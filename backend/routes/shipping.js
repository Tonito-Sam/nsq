const express = require('express');
const axios = require('axios');

const router = express.Router();
const SHIPLOGIC_RATES_URL = 'https://api.shiplogic.com/v2/rates';

router.post('/courierguy/rates', async (req, res) => {
  const accessToken = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!accessToken) return res.status(401).json({ error: 'Sign in to calculate shipping' });

  const apiKey = process.env.COURIERGUY_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'CourierGuy live rates are not configured on the server' });

  try {
    const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
    if (!supabaseUrl || !serviceKey) return res.status(503).json({ error: 'Shipping quote authentication is not configured' });
    await axios.get(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${accessToken}` },
      timeout: 10000,
    });
  } catch (error) {
    return res.status(401).json({ error: 'Your session is invalid or expired' });
  }

  const { collection, delivery, parcel } = req.body || {};
  const validAddress = address => address &&
    address.country === 'ZA' &&
    typeof address.city === 'string' && address.city.trim() &&
    typeof address.street === 'string' && address.street.trim() &&
    typeof address.postal_code === 'string' && address.postal_code.trim();
  const weight = Number(parcel?.weight);
  const length = Number(parcel?.length);
  const width = Number(parcel?.width);
  const height = Number(parcel?.height);

  if (!validAddress(collection) || !validAddress(delivery)) {
    return res.status(400).json({ error: 'Valid South African collection and delivery addresses are required for CourierGuy rates' });
  }
  if (![weight, length, width, height].every(Number.isFinite) || weight <= 0 || length <= 0 || width <= 0 || height <= 0) {
    return res.status(400).json({ error: 'Valid parcel weight and dimensions are required' });
  }

  try {
    const response = await axios.post(SHIPLOGIC_RATES_URL, {
      collection: { address: collection },
      delivery: { address: delivery },
      parcels: [{ weight, length, width, height }],
    }, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 15000,
    });

    const payload = response.data;
    const rates = Array.isArray(payload) ? payload : Array.isArray(payload?.rates) ? payload.rates : [];
    const quotes = rates.map(rate => ({
      service: String(rate.service_level?.name || rate.service_level_name || rate.name || 'CourierGuy'),
      amount: Number(rate.total ?? rate.total_price ?? rate.amount),
      currency: String(rate.currency || payload.currency || 'ZAR').toUpperCase(),
      estimated_delivery: rate.estimated_delivery || rate.estimated_delivery_date || null,
    })).filter(rate => Number.isFinite(rate.amount) && rate.amount >= 0);

    return res.json({ quotes });
  } catch (error) {
    const providerStatus = error.response?.status;
    console.error('CourierGuy rate request failed:', providerStatus || error.code || error.message);
    return res.status(502).json({ error: 'CourierGuy could not return a live rate. Check the address and parcel details.' });
  }
});

module.exports = router;
