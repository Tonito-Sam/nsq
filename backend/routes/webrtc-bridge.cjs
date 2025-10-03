const express = require('express');
const router = express.Router();
const path = require('path');
const bridge = require(path.resolve(__dirname, '..', 'webrtc-rtmp-bridge.cjs'));

// POST /api/webrtc-bridge/create-session
// body: { streamId: string, sdp: string }
// Create a new bridge session; returns { sessionId, sdp }
router.post('/create-session', async (req, res) => {
  const { streamId, sdp } = req.body;
  const LIVEPEER_API_KEY = process.env.LIVEPEER_API_KEY;
  if (!LIVEPEER_API_KEY) {
    return res.status(500).json({ error: 'LIVEPEER_API_KEY not configured on server' });
  }

  if (!streamId || !sdp) return res.status(400).json({ error: 'streamId and sdp required' });

  try {
    const result = await bridge.createSession({ streamId, clientSdp: sdp, livepeerApiKey: LIVEPEER_API_KEY });
    // If bridge signals WebRTC is unavailable, return a 503 with RTMP fallback details
    if (result && result.webrtcUnavailable) {
      return res.status(503).json({
        error: 'webrtc_unavailable',
        message: 'Livepeer WebRTC ingest is not available for this stream. Use RTMP as a fallback.',
        rtmpIngestUrl: result.rtmpIngestUrl,
        streamKey: result.streamKey,
      });
    }

    res.json(result);
  } catch (err) {
    console.error('webrtc-bridge create-session error:', err?.message || err);
    res.status(500).json({ error: 'Bridge error: ' + (err?.message || String(err)) });
  }
});

// Add ICE candidate for an existing session
router.post('/:sessionId/candidate', async (req, res) => {
  const { sessionId } = req.params;
  const { candidate } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
  try {
    await bridge.addCandidate(sessionId, candidate);
    res.json({ ok: true });
  } catch (err) {
    console.error('webrtc-bridge add-candidate error:', err?.message || err);
    res.status(500).json({ error: 'Failed to add candidate' });
  }
});

// Close a session
router.post('/:sessionId/close', (req, res) => {
  const { sessionId } = req.params;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
  try {
    bridge.closeSession(sessionId);
    res.json({ ok: true });
  } catch (err) {
    console.error('webrtc-bridge close error:', err?.message || err);
    res.status(500).json({ error: 'Failed to close session' });
  }
});

module.exports = router;
