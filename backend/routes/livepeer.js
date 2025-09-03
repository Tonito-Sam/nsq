const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

// POST /api/livepeer/create-stream
router.post('/create-stream', async (req, res) => {
  const { name } = req.body;
  const apiKey = process.env.LIVEPEER_API_KEY;
  try {
    const response = await fetch('https://livepeer.studio/api/stream', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create stream', details: err.message });
  }
});

module.exports = router;
