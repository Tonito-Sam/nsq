const express = require('express');
const axios = require('axios');

const router = express.Router();

function supabaseAuthHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

const SUPABASE_URL = process.env.SUPABASE_URL;

// GET /api/users/search?q=term
router.get('/search', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'server missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars' });
  }

  try {
    // If no query provided, return a small recent user list (limit 8)
    let url;
    if (!q) {
      url = `${SUPABASE_URL.replace(/\/+$/,'')}/rest/v1/users?select=id,username,full_name,email,avatar_url&order=created_at.desc&limit=8`;
    } else {
      const encoded = encodeURIComponent(`%${q}%`);
      url = `${SUPABASE_URL.replace(/\/+$/,'')}/rest/v1/users?select=id,username,full_name,email,avatar_url&or=username.ilike.${encoded},full_name.ilike.${encoded},email.ilike.${encoded}&limit=8`;
    }

    let resp = await axios.get(url, { headers: supabaseAuthHeaders() });
    let rows = Array.isArray(resp.data) ? resp.data : [];

    // If no rows returned from 'users' (common when usernames are stored in 'profiles'),
    // try the `profiles` table as a fallback.
    if ((!rows || rows.length === 0) && SUPABASE_URL) {
      try {
        let profileUrl;
        if (!q) {
          profileUrl = `${SUPABASE_URL.replace(/\/+$/,'')}/rest/v1/profiles?select=id,username,full_name,email,avatar_url&order=created_at.desc&limit=8`;
        } else {
          const encoded = encodeURIComponent(`%${q}%`);
          profileUrl = `${SUPABASE_URL.replace(/\/+$/,'')}/rest/v1/profiles?select=id,username,full_name,email,avatar_url&or=username.ilike.${encoded},full_name.ilike.${encoded},email.ilike.${encoded}&limit=8`;
        }
        const resp2 = await axios.get(profileUrl, { headers: supabaseAuthHeaders() });
        const rows2 = Array.isArray(resp2.data) ? resp2.data : [];
        if (rows2 && rows2.length > 0) rows = rows2;
      } catch (pfErr) {
        console.warn('users:search fallback to profiles failed', pfErr && pfErr.response ? pfErr.response.data : pfErr.message || pfErr);
      }
    }

    return res.json({ data: rows });
  } catch (err) {
    console.error('users:search error', err.response && err.response.data ? err.response.data : err.message || err);
    return res.status(500).json({ error: 'search failed' });
  }
});

module.exports = router;

// POST /api/users/delete
// Body: { id: string, reason?: string }
router.post('/delete', async (req, res) => {
  const { id, reason } = req.body || {};
  if (!id) return res.status(400).json({ error: 'missing user id' });
  if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'server missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars' });
  }

  try {
    // Delete from users table via REST API
    const usersUrl = `${SUPABASE_URL.replace(/\/+$/,'')}/rest/v1/users?id=eq.${encodeURIComponent(id)}`;
    await axios.delete(usersUrl, { headers: supabaseAuthHeaders() });

    // Optionally store deletion reason in an audit table (best-effort)
    try {
      const auditUrl = `${SUPABASE_URL.replace(/\/+$/,'')}/rest/v1/user_deletion_reasons`;
      await axios.post(auditUrl, { user_id: id, reason: reason || null, created_at: new Date().toISOString() }, { headers: supabaseAuthHeaders() });
    } catch (auditErr) {
      // ignore audit failures
      console.warn('audit insert failed', auditErr && auditErr.response ? auditErr.response.data : auditErr.message || auditErr);
    }

    // Delete from Supabase Auth (admin)
    const authUrl = `${SUPABASE_URL.replace(/\/+$/,'')}/auth/v1/admin/users/${encodeURIComponent(id)}`;
    await axios.delete(authUrl, { headers: supabaseAuthHeaders() });

    return res.json({ ok: true });
  } catch (err) {
    console.error('users:delete error', err && err.response ? err.response.data : err.message || err);
    return res.status(500).json({ error: 'failed to delete user' });
  }
});
