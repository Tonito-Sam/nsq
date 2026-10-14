const express = require('express');
const crypto = require('crypto');
const { sendTemplateMessage } = require('../utils/whatsappOrderNotifications');
let fetchFn;
if (typeof fetch !== 'undefined') {
  fetchFn = fetch;
} else {
  try {
    const nf = require('node-fetch');
    fetchFn = nf && nf.default ? nf.default : nf;
  } catch (e) {
    fetchFn = undefined;
    console.warn('node-fetch is not available; stores route requires fetch.');
  }
}

const router = express.Router();

function supabaseConfig() {
  return {
    url: (process.env.SUPABASE_URL || '').replace(/\/+$/, ''),
    serviceRole: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE,
  };
}

function authHeaders(serviceRole, accessToken) {
  return {
    apikey: serviceRole,
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

async function getOwnedStore(req, storeId) {
  const { url, serviceRole } = supabaseConfig();
  const accessToken = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!url || !serviceRole || !accessToken) {
    return { error: { status: 401, message: 'Sign in as the store owner to change WhatsApp settings' } };
  }

  const userResponse = await fetchFn(`${url}/auth/v1/user`, {
    headers: authHeaders(serviceRole, accessToken),
  });
  if (!userResponse.ok) return { error: { status: 401, message: 'Your session is invalid or expired' } };
  const user = await userResponse.json();

  const storeResponse = await fetchFn(
    `${url}/rest/v1/user_stores?id=eq.${encodeURIComponent(storeId)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,user_id,store_name,business_whatsapp_number,business_whatsapp_verified_at,business_whatsapp_verified_phone,notify_whatsapp&limit=1`,
    { headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}` } }
  );
  if (!storeResponse.ok) throw new Error('Could not verify store ownership');
  const stores = await storeResponse.json();
  if (!stores[0]) return { error: { status: 403, message: 'You do not own this store' } };

  return { url, serviceRole, accessToken, user, store: stores[0] };
}

function otpHash(storeId, code) {
  const secret = process.env.WHATSAPP_OTP_SECRET;
  if (!secret) throw new Error('WhatsApp verification is not configured on the server');
  return crypto.createHmac('sha256', secret).update(`${storeId}:${code}`).digest('hex');
}

// POST /api/stores/update-whatsapp-notify
// Body: { store_id, notify_whatsapp: boolean, business_whatsapp_number?: string }
router.post('/update-whatsapp-notify', async (req, res) => {
  try {
    const body = req.body || {};
    const { store_id, notify_whatsapp, business_whatsapp_number } = body;

    if (!store_id) return res.status(400).json({ error: 'missing store_id' });
    if (typeof notify_whatsapp !== 'boolean') return res.status(400).json({ error: 'notify_whatsapp must be boolean' });
    const owner = await getOwnedStore(req, store_id);
    if (owner.error) return res.status(owner.error.status).json({ error: owner.error.message });

    const number = typeof business_whatsapp_number === 'string'
      ? business_whatsapp_number.trim()
      : owner.store.business_whatsapp_number;
    if (notify_whatsapp && (!number || number !== owner.store.business_whatsapp_verified_phone || !owner.store.business_whatsapp_verified_at)) {
      return res.status(409).json({ error: 'Verify this WhatsApp number before enabling order notifications' });
    }

    const updates = { notify_whatsapp };
    if (typeof business_whatsapp_number === 'string') updates.business_whatsapp_number = number || null;
    if (number !== owner.store.business_whatsapp_verified_phone) {
      updates.notify_whatsapp = false;
      updates.business_whatsapp_verified_phone = null;
      updates.business_whatsapp_verified_at = null;
    }

    const response = await fetchFn(
      `${owner.url}/rest/v1/user_stores?id=eq.${encodeURIComponent(store_id)}&user_id=eq.${encodeURIComponent(owner.user.id)}`,
      {
        method: 'PATCH',
        headers: { ...authHeaders(owner.serviceRole, owner.serviceRole), Prefer: 'return=representation' },
        body: JSON.stringify(updates),
      }
    );
    const text = await response.text();
    if (!response.ok) return res.status(502).json({ error: 'Could not update WhatsApp settings' });
    return res.json({ ok: true, updated: JSON.parse(text || '[]')[0] || null });
  } catch (err) {
    console.error('stores.update-whatsapp-notify error', err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
});

router.post('/whatsapp-verification/start', async (req, res) => {
  try {
    const { store_id, business_whatsapp_number } = req.body || {};
    if (!store_id || typeof business_whatsapp_number !== 'string') {
      return res.status(400).json({ error: 'Store and WhatsApp number are required' });
    }
    const number = business_whatsapp_number.trim();
    if (!/^\+[1-9][0-9]{1,14}$/.test(number)) {
      return res.status(400).json({ error: 'Enter a valid WhatsApp number in international format' });
    }

    const owner = await getOwnedStore(req, store_id);
    if (owner.error) return res.status(owner.error.status).json({ error: owner.error.message });
    if (!process.env.WHATSAPP_VERIFICATION_TEMPLATE_NAME) {
      return res.status(503).json({ error: 'WhatsApp verification template is not configured on the server' });
    }

    const verificationResponse = await fetchFn(
      `${owner.url}/rest/v1/store_whatsapp_verifications?store_id=eq.${encodeURIComponent(store_id)}&select=created_at&limit=1`,
      { headers: { apikey: owner.serviceRole, Authorization: `Bearer ${owner.serviceRole}` } }
    );
    if (verificationResponse.ok) {
      const existing = (await verificationResponse.json())[0];
      if (existing && Date.now() - Date.parse(existing.created_at) < 60_000) {
        return res.status(429).json({ error: 'Wait one minute before requesting another code' });
      }
    }

    const code = String(crypto.randomInt(100000, 1000000));
    const verification = await fetchFn(`${owner.url}/rest/v1/store_whatsapp_verifications?on_conflict=store_id`, {
      method: 'POST',
      headers: {
        apikey: owner.serviceRole,
        Authorization: `Bearer ${owner.serviceRole}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify([{
        store_id,
        owner_user_id: owner.user.id,
        phone_number: number,
        code_hash: otpHash(store_id, code),
        expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
        attempts: 0,
        created_at: new Date().toISOString(),
      }]),
    });
    if (!verification.ok) throw new Error('Could not start WhatsApp number verification');

    const updateStore = await fetchFn(
      `${owner.url}/rest/v1/user_stores?id=eq.${encodeURIComponent(store_id)}&user_id=eq.${encodeURIComponent(owner.user.id)}`,
      {
        method: 'PATCH',
        headers: { apikey: owner.serviceRole, Authorization: `Bearer ${owner.serviceRole}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_whatsapp_number: number, notify_whatsapp: false }),
      }
    );
    if (!updateStore.ok) throw new Error('Could not save the WhatsApp number');

    await sendTemplateMessage(number, process.env.WHATSAPP_VERIFICATION_TEMPLATE_NAME, [code]);
    return res.json({ ok: true, message: 'Verification code sent' });
  } catch (err) {
    console.error('stores.whatsapp-verification.start error', err.response?.data || err.message);
    return res.status(502).json({ error: 'Could not send a WhatsApp verification code' });
  }
});

router.post('/whatsapp-verification/confirm', async (req, res) => {
  try {
    const { store_id, code } = req.body || {};
    if (!store_id || !/^\d{6}$/.test(String(code || ''))) {
      return res.status(400).json({ error: 'Enter the six-digit verification code' });
    }
    const owner = await getOwnedStore(req, store_id);
    if (owner.error) return res.status(owner.error.status).json({ error: owner.error.message });

    const verificationResponse = await fetchFn(
      `${owner.url}/rest/v1/store_whatsapp_verifications?store_id=eq.${encodeURIComponent(store_id)}&owner_user_id=eq.${encodeURIComponent(owner.user.id)}&select=*&limit=1`,
      { headers: { apikey: owner.serviceRole, Authorization: `Bearer ${owner.serviceRole}` } }
    );
    if (!verificationResponse.ok) throw new Error('Could not read verification state');
    const verification = (await verificationResponse.json())[0];
    if (!verification || Date.parse(verification.expires_at) <= Date.now() || verification.attempts >= 5) {
      return res.status(400).json({ error: 'Verification code expired. Request a new code.' });
    }

    const expected = Buffer.from(otpHash(store_id, String(code)));
    const received = Buffer.from(verification.code_hash);
    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
      await fetchFn(`${owner.url}/rest/v1/store_whatsapp_verifications?store_id=eq.${encodeURIComponent(store_id)}`, {
        method: 'PATCH',
        headers: { apikey: owner.serviceRole, Authorization: `Bearer ${owner.serviceRole}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ attempts: verification.attempts + 1 }),
      });
      return res.status(400).json({ error: 'That verification code is incorrect' });
    }

    const updateResponse = await fetchFn(
      `${owner.url}/rest/v1/user_stores?id=eq.${encodeURIComponent(store_id)}&user_id=eq.${encodeURIComponent(owner.user.id)}`,
      {
        method: 'PATCH',
        headers: { apikey: owner.serviceRole, Authorization: `Bearer ${owner.serviceRole}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({
          business_whatsapp_number: verification.phone_number,
          business_whatsapp_verified_phone: verification.phone_number,
          business_whatsapp_verified_at: new Date().toISOString(),
          notify_whatsapp: false,
        }),
      }
    );
    if (!updateResponse.ok) throw new Error('Could not save WhatsApp verification');

    await fetchFn(`${owner.url}/rest/v1/store_whatsapp_verifications?store_id=eq.${encodeURIComponent(store_id)}`, {
      method: 'DELETE',
      headers: { apikey: owner.serviceRole, Authorization: `Bearer ${owner.serviceRole}` },
    });
    return res.json({ ok: true, updated: (await updateResponse.json())[0] || null });
  } catch (err) {
    console.error('stores.whatsapp-verification.confirm error', err.message);
    return res.status(502).json({ error: 'Could not verify this WhatsApp number' });
  }
});

module.exports = router;
