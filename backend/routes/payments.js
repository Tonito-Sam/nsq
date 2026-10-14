const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { enqueuePaidOrderNotification } = require('../utils/whatsappOrderNotifications');

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

async function buildStoreOrderRows({ userId, reference, amount, currency, gateway, metadata, status }) {
  const cartItems = Array.isArray(metadata?.cart_items) ? metadata.cart_items : [];
  if (!cartItems.length) throw new Error('The order has no products');

  const requestedItems = cartItems.map(item => {
    const product = item.product || item.store_products || item;
    const productId = String(product.id || item.product_id || '');
    const quantity = Number(item.quantity || 1);
    if (!/^[0-9a-f-]{36}$/i.test(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw new Error('The order contains an invalid product or quantity');
    }
    return { productId, quantity };
  });
  const productIds = [...new Set(requestedItems.map(item => item.productId))];
  const productResponse = await axios.get(
    `${restUrl('/rest/v1/store_products')}?select=id,store_id,title,price,is_on_sale,sale_price,sale_starts,sale_ends&id=in.(${productIds.join(',')})`,
    { headers: supabaseAuthHeaders() }
  );
  const productsById = new Map((productResponse.data || []).map(product => [product.id, product]));
  if (productsById.size !== productIds.length) throw new Error('One or more products in the cart are no longer available');

  const groups = new Map();
  for (const item of requestedItems) {
    const product = productsById.get(item.productId);
    if (!product?.store_id) throw new Error('A cart product is not associated with a store');
    const group = groups.get(product.store_id) || { storeId: product.store_id, weight: 0, lines: [] };
    const now = Date.now();
    const saleStarts = product.sale_starts ? Date.parse(product.sale_starts) : Number.NEGATIVE_INFINITY;
    const saleEnds = product.sale_ends ? Date.parse(product.sale_ends) : Number.POSITIVE_INFINITY;
    const saleActive = product.is_on_sale && Number(product.sale_price) > 0 && saleStarts <= now && saleEnds >= now;
    const priceWeight = Math.max(0, Number(saleActive ? product.sale_price : product.price) || 0) * item.quantity;
    group.weight += priceWeight;
    group.lines.push(`${String(product.title || 'Product').slice(0, 80)} x${item.quantity}`);
    groups.set(product.store_id, group);
  }

  const groupList = [...groups.values()];
  const totalWeight = groupList.reduce((sum, group) => sum + group.weight, 0);
  if (totalWeight <= 0) throw new Error('The products have no valid prices');

  let allocated = 0;
  return groupList.map((group, index) => {
    const groupAmount = index === groupList.length - 1
      ? Number((Number(amount) - allocated).toFixed(2))
      : Number((Number(amount) * group.weight / totalWeight).toFixed(2));
    allocated = Number((allocated + groupAmount).toFixed(2));
    return {
      user_id: userId,
      store_id: group.storeId,
      total_amount: groupAmount,
      seller_amount: Number(group.weight.toFixed(2)),
      currency,
      status,
      payment_method: gateway,
      payment_reference: reference,
      shipping_address: JSON.stringify(metadata?.shipping_info || {}),
      item_summary: group.lines.join(', ').slice(0, 500),
    };
  });
}

async function recordPaidStoreOrders({ userId, reference, amount, currency, gateway, metadata }) {
  const existingResponse = await axios.get(
    `${restUrl('/rest/v1/orders')}?select=id,store_id,status,payment_method&payment_reference=eq.${encodeURIComponent(reference)}&payment_method=eq.${encodeURIComponent(gateway)}`,
    { headers: supabaseAuthHeaders() }
  );
  let orders = existingResponse.data || [];

  if (!orders.length) {
    const orderRows = await buildStoreOrderRows({
      userId,
      reference,
      amount,
      currency,
      gateway,
      metadata,
      status: 'paid',
    });
    const inserted = await axios.post(`${restUrl('/rest/v1/orders')}?on_conflict=payment_reference,store_id`, orderRows, {
      headers: { ...supabaseAuthHeaders(), Prefer: 'resolution=merge-duplicates,return=representation' },
    });
    orders = inserted.data || [];
  } else if (orders.some(order => order.status !== 'paid')) {
    await axios.patch(
      `${restUrl('/rest/v1/orders')}?payment_reference=eq.${encodeURIComponent(reference)}&payment_method=eq.${encodeURIComponent(gateway)}`,
      { status: 'paid' },
      { headers: { ...supabaseAuthHeaders(), Prefer: 'return=minimal' } }
    );
  }

  if (!orders.length) throw new Error('No store orders exist for this confirmed payment');
  for (const order of orders) {
    await axios.post(`${restUrl('/rest/v1/rpc/wallet_credit_paid_order')}`, {
      p_order_id: order.id,
    }, { headers: supabaseAuthHeaders() });
    try {
      await enqueuePaidOrderNotification(order.id);
    } catch (error) {
      console.error('Could not queue WhatsApp order notification:', error.response?.data || error.message);
    }
  }
  return orders.map(order => order.id);
}

async function creditVerifiedWalletTopup({ reference, gateway, amount, currency, providerReference, userId }) {
  const intentResponse = await axios.get(
    `${restUrl('/rest/v1/wallet_topup_intents')}?select=reference,user_id,gateway,amount_local,currency_local,amount_usd,status,expires_at&reference=eq.${encodeURIComponent(reference)}&limit=1`,
    { headers: supabaseAuthHeaders() }
  );
  const intent = intentResponse.data?.[0];
  if (!intent || intent.gateway !== gateway || intent.user_id !== userId) {
    throw new Error('Wallet top-up intent does not match the confirmed payment');
  }
  if (intent.currency_local !== currency || Math.abs(Number(intent.amount_local) - Number(amount)) >= 0.01) {
    throw new Error('Confirmed payment does not match the wallet top-up intent');
  }
  let result = { status: 'already_credited', reference };
  if (intent.status !== 'credited') {
    if (intent.status !== 'pending' || Date.parse(intent.expires_at) <= Date.now()) {
      throw new Error('Wallet top-up intent has expired');
    }

    const { data } = await axios.post(`${restUrl('/rest/v1/rpc/wallet_credit_topup')}`, {
      p_reference: reference,
      p_provider_reference: String(providerReference || reference),
    }, { headers: supabaseAuthHeaders() });
    result = data;
  }

  const existingTransaction = await axios.get(
    `${restUrl('/rest/v1/transactions')}?select=id&reference=eq.${encodeURIComponent(reference)}&user_id=eq.${encodeURIComponent(intent.user_id)}&limit=1`,
    { headers: supabaseAuthHeaders() }
  );
  if (!existingTransaction.data?.length) {
    await axios.post(restUrl('/rest/v1/transactions'), [{
      user_id: intent.user_id,
      type: 'topup',
      amount_usd: Number(intent.amount_usd),
      amount_local: Number(intent.amount_local),
      currency_local: intent.currency_local,
      gateway: intent.gateway,
      status: 'completed',
      reference,
      description: `Wallet top-up via ${intent.gateway}`,
      is_test: false,
      balance_type: 'real',
      metadata: { provider_reference: String(providerReference || reference) },
    }], { headers: { ...supabaseAuthHeaders(), Prefer: 'return=minimal' } });
  }
  return result;
}

function encodePayfastValue(value) {
  return encodeURIComponent(String(value).trim())
    .replace(/[!'()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, '+');
}

function payfastSignature(fields, passphrase) {
  const parts = Object.keys(fields)
    .filter(key => key !== 'signature' && fields[key] !== undefined && fields[key] !== null && String(fields[key]) !== '')
    .sort()
    .map(key => `${key}=${encodePayfastValue(fields[key])}`);

  if (passphrase) parts.push(`passphrase=${encodePayfastValue(passphrase)}`);
  return crypto.createHash('md5').update(parts.join('&')).digest('hex');
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

router.post('/paystack/itn', async (req, res) => {
  const secretKey = process.env.PAYSTACK_SECRET || process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey || !SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: 'PayStack order notifications are not configured' });
  }

  const signature = String(req.get('x-paystack-signature') || '');
  if (!signature || !Buffer.isBuffer(req.rawBody)) {
    return res.status(400).json({ error: 'Missing PayStack signature or raw request body' });
  }

  const expected = crypto.createHmac('sha512', secretKey).update(req.rawBody).digest();
  let received;
  try {
    received = Buffer.from(signature, 'hex');
  } catch (error) {
    return res.status(400).json({ error: 'Invalid PayStack signature' });
  }
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    return res.status(401).json({ error: 'Invalid PayStack signature' });
  }

  if (req.body?.event !== 'charge.success') return res.status(200).json({ received: true });

  try {
    const data = req.body.data || {};
    const metadata = data.metadata || {};
    const reference = String(data.reference || '');
    if (metadata.wallet_topup === true) {
      await creditVerifiedWalletTopup({
        reference,
        gateway: 'paystack',
        amount: Number(data.amount) / 100,
        currency: String(data.currency || '').toUpperCase(),
        providerReference: reference,
        userId: metadata.user_id,
      });
      return res.status(200).json({ received: true });
    }
    if (!reference || !metadata.user_id || !Array.isArray(metadata.cart_items) || !metadata.cart_items.length) {
      return res.status(200).json({ received: true, ignored: true });
    }

    const amount = Number(data.amount) / 100;
    const currency = String(data.currency || '').toUpperCase();
    const expectedAmount = Number(metadata.expected_amount);
    const expectedCurrency = String(metadata.expected_currency || '').toUpperCase();
    if (!Number.isFinite(expectedAmount) || Math.abs(amount - expectedAmount) >= 0.01 || currency !== expectedCurrency) {
      console.error('PayStack webhook amount mismatch for reference:', reference);
      return res.status(400).json({ error: 'Payment amount does not match checkout metadata' });
    }

    await recordPaidStoreOrders({
      userId: metadata.user_id,
      reference,
      amount,
      currency,
      gateway: 'paystack',
      metadata,
    });
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('PayStack ITN processing failed:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Could not process PayStack notification' });
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

router.post('/payfast/init', async (req, res) => {
  const merchantId = process.env.PAYFAST_MERCHANT_ID;
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
  const passphrase = process.env.PAYFAST_PASSPHRASE;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  const { amount, currency, email, reference, metadata, accessToken, returnUrl, cancelUrl, notifyUrl } = req.body || {};
  const numericAmount = Number(amount);
  const userId = metadata?.user_id;

  if (!merchantId || !merchantKey || !passphrase || !SUPABASE_URL || !serviceKey) {
    return res.status(503).json({ error: 'PayFast checkout is not configured on the server' });
  }
  if (!Number.isFinite(numericAmount) || numericAmount <= 0 || currency !== 'ZAR' || !email || !userId || !accessToken) {
    return res.status(400).json({ error: 'A valid ZAR payment, customer email, and signed-in user are required' });
  }
  if (!/^PAY-[A-Za-z0-9-]{8,80}$/.test(String(reference || ''))) {
    return res.status(400).json({ error: 'A valid payment reference is required' });
  }

  try {
    const userResponse = await axios.get(`${SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/user`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${accessToken}` },
    });
    if (userResponse.data?.id !== userId) {
      return res.status(403).json({ error: 'Signed-in user does not match the order' });
    }

    const requestOrigin = req.get('origin');
    for (const candidate of [returnUrl, cancelUrl, notifyUrl]) {
      const parsed = new URL(candidate);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid PayFast callback URL');
    }
    if (!requestOrigin || new URL(returnUrl).origin !== requestOrigin || new URL(cancelUrl).origin !== requestOrigin) {
      return res.status(400).json({ error: 'PayFast return URLs must use the checkout site origin' });
    }

    const cartItems = Array.isArray(metadata?.cart_items) ? metadata.cart_items : [];
    const orderRows = await buildStoreOrderRows({
      userId,
      reference,
      amount: numericAmount,
      currency: 'ZAR',
      gateway: 'payfast',
      metadata,
      status: 'pending',
    });
    const orderResponse = await axios.post(`${restUrl('/rest/v1/orders')}?on_conflict=payment_reference,store_id`, orderRows, {
      headers: { ...supabaseAuthHeaders(), Prefer: 'resolution=merge-duplicates,return=representation' },
    });
    if (!orderResponse.data?.length) throw new Error('Could not create the pending orders');

    const fields = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: returnUrl,
      cancel_url: cancelUrl,
      notify_url: notifyUrl,
      name_first: String(metadata?.customer?.name || '').split(' ')[0] || undefined,
      email_address: email,
      m_payment_id: reference,
      amount: numericAmount.toFixed(2),
      currency_code: 'ZAR',
      item_name: cartItems.map(item => item.product?.title || item.store_products?.title).filter(Boolean).join(', ').slice(0, 100) || 'NexSq order',
      custom_str1: orderResponse.data[0].id,
    };
    fields.signature = payfastSignature(fields, passphrase);

    return res.json({
      action: process.env.PAYFAST_SANDBOX === 'true'
        ? 'https://sandbox.payfast.co.za/eng/process'
        : 'https://www.payfast.co.za/eng/process',
      fields,
    });
  } catch (error) {
    console.error('PayFast initialization failed:', error.response?.data || error.message);
    return res.status(502).json({ error: 'Could not initialize PayFast checkout' });
  }
});

router.post('/payfast/itn', express.urlencoded({ extended: false }), async (req, res) => {
  const merchantId = process.env.PAYFAST_MERCHANT_ID;
  const passphrase = process.env.PAYFAST_PASSPHRASE;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  const payload = req.body || {};
  const reference = String(payload.m_payment_id || '');
  const signature = String(payload.signature || '');

  if (!merchantId || !passphrase || !SUPABASE_URL || !serviceKey) {
    return res.status(503).send('PayFast verification is not configured');
  }
  if (!reference || payload.merchant_id !== merchantId || !signature) {
    return res.status(400).send('Invalid PayFast notification');
  }

  try {
    const expectedSignature = payfastSignature(payload, passphrase);
    const received = Buffer.from(signature.toLowerCase());
    const expected = Buffer.from(expectedSignature);
    if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
      return res.status(400).send('Invalid PayFast signature');
    }

    const orderUrl = `${restUrl('/rest/v1/orders')}?select=id,store_id,total_amount,currency,status,payment_method&payment_reference=eq.${encodeURIComponent(reference)}`;
    const orderResponse = await axios.get(orderUrl, { headers: supabaseAuthHeaders() });
    const orders = orderResponse.data || [];
    if (!orders.length || orders.some(order => order.payment_method !== 'payfast')) return res.status(404).send('Order not found');
    const totalAmount = orders.reduce((sum, order) => sum + Number(order.total_amount), 0);
    if (Math.abs(Number(payload.amount_gross) - totalAmount) >= 0.01 || orders.some(order => order.currency !== 'ZAR')) {
      return res.status(400).send('Payment amount does not match order');
    }

    const postbackUrl = process.env.PAYFAST_SANDBOX === 'true'
      ? 'https://sandbox.payfast.co.za/eng/query/validate'
      : 'https://www.payfast.co.za/eng/query/validate';
    const postback = Object.keys(payload)
      .filter(key => key !== 'signature' && payload[key] !== undefined && payload[key] !== '')
      .sort()
      .map(key => `${encodePayfastValue(key)}=${encodePayfastValue(payload[key])}`)
      .join('&');
    const validation = await axios.post(postbackUrl, postback, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      responseType: 'text',
      transformResponse: [data => data],
    });
    if (String(validation.data).trim() !== 'VALID') {
      return res.status(400).send('PayFast notification could not be validated');
    }

    if (payload.payment_status === 'COMPLETE') {
      if (orders.some(order => order.status !== 'paid')) {
      await axios.patch(
        `${restUrl('/rest/v1/orders')}?payment_reference=eq.${encodeURIComponent(reference)}`,
        { status: 'paid' },
        { headers: { ...supabaseAuthHeaders(), Prefer: 'return=minimal' } }
      );
      }
      for (const order of orders) {
        await axios.post(`${restUrl('/rest/v1/rpc/wallet_credit_paid_order')}`, {
          p_order_id: order.id,
        }, { headers: supabaseAuthHeaders() });
        try {
          await enqueuePaidOrderNotification(order.id);
        } catch (error) {
          console.error('Could not queue WhatsApp order notification:', error.response?.data || error.message);
        }
      }
    } else if (payload.payment_status === 'FAILED' && orders.some(order => order.status === 'pending')) {
      await axios.patch(
        `${restUrl('/rest/v1/orders')}?payment_reference=eq.${encodeURIComponent(reference)}`,
        { status: 'failed' },
        { headers: { ...supabaseAuthHeaders(), Prefer: 'return=minimal' } }
      );
    }

    return res.status(200).send('OK');
  } catch (error) {
    console.error('PayFast ITN verification failed:', error.response?.data || error.message);
    return res.status(502).send('Could not process PayFast notification');
  }
});

router.get('/payfast/status/:reference', async (req, res) => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  if (!SUPABASE_URL || !serviceKey) return res.status(503).json({ error: 'Order status lookup is not configured' });
  const accessToken = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!accessToken) return res.status(401).json({ error: 'Sign in to check this order' });

  try {
    const userResponse = await axios.get(`${SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/user`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${accessToken}` },
    });
    const userId = userResponse.data?.id;
    if (!userId) return res.status(401).json({ error: 'Session is invalid or expired' });

    const orderUrl = `${restUrl('/rest/v1/orders')}?select=id,user_id,status,payment_method&payment_reference=eq.${encodeURIComponent(req.params.reference)}`;
    const response = await axios.get(orderUrl, { headers: supabaseAuthHeaders() });
    const orders = response.data || [];
    if (!orders.length || orders.some(order => order.payment_method !== 'payfast' || order.user_id !== userId)) {
      return res.status(404).json({ error: 'PayFast order not found' });
    }
    return res.json({
      status: orders.every(order => order.status === 'paid') ? 'paid' : orders.some(order => order.status === 'failed') ? 'failed' : 'pending',
      orders: orders.map(order => ({ id: order.id, status: order.status })),
    });
  } catch (error) {
    console.error('PayFast order status lookup failed:', error.response?.data || error.message);
    return res.status(502).json({ error: 'Could not check PayFast order status' });
  }
});

// POST /api/payments/verify
// Verify a completed checkout directly with the payment provider.
router.post('/verify', async (req, res) => {
  const { gateway, reference, amount, currency, metadata, accessToken } = req.body || {};
  const expectedAmount = Number(amount);
  const expectedCurrency = String(currency || '').toUpperCase();

  if (!reference || !['paystack', 'flutterwave'].includes(gateway)) {
    return res.status(400).json({ error: 'A supported gateway and transaction reference are required' });
  }
  if (!Number.isFinite(expectedAmount) || expectedAmount <= 0 || !expectedCurrency) {
    return res.status(400).json({ error: 'A valid checkout amount and currency are required' });
  }

  try {
    let transaction;

    if (gateway === 'paystack') {
      const secretKey = process.env.PAYSTACK_SECRET || process.env.PAYSTACK_SECRET_KEY;
      if (!secretKey) return res.status(503).json({ error: 'Paystack verification is not configured' });

      const response = await axios.get(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
        { headers: { Authorization: `Bearer ${secretKey}` } }
      );
      transaction = response.data?.data;
    } else {
      const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
      if (!secretKey) return res.status(503).json({ error: 'Flutterwave verification is not configured' });

      const response = await axios.get(
        `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(reference)}/verify`,
        { headers: { Authorization: `Bearer ${secretKey}` } }
      );
      transaction = response.data?.data;
    }

    const providerSucceeded = gateway === 'paystack'
      ? transaction?.status === 'success'
      : transaction?.status === 'successful';
    const chargedAmount = gateway === 'paystack'
      ? Number(transaction?.amount) / 100
      : Number(transaction?.amount);
    const chargedCurrency = String(transaction?.currency || '').toUpperCase();
    const amountMatches = Number.isFinite(chargedAmount) && Math.abs(chargedAmount - expectedAmount) < 0.01;
    const currencyMatches = chargedCurrency === expectedCurrency;

    if (!providerSucceeded || !amountMatches || !currencyMatches) {
      return res.json({ status: 'failed', reference, amount: chargedAmount, currency: chargedCurrency });
    }

    if (metadata?.wallet_topup === true) {
      if (!accessToken || String(metadata.wallet_topup_reference || '') !== String(reference)) {
        return res.status(400).json({ error: 'A matching wallet top-up intent is required' });
      }
      const userResponse = await axios.get(`${SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/user`, {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE,
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (userResponse.data?.id !== metadata.user_id) {
        return res.status(403).json({ error: 'Signed-in user does not match the wallet top-up' });
      }
      const topup = await creditVerifiedWalletTopup({
        reference,
        gateway,
        amount: chargedAmount,
        currency: chargedCurrency,
        providerReference: transaction?.reference || transaction?.tx_ref || reference,
        userId: metadata.user_id,
      });
      return res.json({ status: 'success', reference, ...topup });
    }

    let orderIds = [];
    const isWalletPayment = String(reference).startsWith('TOPUP-') || String(reference).startsWith('wallet_');
    if (!isWalletPayment) {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
      if (!serviceKey || !metadata?.user_id || !accessToken) {
        return res.status(400).json({ error: 'Signed-in order details are required to complete this payment' });
      }

      const userResponse = await axios.get(`${SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/user`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${accessToken}` },
      });
      if (userResponse.data?.id !== metadata.user_id) {
        return res.status(403).json({ error: 'Signed-in user does not match the order' });
      }
      orderIds = await recordPaidStoreOrders({
        userId: metadata.user_id,
        reference,
        amount: chargedAmount,
        currency: chargedCurrency,
        gateway,
        metadata,
      });
    }

    return res.json({
      status: 'success',
      reference: transaction?.reference || transaction?.tx_ref || String(reference),
      amount: chargedAmount,
      currency: chargedCurrency,
      order_ids: orderIds,
    });
  } catch (error) {
    console.error(`${gateway} payment verification failed:`, error.response?.data || error.message);
    return res.status(502).json({ error: 'Could not verify this payment with the provider' });
  }
});

module.exports = router;
