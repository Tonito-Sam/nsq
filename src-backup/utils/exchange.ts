// Utility to fetch exchange rates and convert to USD
// You can replace this with a real API call in production

export async function convertToUSD(amount: number, fromCurrency: string): Promise<number> {
  if (fromCurrency === 'USD') return amount;
  // Example: Use exchangerate-api.com or similar
  try {
    const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${fromCurrency}`);
    const data = await res.json();
    const rate = data.rates['USD'];
    if (!rate) throw new Error('No USD rate');
    return amount * rate;
  } catch (e) {
    // fallback: assume 1:1 if API fails
    return amount;
  }
}
