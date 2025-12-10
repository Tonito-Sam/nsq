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

// Helper: sum amounts in promo_transfers for a user and return current promo balance
async function getPromoBalance(userId) {
  // Default virtual credit
  const BASE = 100;
  if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return BASE;

  try {
    // We expect a table `promo_transfers` to exist with columns: id, from_user_id, to_user_id, amount, created_at
    const url = `${SUPABASE_URL.replace(/\/+$/,'')}/rest/v1/promo_transfers?select=from_user_id,to_user_id,amount&or=(from_user_id.eq.${userId},to_user_id.eq.${userId})`;
    const res = await axios.get(url, { headers: supabaseAuthHeaders() });
    const rows = Array.isArray(res.data) ? res.data : [];
    let net = 0;
    for (const r of rows) {
      if (String(r.to_user_id) === String(userId)) net += Number(r.amount || 0);
      if (String(r.from_user_id) === String(userId)) net -= Number(r.amount || 0);
    }
    return BASE + net;
  } catch (err) {
    console.error('promo:getPromoBalance error:', err.message || err);
    return BASE; // fail open to avoid blocking users if DB/table missing
  }
}

// GET /api/promo/balance/:userId
router.get('/balance/:userId', async (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ error: 'missing userId' });
  try {
    const balance = await getPromoBalance(userId);
    return res.json({ promoBalanceUSD: Number(balance) });
  } catch (err) {
    console.error('promo balance error', err);
    return res.status(500).json({ error: 'could not compute promo balance' });
  }
});

// POST /api/promo/transfer
// body: { from_user_id, to_user_id, amount, note }
router.post('/transfer', async (req, res) => {
  const { from_user_id, to_user_id, amount, note } = req.body || {};
  if (!from_user_id || !to_user_id || !amount) return res.status(400).json({ error: 'missing required fields' });

  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'invalid amount' });

  if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'server missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars' });
  }

  try {
    const available = await getPromoBalance(from_user_id);
    if (amt > available) return res.status(400).json({ error: 'insufficient promo balance', available });

    // Insert into promo_transfers table (expected to exist). Insert single row representing the transfer.
    const url = `${SUPABASE_URL.replace(/\/+$/,'')}/rest/v1/promo_transfers`;
    const payload = {
      from_user_id: from_user_id,
      to_user_id: to_user_id,
      amount: amt,
      note: note || null,
      created_at: new Date().toISOString(),
    };

    const insertRes = await axios.post(url, payload, { headers: supabaseAuthHeaders() });

    return res.json({ success: true, inserted: insertRes.data });
  } catch (err) {
    console.error('promo transfer error', err.response && err.response.data ? err.response.data : err.message || err);
    return res.status(500).json({ error: 'could not complete promo transfer', details: err.response && err.response.data ? err.response.data : String(err.message || err) });
  }
});

module.exports = router;
