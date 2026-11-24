const express = require('express');
const axios = require('axios');
const { getExchangeRates } = require('../utils/exchangeRates');

const router = express.Router();

// Optional: store in Supabase if SERVICE_ROLE provided
const SUPABASE_URL = process.env.SUPABASE_URL || null;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || null;

router.get('/rates', async (req, res) => {
  let base;
  let rates;
  let timestamp;
  let source;
  try {
    base = String(req.query.base || 'USD').toUpperCase();
    if (!/^[A-Z]{3}$/.test(base)) return res.status(400).json({ error: 'Invalid currency code' });
    const result = await getExchangeRates(base);
    ({ rates, timestamp, source } = result);

    // Optionally write to Supabase (best-effort, do not fail request)
    if (source === 'remote' && SUPABASE_URL && SERVICE_ROLE) {
      try {
        const body = JSON.stringify({ base, rates, fetched_at: new Date(timestamp).toISOString() });
        await axios.post(`${SUPABASE_URL}/rest/v1/currency_rates`, body, { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' }, timeout: 5000 });
      } catch (e) {
        // ignore Supabase write errors
        console.warn('Failed to write currency rates to Supabase (optional):', e && e.message ? e.message : e);
      }
    }

    const requestedSymbols = String(req.query.symbols || '')
      .split(',')
      .map(symbol => symbol.trim().toUpperCase())
      .filter(Boolean);
    const responseRates = requestedSymbols.length
      ? Object.fromEntries(requestedSymbols.filter(symbol => rates[symbol]).map(symbol => [symbol, rates[symbol]]))
      : rates;
    return res.json({ source, timestamp, rates: responseRates, base });
  } catch (e) {
    console.error('currency/rates error', e && e.message ? e.message : e);
    return res.status(500).json({ error: 'Failed to fetch currency rates' });
  }
});

module.exports = router;
