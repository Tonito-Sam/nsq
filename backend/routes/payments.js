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

// Helper: allow insecure/dev simulated calls when query param dev=1 or body.dev === true
function isDevSim(req) {
  return req.query && req.query.dev === '1' || req.body && req.body.dev === true || process.env.ALLOW_INSECURE_WEBHOOKS === '1';
}

function restUrl(path) {
  if (!SUPABASE_URL) return null;
  return `${SUPABASE_URL.replace(/\/+$/,'')}${path.startsWith('/') ? '' : '/'}${path}`;
}

// POST /api/payments/flutterwave-webhook
// Dev-safe webhook to accept simulated Flutterwave payloads and write a transaction row.
router.post('/flutterwave-webhook', async (req, res) => {
  if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'server missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars' });
  }

  // Only accept simulated payloads unless ALLOW_INSECURE_WEBHOOKS=1
  if (!isDevSim(req)) {
    return res.status(403).json({ error: 'webhook disabled in non-dev mode. add ?dev=1 or set ALLOW_INSECURE_WEBHOOKS=1' });
  }

  try {
    const body = req.body || {};
    const data = body.data || body;

    const tx_ref = (data.tx_ref || data.reference || `dev-${Date.now()}`).toString();
    const amount = Number((data.amount || data.amount_paid || data.amount_usd) || 0);
    const currency = data.currency || data.currency_local || 'USD';
    const status = (data.status || (data.tx && data.tx.status) || 'successful').toString();
    const customer = (data.customer && typeof data.customer === 'object') ? data.customer : (data.customer_email ? { email: data.customer_email } : {});

    // If OTP is required, return an instruction so frontend can show OTP screen.
    if (data.otp_required && !data.otp) {
      // Create a pending transaction record
      const payload = [{
        user_id: data.user_id || null,
        type: 'topup',
        amount_usd: amount,
        amount_local: amount,
        currency_local: currency,
        gateway: 'flutterwave',
        status: 'pending_otp',
        reference: tx_ref,
        description: `Flutterwave simulated (pending OTP)` ,
        is_test: true,
        balance_type: 'real',
        metadata: { raw: data }
      }];

      const url = restUrl('/rest/v1/transactions');
      console.log('flutterwave webhook - posting pending txn to', url, 'payload:', JSON.stringify(payload));
      await axios.post(url, payload, { headers: { ...supabaseAuthHeaders(), Prefer: 'return=representation' } });
      return res.json({ success: true, message: 'OTP required', tx_ref });
    }

    // If OTP provided (or not required) mark as completed
    const txn = {
      user_id: data.user_id || null,
      type: 'topup',
      amount_usd: amount,
      amount_local: amount,
      currency_local: currency,
      gateway: 'flutterwave',
      status: status === 'successful' || data.otp ? 'completed' : status,
      reference: tx_ref,
      description: `Flutterwave simulated (${status})`,
      is_test: true,
      balance_type: 'real',
      recipient_info: customer.email || null,
      metadata: { raw: data }
    };

    // Upsert transaction (avoid duplicates)
    const url = restUrl('/rest/v1/transactions');
    console.log('flutterwave webhook - posting txn to', url, 'txn:', JSON.stringify(txn));
    await axios.post(url, [txn], { headers: { ...supabaseAuthHeaders(), Prefer: 'return=representation' } });

    // If completed and we have a user_id, update their wallet balances
    if ((txn.status === 'completed' || txn.status === 'success') && txn.user_id) {
      try {
        const walletGetUrl = restUrl(`/rest/v1/wallets?select=real_balance,virtual_balance,user_id&user_id=eq.${encodeURIComponent(txn.user_id)}&limit=1`);
        console.log('fetching wallet for user', txn.user_id, walletGetUrl);
        const getResp = await axios.get(walletGetUrl, { headers: supabaseAuthHeaders() });
        const rows = Array.isArray(getResp.data) ? getResp.data : [];
        const existing = rows[0];
        const currentReal = existing && typeof existing.real_balance === 'number' ? existing.real_balance : 0;
        const currentVirtual = existing && typeof existing.virtual_balance === 'number' ? existing.virtual_balance : 100;
        const newReal = currentReal + (Number(txn.amount_usd) || 0);
        const newTotal = newReal + currentVirtual;

        if (existing) {
          const patchUrl = restUrl(`/rest/v1/wallets?user_id=eq.${encodeURIComponent(txn.user_id)}`);
          console.log('patching wallet', patchUrl, { real_balance: newReal, total_balance: newTotal });
          await axios.patch(patchUrl, { real_balance: newReal, total_balance: newTotal, updated_at: new Date().toISOString() }, { headers: { ...supabaseAuthHeaders(), Prefer: 'return=representation' } });
        } else {
          const insertUrl = restUrl('/rest/v1/wallets');
          const insertPayload = [{ user_id: txn.user_id, real_balance: newReal, virtual_balance: currentVirtual, total_balance: newTotal, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }];
          console.log('inserting wallet', insertUrl, insertPayload);
          await axios.post(insertUrl, insertPayload, { headers: { ...supabaseAuthHeaders(), Prefer: 'return=representation' } });
        }
      } catch (wErr) {
        console.warn('failed to update wallet after txn', wErr && wErr.response ? wErr.response.data : (wErr && wErr.message) || wErr);
      }
    }

    return res.json({ success: true, tx_ref });
  } catch (err) {
    const detail = err && err.response ? err.response.data : (err && err.message ? err.message : String(err));
    console.error('flutterwave-webhook error', detail);
    if (isDevSim(req)) return res.status(500).json({ error: 'failed to process webhook', detail });
    return res.status(500).json({ error: 'failed to process webhook' });
  }
});

