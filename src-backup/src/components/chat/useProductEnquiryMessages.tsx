import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useProductEnquiryMessages = (conversationId?: string) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = async () => {
    if (!conversationId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (!error) setMessages(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchMessages();
    // Optionally subscribe to realtime updates
    const channel = supabase
      .channel('product-enquiry-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, fetchMessages)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  return { messages, loading, fetchMessages };
};
