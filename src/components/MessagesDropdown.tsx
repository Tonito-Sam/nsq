import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export const MessagesDropdown = () => {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Fetch conversations and unread counts
  const fetchConversations = useCallback(async () => {
    let user = null;
    if (!userId) {
      const { data: userResult } = await supabase.auth.getUser();
      user = userResult?.user;
      if (!user) return;
      setUserId(user.id);
    } else {
      user = { id: userId };
    }
    const { data: convs } = await supabase
      .from('conversations')
      .select('*')
      .or(`customer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order('last_message_at', { ascending: false });
    if (!convs) {
      setConversations([]);
      setUnreadCount(0);
      return;
    }
    const convsWithDetails = await Promise.all(
      convs.map(async (conv) => {
        const otherUserId = conv.customer_id === user.id ? conv.seller_id : conv.customer_id;
        const { data: otherUser } = await supabase
          .from('users')
          .select('first_name, last_name, username, avatar_url')
          .eq('id', otherUserId)
          .single();
        const { data: lastMsg } = await supabase
          .from('messages')
          .select('content, created_at, sender_id')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        const { count: unread } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .neq('sender_id', user.id)
          .is('read_at', null);
        return {
          id: conv.id,
          name: otherUser ? `${otherUser.first_name || ''} ${otherUser.last_name || ''}`.trim() || otherUser.username : 'Unknown',
          avatar: otherUser?.avatar_url || '/placeholder.svg',
          lastMessage: lastMsg?.content || '',
          time: lastMsg?.created_at ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
          unread: unread || 0,
        };
      })
    );
    setConversations(convsWithDetails.filter(Boolean));
    setUnreadCount(convsWithDetails.reduce((acc, c) => acc + (c.unread || 0), 0));
  }, [userId]);

  // Real-time subscription for unread count
  useEffect(() => {
    let channel: any;
    const setup = async () => {
      if (!userId) {
        const { data: userResult } = await supabase.auth.getUser();
        if (!userResult?.user) return;
        setUserId(userResult.user.id);
      }
      await fetchConversations();
      channel = supabase.channel('dropdown-unread-messages')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, fetchConversations)
        .subscribe();
    };
    setup();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [fetchConversations, userId]);

  // Refetch when dropdown is opened
  useEffect(() => {
    if (open) fetchConversations();
  }, [open, fetchConversations]);

  return (
    <div className="relative">
      <button
        className="relative"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Messages"
      >
        <MessageCircle className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs bg-red-500 text-white p-0">
            {unreadCount}
          </Badge>
        )}
      </button>
      {open && (
        <div className="
            fixed md:absolute right-2 md:right-0 top-16 md:top-full z-50
            w-[96vw] max-w-sm md:w-80
            bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg
            mx-auto md:mx-0
          "
          style={{ left: '50%', transform: 'translateX(-50%)', maxHeight: '90vh' }}
        >
          <div className="p-4 font-semibold border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 rounded-t-lg">
            Messages
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-4 text-gray-500 text-center">No conversations yet.</div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-purple-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 last:border-b-0 text-left"
                  onClick={async () => {
                    setOpen(false);
                    // Mark all unread messages in this conversation as read
                    await supabase
                      .from('messages')
                      .update({ read_at: new Date().toISOString() })
                      .eq('conversation_id', conv.id)
                      .is('read_at', null)
                      .neq('sender_id', userId);
                    navigate(`/messages/${conv.id}`);
                    setTimeout(fetchConversations, 500);
                  }}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={conv.avatar} />
                    <AvatarFallback>{conv.name?.charAt(0)?.toUpperCase() || '?'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">{conv.name}</div>
                    <div className="text-xs text-gray-500 truncate">{conv.lastMessage}</div>
                  </div>
                  {conv.unread > 0 && (
                    <span className="ml-2 bg-purple-500 text-white text-xs rounded-full px-2 py-0.5">{conv.unread}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
