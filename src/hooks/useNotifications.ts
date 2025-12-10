
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  read: boolean;
  created_at: string;
}

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const mounted = useRef(true);
  const consecutiveFailures = useRef(0);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      // keep realtime subscription optional; primary fetch now uses server API
      try { subscribeToNotifications(); } catch (e) { /* ignore */ }
    }

    return () => { mounted.current = false; };
  }, [user]);

  const fetchNotifications = async (opts?: { signal?: AbortSignal; force?: boolean }) => {
    if (!user) return;

    // Avoid fetching while tab is hidden unless forced
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden' && !opts?.force) return;

    // Respect abort signal
    if (opts?.signal?.aborted) return;

    if (mounted.current) setLoading(true);
    try {
      const resp = await fetch(`/api/notifications/list?user_id=${encodeURIComponent(user.id)}`, { signal: opts?.signal });
      if (!resp.ok) throw new Error(`notifications list failed: ${resp.status}`);
      const body = await resp.json();
      const data = body.notifications || [];

      const normalized = (data || []).map((n: any) => ({
        ...n,
        read: typeof n.read !== 'undefined' ? n.read : (typeof n.is_read !== 'undefined' ? n.is_read : false)
      }));

      if (!mounted.current) return;
      setNotifications(normalized);
      setUnreadCount(normalized.filter((n: any) => !n.read).length || 0);
      consecutiveFailures.current = 0;
    } catch (error) {
      consecutiveFailures.current += 1;
      console.error('Error fetching notifications:', error);
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  const subscribeToNotifications = () => {
    if (!user) return;

    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          setNotifications(prev => [payload.new as Notification, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const markAsRead = async (notificationId: string) => {
    try {
      // Call server endpoint to mark as read
      const resp = await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [notificationId] })
      });
      if (!resp.ok) throw new Error(`mark-read failed: ${resp.status}`);
      await fetchNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      // Fetch current unread notifications then mark them via server
      const resp = await fetch(`/api/notifications/list?user_id=${encodeURIComponent(user.id)}&unread_only=true`);
      if (!resp.ok) throw new Error(`failed to fetch unread: ${resp.status}`);
      const body = await resp.json();
      const unread = body.notifications || [];
      const ids = unread.map((n: any) => n.id).filter(Boolean);
      if (ids.length === 0) return;
      const markResp = await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      if (!markResp.ok) throw new Error(`mark-read failed: ${markResp.status}`);
      await fetchNotifications();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    fetchNotifications
  };
};
