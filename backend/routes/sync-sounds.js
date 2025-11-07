const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// POST /api/admin/sync-sounds
// Body/headers:
// - x-sync-secret: must match process.env.SYNC_SECRET (if set)
// This endpoint uses the SUPABASE_SERVICE_ROLE_KEY env var to read the
// soundbank table via Supabase REST and writes a JSON file to ../public/sounds.json
router.post('/sync-sounds', async (req, res) => {
  try {
    const expected = process.env.SYNC_SECRET;
    const provided = req.headers['x-sync-secret'];
    if (expected && provided !== expected) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pfemdshixllwqqajsxxp.supabase.co';

    if (!SERVICE_ROLE) {
      return res.status(500).json({ error: 'missing SUPABASE_SERVICE_ROLE_KEY on server' });
    }

    const url = `${SUPABASE_URL.replace(/\/+$/,'')}/rest/v1/soundbank?select=*&order=id.desc&limit=1000`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json',
      },
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return res.status(502).json({ error: 'failed to read soundbank', status: resp.status, body: txt });
    }

    const rows = await resp.json();

    // Transform rows into the shape you want in public/sounds.json
    const sounds = (Array.isArray(rows) ? rows : []).map((r) => ({
      id: r.id ?? null,
      title: r.title ?? null,
      url: r.url ?? null,
      metadata: r.metadata ?? null,
      created_at: r.created_at ?? null,
    }));

    const outPath = path.join(__dirname, '..', '..', 'public', 'sounds.json');
    fs.writeFileSync(outPath, JSON.stringify(sounds, null, 2), 'utf8');

    return res.json({ ok: true, count: sounds.length, path: outPath });
  } catch (err) {
    console.error('sync-sounds error', err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
});

module.exports = router;
