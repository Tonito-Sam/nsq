import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ArrowLeftRight, DollarSign, RefreshCw, Globe } from 'lucide-react';

// Free exchange rate API (public fallback)
const EXCHANGE_API_URL_BASE = 'https://open.er-api.com/v6/latest';
// Backend base path (prefer this so server-side caching / proxy is used)
import apiUrl from '@/lib/api';
const BACKEND_API_PATH = (base = 'USD') => apiUrl(`/api/currency/rates?base=${encodeURIComponent(base)}`);

// All major world currencies and top 30 African currencies
const CURRENCY_DATA: Record<string, { name: string; symbol: string; emoji: string; category: string }> = {
  'USD': { name: 'US Dollar', symbol: '$', emoji: '🇺🇸', category: 'world' },
  'EUR': { name: 'Euro', symbol: '€', emoji: '🇪🇺', category: 'world' },
  'GBP': { name: 'British Pound', symbol: '£', emoji: '🇬🇧', category: 'world' },
  'JPY': { name: 'Japanese Yen', symbol: '¥', emoji: '🇯🇵', category: 'world' },
  'CNY': { name: 'Chinese Yuan', symbol: '¥', emoji: '🇨🇳', category: 'world' },
  'AUD': { name: 'Australian Dollar', symbol: 'A$', emoji: '🇦🇺', category: 'world' },
  'CAD': { name: 'Canadian Dollar', symbol: 'C$', emoji: '🇨🇦', category: 'world' },
  'CHF': { name: 'Swiss Franc', symbol: 'CHF', emoji: '🇨🇭', category: 'world' },
  'INR': { name: 'Indian Rupee', symbol: '₹', emoji: '🇮🇳', category: 'world' },
  'SGD': { name: 'Singapore Dollar', symbol: 'S$', emoji: '🇸🇬', category: 'world' },
  'HKD': { name: 'Hong Kong Dollar', symbol: 'HK$', emoji: '🇭🇰', category: 'world' },
  'KRW': { name: 'South Korean Won', symbol: '₩', emoji: '🇰🇷', category: 'world' },
  'MXN': { name: 'Mexican Peso', symbol: 'MX$', emoji: '🇲🇽', category: 'world' },
  'BRL': { name: 'Brazilian Real', symbol: 'R$', emoji: '🇧🇷', category: 'world' },
  'RUB': { name: 'Russian Ruble', symbol: '₽', emoji: '🇷🇺', category: 'world' },
  'TRY': { name: 'Turkish Lira', symbol: '₺', emoji: '🇹🇷', category: 'world' },
  'SAR': { name: 'Saudi Riyal', symbol: 'SR', emoji: '🇸🇦', category: 'world' },
  'AED': { name: 'UAE Dirham', symbol: 'د.إ', emoji: '🇦🇪', category: 'world' },
  'ZAR': { name: 'South African Rand', symbol: 'R', emoji: '🇿🇦', category: 'africa' },
  'NGN': { name: 'Nigerian Naira', symbol: '₦', emoji: '🇳🇬', category: 'africa' },
  'EGP': { name: 'Egyptian Pound', symbol: 'E£', emoji: '🇪🇬', category: 'africa' },
  'KES': { name: 'Kenyan Shilling', symbol: 'KSh', emoji: '🇰🇪', category: 'africa' },
  'GHS': { name: 'Ghanaian Cedi', symbol: 'GH₵', emoji: '🇬🇭', category: 'africa' },
  'ETB': { name: 'Ethiopian Birr', symbol: 'Br', emoji: '🇪🇹', category: 'africa' },
  'DZD': { name: 'Algerian Dinar', symbol: 'د.ج', emoji: '🇩🇿', category: 'africa' },
  'MAD': { name: 'Moroccan Dirham', symbol: 'د.م.', emoji: '🇲🇦', category: 'africa' },
  'TZS': { name: 'Tanzanian Shilling', symbol: 'TSh', emoji: '🇹🇿', category: 'africa' },
  'UGX': { name: 'Ugandan Shilling', symbol: 'USh', emoji: '🇺🇬', category: 'africa' },
  'CDF': { name: 'Congolese Franc', symbol: 'FC', emoji: '🇨🇩', category: 'africa' },
  'XOF': { name: 'West African CFA Franc', symbol: 'CFA', emoji: '🌍', category: 'africa' },
  'XAF': { name: 'Central African CFA Franc', symbol: 'FCFA', emoji: '🌍', category: 'africa' },
  'MZN': { name: 'Mozambican Metical', symbol: 'MT', emoji: '🇲🇿', category: 'africa' },
  'MWK': { name: 'Malawian Kwacha', symbol: 'MK', emoji: '🇲🇼', category: 'africa' },
  'ZMW': { name: 'Zambian Kwacha', symbol: 'ZK', emoji: '🇿🇲', category: 'africa' },
  'RWF': { name: 'Rwandan Franc', symbol: 'FRw', emoji: '🇷🇼', category: 'africa' },
  'SZL': { name: 'Swazi Lilangeni', symbol: 'L', emoji: '🇸🇿', category: 'africa' },
  'LRD': { name: 'Liberian Dollar', symbol: 'L$', emoji: '🇱🇷', category: 'africa' },
  'LSL': { name: 'Lesotho Loti', symbol: 'L', emoji: '🇱🇸', category: 'africa' },
  'NAD': { name: 'Namibian Dollar', symbol: 'N$', emoji: '🇳🇦', category: 'africa' },
  'SDG': { name: 'Sudanese Pound', symbol: 'ج.س.', emoji: '🇸🇩', category: 'africa' },
  'TND': { name: 'Tunisian Dinar', symbol: 'د.ت', emoji: '🇹🇳', category: 'africa' },
  'LYD': { name: 'Libyan Dinar', symbol: 'ل.د', emoji: '🇱🇾', category: 'africa' },
  'BIF': { name: 'Burundian Franc', symbol: 'FBu', emoji: '🇧🇮', category: 'africa' },
  'DJF': { name: 'Djiboutian Franc', symbol: 'Fdj', emoji: '🇩🇯', category: 'africa' },
  'GMD': { name: 'Gambian Dalasi', symbol: 'D', emoji: '🇬🇲', category: 'africa' },
  'GNF': { name: 'Guinean Franc', symbol: 'FG', emoji: '🇬🇳', category: 'africa' },
  'MGA': { name: 'Malagasy Ariary', symbol: 'Ar', emoji: '🇲🇬', category: 'africa' },
  'MRU': { name: 'Mauritanian Ouguiya', symbol: 'UM', emoji: '🇲🇷', category: 'africa' },
  'SCR': { name: 'Seychellois Rupee', symbol: 'SR', emoji: '🇸🇨', category: 'africa' },
  'SLL': { name: 'Sierra Leonean Leone', symbol: 'Le', emoji: '🇸🇱', category: 'africa' },
  'SOS': { name: 'Somali Shilling', symbol: 'Sh.So.', emoji: '🇸🇴', category: 'africa' },
  'SSP': { name: 'South Sudanese Pound', symbol: '£', emoji: '🇸🇸', category: 'africa' },
  'STN': { name: 'Sao Tomean Dobra', symbol: 'Db', emoji: '🇸🇹', category: 'africa' }
};

