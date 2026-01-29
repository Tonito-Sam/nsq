import React from 'react';
import { useLocation } from 'react-router-dom';

// Persist the last non-auth route so users return there after re-login / session restore
export const RouteTracker: React.FC = () => {
  const location = useLocation();

  React.useEffect(() => {
    try {
      const path = location.pathname + (location.search || '');
      // Skip auth and static routes
      const skipPrefixes = ['/auth', '/forgot-password', '/reset-password', '/email-confirmed'];
      const shouldSkip = skipPrefixes.some(p => path.startsWith(p));
      if (!shouldSkip) {
        localStorage.setItem('last_route', path);
        localStorage.setItem('last_route_ts', String(Date.now()));
      }
    } catch (e) {
      // ignore
    }
  }, [location.pathname, location.search]);

  return null;
};

export default RouteTracker;
