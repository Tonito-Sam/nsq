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

async function authenticate(req) {
  const accessToken = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!SUPABASE_URL || !accessToken) {
    const error = new Error('Sign in to continue');
    error.status = 401;
    throw error;
  }
  const { data } = await axios.get(`${SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/user`, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return data;
}

async function callRpc(name, body) {
  const { data } = await axios.post(`${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/rpc/${name}`, body, {
    headers: supabaseAuthHeaders(),
  });
  return data;
}

function sendError(res, error, fallback) {
  const status = error.status || (error.response?.data?.code === 'P0001' ? 400 : error.response?.status || 500);
  const message = error.status ? error.message : error.response?.data?.message || fallback;
  if (status >= 500) console.error(fallback, error.response?.data || error.message);
  return res.status(status).json({ error: message });
}

// POST /api/campaigns - create and charge a campaign atomically
router.post('/', async (req, res) => {
  try {
    const user = await authenticate(req);
    const body = req.body || {};
    const budget = Number(body.budget_usd);
    const days = Number(body.days || 1);
    const reference = String(body.reference || '');
    const postId = body.post_id || null;
    if (!Number.isFinite(budget) || budget <= 0 || budget > 100000 || !Number.isInteger(days) || days < 1 || days > 365 || !/^[A-Za-z0-9-]{12,80}$/.test(reference)) {
      return res.status(400).json({ error: 'Enter a valid campaign budget, duration, and reference' });
    }
    if (postId && !/^[0-9a-f-]{36}$/i.test(postId)) return res.status(400).json({ error: 'Invalid post id' });
    if (body.target_options != null && (typeof body.target_options !== 'object' || Array.isArray(body.target_options))) {
      return res.status(400).json({ error: 'Invalid campaign targeting options' });
    }

    const result = await callRpc('wallet_create_campaign', {
      p_user_id: user.id,
      p_reference: reference,
      p_post_id: postId,
      p_name: String(body.name || '').slice(0, 200),
      p_objective: String(body.objective || 'general').slice(0, 60),
      p_budget_usd: budget,
      p_days: days,
      p_start_at: body.start_at || null,
      p_end_at: body.end_at || null,
      p_target_options: body.target_options || null,
    });
    return res.json({ success: true, ...result });
  } catch (err) {
    return sendError(res, err, 'Could not create campaign');
  }
});

// GET /api/campaigns - list campaigns for the signed-in user
router.get('/', async (req, res) => {
  try {
    const user = await authenticate(req);
    const url = `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/campaigns?user_id=eq.${encodeURIComponent(user.id)}&order=created_at.desc`;
    const listRes = await axios.get(url, { headers: supabaseAuthHeaders() });
    return res.json({ campaigns: listRes.data || [] });
  } catch (err) {
    return sendError(res, err, 'Could not list campaigns');
  }
});

// GET /api/campaigns/:id
router.get('/:id', async (req, res) => {
  const id = req.params.id;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Invalid campaign id' });
  try {
    const user = await authenticate(req);
    const url = `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/campaigns?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}`;
    const resp = await axios.get(url, { headers: supabaseAuthHeaders() });
    const row = Array.isArray(resp.data) ? resp.data[0] : resp.data;
    if (!row) return res.status(404).json({ error: 'Campaign not found' });
    return res.json({ campaign: row || null });
  } catch (err) {
    return sendError(res, err, 'Could not get campaign');
  }
});

// PATCH /api/campaigns/:id -- update safe campaign settings
router.patch('/:id', async (req, res) => {
  const id = req.params.id;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Invalid campaign id' });
  try {
    const user = await authenticate(req);
    const body = req.body || {};
    const patch = {};
    for (const key of ['name', 'target_options', 'start_at', 'end_at']) {
      if (Object.hasOwn(body, key)) patch[key] = body[key];
    }
    if (Object.hasOwn(body, 'status')) {
      if (!['active', 'paused'].includes(body.status)) return res.status(400).json({ error: 'Invalid campaign status' });
      patch.status = body.status;
    }
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'No editable campaign fields provided' });
    patch.updated_at = new Date().toISOString();
    const url = `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/campaigns?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}`;
    const patchRes = await axios.patch(url, patch, { headers: { ...supabaseAuthHeaders(), Prefer: 'return=representation' } });
    if (!patchRes.data?.length) return res.status(404).json({ error: 'Campaign not found' });
    return res.json({ success: true, updated: patchRes.data });
  } catch (err) {
    return sendError(res, err, 'Could not update campaign');
  }
});

// DELETE /api/campaigns/:id -- cancel and refund remaining budget atomically
router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Invalid campaign id' });
  const refund = req.query.refund !== 'false';
  try {
    const user = await authenticate(req);
    const result = await callRpc('wallet_cancel_campaign', {
      p_user_id: user.id,
      p_campaign_id: id,
      p_refund: refund,
    });
    return res.json({ success: true, ...result, cancelled: true });
  } catch (err) {
    return sendError(res, err, 'Could not cancel campaign');
  }
});

module.exports = router;
