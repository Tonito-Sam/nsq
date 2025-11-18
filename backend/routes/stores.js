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
    console.warn('node-fetch is not available; stores route requires fetch.');
  }
}

const router = express.Router();

// POST /api/stores/update-whatsapp-notify
// Body: { store_id, notify_whatsapp: boolean, business_whatsapp_number?: string }
router.post('/update-whatsapp-notify', async (req, res) => {
  try {
    const body = req.body || {};
    const { store_id, notify_whatsapp, business_whatsapp_number } = body;

    if (!store_id) return res.status(400).json({ error: 'missing store_id' });
    if (typeof notify_whatsapp !== 'boolean') return res.status(400).json({ error: 'notify_whatsapp must be boolean' });

    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    let SUPABASE_URL = process.env.SUPABASE_URL || '';
    SUPABASE_URL = SUPABASE_URL.replace(/\/+$/,'');

    if (!SERVICE_ROLE) return res.status(500).json({ error: 'missing SUPABASE_SERVICE_ROLE_KEY on server' });
    if (!fetchFn) return res.status(500).json({ error: 'fetch is not available on the server runtime' });

    // If enabling notify_whatsapp, require a valid E.164 number
    const e164Regex = /^\+[1-9][0-9]{1,14}$/;
    if (notify_whatsapp) {
      const num = (business_whatsapp_number || '').trim();
      if (!num) {
        return res.status(400).json({ error: 'business_whatsapp_number is required when enabling notify_whatsapp' });
      }
      if (!e164Regex.test(num)) {
        return res.status(400).json({ error: 'business_whatsapp_number must be in E.164 format (e.g. +2771xxxxxxx)' });
      }
    }

    // Build update payload
    const updates = { notify_whatsapp };
    if (typeof business_whatsapp_number === 'string') updates.business_whatsapp_number = business_whatsapp_number || null;

    // Call Supabase REST API to update the user_stores row with the service role
    const url = `${SUPABASE_URL}/rest/v1/user_stores?id=eq.${encodeURIComponent(store_id)}`;
    const resp = await fetchFn(url, {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify(updates)
    });

    const text = await resp.text();
    if (!resp.ok) {
      return res.status(502).json({ error: 'supabase update failed', status: resp.status, body: text });
    }

    const json = JSON.parse(text || '[]');
    return res.json({ ok: true, updated: json[0] || null });
  } catch (err) {
    console.error('stores.update-whatsapp-notify error', err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
});

module.exports = router;
