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

  const { collection, delivery } = req.body || {};
  const parcels = Array.isArray(req.body?.parcels)
    ? req.body.parcels
    : req.body?.parcel
      ? [req.body.parcel]
      : [];
  const validAddress = address => address &&
    address.country === 'ZA' &&
    typeof address.city === 'string' && address.city.trim() &&
    typeof address.street === 'string' && address.street.trim() &&
    typeof address.postal_code === 'string' && address.postal_code.trim();
  const normalizedParcels = parcels.map(parcel => ({
    weight: Number(parcel?.weight),
    length: Number(parcel?.length),
    width: Number(parcel?.width),
    height: Number(parcel?.height),
  }));

  if (!validAddress(collection) || !validAddress(delivery)) {
    return res.status(400).json({ error: 'Valid South African collection and delivery addresses are required for CourierGuy rates' });
  }
  if (!normalizedParcels.length || normalizedParcels.length > 100 || normalizedParcels.some(parcel =>
    ![parcel.weight, parcel.length, parcel.width, parcel.height].every(Number.isFinite) ||
    parcel.weight <= 0 || parcel.length <= 0 || parcel.width <= 0 || parcel.height <= 0
  )) {
    return res.status(400).json({ error: 'Valid weight and dimensions are required for each parcel (maximum 100 parcels)' });
  }

  try {
    const response = await axios.post(SHIPLOGIC_RATES_URL, {
      collection: { address: collection },
      delivery: { address: delivery },
      parcels: normalizedParcels,
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
    })).filter(rate => Number.isFinite(rate.amount) && rate.amount > 0)
      .sort((first, second) => first.amount - second.amount);

    return res.json({ quotes });
  } catch (error) {
    const providerStatus = error.response?.status;
    console.error('CourierGuy rate request failed:', providerStatus || error.code || error.message);
    return res.status(502).json({ error: 'CourierGuy could not return a live rate. Check the address and parcel details.' });
  }
});

router.post('/terminal-africa/rates', async (req, res) => {
  const accessToken = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!accessToken) return res.status(401).json({ error: 'Sign in to calculate shipping' });

  const apiKey = process.env.TERMINAL_AFRICA_SECRET_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Terminal Africa live rates are not configured on the server' });

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
  const currency = String(req.body?.currency || 'ZAR').toUpperCase();
  const supportedCurrencies = new Set(['AED', 'AUD', 'CAD', 'CNY', 'EUR', 'GBP', 'GHS', 'HKD', 'KES', 'NGN', 'TZS', 'UGX', 'USD', 'ZAR']);
  const normalizeAddress = address => ({
    country: String(address?.country || '').trim().toUpperCase(),
    city: String(address?.city || '').trim(),
    state: String(address?.province || address?.state || '').trim(),
    line1: String(address?.street || address?.line1 || '').trim(),
    zip: String(address?.postal_code || address?.zip || '').trim(),
  });
  const pickupAddress = normalizeAddress(collection);
  const deliveryAddress = normalizeAddress(delivery);
  const items = Array.isArray(parcel?.items) ? parcel.items : [];
  const normalizedItems = items.map(item => ({
    name: String(item?.name || '').trim(),
    description: String(item?.description || item?.name || '').trim(),
    type: item?.type,
    currency: String(item?.currency || '').toUpperCase(),
    value: Number(item?.value),
    quantity: Number(item?.quantity),
    weight: Number(item?.weight),
  }));

  if (!/^[A-Z]{2}$/.test(pickupAddress.country) || !/^[A-Z]{2}$/.test(deliveryAddress.country) ||
    (pickupAddress.country !== 'NG' && deliveryAddress.country !== 'NG')) {
    return res.status(400).json({ error: 'Terminal Africa quotes require a valid shipping lane to or from Nigeria' });
  }
  if (!pickupAddress.city || !pickupAddress.state || !pickupAddress.line1 ||
    !deliveryAddress.city || !deliveryAddress.state || !deliveryAddress.line1) {
    return res.status(400).json({ error: 'Complete pickup and delivery street, city, and state details are required' });
  }
  if (!supportedCurrencies.has(currency)) return res.status(400).json({ error: 'Unsupported Terminal Africa quote currency' });
  if (!String(parcel?.description || '').trim() || normalizedItems.length === 0 || normalizedItems.length > 100 ||
    normalizedItems.some(item => !item.name || !item.description || !['document', 'parcel'].includes(item.type) ||
      !supportedCurrencies.has(item.currency) || !Number.isFinite(item.value) || item.value < 0 ||
      !Number.isInteger(item.quantity) || item.quantity < 1 || !Number.isFinite(item.weight) || item.weight <= 0)) {
    return res.status(400).json({ error: 'Each parcel item needs a name, description, supported currency, value, quantity, and weight in kg' });
  }

  const baseUrl = (process.env.TERMINAL_AFRICA_BASE_URL || 'https://sandbox.terminal.africa/v1').replace(/\/+$/, '');
  try {
    const response = await axios.post(`${baseUrl}/rates/shipment/quotes`, {
      pickup_address: pickupAddress,
      delivery_address: deliveryAddress,
      parcel: {
        description: String(parcel.description).trim().slice(0, 500),
        items: normalizedItems,
        weight_unit: 'kg',
      },
      currency,
      persist_data: false,
    }, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 25000,
    });

    const providerRates = Array.isArray(response.data?.data) ? response.data.data : [];
    const quotes = providerRates.map(rate => ({
      amount: Number(rate.amount),
      currency: String(rate.currency || currency).toUpperCase(),
      service: [rate.carrier_name, rate.carrier_rate_description].filter(Boolean).join(' - ') || 'Terminal Africa',
      estimated_delivery: rate.delivery_time || null,
      rate_id: rate.rate_id || rate.id || null,
    })).filter(rate => Number.isFinite(rate.amount) && rate.amount > 0 && rate.currency === currency)
      .sort((first, second) => first.amount - second.amount);

    return res.json({ quotes });
  } catch (error) {
    console.error('Terminal Africa rate request failed:', error.response?.status || error.code || error.message);
    return res.status(502).json({ error: 'Terminal Africa could not return a live rate. Check the addresses and parcel details.' });
  }
});

module.exports = router;
