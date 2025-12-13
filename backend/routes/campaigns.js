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

// Minimum daily pricing enforcement (server-side)
const BOOST_DAILY = 0.75; // $0.75 per day for boosts
const AD_DAILY = 1.0; // $1.00 per day for ad campaigns

// Helper: get wallet for user
async function getWallet(userId) {
  const url = `${SUPABASE_URL.replace(/\/+$/,'')}/rest/v1/wallets?user_id=eq.${userId}`;
  const res = await axios.get(url, { headers: supabaseAuthHeaders() });
  const rows = Array.isArray(res.data) ? res.data : [];
  return rows[0] || null;
}

// POST /api/campaigns - create a campaign and charge wallet (virtual-first, fallback to real)
router.post('/', async (req, res) => {
  const body = req.body || {};
  const { user_id, post_id, name, budget_usd, start_at, end_at, target_options } = body;
  if (!user_id || !budget_usd) return res.status(400).json({ error: 'missing user_id or budget_usd' });

  if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'server missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars' });
  }

  const budget = Number(budget_usd || 0);
  const days = Number(body.days || 1);
  const dailyBudget = budget / Math.max(1, days);
  // server-side enforcement of minimum daily rates
  const objectiveType = post_id ? 'boost_post' : (body.objective || 'general');
  if (objectiveType === 'boost_post') {
    if (dailyBudget < BOOST_DAILY) return res.status(400).json({ error: 'daily_budget_too_low', message: `Boost daily budget must be at least $${BOOST_DAILY.toFixed(2)} per day.` });
  } else {
    if (dailyBudget < AD_DAILY) return res.status(400).json({ error: 'daily_budget_too_low', message: `Ad campaign daily budget must be at least $${AD_DAILY.toFixed(2)} per day.` });
  }
  if (!Number.isFinite(budget) || budget <= 0) return res.status(400).json({ error: 'invalid budget_usd' });

  try {
    const wallet = await getWallet(user_id);
    if (!wallet) return res.status(400).json({ error: 'wallet not found for user' });

    const virtual = Number(wallet.virtual_balance || 0);
    const real = Number(wallet.real_balance || 0);

    const chargeFromVirtual = Math.min(virtual, budget);
    const remaining = +(budget - chargeFromVirtual).toFixed(2);

    if (remaining > 0 && remaining > real) {
      return res.status(400).json({ error: 'insufficient total balance', available_virtual: virtual, available_real: real, required: budget });
    }

    // Perform wallet update: deduct virtual and real accordingly
    const newVirtual = +(virtual - chargeFromVirtual).toFixed(2);
    const newReal = +(real - remaining).toFixed(2);
    const newTotal = +(newVirtual + newReal).toFixed(2);

    const walletsUrl = `${SUPABASE_URL.replace(/\/+$/,'')}/rest/v1/wallets`;

    // PATCH wallet (by user_id) - request representation back for verification
    const patchRes = await axios.patch(`${walletsUrl}?user_id=eq.${user_id}`, {
      virtual_balance: newVirtual,
      real_balance: newReal,
      total_balance: newTotal,
      updated_at: new Date().toISOString()
    }, { headers: { ...supabaseAuthHeaders(), Prefer: 'return=representation' } });

    // If wallet update succeeded, create campaign and ad_transaction
    const campaignsUrl = `${SUPABASE_URL.replace(/\/+$/,'')}/rest/v1/campaigns`;
    const adtxUrl = `${SUPABASE_URL.replace(/\/+$/,'')}/rest/v1/ad_transactions`;

    // Create campaign
    const campaignPayload = {
      user_id,
      post_id: post_id || null,
      name: name || `Campaign ${Date.now()}`,
      objective: post_id ? 'boost_post' : 'general',
      budget_usd: budget,
      spent_usd: 0,
      status: 'active',
      start_at: start_at || new Date().toISOString(),
      end_at: end_at || null,
      target_options: target_options || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Create campaign and request the created row back
    const createCampaignRes = await axios.post(campaignsUrl, campaignPayload, { headers: { ...supabaseAuthHeaders(), Prefer: 'return=representation' } });
    const createdCampaign = Array.isArray(createCampaignRes.data) ? createCampaignRes.data[0] : createCampaignRes.data;

    // Validate created campaign
    if (!createdCampaign || !createdCampaign.id) {
      console.error('campaign creation did not return a created row', createCampaignRes.data);
      return res.status(500).json({ error: 'campaign creation failed - no created id returned', details: createCampaignRes.data });
    }

    // Record ad transaction
    const txPayload = {
      campaign_id: createdCampaign.id,
      user_id,
      amount_usd: budget,
      amount_virtual_charged: chargeFromVirtual,
      amount_real_charged: remaining,
      type: 'charge',
      meta: { note: 'Campaign purchase' },
      created_at: new Date().toISOString()
    };

    await axios.post(adtxUrl, txPayload, { headers: supabaseAuthHeaders() });

    return res.json({ success: true, campaign: createdCampaign, charged: { virtual: chargeFromVirtual, real: remaining } });
  } catch (err) {
    console.error('campaign create error', err.response && err.response.data ? err.response.data : err.message || err);

    // If the error indicates the `wallets` table is missing, return a clearer message
    const pgErr = err.response && err.response.data ? err.response.data : err;
    if (pgErr && (pgErr.code === '42P01' || (pgErr.message && pgErr.message.includes('relation "public.wallets" does not exist')))) {
      console.error('Missing wallets table detected. Please run the migrations to create `wallets`.');
      return res.status(500).json({ error: 'missing_table_wallets', message: 'The database table `wallets` does not exist. Run the migrations or create the table in Supabase.' , details: pgErr });
    }

    // Attempt to rollback wallet patch if we partially updated
    try {
      // fetch current wallet and attempt to restore by adding back amounts if necessary
      // NOTE: This is a best-effort compensating action.
      // In practice, wrap operations in a DB transaction for atomicity.
      const walletNow = await getWallet(user_id);
      if (walletNow) {
        // compute if we reduced the wallet and need to restore - naive best-effort
        // (we don't have original values here, so skip complex rollback to avoid risk)
      }
    } catch (e) {
      console.error('rollback attempt failed', e && e.response ? e.response.data : e.message || e);
    }

    return res.status(500).json({ error: 'could not create campaign', details: err.response && err.response.data ? err.response.data : String(err.message || err) });
  }
});

