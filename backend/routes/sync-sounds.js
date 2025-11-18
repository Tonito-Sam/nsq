const express = require('express');
// Prefer the global fetch (Node 18+). If not available, try to require node-fetch
let fetchFn;
if (typeof fetch !== 'undefined') {
  fetchFn = fetch;
} else {
  try {
    // node-fetch v3 is ESM; require returns an object with a default property in some setups
    const nf = require('node-fetch');
    fetchFn = nf && nf.default ? nf.default : nf;
  } catch (e) {
    // leave fetchFn undefined; we'll surface a clear error later if it's needed
    fetchFn = undefined;
    console.warn('node-fetch is not available and global fetch is undefined. sync-sounds will fail if fetch is required.');
  }
}
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
    if (!fetchFn) return res.status(500).json({ error: 'fetch is not available on the server runtime' });

    const resp = await fetchFn(url, {
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

    // Try to upload the generated JSON to Supabase Storage for durability.
    // Requires SUPABASE_SERVICE_ROLE_KEY in env and optional SUPABASE_URL.
    try {
      const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://pfemdshixllwqqajsxxp.supabase.co').replace(/\/+$/,'');
      const BUCKET = process.env.SUPABASE_SOUND_BUCKET || 'sound-bank';
      if (SERVICE_ROLE) {
        const uploadPath = 'sounds.json';
        const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(BUCKET)}/${encodeURIComponent(uploadPath)}`;

        const putRes = await fetchFn(uploadUrl, {
          method: 'PUT',
          headers: {
            apikey: SERVICE_ROLE,
            Authorization: `Bearer ${SERVICE_ROLE}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(sounds),
        });

        if (!putRes.ok) {
          const txt = await putRes.text();
          console.warn('Supabase storage upload failed', putRes.status, txt);
        }

        // Construct the public URL (works if bucket is public)
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(BUCKET)}/${encodeURIComponent(uploadPath)}`;

        // Try to create a signed URL (fallback if bucket is private)
        let signedUrl = null;
        try {
          const signUrl = `${SUPABASE_URL}/storage/v1/object/sign/${encodeURIComponent(BUCKET)}/${encodeURIComponent(uploadPath)}`;
          const signResp = await fetchFn(signUrl, {
            method: 'POST',
            headers: {
              apikey: SERVICE_ROLE,
              Authorization: `Bearer ${SERVICE_ROLE}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ expiresIn: 60 * 60 * 24 }),
          });
          if (signResp.ok) {
            const signJson = await signResp.json();
            signedUrl = signJson?.signedURL || signJson?.signedUrl || null;
          } else {
            const txt = await signResp.text();
            console.warn('Could not create signed URL', signResp.status, txt);
          }
        } catch (e) {
          console.warn('Signed URL generation failed', e?.message || e);
        }

        return res.json({ ok: true, count: sounds.length, path: outPath, publicUrl, signedUrl });
      }
    } catch (e) {
      console.warn('Upload to Supabase failed', e?.message || e);
    }

    return res.json({ ok: true, count: sounds.length, path: outPath });
  } catch (err) {
    console.error('sync-sounds error', err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
});

module.exports = router;
