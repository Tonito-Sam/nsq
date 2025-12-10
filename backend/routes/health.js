const express = require('express');
let fetchFn;
if (typeof fetch !== 'undefined') {
  fetchFn = fetch;
} else {
  try {
    const nf = require('node-fetch');
    fetchFn = nf && nf.default ? nf.default : nf;
  } catch (e) {
    fetchFn = undefined;
    console.warn('node-fetch is not available; health route requires fetch.');
  }
}

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/,'');
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';

    if (!SUPABASE_URL) return res.status(500).json({ ok: false, error: 'SUPABASE_URL not set' });
    if (!fetchFn) return res.status(500).json({ ok: false, error: 'fetch not available on server runtime' });

    // Probe Supabase REST with a simple read (posts id)
    const probeUrl = `${SUPABASE_URL}/rest/v1/posts?select=id&limit=1`;
    const start = Date.now();
    const resp = await fetchFn(probeUrl, {
      method: 'GET',
      headers: SERVICE_ROLE ? { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } : {}
    });
    const elapsed = Date.now() - start;
    const text = await resp.text().catch(() => '');

    return res.json({ ok: true, supabase: { status: resp.status, elapsed_ms: elapsed, body_preview: text ? text.substr(0,500) : '' } });
  } catch (err) {
    console.error('health fetch error', err);
    return res.status(502).json({ ok: false, error: err?.message || String(err), cause: err?.cause && err.cause.message ? err.cause.message : undefined });
  }
});

module.exports = router;