// GET /api/campaigns?user_id=...
router.get('/', async (req, res) => {
  const userId = req.query.user_id;
  if (!userId) return res.status(400).json({ error: 'missing user_id' });
  try {
    const url = `${SUPABASE_URL.replace(/\/+$/,'')}/rest/v1/campaigns?user_id=eq.${userId}&order=created_at.desc`;
    const listRes = await axios.get(url, { headers: supabaseAuthHeaders() });
    return res.json({ campaigns: listRes.data || [] });
  } catch (err) {
    console.error('campaign list error', err && err.response ? err.response.data : err.message || err);
    return res.status(500).json({ error: 'could not list campaigns' });
  }
});

// GET /api/campaigns/:id
router.get('/:id', async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: 'missing id' });
  try {
    const url = `${SUPABASE_URL.replace(/\/+$/,'')}/rest/v1/campaigns?id=eq.${id}`;
    const resp = await axios.get(url, { headers: supabaseAuthHeaders() });
    const row = Array.isArray(resp.data) ? resp.data[0] : resp.data;
    return res.json({ campaign: row || null });
  } catch (err) {
    console.error('campaign get error', err && err.response ? err.response.data : err.message || err);
    return res.status(500).json({ error: 'could not get campaign' });
  }
});

// PATCH /api/campaigns/:id -- update (e.g., pause/resume or change budget)
router.patch('/:id', async (req, res) => {
  const id = req.params.id;
  const body = req.body || {};
  if (!id) return res.status(400).json({ error: 'missing id' });
  try {
    const url = `${SUPABASE_URL.replace(/\/+$/,'')}/rest/v1/campaigns?id=eq.${id}`;
    const patchRes = await axios.patch(url, { ...body, updated_at: new Date().toISOString() }, { headers: supabaseAuthHeaders() });
    return res.json({ success: true, updated: patchRes.data });
  } catch (err) {
    console.error('campaign patch error', err && err.response ? err.response.data : err.message || err);
    return res.status(500).json({ error: 'could not update campaign' });
  }
});

