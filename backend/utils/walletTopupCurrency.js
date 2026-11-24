const DEFAULT_PAYSTACK_CURRENCIES = ['ZAR', 'NGN', 'GHS', 'KES'];

function getPaystackCurrencies(configuredCurrencies = process.env.PAYSTACK_SUPPORTED_CURRENCIES) {
  const configured = String(configuredCurrencies || DEFAULT_PAYSTACK_CURRENCIES.join(','))
    .split(',')
    .map(currency => currency.trim().toUpperCase())
    .filter(currency => DEFAULT_PAYSTACK_CURRENCIES.includes(currency));
  return [...new Set(configured)];
}

function calculateWalletTopupQuote({ amount, currency, chargeCurrency, rates }) {
  const inputAmount = Number(amount);
  const inputCurrency = String(currency || '').toUpperCase();
  const providerCurrency = String(chargeCurrency || '').toUpperCase();
  const inputRate = Number(rates?.[inputCurrency]);
  const chargeRate = Number(rates?.[providerCurrency]);
  if (!Number.isFinite(inputAmount) || inputAmount <= 0
    || !Number.isFinite(inputRate) || inputRate <= 0
    || !Number.isFinite(chargeRate) || chargeRate <= 0) {
    throw new Error('A valid amount and current exchange rates are required');
  }

  const amountUsdBeforeProviderRounding = inputAmount / inputRate;
  const amountLocal = Number((amountUsdBeforeProviderRounding * chargeRate).toFixed(2));
  if (!Number.isFinite(amountLocal) || amountLocal <= 0) {
    throw new Error('The converted payment amount is too small');
  }

  const amountUsd = Number((amountLocal / chargeRate).toFixed(2));
  return {
    amount_local: amountLocal,
    currency: providerCurrency,
    amount_usd: amountUsd,
    fx_rate: Number((amountUsd / amountLocal).toFixed(8)),
  };
}

module.exports = {
  DEFAULT_PAYSTACK_CURRENCIES,
  getPaystackCurrencies,
  calculateWalletTopupQuote,
};
