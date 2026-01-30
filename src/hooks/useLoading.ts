import { useState, useCallback } from 'react';

export const useLoading = (initial = false) => {
  const [loading, setLoading] = useState<boolean>(initial);
  const show = useCallback(() => setLoading(true), []);
  const hide = useCallback(() => setLoading(false), []);
  return { loading, setLoading, show, hide };
};

export default useLoading;