// DELETE /api/campaigns/:id -- cancel and (optionally) refund remaining budget
router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  const { refund = 'true' } = req.query;
  if (!id) return res.status(400).json({ error: 'missing id' });
  try {
    // fetch campaign
    const campUrl = `${SUPABASE_URL.replace(/\/+$/,'')}/rest/v1/campaigns?id=eq.${id}`;
    const campRes = await axios.get(campUrl, { headers: supabaseAuthHeaders() });
    const camp = Array.isArray(campRes.data) ? campRes.data[0] : campRes.data;
    if (!camp) return res.status(404).json({ error: 'campaign not found' });

    // compute remaining = budget - spent
    const budget = Number(camp.budget_usd || 0);
    const spent = Number(camp.spent_usd || 0);
    const remaining = Math.max(0, +(budget - spent).toFixed(2));

    // delete campaign (or mark cancelled)
    const deleteUrl = `${SUPABASE_URL.replace(/\/+$/,'')}/rest/v1/campaigns?id=eq.${id}`;
    await axios.patch(deleteUrl, { status: 'cancelled', updated_at: new Date().toISOString() }, { headers: supabaseAuthHeaders() });

    // refund if requested and amount > 0
    if (refund === 'true' && remaining > 0) {
      // Determine refund routing. By default we refund to the original source(s) used to pay
      // the campaign. Caller may override with ?refund_to=virtual|real
      const refundTo = (req.query.refund_to || 'original').toString();

      // Fetch charge transactions for this campaign to determine how it was funded
      const adtxUrl = `${SUPABASE_URL.replace(/\/+$/,'')}/rest/v1/ad_transactions`;
      let totalVirtualCharged = 0;
      let totalRealCharged = 0;
      try {
        const txRes = await axios.get(`${adtxUrl}?campaign_id=eq.${id}&type=eq.charge`, { headers: supabaseAuthHeaders() });
        const txs = Array.isArray(txRes.data) ? txRes.data : [];
        for (const t of txs) {
          totalVirtualCharged += Number(t.amount_virtual_charged || 0);
          totalRealCharged += Number(t.amount_real_charged || 0);
        }
      } catch (e) {
        console.warn('could not fetch ad_transactions for refund proportions', e && e.response ? e.response.data : e.message || e);
      }

      const wallet = await getWallet(camp.user_id);
      if (wallet) {
        const walletsUrl = `${SUPABASE_URL.replace(/\/+$/,'')}/rest/v1/wallets`;

        // Decide distribution of refund between virtual and real
        let virtualRefund = 0;
        let realRefund = 0;

        if (refundTo === 'virtual') {
          virtualRefund = remaining;
        } else if (refundTo === 'real') {
          realRefund = remaining;
        } else {
          // original: if campaign was paid entirely from one source, refund there.
          // if mixed, refund proportionally based on amounts charged.
          const totalCharged = totalVirtualCharged + totalRealCharged;
          if (totalCharged <= 0) {
            // fallback: refund to virtual by default if we don't know the source
            virtualRefund = remaining;
          } else if (totalVirtualCharged > 0 && totalRealCharged === 0) {
            virtualRefund = remaining;
          } else if (totalRealCharged > 0 && totalVirtualCharged === 0) {
            realRefund = remaining;
          } else {
            // proportional split
            virtualRefund = Math.round((remaining * (totalVirtualCharged / totalCharged)) * 100) / 100;
            realRefund = +(remaining - virtualRefund).toFixed(2);
          }
        }

        // Apply refund to wallet balances (add amounts back)
        const newVirtual = +(Number(wallet.virtual_balance || 0) + virtualRefund).toFixed(2);
        const newReal = +(Number(wallet.real_balance || 0) + realRefund).toFixed(2);
        const newTotal = +(newVirtual + newReal).toFixed(2);

        await axios.patch(`${walletsUrl}?user_id=eq.${camp.user_id}`, { virtual_balance: newVirtual, real_balance: newReal, total_balance: newTotal, updated_at: new Date().toISOString() }, { headers: supabaseAuthHeaders() });

        // record refund transaction with breakdown
        await axios.post(adtxUrl, {
          campaign_id: id,
          user_id: camp.user_id,
          amount_usd: remaining,
          amount_virtual_charged: virtualRefund,
          amount_real_charged: realRefund,
          type: 'refund',
          meta: { note: 'campaign cancelled refund', refund_to: refundTo },
          created_at: new Date().toISOString()
        }, { headers: supabaseAuthHeaders() });
      }
    }

    return res.json({ success: true, cancelled: true, refunded: remaining });
  } catch (err) {
    console.error('campaign delete error', err && err.response ? err.response.data : err.message || err);
    return res.status(500).json({ error: 'could not cancel campaign' });
  }
});

module.exports = router;
