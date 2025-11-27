import React, { useEffect, useState, useRef } from 'react';
import { Bell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const mounted = useRef(true);

  useEffect(() => {
    return () => { mounted.current = false; };
  }, []);

  const fetchNotifications = async (unreadOnly = true) => {
    if (!user?.id) return;
    try {
      const url = `/api/notifications/list?user_id=${encodeURIComponent(user.id)}${unreadOnly ? '&unread_only=true' : ''}`;
      const resp = await fetch(url, { method: 'GET' });
      if (!resp.ok) return;
      const json = await resp.json();
      if (!mounted.current) return;
      const list = json.notifications || [];
      setItems(list);
      setUnreadCount(list.filter((n: any) => !n.is_read).length);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    // initial fetch (unread)
    fetchNotifications(true);

    // try realtime subscription when available
    let channel: any = null;
    try {
      if ((supabase as any).channel) {
        channel = (supabase as any).channel('public:notifications')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload: any) => {
            if (!payload || !payload.new) return;
            if (String(payload.new.user_id) === String(user.id)) {
              setItems(prev => [payload.new, ...prev]);
              setUnreadCount(c => c + 1);
            }
          })
          .subscribe();
      }
    } catch (e) {
      // ignore
    }

    // fallback polling
    const iv = setInterval(() => fetchNotifications(true), 15000);

    return () => {
      clearInterval(iv);
      try { if (channel) (supabase as any).removeChannel(channel); } catch (e) {}
    };
  }, [user?.id]);

  const markRead = async (ids: string[]) => {
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      // update local state
      setItems(prev => prev.map(it => ids.includes(it.id) ? { ...it, is_read: true } : it));
      setUnreadCount(prev => Math.max(0, prev - ids.length));
    } catch (e) {
      // ignore
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(s => !s); if (!open) fetchNotifications(false); }}
        aria-label="Notifications"
        className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <Bell className="h-5 w-5 text-gray-700 dark:text-gray-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-0 -right-0 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg z-50">
          <div className="p-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <strong>Notifications</strong>
            <button className="text-sm text-blue-600" onClick={() => { const ids = items.filter(i => !i.is_read).map(i => i.id); if (ids.length) markRead(ids); }}>Mark all read</button>
          </div>
          <div>
            {items.length === 0 && (
              <div className="p-4 text-sm text-gray-500">No notifications</div>
            )}
            {items.map((n: any) => (
              <div key={n.id} className={`p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer ${n.is_read ? 'opacity-70' : ''}`}>
                <div className="text-sm font-medium">{(n.payload && n.payload.title) || n.type}</div>
                <div className="text-xs text-gray-500 truncate">{(n.payload && n.payload.message) || JSON.stringify(n.payload)}</div>
                <div className="flex items-center justify-between mt-2">
                  <div className="text-xs text-gray-400">{new Date(n.created_at).toLocaleString()}</div>
                  {!n.is_read && (
                    <button className="text-xs text-blue-600" onClick={() => markRead([n.id])}>Mark read</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
