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
    console.warn('node-fetch is not available; notifications route requires fetch.');
  }
}

const router = express.Router();

// POST /api/notifications/create
// Body: { user_id, actor_id, type, title, message, action_id?, target_table?, data? }
// Header: x-service-secret optional - if set on server, must match process.env.NOTIFICATIONS_SECRET
router.post('/create', async (req, res) => {
  try {
    const expectedSecret = process.env.NOTIFICATIONS_SECRET;
    const provided = req.headers['x-service-secret'];
    if (expectedSecret && provided !== expectedSecret) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/,'');

    if (!SERVICE_ROLE) {
      return res.status(500).json({ error: 'missing SUPABASE_SERVICE_ROLE_KEY on server' });
    }

    if (!fetchFn) return res.status(500).json({ error: 'fetch is not available on the server runtime' });

    const body = req.body || {};
    const required = ['user_id','type'];
    for (const f of required) {
      if (!body[f]) return res.status(400).json({ error: `missing field ${f}` });
    }

    // Prepare payload for Supabase REST insert
    const insertPayload = {
      user_id: body.user_id,
      actor_id: body.actor_id || null,
      type: body.type,
      title: body.title || null,
      message: body.message || null,
      action_id: body.action_id || null,
      target_table: body.target_table || null,
      data: body.data || {},
      read: false
    };

    const url = `${SUPABASE_URL}/rest/v1/notifications`;
    const resp = await fetchFn(url, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify(insertPayload),
    });

    const text = await resp.text();
    if (!resp.ok) {
      return res.status(502).json({ error: 'supabase insert failed', status: resp.status, body: text });
    }

    const json = JSON.parse(text || '[]');
    return res.json({ ok: true, inserted: json[0] || null });
  } catch (err) {
    console.error('notifications.create error', err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
});

module.exports = router;
