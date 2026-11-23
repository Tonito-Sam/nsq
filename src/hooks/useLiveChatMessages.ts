
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
    if (!showId) {
      setMessages([]);
      setIsLoading(false);
      return;
    }

    let active = true;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    setIsLoading(true);
    
    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('live_chat')
          .select('*')
          .eq('show_id', showId)
          .order('timestamp', { ascending: true })
          .limit(100);

        if (error) {
          throw error;
        } else {
          if (active) setMessages(data || []);
        }
      } catch (err) {
        if (active) console.error('useLiveChatMessages: Error in fetchMessages:', err);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    fetchMessages();

    // Subscribe to real-time changes
    try {
      channel = supabase
        .channel(`live_chat_messages_${showId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'live_chat',
          filter: `show_id=eq.${showId}`,
        }, (payload) => {
          if (!active) return;
          setMessages((prev) => {
            const incoming = payload.new as ChatMessage;
            if (prev.some((message) => message.id === incoming.id)) return prev;
            return [...prev.slice(-99), incoming];
          });
        })
        .subscribe();
    } catch (err) {
      console.error('useLiveChatMessages: Error in subscription:', err);
    }

    return () => {
      active = false;
      try {
        if (channel) {
          void supabase.removeChannel(channel);
        }
      } catch (err) {
        console.error('useLiveChatMessages: Error removing channel:', err);
      }
    };
  }, [showId]);

  return { messages, isLoading };
}