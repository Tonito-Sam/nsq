const express = require('express');
const router = express.Router();
const { generateTurnCredentials } = require('../utils/turnCreds.cjs');

// GET /api/turn/creds?ttl=3600
router.get('/creds', (req, res) => {
  // If static TURN_USER/TURN_PASS are configured, return them directly (useful for public/free TURN)
  const staticUrl = process.env.TURN_URL;
  const staticUser = process.env.TURN_USER;
  const staticPass = process.env.TURN_PASS;
  const ttl = req.query.ttl || 3600;

  if (staticUrl && staticUser && staticPass) {
    return res.json({ url: staticUrl, username: staticUser, password: staticPass, ttl: Number(ttl) });
  }

  const secret = process.env.STATIC_TURN_SECRET || process.env.TURN_SECRET || process.env.TURN_PASS;
  if (!secret) return res.status(500).json({ error: 'TURN secret not configured on server' });

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
