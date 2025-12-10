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
    console.warn('node-fetch is not available; post-views route requires fetch.');
  }
}

const router = express.Router();

// POST /api/post-views
// Body: { post_id, user_id }
router.post('/', async (req, res) => {
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
  console.log('POST /api/post-views body:', body);
  if (!body.post_id || !body.user_id) return res.status(400).json({ error: 'missing post_id or user_id' });

    const payload = { post_id: body.post_id, user_id: body.user_id };

    // Use Supabase REST upsert via on_conflict and Prefer header
    const url = `${SUPABASE_URL}/rest/v1/post_views?on_conflict=user_id,post_id`;
    const resp = await fetchFn(url, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify(payload),
    });

    const text = await resp.text();
    console.log('Supabase post_views response status:', resp.status, 'body:', text);
    if (!resp.ok) {
      return res.status(502).json({ error: 'supabase insert failed', status: resp.status, body: text });
    }

    const json = JSON.parse(text || '[]');
    // After recording unique view, also increment total impressions (posts.views_count)
    try {
      const rpcUrl = `${SUPABASE_URL}/rest/v1/rpc/increment_post_views`;
      const rpcResp = await fetchFn(rpcUrl, {
        method: 'POST',
        headers: {
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ pid: body.post_id })
      });
      const rpcText = await rpcResp.text();
      if (!rpcResp.ok) {
        console.warn('increment_post_views RPC failed', rpcResp.status, rpcText);
      } else {
        console.log('increment_post_views RPC ok');
      }
    } catch (rpcErr) {
      console.error('increment_post_views error', rpcErr);
    }

    return res.json({ ok: true, inserted: json[0] || null });
  } catch (err) {
    console.error('post-views.create error', err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
});

module.exports = router;

// GET /api/post-views?post_id=<id>&limit=<n>&recent_only=true
router.get('/', async (req, res) => {
  try {
    const postId = req.query.post_id;
    if (!postId) return res.status(400).json({ error: 'missing post_id query param' });

    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/,'');
    if (!SERVICE_ROLE) return res.status(500).json({ error: 'missing SUPABASE_SERVICE_ROLE_KEY on server' });
    if (!fetchFn) return res.status(500).json({ error: 'fetch is not available on the server runtime' });

    // Return total impressions from posts.views_count if available.
    // limit parameter still controls recent viewers fetch from post_views table.
    const limit = parseInt(req.query.limit || '0', 10);

    // Read posts.views_count
    const postUrl = `${SUPABASE_URL}/rest/v1/posts?select=views_count&id=eq.${encodeURIComponent(postId)}`;
    const postResp = await fetchFn(postUrl, {
      method: 'GET',
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
      }
    });
    const postText = await postResp.text();
    if (!postResp.ok) return res.status(502).json({ error: 'supabase posts read failed', status: postResp.status, body: postText });
    const postJson = JSON.parse(postText || '[]');
    const views_count = Array.isArray(postJson) && postJson[0] && typeof postJson[0].views_count !== 'undefined' ? Number(postJson[0].views_count) : 0;

    let viewers = [];
    if (limit > 0) {
      // Fetch recent viewers with user info join
      const viewersUrl = `${SUPABASE_URL}/rest/v1/post_views?post_id=eq.${encodeURIComponent(postId)}&select=user_id,users:users!post_views_user_id_fkey(id,first_name,last_name,username,avatar_url)&order=created_at.desc&limit=${limit}`;
      const viewersResp = await fetchFn(viewersUrl, {
        method: 'GET',
        headers: {
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
        }
      });
      const viewersText = await viewersResp.text();
      if (!viewersResp.ok) return res.status(502).json({ error: 'supabase viewers read failed', status: viewersResp.status, body: viewersText });
      viewers = JSON.parse(viewersText || '[]');
    }

    return res.json({ ok: true, count: views_count, viewers });
  } catch (err) {
    console.error('post-views.list error', err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
});
