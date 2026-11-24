const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_SERVICE_ROLE_KEY = 'shipping-quote-token-test-secret';
const { createShippingQuoteToken, verifyShippingQuoteToken } = require('./shippingQuoteToken');

test('shipping quote token is verifiable only for its intended buyer and store', () => {
  const token = createShippingQuoteToken({
    userId: 'buyer-1',
    storeId: 'store-1',
    provider: 'courierguy',
    rateId: 'rate-1',
    amount: 125.5,
    bookingPayload: { service_level_code: 'standard' },
  });

  const quote = verifyShippingQuoteToken(token, { userId: 'buyer-1', storeId: 'store-1' });
  assert.equal(quote.rateId, 'rate-1');
  assert.equal(verifyShippingQuoteToken(token, { userId: 'buyer-2', storeId: 'store-1' }), null);
  assert.equal(verifyShippingQuoteToken(token, { userId: 'buyer-1', storeId: 'store-2' }), null);
});

test('shipping quote token rejects payload tampering', () => {
  const token = createShippingQuoteToken({
    userId: 'buyer-1',
    storeId: 'store-1',
    provider: 'terminalafrica',
    rateId: 'rate-1',
    amount: 125.5,
  });
  const [payload, signature] = token.split('.');
  const tampered = `${payload.slice(0, -1)}${payload.endsWith('A') ? 'B' : 'A'}.${signature}`;

  assert.equal(verifyShippingQuoteToken(tampered), null);
});
