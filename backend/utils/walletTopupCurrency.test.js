const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getPaystackCurrencies,
  calculateWalletTopupQuote,
} = require('./walletTopupCurrency');

test('Paystack currency configuration is normalized and deduplicated', () => {
  assert.deepEqual(getPaystackCurrencies(' zar,NGN,zar,ABC '), ['ZAR', 'NGN']);
});

test('wallet top-up quote converts between wallet and provider currencies and credits USD', () => {
  const quote = calculateWalletTopupQuote({
    amount: 1000,
    currency: 'ZAR',
    chargeCurrency: 'NGN',
    rates: { USD: 1, ZAR: 18, NGN: 1500 },
  });

  assert.equal(quote.amount_local, 83333.33);
  assert.equal(quote.currency, 'NGN');
  assert.equal(quote.amount_usd, 55.56);
  assert.equal(quote.fx_rate, 0.00066672);
});
