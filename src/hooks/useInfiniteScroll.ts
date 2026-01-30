import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Custom hook for infinite scroll that handles stale closures and query state updates
 *
 * @param fetchNextPage - Function to fetch next page from react-query
 * @param hasNextPage - Boolean indicating if there are more pages
 * @param isFetchingNextPage - Boolean indicating if currently fetching
 * @returns ref to attach to sentinel element
 */
export function useInfiniteScroll(
  fetchNextPage: (() => Promise<any> | void) | undefined,
  hasNextPage: boolean | undefined,
  isFetchingNextPage: boolean | undefined
) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);

  // Track latest values in refs to avoid stale closures
  const hasNextPageRef = useRef<boolean | undefined>(hasNextPage);
  const isFetchingRef = useRef<boolean | undefined>(isFetchingNextPage);
  const fetchRef = useRef(fetchNextPage);

  // Update refs whenever values change
  useEffect(() => { hasNextPageRef.current = hasNextPage; }, [hasNextPage]);
  useEffect(() => { isFetchingRef.current = isFetchingNextPage; }, [isFetchingNextPage]);
  useEffect(() => { fetchRef.current = fetchNextPage; }, [fetchNextPage]);

  // Stable intersection callback
  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    const [entry] = entries;
    setIsIntersecting(!!entry?.isIntersecting);
  }, []);

  // Trigger fetch when conditions are met
  useEffect(() => {
    const shouldFetch = 
      isIntersecting &&
      hasNextPageRef.current === true &&
      !isFetchingRef.current;

    if (shouldFetch) {
      try {
        fetchRef.current && fetchRef.current();
      } catch (e) {
        // swallow - react-query will surface errors elsewhere
        /* eslint-disable no-console */
        console.warn('[useInfiniteScroll] fetchNextPage threw', e);
      }
    }
  }, [isIntersecting]);

  // Create and maintain observer
  useEffect(() => {
    const observer = new IntersectionObserver(handleIntersection, {
      root: null,
      rootMargin: '500px', // Trigger 500px before sentinel
      threshold: [0, 0.1, 0.5, 1.0],
    });

    const target = sentinelRef.current;

    if (target) {
      try {
        observer.observe(target);
      } catch (e) {
        console.warn('[useInfiniteScroll] Observer observe failed', e);
      }
    }

    return () => {
      try {
        if (target) observer.unobserve(target);
      } catch (e) {}
      observer.disconnect();
    };
  }, [handleIntersection]);

  return sentinelRef;
}

export default useInfiniteScroll;
