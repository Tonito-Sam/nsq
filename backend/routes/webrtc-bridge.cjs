const express = require('express');
const router = express.Router();
const path = require('path');
const bridge = require(path.resolve(__dirname, '..', 'webrtc-rtmp-bridge.cjs'));

// POST /api/webrtc-bridge/create-session
// body: { streamId: string, sdp: string }
router.post('/create-session', async (req, res) => {
  const { streamId, sdp } = req.body;
  const LIVEPEER_API_KEY = process.env.LIVEPEER_API_KEY;
  if (!LIVEPEER_API_KEY) {
    return res.status(500).json({ error: 'LIVEPEER_API_KEY not configured on server' });
  }

  try {
    const result = await bridge.handleSession({ streamId, clientSdp: sdp, livepeerApiKey: LIVEPEER_API_KEY });
    res.json(result);
  } catch (err) {
    console.error('webrtc-bridge error:', err?.message || err);
    res.status(500).json({ error: 'Bridge error: ' + (err?.message || String(err)) });
  }
});

module.exports = router;
