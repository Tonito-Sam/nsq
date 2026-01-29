import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useUserPrivilege() {
  const { user } = useAuth();
  const [privilege, setPrivilege] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from('users')
      .select('privilege')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data && typeof data === 'object' && 'privilege' in data) {
          setPrivilege(data.privilege || 'user');
        } else {
          setPrivilege('user');
        }
        setLoading(false);
      });
  }, [user]);

  return { privilege, loading };
}
