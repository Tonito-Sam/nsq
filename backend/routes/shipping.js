const express = require('express');
const axios = require('axios');
const { createShippingQuoteToken, verifyShippingQuoteToken } = require('../utils/shippingQuoteToken');

const router = express.Router();
const SHIPLOGIC_RATES_URL = 'https://api.shiplogic.com/v2/rates';
const SHIPLOGIC_SHIPMENTS_URL = 'https://api.shiplogic.com/v2/shipments';
const TERMINAL_AFRICA_BASE_URL = (process.env.TERMINAL_AFRICA_BASE_URL || 'https://api.terminal.africa/v1').replace(/\/+$/, '');

function getSupabaseCredentials() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  return url && key ? { url, key } : null;
}

function getServiceHeaders(auth) {
  return { apikey: auth.key, Authorization: `Bearer ${auth.key}` };
}

function normalizeShippingAddress(address) {
  return {
    country: String(address?.country || '').trim().toUpperCase(),
    postal_code: String(address?.postal_code || '').trim(),
    city: String(address?.city || '').trim(),
    street: String(address?.street || '').trim(),
    province: String(address?.province || address?.state || '').trim(),
    suburb: String(address?.suburb || '').trim(),
    name: String(address?.name || '').trim(),
    email: String(address?.email || '').trim(),
    phone: String(address?.phone || '').trim(),
  };
}

async function authenticate(req) {
  const credentials = getSupabaseCredentials();
  const accessToken = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!credentials || !accessToken) return null;

  const response = await axios.get(`${credentials.url}/auth/v1/user`, {
    headers: { apikey: credentials.key, Authorization: `Bearer ${accessToken}` },
    timeout: 10000,
  });
  return response.data?.id ? { ...credentials, userId: response.data.id } : null;
}

async function loadStorePickup(auth, storeId) {
  const response = await axios.get(
    `${auth.url}/rest/v1/user_stores?select=id,country,base_currency,shipping_pickup_address,shipping_pickup_suburb,shipping_pickup_city,shipping_pickup_province,shipping_pickup_postal_code,shipping_pickup_name,shipping_pickup_email,shipping_pickup_phone&id=eq.${encodeURIComponent(storeId)}&limit=1`,
    { headers: getServiceHeaders(auth), timeout: 10000 }
  );
  const store = response.data?.[0];
  if (!store) throw Object.assign(new Error('Store not found'), { statusCode: 404 });

  const fullName = String(store.shipping_pickup_name || '').trim();
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  return {
    country: String(store.country || '').trim().toUpperCase(),
    postal_code: String(store.shipping_pickup_postal_code || '').trim(),
    city: String(store.shipping_pickup_city || '').trim(),
    street: String(store.shipping_pickup_address || '').trim(),
    province: String(store.shipping_pickup_province || '').trim(),
    suburb: String(store.shipping_pickup_suburb || '').trim(),
    name: fullName,
    first_name: nameParts[0] || '',
    last_name: nameParts.slice(1).join(' '),
    email: String(store.shipping_pickup_email || '').trim(),
    phone: String(store.shipping_pickup_phone || '').trim(),
    currency: String(store.base_currency || 'ZAR').trim().toUpperCase(),
  };
}

