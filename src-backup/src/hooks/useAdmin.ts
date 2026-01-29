import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('users')
      .select('privilege')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        console.log('DEBUG useAdmin privilege result:', data, 'for user', user?.id);
        if (data && typeof data === 'object' && 'privilege' in data) {
          setIsAdmin(data.privilege === 'admin' || data.privilege === 'superadmin');
          setIsSuperAdmin(data.privilege === 'superadmin');
        } else {
          setIsAdmin(false);
          setIsSuperAdmin(false);
        }
      });
  }, [user]);

  return { isAdmin, isSuperAdmin };
}
