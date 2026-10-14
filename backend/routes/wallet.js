const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const router = express.Router();
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

function headers(extra = {}) {
  return {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function authenticate(req) {
  const accessToken = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!SUPABASE_URL || !SERVICE_ROLE || !accessToken) {
    const error = new Error('Sign in to continue');
    error.status = 401;
    throw error;
  }

  const { data } = await axios.get(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${accessToken}` },
  });
  return { user: data, accessToken };
}

async function requireVerifiedWallet(userId) {
  const response = await axios.get(
    `${SUPABASE_URL}/rest/v1/wallet_compliance_profiles?select=kyc_status,risk_status&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    { headers: headers() }
  );
  const profile = response.data?.[0];
  if (!profile || profile.kyc_status !== 'verified' || profile.risk_status !== 'active') {
    const error = new Error('Complete identity verification before using real-money transfers or payouts');
    error.status = 403;
    throw error;
  }
}

async function requireAdmin(userId) {
  const response = await axios.get(
    `${SUPABASE_URL}/rest/v1/user_roles?select=role&user_id=eq.${encodeURIComponent(userId)}&role=eq.admin&limit=1`,
    { headers: headers() }
  );
  if (!response.data?.length) {
    const error = new Error('Administrator access required');
    error.status = 403;
    throw error;
  }
}

async function callRpc(name, body) {
  const { data } = await axios.post(`${SUPABASE_URL}/rest/v1/rpc/${name}`, body, {
    headers: headers(),
  });
  return data;
}

function asyncRoute(handler) {
  return (req, res) => handler(req, res).catch(error => {
    const status = error.status || error.response?.status || 500;
    const message = error.status ? error.message : error.response?.data?.message || 'Wallet operation failed';
    if (status >= 500) console.error('Wallet API error:', error.response?.data || error.message);
    res.status(status).json({ error: message });
  });
}

router.post('/transfers', asyncRoute(async (req, res) => {
  const { user } = await authenticate(req);
  await requireVerifiedWallet(user.id);

  const recipientId = String(req.body?.recipient_user_id || '');
  const amount = Number(req.body?.amount_usd);
  const reference = String(req.body?.reference || '');
  if (!/^[0-9a-f-]{36}$/i.test(recipientId) || recipientId === user.id || !Number.isFinite(amount) || amount <= 0 || amount > 100000 || !/^[A-Za-z0-9-]{12,80}$/.test(reference)) {
    return res.status(400).json({ error: 'Enter a valid recipient, amount, and transfer reference' });
  }

  const result = await callRpc('wallet_post_personal_transfer', {
    p_sender_user_id: user.id,
    p_recipient_user_id: recipientId,
    p_amount_usd: amount,
    p_reference: reference,
    p_daily_limit_usd: Number(process.env.WALLET_P2P_DAILY_LIMIT_USD || 500),
  });
  return res.json(result);
}));

router.post('/store-transfers', asyncRoute(async (req, res) => {
  const { user } = await authenticate(req);
  await requireVerifiedWallet(user.id);

  const storeId = String(req.body?.store_id || '');
  const amount = Number(req.body?.amount_usd);
  const reference = String(req.body?.reference || '');
  if (!/^[0-9a-f-]{36}$/i.test(storeId) || !Number.isFinite(amount) || amount <= 0 || amount > 100000 || !/^[A-Za-z0-9-]{12,80}$/.test(reference)) {
    return res.status(400).json({ error: 'Enter a valid store, amount, and transfer reference' });
  }

  const result = await callRpc('wallet_transfer_to_store', {
    p_owner_user_id: user.id,
    p_store_id: storeId,
    p_amount_usd: amount,
    p_reference: reference,
    p_daily_limit_usd: Number(process.env.WALLET_STORE_TRANSFER_DAILY_LIMIT_USD || 500),
  });
  return res.json(result);
}));

router.get('/balance', asyncRoute(async (req, res) => {
  const { user } = await authenticate(req);
  await axios.post(`${SUPABASE_URL}/rest/v1/wallets?on_conflict=user_id`, [{
    user_id: user.id,
    real_balance: 0,
    virtual_balance: 100,
    total_balance: 100,
  }], { headers: headers({ Prefer: 'resolution=ignore-duplicates,return=minimal' }) });
  const response = await axios.get(
    `${SUPABASE_URL}/rest/v1/wallets?select=real_balance,virtual_balance,total_balance&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
    { headers: headers() }
  );
  return res.json(response.data?.[0] || { real_balance: 0, virtual_balance: 100, total_balance: 100 });
}));

router.post('/promo-transfers', asyncRoute(async (req, res) => {
  const { user } = await authenticate(req);
  const recipientId = String(req.body?.recipient_user_id || '');
  const amount = Number(req.body?.amount);
  const reference = String(req.body?.reference || '');
  if (!/^[0-9a-f-]{36}$/i.test(recipientId) || recipientId === user.id || !Number.isFinite(amount) || amount <= 0 || amount > 100000 || !/^[A-Za-z0-9-]{12,80}$/.test(reference)) {
    return res.status(400).json({ error: 'Enter a valid recipient, amount, and transfer reference' });
  }
  const result = await callRpc('wallet_transfer_virtual_promo', {
    p_sender_user_id: user.id,
    p_recipient_user_id: recipientId,
    p_amount: amount,
    p_reference: reference,
    p_note: String(req.body?.note || '').slice(0, 500) || null,
  });
  return res.json(result);
}));

router.post('/topups/intent', asyncRoute(async (req, res) => {
  const { user } = await authenticate(req);
  await requireVerifiedWallet(user.id);

  const amountLocal = Number(req.body?.amount_local);
  const currency = String(req.body?.currency || '').toUpperCase();
  const gateway = String(req.body?.gateway || '').toLowerCase();
  if (!Number.isFinite(amountLocal) || amountLocal <= 0 || amountLocal > Number(process.env.WALLET_TOPUP_MAX_LOCAL || 5000)) {
    return res.status(400).json({ error: 'Top-up amount is outside the allowed range' });
  }
  if (!/^[A-Z]{3}$/.test(currency) || !['paystack', 'flutterwave'].includes(gateway)) {
    return res.status(400).json({ error: 'Unsupported wallet top-up currency or gateway' });
  }

  const rateResponse = await axios.get('https://api.exchangerate.host/latest', {
    params: { base: currency, symbols: 'USD' },
    timeout: 10000,
  });
  const fxRate = Number(rateResponse.data?.rates?.USD);
  if (!Number.isFinite(fxRate) || fxRate <= 0) throw new Error('Could not get a current server exchange rate');

  const amountUsd = Number((amountLocal * fxRate).toFixed(2));
  if (amountUsd <= 0 || amountUsd > Number(process.env.WALLET_TOPUP_MAX_USD || 5000)) {
    return res.status(400).json({ error: 'Top-up amount is outside the allowed range' });
  }

  const reference = `TOPUP-${crypto.randomUUID()}`;
  const intent = [{
    reference,
    user_id: user.id,
    gateway,
    amount_local: Number(amountLocal.toFixed(2)),
    currency_local: currency,
    amount_usd: amountUsd,
    fx_rate: fxRate,
    status: 'pending',
    expires_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
  }];
  await axios.post(`${SUPABASE_URL}/rest/v1/wallet_topup_intents`, intent, {
    headers: headers({ Prefer: 'return=minimal' }),
  });
  return res.json({ reference, amount_local: Number(amountLocal.toFixed(2)), currency, amount_usd: amountUsd, fx_rate: fxRate });
}));

router.post('/stores/:storeId/payouts', asyncRoute(async (req, res) => {
  const { user } = await authenticate(req);
  await requireVerifiedWallet(user.id);

  const storeId = String(req.params.storeId || '');
  const amount = Number(req.body?.amount);
  const currency = String(req.body?.currency || '').toUpperCase();
  const reference = `SPAY-${crypto.randomUUID()}`;
  if (!/^[0-9a-f-]{36}$/i.test(storeId) || !Number.isFinite(amount) || amount <= 0 || !/^[A-Z]{3}$/.test(currency)) {
    return res.status(400).json({ error: 'Enter a valid payout amount and currency' });
  }

  const storeResponse = await axios.get(
    `${SUPABASE_URL}/rest/v1/user_stores?select=*&id=eq.${encodeURIComponent(storeId)}&user_id=eq.${encodeURIComponent(user.id)}&is_active=eq.true&limit=1`,
    { headers: headers() }
  );
  const store = storeResponse.data?.[0];
  if (!store) return res.status(403).json({ error: 'Store is not owned by this account' });

  let beneficiary;
  const businessAccountNumber = store.business_bank_account_number || store.business_account_number;
  const businessAccountHolder = store.business_registered_name || store.business_account_holder;
  const businessBranch = store.business_bank_branch || store.business_branch_code;
  if (store.business_bank_name && businessAccountNumber && businessAccountHolder) {
    beneficiary = {
      type: 'bank',
      bank_name: store.business_bank_name,
      account_number: businessAccountNumber,
      branch_code: businessBranch,
      account_holder: businessAccountHolder,
      currency,
    };
  } else {
    const bankResponse = await axios.get(
      `${SUPABASE_URL}/rest/v1/user_bank_accounts?select=bank_name,account_number,branch_code,account_holder,currency&user_id=eq.${encodeURIComponent(user.id)}&is_active=eq.true&is_primary=eq.true&limit=1`,
      { headers: headers() }
    );
    const bank = bankResponse.data?.[0];
    if (!bank?.bank_name || !bank.account_number || !bank.account_holder) {
      return res.status(409).json({ error: 'Add a verified payout beneficiary before requesting a payout' });
    }
    beneficiary = { type: 'bank', ...bank, currency };
  }

  const result = await callRpc('wallet_request_store_payout', {
    p_owner_user_id: user.id,
    p_store_id: storeId,
    p_currency: currency,
    p_amount: amount,
    p_reference: reference,
    p_beneficiary: beneficiary,
    p_daily_limit: Number(process.env.WALLET_STORE_PAYOUT_DAILY_LIMIT || 5000),
  });
  return res.status(202).json(result);
}));

router.get('/admin/store-payouts', asyncRoute(async (req, res) => {
  const { user } = await authenticate(req);
  await requireAdmin(user.id);
  const status = String(req.query.status || 'active');
  const statusFilter = status === 'active'
    ? { status: 'in.(pending_review,approved,processing)' }
    : { status: `eq.${status}` };
  const response = await axios.get(`${SUPABASE_URL}/rest/v1/store_payout_requests`, {
    params: {
      select: 'id,store_id,owner_user_id,currency,amount,beneficiary,status,reference,created_at,updated_at,reviewer_user_id,review_note,provider_reference,user_stores(store_name)',
      ...statusFilter,
      order: 'created_at.asc',
    },
    headers: headers(),
  });
  return res.json({ payouts: response.data || [] });
}));

router.post('/admin/store-payouts/:payoutId/decision', asyncRoute(async (req, res) => {
  const { user } = await authenticate(req);
  await requireAdmin(user.id);
  const decision = String(req.body?.decision || '');
  const providerReference = String(req.body?.provider_reference || '').trim();
  if (!['approved', 'processing', 'paid', 'rejected', 'failed'].includes(decision)) {
    return res.status(400).json({ error: 'Unsupported payout decision' });
  }
  if (decision === 'paid' && !providerReference) {
    return res.status(400).json({ error: 'A bank or payout provider reference is required before marking paid' });
  }

  const result = await callRpc('wallet_decide_store_payout', {
    p_request_id: req.params.payoutId,
    p_decision: decision,
    p_reviewer_user_id: user.id,
    p_note: String(req.body?.review_note || '').slice(0, 1000) || null,
    p_provider_reference: providerReference || null,
  });
  return res.json(result);
}));

module.exports = router;
