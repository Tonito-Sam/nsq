import { useEffect, useState, useRef } from 'react';
import apiUrl from '@/lib/api';

export type Rates = { [key: string]: number };

export default function useCurrencyRates(base = 'USD', refreshMs = 5 * 60 * 1000) {
  const [rates, setRates] = useState<Rates>({ USD: 1 });
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [isCached, setIsCached] = useState(false);
  const timerRef = useRef<number | null>(null as any);

  const fetchRates = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('base', base);
      // Prefer backend proxy route; fall back to public exchangerate.host if backend is unreachable
      try {
        const resp = await fetch(apiUrl(`/api/currency/rates?${params.toString()}`));
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.rates) {
            setRates(data.rates);
            setUpdatedAt(data.timestamp || Date.now());
            // persist to localStorage
            try { localStorage.setItem(`rates_cache_${base}`, JSON.stringify(data.rates)); localStorage.setItem(`rates_cache_ts_${base}`, String(data.timestamp || Date.now())); setIsCached(false); } catch(e) {}
            return;
          }
        } else {
          console.warn('Backend currency route returned non-OK', resp.status);
        }
      } catch (e) {
        console.warn('Backend currency fetch failed, falling back to public API', e);
      }

      // Fallback: public exchangerate.host API
      try {
        const publicUrl = `https://api.exchangerate.host/latest?base=${encodeURIComponent(base)}`;
        const r2 = await fetch(publicUrl);
        if (r2.ok) {
          const data2 = await r2.json();
          if (data2 && data2.rates) {
            setRates(data2.rates);
            setUpdatedAt(Date.now());
            try { localStorage.setItem(`rates_cache_${base}`, JSON.stringify(data2.rates)); localStorage.setItem(`rates_cache_ts_${base}`, String(Date.now())); setIsCached(false); } catch(e) {}
            return;
          }
        }
      } catch (err2) {
        console.warn('Public exchangerate host fetch failed', err2);
      }
    } catch (e) {
      console.warn('useCurrencyRates fetch error', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
    timerRef.current = window.setInterval(fetchRates, refreshMs);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  // expose cached fallback if fetch failed - try to load from localStorage
  useEffect(() => {
    try {
      const cached = localStorage.getItem(`rates_cache_${base}`);
      const ts = localStorage.getItem(`rates_cache_ts_${base}`);
      if (cached && (!rates || Object.keys(rates).length === 0)) {
        setRates(JSON.parse(cached));
        setUpdatedAt(ts ? Number(ts) : Date.now());
        setIsCached(true);
      }
    } catch (e) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { rates, loading, updatedAt, refresh: fetchRates, isCached };
}
