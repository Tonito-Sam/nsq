import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface LiveStreamMessage {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
}

interface Props {
  streamId: string;
}

const LiveStreamMessages: React.FC<Props> = ({ streamId }) => {
  const [messages, setMessages] = useState<LiveStreamMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMessages();
    // Optionally: subscribe to real-time updates here
    // ...
  }, [streamId]);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id, content, created_at, sender_id')
        .eq('conversation_id', streamId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      setMessages([]);
    }
    setLoading(false);
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: streamId,
          content: newMessage.trim(),
          created_at: new Date().toISOString(),
          // Add sender_id if you have user context
        });
      if (error) throw error;
      setNewMessage('');
      fetchMessages();
    } catch (err) {
      // Optionally show error
    }
    setLoading(false);
  };

  return (
    <div>
      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
        {messages.map(msg => (
          <div key={msg.id}>
            <b>{msg.sender_id}:</b> {msg.content} <small>{msg.created_at}</small>
          </div>
        ))}
        {loading && <div>Loading...</div>}
      </div>
      <form onSubmit={e => { e.preventDefault(); sendMessage(); }}>
        <input
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          placeholder="Type a message..."
        />
        <button type="submit" disabled={loading}>Send</button>
      </form>
    </div>
  );
};

export default LiveStreamMessages;
