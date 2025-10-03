// backend/routes/livepeer.cjs

const express = require('express');
const router = express.Router();
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

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

    const d = response.data;
    console.log('Livepeer API response:', JSON.stringify(d, null, 2));
    res.json({
      id: d.id,
      streamKey: d.streamKey,
      playbackId: d.playbackId,
      rtmpIngestUrl: 'rtmp://rtmp.livepeer.com/live', // Keep for compatibility
    });
  } catch (error) {
    console.error('Livepeer API error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to create stream' });
  }
});

// ✅ Create WebRTC Session - UPDATED with correct Livepeer API
router.post('/create-webrtc-session', async (req, res) => {
  const { streamId, sdp } = req.body;

  if (!streamId || !sdp) {
    return res.status(400).json({ error: 'streamId and sdp are required' });
  }

  try {
    console.log('Creating WebRTC session for stream:', streamId);
    
    // Livepeer WebRTC API endpoint
    const url = `https://livepeer.studio/api/stream/${streamId}/webRTCPlayback`;
    
    const response = await axios.post(
      url,
      { sdp },
      {
        headers: {
          Authorization: `Bearer ${process.env.LIVEPEER_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = response.data;
    console.log('WebRTC session created:', data);
    
    res.json({ 
      sdp: data.sdp,
      raw: data 
    });
  } catch (err) {
    console.error('Livepeer WebRTC error:', err.response?.data || err.message);
    res.status(500).json({ 
      error: 'Failed to create WebRTC session', 
      details: err.response?.data || err.message 
    });
  }
});

// ✅ Alternative: Try the ingest endpoint for publishing
router.post('/create-webrtc-publish', async (req, res) => {
  const { streamId, sdp } = req.body;

  if (!streamId || !sdp) {
    return res.status(400).json({ error: 'streamId and sdp are required' });
  }

  try {
    console.log('Creating WebRTC publish session for stream:', streamId);
    
    // Try different Livepeer endpoints
    const endpoints = [
      `https://livepeer.studio/api/stream/${streamId}/ingest`,
      `https://livepeer.studio/api/stream/${streamId}/webRTCIngest`,
      `https://livepeer.studio/api/stream/${streamId}/publish`
    ];

    let lastError = null;
    
    for (const url of endpoints) {
      try {
        const response = await axios.post(
          url,
          { sdp },
          {
            headers: {
              Authorization: `Bearer ${process.env.LIVEPEER_API_KEY}`,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          }
        );

        const data = response.data;
        console.log('WebRTC publish session created at:', url, data);
        
        return res.json({ 
          sdp: data.sdp,
          endpoint: url,
          raw: data 
        });
      } catch (err) {
        lastError = err;
        console.log(`Endpoint ${url} failed:`, err.response?.status);
        continue;
      }
    }

    throw lastError;
    
  } catch (err) {
    console.error('All WebRTC publish endpoints failed:', err.response?.data || err.message);
    res.status(500).json({ 
      error: 'Failed to create WebRTC publish session', 
      details: err.response?.data || err.message,
      suggestion: 'Check if your Livepeer plan supports WebRTC ingestion'
    });
  }
});

module.exports = router;