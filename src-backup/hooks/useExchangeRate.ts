import { useState, useEffect, useRef } from 'react';

// Types for API responses
interface ExchangeRateResponse {
  success?: boolean;
  rates?: Record<string, number>;
  error?: {
    info: string;
    code: number;
  };
  // Alternative API response format
  result?: number;
  base_code?: string;
  target_code?: string;
}

interface CacheEntry {
  rate: number;
  timestamp: number;
}

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;
// Maximum retry attempts
const MAX_RETRIES = 3;
// Retry delay in milliseconds
const RETRY_DELAY = 1000;

// Valid currency codes (add more as needed)
const VALID_CURRENCIES = new Set([
  'USD', 'EUR', 'GBP', 'ZAR', 'NGN', 'KES', 'GHS', 'UGX', 'TZS', 'RWF',
  'CAD', 'AUD', 'JPY', 'CNY', 'INR', 'BRL', 'MXN', 'SGD', 'HKD', 'AED'
]);

export const useExchangeRate = (
  userCurrency: string,
  baseCurrency: string = 'USD',
  options: {
    cacheDuration?: number;
    maxRetries?: number;
    retryDelay?: number;
  } = {}
) => {
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Cache for storing exchange rates
  const cache = useRef<Map<string, CacheEntry>>(new Map());
  // Abort controller for cleanup
  const abortController = useRef<AbortController | null>(null);
  // Retry count
  const retryCount = useRef(0);

  // Validate currency codes
  const validateCurrency = (currency: string): boolean => {
    return VALID_CURRENCIES.has(currency.toUpperCase());
  };

  // Try multiple exchange rate APIs
  const fetchExchangeRateFromMultipleSources = async (
    from: string,
    to: string,
    signal: AbortSignal
  ): Promise<number> => {
    const apis = [
      // Free API 1: ExchangeRate-API
      {
        url: `https://api.exchangerate-api.com/v4/latest/${from}`,
        parser: (data: any) => data.rates?.[to]
      },
      // Free API 2: Fixer.io (with fallback)
      {
        url: `https://api.fixer.io/latest?base=${from}&symbols=${to}`,
        parser: (data: any) => data.rates?.[to]
      },
      // Free API 3: CurrencyAPI
      {
        url: `https://api.currencyapi.com/v3/latest?apikey=fca_live_default&base_currency=${from}&currencies=${to}`,
        parser: (data: any) => data.data?.[to]?.value
      }
    ];

    let lastError;

    for (const api of apis) {
      try {
        console.log(`Trying API: ${api.url}`);
        const response = await fetch(api.url, { signal });
        
        if (!response.ok) {
          console.log(`API ${api.url} returned ${response.status}`);
          continue;
        }

        const data = await response.json();
        console.log(`API response:`, data);
        
        const rate = api.parser(data);
        if (rate && typeof rate === 'number' && rate > 0) {
          console.log(`Got rate ${rate} from ${api.url}`);
          return rate;
        }
      } catch (error) {
        console.log(`API ${api.url} failed:`, error);
        lastError = error;
        continue;
      }
    }

    // If all APIs fail, try a simple calculation (fallback)
    if (from === 'ZAR' && to === 'USD') {
      return 0.055; // Approximate rate as fallback
    } else if (from === 'USD' && to === 'ZAR') {
      return 18.5; // Approximate rate as fallback
    }

    throw lastError || new Error('All exchange rate APIs failed');
  };

  // Fetch exchange rate with retry mechanism
  const fetchWithRetry = async (
    from: string,
    to: string,
    signal: AbortSignal
  ): Promise<number> => {
    try {
      return await fetchExchangeRateFromMultipleSources(from, to, signal);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      
      if (retryCount.current < (options.maxRetries || MAX_RETRIES)) {
        retryCount.current++;
        console.log(`Retrying... attempt ${retryCount.current}`);
        await new Promise(resolve => 
          setTimeout(resolve, options.retryDelay || RETRY_DELAY)
        );
        return fetchWithRetry(from, to, signal);
      }
      throw error;
    }
  };

  useEffect(() => {
    const fetchExchangeRate = async () => {
      try {
        setIsLoading(true);
        setError(null);
        retryCount.current = 0;

        // Validate currencies
        if (!validateCurrency(userCurrency)) {
          throw new Error(`Invalid user currency: ${userCurrency}`);
        }
        if (!validateCurrency(baseCurrency)) {
          throw new Error(`Invalid base currency: ${baseCurrency}`);
        }

        // If user currency is same as store currency, no need to fetch
        if (userCurrency === 'ZAR') {
          setExchangeRate(1);
          setIsLoading(false);
          return;
        }

        // Check cache first
        const cacheKey = `${baseCurrency}-${userCurrency}`;
        const cachedData = cache.current.get(cacheKey);
        const now = Date.now();

        if (cachedData && (now - cachedData.timestamp) < (options.cacheDuration || CACHE_DURATION)) {
          console.log('Using cached exchange rate');
          setExchangeRate(cachedData.rate);
          setIsLoading(false);
          return;
        }

        // Create new AbortController for this fetch
        abortController.current = new AbortController();
        const signal = abortController.current.signal;

        // Get direct conversion rate from ZAR to user currency
        const rate = await fetchWithRetry('ZAR', userCurrency, signal);

        // Update cache
        cache.current.set(cacheKey, {
          rate,
          timestamp: now
        });

        console.log(`Exchange rate from ZAR to ${userCurrency}:`, rate);
        setExchangeRate(rate);
      } catch (err) {
        console.error('Error fetching exchange rate:', err);
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Failed to fetch exchange rate');
        }
        setExchangeRate(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchExchangeRate();

    // Cleanup function
    return () => {
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, [userCurrency, baseCurrency, options.cacheDuration, options.maxRetries, options.retryDelay]);

  return { exchangeRate, isLoading, error };
};