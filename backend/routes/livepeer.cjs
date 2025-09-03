// backend/routes/livepeer.cjs

const express = require('express');
const router = express.Router();
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config(); // Load .env if not already

// ✅ Test Route
router.get('/test', (req, res) => {
  res.send('🎉 Livepeer route is working!');
});

// ✅ Create Livepeer Stream Route
router.post('/create-stream', async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Stream name is required' });
  }

  try {
    const response = await axios.post(
      'https://livepeer.studio/api/stream',
      {
        name,
        profiles: [
          {
            name: '720p',
            bitrate: 2000000,
            fps: 30,
            width: 1280,
            height: 720,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.LIVEPEER_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Log and return the full Livepeer API response for debugging
    const d = response.data;
    console.log('Livepeer API response:', JSON.stringify(d, null, 2));
    res.json({
      rtmpIngestUrl: 'rtmp://rtmp.livepeer.com/live',
      streamKey: d.streamKey || d.stream_key || '',
      playbackId: d.playbackId || d.playback_id || '',
      raw: d
    });
  } catch (error) {
    console.error('Livepeer API error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to create stream' });
  }
});

module.exports = router;