async function loadTrustedProductLines(auth, storeId, submittedLines, currency) {
  if (!Array.isArray(submittedLines) || !submittedLines.length || submittedLines.length > 100) {
    throw Object.assign(new Error('Select at least one physical product to get a shipping quote'), { statusCode: 400 });
  }
  const lines = submittedLines.map(line => ({
    productId: String(line?.product_id || ''),
    quantity: Number(line?.quantity),
  }));
  const totalParcels = lines.reduce((sum, line) => sum + line.quantity, 0);
  if (lines.some(line => !/^[0-9a-f-]{36}$/i.test(line.productId) ||
    !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 99) ||
    totalParcels > 100) {
    throw Object.assign(new Error('Product quantities are invalid or exceed 100 parcels'), { statusCode: 400 });
  }

  const productIds = [...new Set(lines.map(line => line.productId))];
  const productsResponse = await axios.get(
    `${auth.url}/rest/v1/store_products?select=id,store_id,title,description,product_type,price,is_on_sale,sale_price,sale_starts,sale_ends,shipping_weight_kg,shipping_length_cm,shipping_width_cm,shipping_height_cm&id=in.(${productIds.join(',')})`,
    { headers: getServiceHeaders(auth), timeout: 10000 }
  );
  const products = new Map((productsResponse.data || []).map(product => [product.id, product]));
  if (products.size !== productIds.length) {
    throw Object.assign(new Error('One or more products are no longer available'), { statusCode: 400 });
  }

  const quoteItems = lines.map(line => {
    const product = products.get(line.productId);
    const productType = String(product.product_type || '').toLowerCase();
    const dimensions = {
      weight: Number(product.shipping_weight_kg),
      length: Number(product.shipping_length_cm),
      width: Number(product.shipping_width_cm),
      height: Number(product.shipping_height_cm),
    };
    if (product.store_id !== storeId || ['digital', 'download', 'service'].some(type => productType.includes(type)) ||
      Object.values(dimensions).some(value => !Number.isFinite(value) || value <= 0)) {
      throw Object.assign(new Error('Each selected physical product must belong to this store and have valid parcel measurements'), { statusCode: 400 });
    }

    const now = Date.now();
    const starts = product.sale_starts ? Date.parse(product.sale_starts) : Number.NEGATIVE_INFINITY;
    const ends = product.sale_ends ? Date.parse(product.sale_ends) : Number.POSITIVE_INFINITY;
    const saleActive = product.is_on_sale && Number(product.sale_price) > 0 && starts <= now && ends >= now;
    return {
      productId: line.productId,
      quantity: line.quantity,
      name: String(product.title || 'Product').slice(0, 120),
      description: String(product.description || product.title || 'Product').slice(0, 500),
      value: Math.max(0, Number(saleActive ? product.sale_price : product.price) || 0),
      ...dimensions,
    };
  });

  return {
    productLines: quoteItems.map(item => ({ product_id: item.productId, quantity: item.quantity })),
    description: quoteItems.map(item => item.name).join(', ').slice(0, 500),
    parcels: quoteItems.flatMap(item => Array.from({ length: item.quantity }, () => ({
      weight: item.weight,
      length: item.length,
      width: item.width,
      height: item.height,
    }))),
    items: quoteItems.map(item => ({
      name: item.name,
      description: item.description,
      type: 'parcel',
      currency,
      value: item.value,
      quantity: item.quantity,
      weight: item.weight,
    })),
  };
}

