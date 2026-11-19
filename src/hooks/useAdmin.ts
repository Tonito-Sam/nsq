import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useAdmin() {
  const { user } = useAuth();
  const userId = user?.id;
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setIsAdmin(false);
    setIsSuperAdmin(false);

    if (!userId) {
      setLoading(false);
      return () => { active = false; };
    }

    void (async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('privilege')
          .eq('id', userId)
          .maybeSingle();
        if (!active) return;
        if (error) {
          console.error('Failed to check administrator privilege:', error);
          return;
        }
        setIsAdmin(data?.privilege === 'admin' || data?.privilege === 'superadmin');
        setIsSuperAdmin(data?.privilege === 'superadmin');
      } catch (error) {
        if (active) console.error('Failed to check administrator privilege:', error);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false; };
  }, [userId]);

  return { isAdmin, isSuperAdmin, loading };
}
