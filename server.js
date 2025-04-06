// backend/server.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Configure CORS
app.use(cors({
    // origin: 'https://insta-download-six.vercel.app/' || 'http://localhost:3000',
    origin: '*',
    credentials: true
}));

app.use(express.json());

// Main profile info endpoint
app.get('/api/instagram-profile', async (req, res) => {
    try {
        const { username } = req.query;

        if (!username) {
            return res.status(400).json({ error: 'Username is required' });
        }

        console.log(`Fetching profile for username: ${username}`);

        // Get base profile data
        const response = await axios.get(
            `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
            {
                headers: getInstagramHeaders()
            }
        );

        // Extract user data
        const userData = response.data.data.user;

        // Format the basic profile data
        const formattedData = {
            username: userData.username,
            full_name: userData.full_name,
            biography: userData.biography,
            profile_pic_url: userData.profile_pic_url_hd,
            external_url: userData.external_url,
            posts: userData.edge_owner_to_timeline_media.count,
            followers: userData.edge_followed_by.count,
            following: userData.edge_follow.count,
            is_private: userData.is_private,
            is_verified: userData.is_verified,
            user_id: userData.id,

            // Add the first 12 posts/media
            recent_posts: formatMediaItems(userData.edge_owner_to_timeline_media.edges)
        };

        res.json(formattedData);
    } catch (error) {
        handleError(error, res);
    }
});

// Get user media (posts, reels) with pagination
app.get('/api/instagram-media', async (req, res) => {
    try {
        const { user_id, end_cursor } = req.query;

        if (!user_id) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        console.log(`Fetching media for user_id: ${user_id}`);

        // GraphQL query to get user media
        const variables = {
            id: user_id,
            first: 12,
            after: end_cursor || null
        };

        const response = await axios.get(
            `https://www.instagram.com/graphql/query/?query_hash=e769aa130647d2354c40ea6a439bfc08&variables=${encodeURIComponent(JSON.stringify(variables))}`,
            {
                headers: getInstagramHeaders()
            }
        );

        const mediaData = response.data.data.user.edge_owner_to_timeline_media;

        res.json({
            media: formatMediaItems(mediaData.edges),
            page_info: mediaData.page_info,
            count: mediaData.count
        });
    } catch (error) {
        handleError(error, res);
    }
});

// Get stories for a user
app.get('/api/instagram-stories', async (req, res) => {
    try {
        const { user_id } = req.query;

        if (!user_id) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        console.log(`Fetching stories for user_id: ${user_id}`);

        // Get user stories
        const response = await axios.get(
            `https://i.instagram.com/api/v1/feed/user/${user_id}/story/`,
            {
                headers: getInstagramHeaders()
            }
        );

        // Format stories data
        let stories = [];
        if (response.data.reel) {
            stories = response.data.reel.items.map(item => ({
                id: item.id,
                taken_at: item.taken_at,
                expiring_at: item.expiring_at,
                media_type: item.media_type,
                image_url: item.media_type === 1 ? item.image_versions2?.candidates[0]?.url : null,
                video_url: item.media_type === 2 ? item.video_versions?.[0]?.url : null,
                duration: item.media_type === 2 ? item.video_duration : null,
                has_audio: item.media_type === 2 ? item.has_audio : false
            }));
        }

        res.json({
            user_id,
            stories,
            has_stories: stories.length > 0
        });
    } catch (error) {
        // If 404 (no stories), return empty array, not error
        if (error.response && error.response.status === 404) {
            res.json({
                user_id,
                stories: [],
                has_stories: false
            });
        } else {
            handleError(error, res);
        }
    }
});

// Get reels for a user
app.get('/api/instagram-reels', async (req, res) => {
    try {
        const { user_id, page_size = 12, max_id } = req.query;

        if (!user_id) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        console.log(`Fetching reels for user_id: ${user_id}`);

        // API endpoint for reels
        const url = `https://i.instagram.com/api/v1/clips/user/`;
        const params = {
            target_user_id: user_id,
            page_size,
            include_feed_video: true,
            max_id
        };

        const response = await axios.get(url, {
            params,
            headers: getInstagramHeaders()
        });

        // Format reels data
        const reels = response.data.items.map(item => ({
            id: item.media.id,
            code: item.media.code,
            thumbnail_url: item.media.image_versions2?.candidates[0]?.url,
            video_url: item.media.video_versions?.[0]?.url,
            view_count: item.media.view_count,
            play_count: item.media.play_count,
            caption: item.media.caption?.text,
            duration: item.media.video_duration,
            created_at: item.media.taken_at
        }));

        res.json({
            reels,
            has_more: response.data.paging_info.more_available,
            next_max_id: response.data.paging_info.max_id
        });
    } catch (error) {
        handleError(error, res);
    }
});

// Helper function to format media items
function formatMediaItems(edges) {
    return edges.map(edge => {
        const node = edge.node;
        return {
            id: node.id,
            shortcode: node.shortcode,
            display_url: node.display_url,
            thumbnail_src: node.thumbnail_src,
            is_video: node.is_video,
            video_url: node.is_video ? node.video_url : null,
            accessibility_caption: node.accessibility_caption,
            caption: node.edge_media_to_caption?.edges[0]?.node?.text || '',
            likes: node.edge_media_preview_like?.count,
            comments: node.edge_media_to_comment?.count,
            timestamp: node.taken_at_timestamp,
            location: node.location?.name,
            dimensions: {
                height: node.dimensions.height,
                width: node.dimensions.width
            },
            is_reel: node.__typename === "GraphVideo" && node.product_type === "clips"
        };
    });
}

// Helper function to get Instagram headers
function getInstagramHeaders() {
    return {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json',
        'Cookie': process.env.INSTAGRAM_COOKIE,
        'X-IG-App-ID': process.env.INSTAGRAM_APP_ID,
        'X-IG-WWW-Claim': '0',
        'Origin': 'https://www.instagram.com',
        'Referer': 'https://www.instagram.com/'
    };
}

// Helper function to handle errors
function handleError(error, res) {
    console.error('Error in Instagram API request:', error.message);

    if (error.response) {
        console.error('Error response:', {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data
        });
    }

    res.status(error.response?.status || 500).json({
        error: 'Failed to fetch Instagram data',
        message: error.response?.data?.message || error.message
    });
}

// Simple test route
app.get('/api/test', (req, res) => {
    res.json({
        message: 'Backend server is working!',
        instagram_cookie_set: !!process.env.INSTAGRAM_COOKIE,
        instagram_app_id_set: !!process.env.INSTAGRAM_APP_ID
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`CORS configured for origin: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
});