router.post('/courierguy/rates', async (req, res) => {
  const apiKey = process.env.COURIERGUY_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'CourierGuy live rates are not configured on the server' });
  let auth;
  try {
    auth = await authenticate(req);
    if (!auth) {
      if (!req.get('authorization')) return res.status(401).json({ error: 'Sign in to calculate shipping' });
      return res.status(401).json({ error: 'Your session is invalid or expired' });
    }
  } catch (error) {
    return res.status(401).json({ error: 'Your session is invalid or expired' });
  }

  const { delivery } = req.body || {};
  const storeId = String(req.body?.store_id || '');
  if (!/^[0-9a-f-]{36}$/i.test(storeId)) return res.status(400).json({ error: 'A valid store is required for a shipping quote' });
  let collection;
  let trustedItems;
  try {
    collection = await loadStorePickup(auth, storeId);
    trustedItems = await loadTrustedProductLines(auth, storeId, req.body?.product_items, 'ZAR');
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('Could not load trusted shipping details:', error.response?.status || error.code || error.message);
    return res.status(502).json({ error: 'Could not load the seller pickup address and parcel details' });
  }
  const validAddress = address => address &&
    String(address.country || '').toUpperCase() === 'ZA' &&
    typeof address.city === 'string' && address.city.trim() &&
    typeof address.street === 'string' && address.street.trim() &&
    typeof address.province === 'string' && address.province.trim() &&
    typeof address.postal_code === 'string' && address.postal_code.trim();
  const normalizedParcels = trustedItems.parcels;

  if (!/^[0-9a-f-]{36}$/i.test(storeId) || !validAddress(collection) || !validAddress(delivery)) {
    return res.status(400).json({ error: 'Valid South African collection and delivery addresses are required for CourierGuy rates' });
  }
  if (!normalizedParcels.length || normalizedParcels.length > 100 || normalizedParcels.some(parcel =>
    ![parcel.weight, parcel.length, parcel.width, parcel.height].every(Number.isFinite) ||
    parcel.weight <= 0 || parcel.length <= 0 || parcel.width <= 0 || parcel.height <= 0
  )) {
    return res.status(400).json({ error: 'Valid weight and dimensions are required for each parcel (maximum 100 parcels)' });
  }

  try {
    const shipmentPayload = {
      collection_address: {
        type: 'business',
        street_address: collection.street.trim(),
        local_area: String(collection.suburb || collection.city).trim(),
        city: collection.city.trim(),
        zone: String(collection.province || collection.state || '').trim(),
        country: 'ZA',
        code: collection.postal_code.trim(),
      },
      delivery_address: {
        type: 'residential',
        street_address: delivery.street.trim(),
        local_area: String(delivery.suburb || delivery.city).trim(),
        city: delivery.city.trim(),
        zone: String(delivery.province || delivery.state || '').trim(),
        country: 'ZA',
        code: delivery.postal_code.trim(),
      },
      parcels: normalizedParcels.map(parcel => ({
        parcel_description: trustedItems.description,
        submitted_length_cm: parcel.length,
        submitted_width_cm: parcel.width,
        submitted_height_cm: parcel.height,
        submitted_weight_kg: parcel.weight,
      })),
      opt_in_rates: [],
      opt_in_time_based_rates: [],
    };
    const response = await axios.post(SHIPLOGIC_RATES_URL, shipmentPayload, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 15000,
    });

    const payload = response.data;
    const rates = Array.isArray(payload) ? payload
      : Array.isArray(payload?.rates) ? payload.rates
        : Array.isArray(payload?.data) ? payload.data : [];
    const quotes = rates.map(rate => ({
      provider: 'courierguy',
      rate_id: String(rate.rate_id || rate.id || ''),
      service_code: String(rate.service_level?.code || rate.service_level_code || ''),
      service: String(rate.service_level?.name || rate.service_level_name || rate.name || 'CourierGuy'),
      amount: Number(rate.total ?? rate.total_price ?? rate.amount),
      currency: String(rate.currency || payload.currency || 'ZAR').toUpperCase(),
      estimated_delivery: rate.delivery_date || rate.estimated_delivery || rate.estimated_delivery_date || null,
    })).filter(rate => Number.isFinite(rate.amount) && rate.amount >= 0 && rate.rate_id && rate.service_code)
      .sort((first, second) => first.amount - second.amount);

    const signedQuotes = quotes.map(quote => ({
      ...quote,
      quote_token: createShippingQuoteToken({
        userId: auth.userId,
        storeId,
        productLines: trustedItems.productLines,
        deliveryAddress: normalizeShippingAddress(delivery),
        provider: quote.provider,
        rateId: quote.rate_id,
        service: quote.service,
        amount: quote.amount,
        currency: quote.currency,
        estimatedDelivery: quote.estimated_delivery,
        bookingPayload: {
          ...shipmentPayload,
          service_level_code: quote.service_code,
        },
      }),
    }));
    return res.json({ quotes: signedQuotes });
  } catch (error) {
    const providerStatus = error.response?.status;
    console.error('CourierGuy rate request failed:', providerStatus || error.code || error.message);
    return res.status(502).json({ error: 'CourierGuy could not return a live rate. Check the address and parcel details.' });
  }
});

