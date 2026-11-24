import { useCallback, useEffect, useState, useRef } from 'react';
import apiUrl from '@/lib/api';

export type Rates = { [key: string]: number };

export default function useCurrencyRates(base = 'USD', refreshMs = 5 * 60 * 1000) {
  const [rates, setRates] = useState<Rates>({ USD: 1 });
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [isCached, setIsCached] = useState(false);
  const timerRef = useRef<number | null>(null as any);

  const fetchRates = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('base', base);
      // Prefer the backend proxy; fall back to the public API if the backend is unreachable.
      try {
        const resp = await fetch(apiUrl(`/api/currency/rates?${params.toString()}`));
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.rates && data.source !== 'cache-stale') {
            setRates(data.rates);
            setUpdatedAt(data.timestamp || Date.now());
            // persist to localStorage
            try { localStorage.setItem(`rates_cache_${base}`, JSON.stringify(data.rates)); localStorage.setItem(`rates_cache_ts_${base}`, String(data.timestamp || Date.now())); setIsCached(false); } catch(e) {}
            return;
          } else if (data?.source === 'cache-stale') {
            console.warn('Backend returned stale exchange rates; trying the public API.');
          }
        } else {
          console.warn('Backend currency route returned non-OK', resp.status);
        }
      } catch (e) {
        console.warn('Backend currency fetch failed, falling back to public API', e);
      }

      // Fallback: open.er-api supports browser requests without an API key.
      try {
        const publicUrl = `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`;
        const r2 = await fetch(publicUrl);
        if (r2.ok) {
          const data2 = await r2.json();
          if (data2?.result === 'success' && data2.rates) {
            const fallbackRates = { ...data2.rates, [base]: 1 };
            setRates(fallbackRates);
            const timestamp = data2.time_last_update_unix ? data2.time_last_update_unix * 1000 : Date.now();
            setUpdatedAt(timestamp);
            try { localStorage.setItem(`rates_cache_${base}`, JSON.stringify(fallbackRates)); localStorage.setItem(`rates_cache_ts_${base}`, String(timestamp)); setIsCached(false); } catch(e) {}
            return;
          }
        }
      } catch (err2) {
        console.warn('Public exchange-rate fallback failed', err2);
      }
    } catch (e) {
      console.error('useCurrencyRates fetch error', e);
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    fetchRates();
    timerRef.current = window.setInterval(fetchRates, refreshMs);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [base, fetchRates, refreshMs]);

  // expose cached fallback if fetch failed - try to load from localStorage
  useEffect(() => {
    try {
      const cached = localStorage.getItem(`rates_cache_${base}`);
      const ts = localStorage.getItem(`rates_cache_ts_${base}`);
      if (cached) {
        const parsedRates = JSON.parse(cached);
        if (parsedRates && typeof parsedRates === 'object' && Number.isFinite(parsedRates.USD)) {
          setRates(parsedRates);
        }
        setUpdatedAt(ts ? Number(ts) : Date.now());
        setIsCached(true);
      }
    } catch (e) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { rates, loading, updatedAt, refresh: fetchRates, isCached };
}
