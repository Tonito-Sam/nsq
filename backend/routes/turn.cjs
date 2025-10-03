const express = require('express');
const router = express.Router();
const { generateTurnCredentials } = require('../utils/turnCreds.cjs');

// GET /api/turn/creds?ttl=3600
router.get('/creds', (req, res) => {
  const secret = process.env.STATIC_TURN_SECRET || process.env.TURN_SECRET || process.env.TURN_PASS;
  if (!secret) return res.status(500).json({ error: 'TURN secret not configured on server' });
  const ttl = req.query.ttl || 3600;
  try {
    const creds = generateTurnCredentials({ secret, ttl });
    // Return TURN URL from config
    const url = process.env.TURN_URL || '';
    res.json({ url, username: creds.username, password: creds.password, ttl: creds.ttl });
  } catch (err) {
    console.error('turn creds error', err);
    res.status(500).json({ error: 'Failed to generate TURN credentials' });
  }
});

module.exports = router;