router.post('/terminal-africa/rates', async (req, res) => {
  const apiKey = process.env.TERMINAL_AFRICA_SECRET_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Terminal Africa live rates are not configured on the server' });
  let auth;
  try {
    auth = await authenticate(req);
    if (!auth) {
      if (!req.get('authorization')) return res.status(401).json({ error: 'Sign in to calculate shipping' });
      return res.status(401).json({ error: 'Your session is invalid or expired' });
    }
  } catch (error) {
    return res.status(401).json({ error: 'Your session is invalid or expired' });
  }

  const { delivery } = req.body || {};
  const storeId = String(req.body?.store_id || '');
  if (!/^[0-9a-f-]{36}$/i.test(storeId)) return res.status(400).json({ error: 'A valid store is required for a shipping quote' });
  const currency = String(req.body?.currency || 'ZAR').toUpperCase();
  const supportedCurrencies = new Set(['AED', 'AUD', 'CAD', 'CNY', 'EUR', 'GBP', 'GHS', 'HKD', 'KES', 'NGN', 'TZS', 'UGX', 'USD', 'ZAR']);
  let collection;
  let trustedItems;
  try {
    collection = await loadStorePickup(auth, storeId);
    trustedItems = await loadTrustedProductLines(auth, storeId, req.body?.product_items, collection.currency);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('Could not load trusted shipping details:', error.response?.status || error.code || error.message);
    return res.status(502).json({ error: 'Could not load the seller pickup address and parcel details' });
  }
  const normalizeAddress = address => {
    const fullName = String(address?.name || '').trim();
    const nameParts = fullName.split(/\s+/).filter(Boolean);
    return {
      country: String(address?.country || '').trim().toUpperCase(),
      city: String(address?.city || '').trim(),
      state: String(address?.province || address?.state || '').trim(),
      line1: String(address?.street || address?.line1 || '').trim(),
      line2: String(address?.line2 || '').trim(),
      zip: String(address?.postal_code || address?.zip || '').trim(),
      first_name: String(address?.first_name || nameParts[0] || '').trim(),
      last_name: String(address?.last_name || nameParts.slice(1).join(' ') || '').trim(),
      name: fullName,
      email: String(address?.email || '').trim(),
      phone: String(address?.phone || '').trim(),
      is_residential: address?.is_residential !== false,
    };
  };
  const pickupAddress = normalizeAddress(collection);
  const deliveryAddress = normalizeAddress(delivery);
  const items = trustedItems.items;
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
  if (![pickupAddress, deliveryAddress].every(address =>
    address.city && address.state && address.line1 && address.zip &&
    address.first_name && address.last_name && address.email && address.phone
  )) {
    return res.status(400).json({ error: 'Complete pickup and delivery addresses, postal codes, names, email addresses, and phone numbers are required' });
  }
  if (!supportedCurrencies.has(currency)) return res.status(400).json({ error: 'Unsupported Terminal Africa quote currency' });
  if (!trustedItems.description || normalizedItems.length === 0 || normalizedItems.length > 100 ||
    normalizedItems.some(item => !item.name || !item.description || !['document', 'parcel'].includes(item.type) ||
      !supportedCurrencies.has(item.currency) || !Number.isFinite(item.value) || item.value < 0 ||
      !Number.isInteger(item.quantity) || item.quantity < 1 || !Number.isFinite(item.weight) || item.weight <= 0)) {
    return res.status(400).json({ error: 'Each parcel item needs a name, description, supported currency, value, quantity, and weight in kg' });
  }

  try {
    const response = await axios.post(`${TERMINAL_AFRICA_BASE_URL}/rates/shipment/quotes`, {
      pickup_address: pickupAddress,
      delivery_address: deliveryAddress,
      parcel: {
        description: trustedItems.description,
        items: normalizedItems,
        weight_unit: 'kg',
      },
      currency,
      persist_data: true,
    }, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 25000,
    });

    const providerRates = Array.isArray(response.data?.data) ? response.data.data : [];
    const quotes = providerRates.map(rate => ({
      provider: 'terminalafrica',
      amount: Number(rate.amount),
      currency: String(rate.currency || currency).toUpperCase(),
      service: [rate.carrier_name, rate.carrier_rate_description].filter(Boolean).join(' - ') || 'Terminal Africa',
      estimated_delivery: rate.delivery_date || rate.delivery_time || null,
      rate_id: String(rate.rate_id || ''),
      pickup_options: Array.isArray(rate.pickup_options) ? rate.pickup_options : [],
    })).filter(rate => Number.isFinite(rate.amount) && rate.amount >= 0 && rate.rate_id && rate.currency === currency)
      .sort((first, second) => first.amount - second.amount);

    const signedQuotes = quotes.map(quote => ({
      ...quote,
      quote_token: createShippingQuoteToken({
        userId: auth.userId,
        storeId,
        productLines: trustedItems.productLines,
        deliveryAddress: normalizeShippingAddress(delivery),
        provider: quote.provider,
        rateId: quote.rate_id,
        service: quote.service,
        amount: quote.amount,
        currency: quote.currency,
        estimatedDelivery: quote.estimated_delivery,
        bookingPayload: {
          rate_id: quote.rate_id,
          pickup_option: quote.pickup_options[0]?.type || 'pickup',
        },
      }),
    }));
    return res.json({ quotes: signedQuotes });
  } catch (error) {
    console.error('Terminal Africa rate request failed:', error.response?.status || error.code || error.message);
    return res.status(502).json({ error: 'Terminal Africa could not return a live rate. Check the addresses and parcel details.' });
  }
});