interface Props {
  userCurrency?: string;
  walletBalance?: number;
}

const ExchangeRatesCard: React.FC<Props> = ({ userCurrency = 'USD', walletBalance = 1000 }) => {
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'world' | 'africa'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [converterAmount, setConverterAmount] = useState('1');
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState(CURRENCY_DATA[userCurrency] ? userCurrency : 'USD');
  const previousUserCurrency = useRef(userCurrency);

  const availableCurrencies = Object.keys(CURRENCY_DATA).filter((code) =>
    rates && Number.isFinite(rates[code]) && rates[code] > 0
  );
  const amountValue = converterAmount.trim() === '' ? Number.NaN : Number(converterAmount);
  const convertedValue = rates
    && Number.isFinite(amountValue)
    && amountValue >= 0
    && Number.isFinite(rates[fromCurrency])
    && rates[fromCurrency] > 0
    && Number.isFinite(rates[toCurrency])
    && rates[toCurrency] > 0
    ? amountValue / rates[fromCurrency] * rates[toCurrency]
    : null;
  const walletInLocalCurrency = rates && Number.isFinite(rates[userCurrency]) && rates[userCurrency] > 0
    ? (walletBalance * rates[userCurrency]).toFixed(2)
    : null;

  const filteredCurrencies = Object.entries(CURRENCY_DATA)
    .filter(([code, data]) => {
      if (selectedCategory === 'world' && data.category !== 'world') return false;
      if (selectedCategory === 'africa' && data.category !== 'africa') return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          code.toLowerCase().includes(query) ||
          data.name.toLowerCase().includes(query) ||
          data.symbol.toLowerCase().includes(query)
        );
      }
      return true;
    })
    .slice(0, 10);

  const fetchExchangeRates = useCallback(async () => {
    try {
      setRatesLoading(true);
      setError(null);
      // Try backend first (uses service-side caching if available)
      let data: any = null;
      try {
        const backendUrl = BACKEND_API_PATH('USD');
        const backendResp = await fetch(backendUrl);
        if (backendResp.ok) {
          const responseData = await backendResp.json();
          if ((!responseData.base || responseData.base === 'USD') && responseData.source !== 'cache-stale') {
            data = responseData;
          }
        } else {
          console.warn('Backend currency route returned non-OK', backendResp.status);
        }
      } catch (be) {
        console.warn('Backend currency route failed:', be);
      }

      // If backend didn't provide data, fall back to public API
      if (!data) {
        const response = await fetch(`${EXCHANGE_API_URL_BASE}/USD`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        data = await response.json();
      }

      const apiRates = data.rates || data.conversion_rates;
      if (data.result && data.result !== 'success') throw new Error('The exchange-rate provider reported an error.');
      if (!apiRates || typeof apiRates !== 'object') throw new Error('The exchange-rate response was invalid.');
      const validRates = Object.fromEntries(
        Object.entries(apiRates).filter(([, value]) => typeof value === 'number' && Number.isFinite(value) && value > 0)
      ) as Record<string, number>;
      validRates.USD = 1;
      if (Object.keys(validRates).length < 2) throw new Error('No usable exchange rates were returned.');

      setRates(validRates);
      const timestamp = data.timestamp || data.time_last_updated || data.updated_at || data.updatedAt;
      const parsedTimestamp = timestamp
        ? new Date(typeof timestamp === 'number' && timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp)
        : new Date();
      setUpdatedAt(Number.isNaN(parsedTimestamp.getTime()) ? new Date() : parsedTimestamp);
    } catch (err: unknown) {
      console.error('Failed to fetch exchange rates:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRatesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExchangeRates();
    const intervalId = setInterval(fetchExchangeRates, 5 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [fetchExchangeRates]);

  useEffect(() => {
    if (previousUserCurrency.current !== userCurrency) {
      previousUserCurrency.current = userCurrency;
      if (CURRENCY_DATA[userCurrency]) setToCurrency(userCurrency);
    }
  }, [userCurrency]);

  useEffect(() => {
    if (!rates) return;
    if (!rates[fromCurrency]) setFromCurrency('USD');
    if (!rates[toCurrency]) setToCurrency(rates[userCurrency] ? userCurrency : 'USD');
  }, [rates, userCurrency, fromCurrency, toCurrency]);

  const handleRefresh = () => fetchExchangeRates();
  const handleSwapCurrencies = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };
  const formatConvertedValue = (value: number, currency: string) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);
    } catch {
      return `${value.toFixed(2)} ${currency}`;
    }
  };

  const formatCurrencyValue = (value: number, currency: string) => {
    const currencyData = CURRENCY_DATA[currency];
    if (!currencyData) return value.toFixed(4);
    const noDecimalCurrencies = ['JPY', 'KRW', 'VND', 'IDR', 'TZS', 'UGX', 'BIF', 'CLP', 'PYG'];
    if (noDecimalCurrencies.includes(currency)) return value.toFixed(0);
    if (['XOF', 'XAF', 'MRO', 'MRU'].includes(currency)) return value.toFixed(2);
    return value.toFixed(4);
  };

  return (
    <Card className="dark:bg-[#161616] border-gray-200 dark:border-gray-700">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <CardTitle className="text-lg">Live Rates</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={ratesLoading}
              className="flex items-center gap-1 text-xs px-3 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-3 w-3 ${ratesLoading ? 'animate-spin' : ''}`} />
              {ratesLoading ? 'Updating...' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1 text-xs rounded-full ${selectedCategory === 'all' ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
          >
            <Globe className="h-3 w-3 inline mr-1" />
            All Currencies
          </button>
          <button
            onClick={() => setSelectedCategory('world')}
            className={`px-3 py-1 text-xs rounded-full ${selectedCategory === 'world' ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
          >
            🌍 World
          </button>
          <button
            onClick={() => setSelectedCategory('africa')}
            className={`px-3 py-1 text-xs rounded-full ${selectedCategory === 'africa' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
          >
            🦁 Africa
          </button>
        </div>

        <div className="mt-2">
          <input
            type="text"
            placeholder="Search currency (USD, NGN, Euro...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{CURRENCY_DATA[userCurrency]?.emoji || '💰'}</span>
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {CURRENCY_DATA[userCurrency]?.name || userCurrency}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Your selected currency</p>
                </div>
              </div>
              {rates && rates[userCurrency] && (
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    1 USD = {rates[userCurrency].toLocaleString(undefined, { maximumFractionDigits: 4 })} {userCurrency}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    1 {userCurrency} = {(1 / rates[userCurrency]).toFixed(4)} USD
                  </p>
                </div>
              )}
            </div>

            {walletInLocalCurrency && (
              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">Wallet Balance: ${walletBalance.toFixed(2)} USD</p>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">≈ {walletInLocalCurrency} {userCurrency}</p>
              </div>
            )}
          </div>

          <section aria-label="Currency converter" className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
            <div className="mb-3">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Currency converter</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Indicative conversion using the latest available rates.</p>
            </div>
            <label htmlFor="converter-amount" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Amount</label>
            <input
              id="converter-amount"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={converterAmount}
              onChange={(event) => setConverterAmount(event.target.value)}
              className="mb-3 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
              <label className="min-w-0 text-xs font-medium text-gray-600 dark:text-gray-300">
                From
                <select
                  aria-label="Convert from"
                  value={fromCurrency}
                  onChange={(event) => setFromCurrency(event.target.value)}
                  disabled={!rates}
                  className="mt-1 block w-full rounded-md border border-gray-200 bg-white px-2 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                >
                  {availableCurrencies.map((code) => <option key={code} value={code}>{code} — {CURRENCY_DATA[code].name}</option>)}
                </select>
              </label>
              <button
                type="button"
                aria-label="Swap currencies"
                onClick={handleSwapCurrencies}
                disabled={!rates}
                className="mb-0.5 rounded-full border border-gray-200 bg-white p-2 text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-blue-400"
              >
                <ArrowLeftRight className="h-4 w-4" />
              </button>
              <label className="min-w-0 text-xs font-medium text-gray-600 dark:text-gray-300">
                To
                <select
                  aria-label="Convert to"
                  value={toCurrency}
                  onChange={(event) => setToCurrency(event.target.value)}
                  disabled={!rates}
                  className="mt-1 block w-full rounded-md border border-gray-200 bg-white px-2 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                >
                  {availableCurrencies.map((code) => <option key={code} value={code}>{code} — {CURRENCY_DATA[code].name}</option>)}
                </select>
              </label>
            </div>
            <div aria-live="polite" className="mt-3 rounded-lg bg-white px-3 py-3 dark:bg-gray-900">
              {convertedValue !== null ? (
                <>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Estimated amount</p>
                  <p className="break-all text-xl font-bold text-blue-700 dark:text-blue-300">
                    {formatConvertedValue(convertedValue, toCurrency)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {ratesLoading ? 'Loading rates…' : error ? 'Conversion is unavailable until rates can be loaded.' : 'Enter a valid amount to convert.'}
                </p>
              )}
            </div>
          </section>

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {selectedCategory === 'all' ? 'All Major Currencies' : selectedCategory === 'world' ? 'World Currencies' : 'African Currencies'}
            </h3>

            {ratesLoading && !rates ? (
              <div className="text-center py-4">
                <div className="animate-pulse space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  ))}
                </div>
              </div>
            ) : error && !rates ? (
              <div className="text-center py-4">
                <p className="text-sm text-red-500 dark:text-red-400">Failed to fetch rates</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Refresh to try again.</p>
              </div>
            ) : rates ? (
              <>
                {filteredCurrencies.map(([currencyCode, currencyData]) => {
                  const rate = rates[currencyCode];
                  if (!Number.isFinite(rate) || rate <= 0) return null;
                  // Determine fraction digits safely and clamp into valid range
                  let maxDigits = (currencyCode === 'JPY' || currencyCode === 'KRW') ? 0 : 2;
                  if (!Number.isFinite(maxDigits) || maxDigits < 0) maxDigits = 0;
                  // clamp to a reasonable upper bound to avoid RangeError across platforms
                  maxDigits = Math.min(20, Math.max(0, Math.trunc(maxDigits)));

                  let formattedRate: string;
                  try {
                    formattedRate = rate.toLocaleString(undefined, { minimumFractionDigits: Math.min(2, maxDigits), maximumFractionDigits: maxDigits });
                  } catch (e) {
                    // Fallback to a safe fixed formatting if toLocaleString fails
                    formattedRate = Number.isFinite(rate) ? rate.toFixed(Math.min(8, Math.max(0, Math.trunc(maxDigits)))) : String(rate);
                  }

                  return (
                    <div key={currencyCode} className={`flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors ${currencyCode === userCurrency ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{currencyData.emoji}</span>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{currencyCode}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{currencyData.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900 dark:text-gray-100">1 USD = {formattedRate} {currencyCode}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">1 {currencyCode} = {formatCurrencyValue(1 / rate, currencyCode)} USD</p>
                      </div>
                    </div>
                  );
                })}

                {filteredCurrencies.length === 0 && (
                  <div className="text-center py-4">
                    <p className="text-gray-500 dark:text-gray-400">No currencies found matching "{searchQuery}"</p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-500 dark:text-gray-400">Exchange rates not available</p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {ratesLoading ? (
                  <span className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>
                    Updating rates...
                  </span>
                ) : error ? (
                  <span className="text-yellow-600 dark:text-yellow-400">{rates ? '⚠️ Refresh failed; showing last loaded rates' : '⚠️ Rates unavailable'}</span>
                ) : (
                  <span className="text-green-600 dark:text-green-400">✓ Rates available</span>
                )}
              </div>

              {updatedAt && (
                <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
                  <p>Updated: {new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              )}
            </div>

            <div className="mt-2 flex gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span>Total currencies: {Object.keys(CURRENCY_DATA).length}</span>
              <span>World: {Object.values(CURRENCY_DATA).filter(c => c.category === 'world').length}</span>
              <span>Africa: {Object.values(CURRENCY_DATA).filter(c => c.category === 'africa').length}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ExchangeRatesCard;
