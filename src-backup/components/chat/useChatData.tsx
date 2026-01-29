
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ConversationWithDetails {
  id: string;
  customer_id: string;
  seller_id: string;
  product_id: string;
  last_message_at: string;
  created_at: string;
  customer?: {
    first_name?: string;
    last_name?: string;
    username: string;
    avatar_url?: string;
  };
  product?: {
    title: string;
    images: string[];
  };
  last_message?: {
    content: string;
    sender_id: string;
  };
  unread_count?: number;
}

export const useChatData = (userId?: string) => {
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = async () => {
    if (!userId) return;

    try {
      // First get conversations
      const { data: conversationsData, error: conversationsError } = await supabase
        .from('conversations')
        .select('*')
        .eq('seller_id', userId)
        .order('last_message_at', { ascending: false });

      if (conversationsError) throw conversationsError;

      // Get additional data for each conversation
      const conversationsWithDetails = await Promise.all(
        (conversationsData || []).map(async (conv) => {
          // Get customer info
          const { data: customerData } = await supabase
            .from('users')
            .select('first_name, last_name, username, avatar_url')
            .eq('id', conv.customer_id)
            .single();

          // Get product info
          const { data: productData } = await supabase
            .from('store_products')
            .select('title, images')
            .eq('id', conv.product_id)
            .single();

          // Get last message
          const { data: lastMessage } = await supabase
            .from('messages')
            .select('content, sender_id')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          // Get unread count
          const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .neq('sender_id', userId)
            .is('read_at', null);

          return {
            id: conv.id,
            customer_id: conv.customer_id,
            seller_id: conv.seller_id,
            product_id: conv.product_id,
            last_message_at: conv.last_message_at,
            created_at: conv.created_at,
            customer: customerData || undefined,
            product: productData || undefined,
            last_message: lastMessage || undefined,
            unread_count: unreadCount || 0
          };
        })
      );

      setConversations(conversationsWithDetails);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToConversations = () => {
    if (!userId) return;

    const channel = supabase
      .channel('chat-board')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        () => {
          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversations',
          filter: `seller_id=eq.${userId}`
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  useEffect(() => {
    if (userId) {
      fetchConversations();
      subscribeToConversations();
    }
  }, [userId]);

  return { conversations, loading, fetchConversations };
};
