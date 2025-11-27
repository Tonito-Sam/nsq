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

    // Prepare payload for Supabase REST insert.
    // The DB migration uses columns: user_id, actor_id, type, object_type, object_id, payload, is_read
    // Map incoming fields to that schema so older callers still work.
    const insertPayload = {
      user_id: body.user_id,
      actor_id: body.actor_id || null,
      type: body.type,
      object_type: body.object_type || body.target_table || null,
      object_id: body.object_id || body.action_id || null,
      payload: Object.assign({}, body.data || {}, { title: body.title || null, message: body.message || null }),
      is_read: body.read === true
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

// GET /api/notifications/list?user_id=<uuid>&unread_only=true
router.get('/list', async (req, res) => {
  try {
    const userId = req.query.user_id;
    if (!userId) return res.status(400).json({ error: 'missing user_id query param' });

    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/,'');
    if (!SERVICE_ROLE) return res.status(500).json({ error: 'missing SUPABASE_SERVICE_ROLE_KEY on server' });
    if (!fetchFn) return res.status(500).json({ error: 'fetch is not available on the server runtime' });

    let url = `${SUPABASE_URL}/rest/v1/notifications?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`;
    if (req.query.unread_only === 'true' || req.query.unread_only === '1') {
      url += '&is_read=eq.false';
    }

    const resp = await fetchFn(url, {
      method: 'GET',
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
      }
    });
    const text = await resp.text();
    if (!resp.ok) return res.status(502).json({ error: 'supabase read failed', status: resp.status, body: text });
    const json = JSON.parse(text || '[]');
    return res.json({ ok: true, notifications: json });
  } catch (err) {
    console.error('notifications.list error', err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
});

// POST /api/notifications/mark-read
// Body: { ids: [<uuid>, ...] } or { id: <uuid> }
router.post('/mark-read', async (req, res) => {
  try {
    const body = req.body || {};
    const ids = Array.isArray(body.ids) ? body.ids : (body.id ? [body.id] : []);
    if (!ids || ids.length === 0) return res.status(400).json({ error: 'missing id(s)' });

    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/,'');
    if (!SERVICE_ROLE) return res.status(500).json({ error: 'missing SUPABASE_SERVICE_ROLE_KEY on server' });
    if (!fetchFn) return res.status(500).json({ error: 'fetch is not available on the server runtime' });

    // Build in clause for REST: id=in.(id1,id2)
    const safeList = ids.map(id => encodeURIComponent(id)).join(',');
    const url = `${SUPABASE_URL}/rest/v1/notifications?id=in.(${safeList})`;

    const resp = await fetchFn(url, {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({ is_read: true })
    });

    const text = await resp.text();
    if (!resp.ok) return res.status(502).json({ error: 'supabase update failed', status: resp.status, body: text });
    const json = JSON.parse(text || '[]');
    return res.json({ ok: true, updated: json });
  } catch (err) {
    console.error('notifications.mark-read error', err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
});
