
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { openWhatsApp } from '@/lib/whatsapp';

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  product_type: string;
  category: string;
  tags: string[];
  images: string[];
  user_id: string;
  store?: {
    store_name: string;
    verification_status: string;
  };
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  sender?: {
    first_name?: string;
    last_name?: string;
    username: string;
    avatar_url?: string;
  };
}

interface Conversation {
  id: string;
  customer_id: string;
  seller_id: string;
  product_id: string;
}

export const useChatModal = (product: Product, user: any) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const initializeConversation = async () => {
    if (!user) return;

    try {
      // First, check if a conversation already exists
      const { data: existingConversation, error: fetchError } = await supabase
        .from('conversations')
        .select('*')
        .eq('customer_id', user.id)
        .eq('seller_id', product.user_id)
        .eq('product_id', product.id)
        .single();

      if (existingConversation && !fetchError) {
        setConversation(existingConversation);
        // Mark this conversation as read for the current user (upsert last_read_at)
        try {
          await supabase
            .from('conversation_participants')
            .upsert(
              { conversation_id: existingConversation.id, user_id: user.id, last_read_at: new Date().toISOString() },
              { onConflict: 'conversation_id,user_id' }
            );
        } catch (e) {
          console.warn('Failed to upsert conversation_participants for read mark', e);
        }
      } else {
        // Create a new conversation
        const { data: newConversation, error: createError } = await supabase
          .from('conversations')
          .insert({
            customer_id: user.id,
            seller_id: product.user_id,
            product_id: product.id
          })
          .select()
          .single();

        if (createError) throw createError;
        setConversation(newConversation);
        // Mark this conversation as read for the current user (upsert last_read_at)
        try {
          await supabase
            .from('conversation_participants')
            .upsert(
              { conversation_id: newConversation.id, user_id: user.id, last_read_at: new Date().toISOString() },
              { onConflict: 'conversation_id,user_id' }
            );
        } catch (e) {
          console.warn('Failed to upsert conversation_participants for read mark', e);
        }
      }
    } catch (error) {
      console.error('Error initializing conversation:', error);
      toast({
        title: "Error",
        description: "Failed to start conversation",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    if (!conversation) return;

    try {
      // Get messages
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      // Get sender details for each message
      const messagesWithSenders = await Promise.all(
        (messagesData || []).map(async (msg) => {
          const { data: senderData } = await supabase
            .from('users')
            .select('first_name, last_name, username, avatar_url')
            .eq('id', msg.sender_id)
            .single();

          return {
            id: msg.id,
            content: msg.content,
            sender_id: msg.sender_id,
            created_at: msg.created_at,
            sender: senderData || undefined
          };
        })
      );

      setMessages(messagesWithSenders);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const subscribeToMessages = () => {
    if (!conversation) return;

    const channel = supabase
      .channel(`conversation-${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`
        },
        (payload) => {
          const newMessage = payload.new as any;
          setMessages(prev => [...prev, {
            id: newMessage.id,
            content: newMessage.content,
            sender_id: newMessage.sender_id,
            created_at: newMessage.created_at
          }]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !conversation || !user || sending) return;

    setSending(true);
    const messageText = newMessage.trim();
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          sender_id: user.id,
          content: messageText
        });

      if (error) throw error;

      // Update conversation's last_message_at
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversation.id);

      setNewMessage('');

      // Fire-and-forget: forward this customer message to the seller's WhatsApp using client helper
      // Only forward if the store manager has opted-in (users_stores.notify_whatsapp === true)
      (async () => {
        try {
          // Try to get seller store info from user_stores table
          // (note: DB column is business_whatsapp_number)
          const { data: store } = await supabase
            .from('user_stores')
            .select('business_whatsapp_number, store_name, notify_whatsapp')
            .eq('user_id', product.user_id)
            .maybeSingle();

          const managerOptIn = !!(store && (store as any).notify_whatsapp);
          if (!managerOptIn) return; // manager hasn't opted in, do not forward

          let sellerPhone: string | undefined = undefined;
          let storeName = product.store?.store_name || 'Store';
          if (store) {
            sellerPhone = (store as any).business_whatsapp_number as any;
            storeName = (store as any).store_name || storeName;
          }

          // Fallback to client-side env var if no phone on store record.
          // Use import.meta.env (Vite) first; fall back to process.env for Node contexts.
          if (!sellerPhone) {
            // prefer Vite-style env names for client builds
            const fallback = (typeof import.meta !== 'undefined' && (import.meta as any).env)
              ? ((import.meta as any).env.VITE_WHATSAPP_TARGET || (import.meta as any).env.NEXT_PUBLIC_WHATSAPP_TARGET || '')
              : (process?.env?.NEXT_PUBLIC_WHATSAPP_TARGET || '');
            sellerPhone = (fallback || '').trim();
          }

          // Debug: show forwarding decision and phone used
          try {
            console.debug('WhatsApp forwarding debug', {
              managerOptIn,
              sellerPhone,
              storeName,
              conversationId: conversation?.id,
              productId: product.id,
              message: messageText
            });
          } catch (e) {
            /* ignore debug failures */
          }

          if (!sellerPhone) {
            console.debug('No seller phone configured for forwarding to WhatsApp');
            return;
          }

          // Normalize phone to digits only and remove leading +
          sellerPhone = sellerPhone.replace(/\D/g, '');

          const plain = `Hi ${storeName}, a customer is waiting on your response about product (${product.id}).\nPlease open NexSq to reply.`;

          const res = await openWhatsApp(sellerPhone, plain);
          try { console.debug('openWhatsApp result', { sellerPhone, res }); } catch (e) { /* ignore */ }
          if (res.opened) {
            toast({ title: 'WhatsApp opened', description: 'WhatsApp was opened for the seller.' });
          } else if (res.copied) {
            toast({ title: 'Message copied', description: 'Message copied to clipboard. Paste it in WhatsApp to send.' });
          } else {
            toast({ title: 'WhatsApp unavailable', description: 'Could not open WhatsApp or copy message.' });
          }
        } catch (err) {
          console.error('Error forwarding message to WhatsApp:', err);
        }
      })();

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  useEffect(() => {
    if (user) {
      initializeConversation();
    }
  }, [user, product]);

  useEffect(() => {
    if (conversation) {
      fetchMessages();
      subscribeToMessages();
    }
  }, [conversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return {
    messages,
    newMessage,
    setNewMessage,
    loading,
    sending,
    sendMessage,
    handleKeyPress,
    messagesEndRef
  };
};
