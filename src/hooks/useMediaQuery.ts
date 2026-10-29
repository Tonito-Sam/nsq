import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQueryList = window.matchMedia(query);
    const updateMatches = () => setMatches(mediaQueryList.matches);
    mediaQueryList.addEventListener('change', updateMatches);
    window.addEventListener('resize', updateMatches, { passive: true });
    updateMatches();
    return () => {
      mediaQueryList.removeEventListener('change', updateMatches);
      window.removeEventListener('resize', updateMatches);
    };
  }, [query]);

  return matches;
}
