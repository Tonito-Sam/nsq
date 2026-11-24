const axios = require('axios');

const cache = new Map();
const configuredTtl = Number(process.env.CURRENCY_CACHE_TTL_MS);
const CACHE_TTL_MS = Number.isFinite(configuredTtl) && configuredTtl > 0
  ? configuredTtl
  : 5 * 60 * 1000;

async function getExchangeRates(currencyCode) {
  const base = String(currencyCode || 'USD').toUpperCase();
  if (!/^[A-Z]{3}$/.test(base)) throw new Error('Invalid currency code');

  const now = Date.now();
  const cached = cache.get(base);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return { ...cached, source: 'cache' };
  }

  try {
    const response = await axios.get(
      `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`,
      { timeout: 10000 }
    );
    const data = response.data;
    if (data?.result !== 'success' || !data.rates || typeof data.rates !== 'object') {
      throw new Error('Invalid exchange-rate response');
    }

    const rates = Object.fromEntries(
      Object.entries(data.rates).filter(([, value]) => Number.isFinite(value) && value > 0)
    );
    rates[base] = 1;
    if (!Number.isFinite(rates.USD) || rates.USD <= 0) {
      throw new Error(`Exchange rate for USD was not returned for ${base}`);
    }

    const result = { rates, base, timestamp: now };
    cache.set(base, result);
    return { ...result, source: 'remote' };
  } catch (error) {
    if (cached) return { ...cached, source: 'cache-stale' };
    throw error;
  }
}

module.exports = { getExchangeRates };
