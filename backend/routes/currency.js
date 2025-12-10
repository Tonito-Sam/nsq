const express = require('express');
const axios = require('axios');

const router = express.Router();

// In-memory cache
let cached = null;
let cachedAt = 0;
const CACHE_TTL_MS = (process.env.CURRENCY_CACHE_TTL_MS ? Number(process.env.CURRENCY_CACHE_TTL_MS) : 5 * 60 * 1000); // 5 minutes default

// Optional: store in Supabase if SERVICE_ROLE provided
const SUPABASE_URL = process.env.SUPABASE_URL || null;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || null;

router.get('/rates', async (req, res) => {
  try {
    const now = Date.now();
    if (cached && (now - cachedAt) < CACHE_TTL_MS) {
      return res.json({ source: 'cache', timestamp: cachedAt, rates: cached.rates, base: cached.base });
    }

    // Fetch from exchangerate.host
    const base = req.query.base || 'USD';
    const symbols = req.query.symbols || '';
    const url = `https://api.exchangerate.host/latest?base=${encodeURIComponent(base)}${symbols ? `&symbols=${encodeURIComponent(symbols)}` : ''}`;
    const r = await axios.get(url, { timeout: 10_000 });
    const data = r.data;
    if (!data || !data.rates) return res.status(502).json({ error: 'Invalid rates response' });

    cached = { rates: data.rates, base: data.base || base };
    cachedAt = now;

    // Optionally write to Supabase (best-effort, do not fail request)
    if (SUPABASE_URL && SERVICE_ROLE) {
      try {
        const body = JSON.stringify({ base: cached.base, rates: cached.rates, fetched_at: new Date().toISOString() });
        await axios.post(`${SUPABASE_URL}/rest/v1/currency_rates`, body, { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' }, timeout: 5000 });
      } catch (e) {
        // ignore Supabase write errors
        console.warn('Failed to write currency rates to Supabase (optional):', e && e.message ? e.message : e);
      }
    }

    return res.json({ source: 'remote', timestamp: cachedAt, rates: cached.rates, base: cached.base });
  } catch (e) {
    console.error('currency/rates error', e && e.message ? e.message : e);
    if (cached) return res.json({ source: 'cache-stale', timestamp: cachedAt, rates: cached.rates, base: cached.base });
    return res.status(500).json({ error: 'Failed to fetch currency rates' });
  }
});

module.exports = router;
