const crypto = require('crypto');

const QUOTE_LIFETIME_MS = 30 * 60 * 1000;

function getSigningKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  if (!key) throw new Error('Shipping quote signing is not configured');
  return key;
}

function encodeBase64Url(value) {
  return Buffer.from(value).toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function decodeBase64Url(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64 + '='.repeat((4 - base64.length % 4) % 4), 'base64');
}

function createShippingQuoteToken(quote) {
  const payload = encodeBase64Url(JSON.stringify({
    ...quote,
    expiresAt: Date.now() + QUOTE_LIFETIME_MS,
  }));
  const signature = encodeBase64Url(
    crypto.createHmac('sha256', getSigningKey()).update(payload).digest()
  );
  return `${payload}.${signature}`;
}

function verifyShippingQuoteToken(token, expected = {}) {
  if (typeof token !== 'string') return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return null;

  const expectedSignature = crypto.createHmac('sha256', getSigningKey()).update(payload).digest();
  const actualSignature = decodeBase64Url(signature);
  if (actualSignature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(actualSignature, expectedSignature)) return null;

  try {
    const quote = JSON.parse(decodeBase64Url(payload).toString('utf8'));
    if (!quote || !Number.isFinite(quote.expiresAt) || quote.expiresAt <= Date.now()) return null;
    if (expected.userId && quote.userId !== expected.userId) return null;
    if (expected.storeId && quote.storeId !== expected.storeId) return null;
    return quote;
  } catch {
    return null;
  }
}

module.exports = { createShippingQuoteToken, verifyShippingQuoteToken };
