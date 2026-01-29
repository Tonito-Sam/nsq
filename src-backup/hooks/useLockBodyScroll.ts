import { useEffect } from 'react';

/**
 * Lock the document body scroll when `active` is true.
 * - saves current scroll position
 * - sets body to position:fixed with negative top to preserve visual position
 * - sets html overflow hidden for extra safety
 * - prevents touchmove on mobile
 */
export default function useLockBodyScroll(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const scrollY = window.scrollY || window.pageYOffset || 0;
    const body = document.body;
    const html = document.documentElement;

    // Apply lock
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';

    // Prevent touchmove on mobile so swipes don't move the background
    const preventTouch = (e: TouchEvent) => e.preventDefault();
    document.addEventListener('touchmove', preventTouch, { passive: false });

    return () => {
      // cleanup
      document.removeEventListener('touchmove', preventTouch);
      body.style.position = '';
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
      body.style.width = '';
      body.style.overflow = '';
      html.style.overflow = '';

      // restore scroll to original position
      window.scrollTo(0, scrollY || 0);
    };
  }, [active]);
}