router.post('/orders/:orderId/book', async (req, res) => {
  const authHeader = req.get('authorization');
  if (!authHeader) return res.status(401).json({ error: 'Sign in to book this shipment' });

  let auth;
  try {
    auth = await authenticate(req);
  } catch {
    return res.status(401).json({ error: 'Your session is invalid or expired' });
  }
  if (!auth) return res.status(401).json({ error: 'Your session is invalid or expired' });

  const orderId = String(req.params.orderId || '');
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return res.status(400).json({ error: 'A valid order ID is required' });

  const orderUrl = `${auth.url}/rest/v1/orders`;
  const headers = { apikey: auth.key, Authorization: `Bearer ${auth.key}`, 'Content-Type': 'application/json' };
  let order;
  try {
    const orderResponse = await axios.get(
      `${orderUrl}?select=id,user_id,store_id,status,shipping_provider,shipping_rate_id,shipping_quote_token,shipping_service,shipping_status,shipping_shipment_id,tracking_number,tracking_url,shipping_label_url,carrier&id=eq.${encodeURIComponent(orderId)}&limit=1`,
      { headers, timeout: 10000 }
    );
    order = orderResponse.data?.[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const storeResponse = await axios.get(
      `${auth.url}/rest/v1/user_stores?select=user_id&id=eq.${encodeURIComponent(order.store_id)}&limit=1`,
      { headers, timeout: 10000 }
    );
    if (storeResponse.data?.[0]?.user_id !== auth.userId) {
      return res.status(403).json({ error: 'Only this store’s owner can book its shipment' });
    }
  } catch (error) {
    console.error('Could not load order for shipment booking:', error.response?.status || error.code || error.message);
    return res.status(502).json({ error: 'Could not verify this order for shipment booking' });
  }

  if (order.shipping_status === 'booked') {
    return res.json({ order });
  }
  if (!['paid', 'processing'].includes(order.status)) {
    return res.status(409).json({ error: 'Only paid orders can be shipped' });
  }
  if (order.shipping_status !== 'ready_to_book' || !order.shipping_rate_id) {
    return res.status(409).json({ error: 'This order does not have a bookable live shipping quote. Recalculate shipping before checkout.' });
  }
  const quote = verifyShippingQuoteToken(order.shipping_quote_token, {
    userId: order.user_id,
    storeId: order.store_id,
  });
  if (!quote || quote.provider !== order.shipping_provider || quote.rateId !== order.shipping_rate_id) {
    return res.status(409).json({ error: 'The saved shipping quote is invalid or expired. Contact support before booking.' });
  }

  const claimResponse = await axios.patch(
    `${orderUrl}?id=eq.${encodeURIComponent(orderId)}&shipping_status=eq.ready_to_book&status=in.(paid,processing)`,
    { shipping_status: 'booking' },
    { headers: { ...headers, Prefer: 'return=representation' }, timeout: 10000 }
  ).catch(error => {
    console.error('Could not claim order for shipment booking:', error.response?.status || error.code || error.message);
    return null;
  });
  if (!claimResponse?.data?.length) {
    return res.status(409).json({ error: 'This shipment is already being booked or is no longer available' });
  }

  let shipment;
  try {
    if (quote.provider === 'terminalafrica') {
      const apiKey = process.env.TERMINAL_AFRICA_SECRET_KEY;
      if (!apiKey) throw Object.assign(new Error('Terminal Africa live booking is not configured on the server'), { statusCode: 503 });
      const response = await axios.post(`${TERMINAL_AFRICA_BASE_URL}/shipments/pickup`, quote.bookingPayload, {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 30000,
      });
      shipment = response.data?.data;
    } else if (quote.provider === 'courierguy') {
      const apiKey = process.env.COURIERGUY_API_KEY;
      const payload = quote.bookingPayload;
      if (!apiKey) throw Object.assign(new Error('CourierGuy live booking is not configured on the server'), { statusCode: 503 });
      if (!payload || !payload.service_level_code || !Array.isArray(payload.parcels) || !payload.parcels.length) {
        throw Object.assign(new Error('The saved CourierGuy shipment details are incomplete'), { statusCode: 409 });
      }
      const response = await axios.post(SHIPLOGIC_SHIPMENTS_URL, {
        ...payload,
        customer_reference: orderId,
        mute_notifications: false,
      }, {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 30000,
      });
      shipment = response.data?.data || response.data;
    } else {
      throw Object.assign(new Error('This shipping provider is not supported for booking'), { statusCode: 409 });
    }
  } catch (error) {
    await axios.patch(
      `${orderUrl}?id=eq.${encodeURIComponent(orderId)}&shipping_status=eq.booking`,
      { shipping_status: 'ready_to_book' },
      { headers, timeout: 10000 }
    ).catch(resetError => {
      console.error('Could not reset failed shipment booking:', resetError.response?.status || resetError.code || resetError.message);
    });
    const statusCode = Number(error.statusCode) || 502;
    if (statusCode === 502) {
      console.error('Carrier shipment booking failed:', error.response?.status || error.code || error.message);
      return res.status(statusCode).json({ error: 'The carrier could not book this shipment. Check the quote and parcel details before retrying.' });
    }
    return res.status(statusCode).json({ error: error.message });
  }

  const shipmentId = String(shipment?.shipment_id || shipment?.id || '');
  if (!shipmentId) {
    console.error('Carrier booking returned no shipment ID for order:', orderId);
    return res.status(502).json({ error: 'The carrier response did not include a shipment ID. Contact support before retrying to avoid duplicate charges.' });
  }

  const extras = shipment.extras || {};
  const trackingNumber = extras.tracking_number || shipment.tracking_reference || shipment.tracking_number || shipment.carrier_tracking_number || null;
  const trackingUrl = extras.tracking_url || shipment.tracking_url || null;
  const labelUrl = extras.shipping_label_url || shipment.shipping_label_url || shipment.label_url || null;
  const updatedFields = {
    shipping_status: 'booked',
    shipping_shipment_id: shipmentId,
    tracking_number: trackingNumber,
    tracking_url: trackingUrl,
    shipping_label_url: labelUrl,
    carrier: shipment.carrier?.name || order.shipping_service,
    status: 'shipped',
  };

  try {
    const updateResponse = await axios.patch(
      `${orderUrl}?id=eq.${encodeURIComponent(orderId)}&shipping_status=eq.booking`,
      updatedFields,
      { headers: { ...headers, Prefer: 'return=representation' }, timeout: 10000 }
    );
    if (!updateResponse.data?.length) throw new Error('Shipment booking state changed before it could be saved');
    return res.json({ order: updateResponse.data[0] });
  } catch (error) {
    console.error('Carrier booked shipment but order update failed:', error.response?.status || error.code || error.message);
    return res.status(502).json({ error: 'The carrier booked this shipment but NexSq could not save the tracking details. Contact support before retrying.' });
  }
});

module.exports = router;
