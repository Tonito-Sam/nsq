
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ChatMessage {
  id: string;
  username: string;
  message: string;
  timestamp: string;
  avatar_url?: string;
  is_moderator?: boolean;
  is_vip?: boolean;
  show_id?: string;
  is_pinned?: boolean;
}

export function useLiveChatMessages(showId: string | undefined) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!showId) return;
    
    let channel: any;
    setIsLoading(true);
    
    const fetchMessages = async () => {
      console.log('useLiveChatMessages: Fetching messages for show:', showId);
      
      try {
        const { data, error } = await supabase
          .from('live_chat')
          .select('*')
          .eq('show_id', showId)
          .order('timestamp', { ascending: true })
          .limit(100);

        if (error) {
          console.error('useLiveChatMessages: Error fetching messages:', error);
        } else {
          console.log('useLiveChatMessages: Fetched messages:', data);
          setMessages(data || []);
        }
      } catch (err) {
        console.error('useLiveChatMessages: Error in fetchMessages:', err);
      }
      setIsLoading(false);
    };

    fetchMessages();

    // Subscribe to real-time changes
    try {
      channel = supabase
        .channel(`live_chat_${showId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'live_chat',
          filter: `show_id=eq.${showId}`,
        }, (payload) => {
          console.log('useLiveChatMessages: New message received:', payload.new);
          setMessages((prev) => [...prev.slice(-99), payload.new as ChatMessage]);
        })
        .subscribe();
    } catch (err) {
      console.error('useLiveChatMessages: Error in subscription:', err);
    }

    return () => {
      try {
        if (channel) {
          // Remove only this subscription channel to avoid cancelling other listeners
          supabase.removeChannel(channel);
        }
      } catch (err) {
        console.error('useLiveChatMessages: Error removing channel:', err);
      }
    };
  }, [showId]);

  return { messages, isLoading };
}