// POST /api/payments/flutterwave-verify
// Accepts { tx_ref, otp } to simulate OTP verification and mark transaction completed.
router.post('/flutterwave-verify', async (req, res) => {
  if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'server missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars' });
  }

  if (!isDevSim(req)) {
    return res.status(403).json({ error: 'verification disabled in non-dev mode. add ?dev=1 or set ALLOW_INSECURE_WEBHOOKS=1' });
  }

  try {
    const { tx_ref, otp } = req.body || {};
    if (!tx_ref || !otp) return res.status(400).json({ error: 'tx_ref and otp required' });

    // In dev we accept any OTP. Update transaction record by tx_ref
    const updateBody = { status: 'completed', updated_at: new Date().toISOString(), metadata: { otp_used: otp } };

    const url = restUrl(`/rest/v1/transactions?reference=eq.${encodeURIComponent(tx_ref)}`);
    const resp = await axios.patch(url, updateBody, { headers: { ...supabaseAuthHeaders(), Prefer: 'return=representation' } });

    return res.json({ success: true, updated: resp.data });
  } catch (err) {
    const detail = err && err.response ? err.response.data : (err && err.message ? err.message : String(err));
    console.error('flutterwave-verify error', detail);
    if (isDevSim(req)) return res.status(500).json({ error: 'verification failed', detail });
    return res.status(500).json({ error: 'verification failed' });
  }
});

// POST /api/payments/paystack-webhook (dev-safe)
router.post('/paystack-webhook', async (req, res) => {
  if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'server missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars' });
  }
  if (!isDevSim(req)) return res.status(403).json({ error: 'disabled in non-dev mode' });

  try {
    const body = req.body || {};
    const evt = body.event || body;
    const data = evt.data || evt;
    const reference = (data.reference || data.tx_ref || `dev-${Date.now()}`).toString();
    const amount = Number((data.amount || data.amount_paid || 0) / 100 || 0);
    const status = data.status || 'success';

    const txn = {
      user_id: data.customer && data.customer.id ? data.customer.id : null,
      type: 'topup',
      amount_usd: amount,
      amount_local: amount,
      currency_local: data.currency || 'USD',
      gateway: 'paystack',
      status: status === 'success' ? 'completed' : status,
      reference,
      description: `Paystack simulated (${status})`,
      is_test: true,
      balance_type: 'real',
      recipient_info: data.customer && data.customer.email ? data.customer.email : null,
      metadata: { raw: data }
    };

    const url = restUrl('/rest/v1/transactions');
    console.log('paystack webhook - posting txn to', url, 'txn:', JSON.stringify(txn));
    await axios.post(url, [txn], { headers: { ...supabaseAuthHeaders(), Prefer: 'return=representation' } });

    // update wallet balances for completed topups
    if ((txn.status === 'completed' || txn.status === 'success') && txn.user_id) {
      try {
        const walletGetUrl = restUrl(`/rest/v1/wallets?select=real_balance,virtual_balance,user_id&user_id=eq.${encodeURIComponent(txn.user_id)}&limit=1`);
        const getResp = await axios.get(walletGetUrl, { headers: supabaseAuthHeaders() });
        const rows = Array.isArray(getResp.data) ? getResp.data : [];
        const existing = rows[0];
        const currentReal = existing && typeof existing.real_balance === 'number' ? existing.real_balance : 0;
        const currentVirtual = existing && typeof existing.virtual_balance === 'number' ? existing.virtual_balance : 100;
        const newReal = currentReal + (Number(txn.amount_usd) || 0);
        const newTotal = newReal + currentVirtual;

        if (existing) {
          const patchUrl = restUrl(`/rest/v1/wallets?user_id=eq.${encodeURIComponent(txn.user_id)}`);
          await axios.patch(patchUrl, { real_balance: newReal, total_balance: newTotal, updated_at: new Date().toISOString() }, { headers: { ...supabaseAuthHeaders(), Prefer: 'return=representation' } });
        } else {
          const insertUrl = restUrl('/rest/v1/wallets');
          const insertPayload = [{ user_id: txn.user_id, real_balance: newReal, virtual_balance: currentVirtual, total_balance: newTotal, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }];
          await axios.post(insertUrl, insertPayload, { headers: { ...supabaseAuthHeaders(), Prefer: 'return=representation' } });
        }
      } catch (wErr) {
        console.warn('failed to update wallet after paystack txn', wErr && wErr.response ? wErr.response.data : (wErr && wErr.message) || wErr);
      }
    }

    return res.json({ success: true, reference });
  } catch (err) {
    const detail = err && err.response ? err.response.data : (err && err.message ? err.message : String(err));
    console.error('paystack-webhook error', detail);
    if (isDevSim(req)) return res.status(500).json({ error: 'failed to process paystack webhook', detail });
    return res.status(500).json({ error: 'failed to process paystack webhook' });
  }
});

module.exports = router;
