// proxy-server.js
// You can deploy this separately on a service like Render, Railway, or Heroku (free tiers)

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

// Enable CORS for your frontend domain
app.use(cors({
    origin: 'https://downoad-free-insta-reels.vercel.app/' || '*'
}));

app.get('/proxy', async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }

    try {
        // Forward all headers from the request
        const headers = {
            "x-ig-app-id": "936619743392459",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.94 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9,ru;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept": "*/*",
            "Origin": "https://www.instagram.com",
            "Referer": "https://www.instagram.com/"
        };

        const response = await axios.get(url, { headers });
        res.json(response.data);
    } catch (error) {
        console.error('Proxy error:', error);

        if (error.response) {
            return res.status(error.response.status).json({
                error: 'Proxy request failed',
                status: error.response.status,
                data: error.response.data
            });
        }

        res.status(500).json({
            error: error.message || 'Unknown error occurred'
        });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Proxy server running on port ${PORT}`);
});