
import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Send, Users, Heart, MessageCircle } from 'lucide-react';
import { useShowContext } from '@/contexts/ShowContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface ChatMessage {
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

export const LiveChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  const { currentShow, viewerCount, likeCount, setLikeCount } = useShowContext();
  const { user } = useAuth();

  console.log('LiveChat: user object:', user);
  console.log('LiveChat: currentShow:', currentShow);

  const fetchMessages = async () => {
    // For now, let's use a default show ID if no current show
    const showId = currentShow?.id || 'default-show';
    console.log('Fetching messages for show:', showId);
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('live_chat')
        .select('*')
        .eq('show_id', showId)
        .order('timestamp', { ascending: true })
        .limit(100);

      if (error) {
        console.error('Error fetching messages:', error);
      } else {
        console.log('Fetched messages:', data);
        setMessages(data || []);
      }
    } catch (err) {
      console.error('Error in fetchMessages:', err);
    }
    setIsLoading(false);
  };

  const subscribeToLiveChat = () => {
    const showId = currentShow?.id || 'default-show';
    console.log('Subscribing to chat for show:', showId);
    
    supabase
      .channel(`live_chat_${showId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_chat',
        filter: `show_id=eq.${showId}`,
      }, (payload) => {
        console.log('New message received:', payload.new);
        setMessages((prev) => [...prev.slice(-99), payload.new as ChatMessage]);
      })
      .subscribe();
  };

  useEffect(() => {
    fetchMessages();
    subscribeToLiveChat();
    return () => {
      supabase.removeAllChannels();
    };
  }, [currentShow]);

  useEffect(() => {
    const el = chatContainerRef.current;
    if (el && isAtBottomRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Send message attempted');
    console.log('newMessage:', newMessage);
    console.log('user:', user);
    console.log('currentShow:', currentShow);

    if (!newMessage.trim()) {
      console.log('Message is empty');
      return;
    }

    if (!user) {
      console.log('No user found');
      toast({
        title: "Authentication required",
        description: "Please log in to send messages",
        variant: "destructive"
      });
      return;
    }

    setIsSending(true);
    
    try {
      // Use default show if no current show
      const showId = currentShow?.id || 'default-show';
      
      const messageData = {
        message: newMessage.trim(),
        username: user.user_metadata?.first_name || user.email?.split('@')[0] || 'Anonymous',
        show_id: showId,
        user_id: user.id,
        avatar_url: user.user_metadata?.avatar_url || null,
        is_moderator: user.user_metadata?.is_moderator || false,
        is_vip: user.user_metadata?.is_vip || false,
        timestamp: new Date().toISOString(),
      };

      console.log('Sending message data:', messageData);

      const { data, error } = await supabase
        .from('live_chat')
        .insert(messageData)
        .select();

      if (error) {
        console.error('Error sending message:', error);
        toast({
          title: "Error sending message",
          description: error.message,
          variant: "destructive"
        });
      } else {
        console.log('Message sent successfully:', data);
        setNewMessage('');
        toast({
          title: "Message sent!",
          description: "Your message has been posted.",
        });
        // Refresh messages to ensure UI updates
        fetchMessages();
      }
    } catch (err) {
      console.error('Error in handleSendMessage:', err);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleLike = () => {
    setLikeCount(likeCount + 1);
  };

  return (
    <Card className="p-4 dark:bg-[#161616] bg-white dark:border-gray-700 h-[500px] flex flex-col rounded-xl shadow-md">
      <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg">
        <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">NOW SHOWING</div>
        <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
          {currentShow?.title || 'General Chat'}
        </div>
        {currentShow?.description && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{currentShow.description}</div>
        )}
      </div>

      <div className="flex items-center justify-between mb-4 pb-3 border-b dark:border-gray-700">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1 text-red-500">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium">WATCHING</span>
            <Users className="w-4 h-4 text-red-500" />
            <span className="text-sm text-gray-700 dark:text-gray-300">{viewerCount.toLocaleString()}</span>
          </div>
          <div className="flex items-center space-x-1 text-pink-500">
            <Heart className="w-4 h-4 fill-current" />
            <span className="text-sm font-semibold">{likeCount}</span>
          </div>
        </div>
      </div>

      <div 
        ref={chatContainerRef} 
        onScroll={() => {
          const el = chatContainerRef.current;
          if (!el) return;
          const threshold = 80;
          isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
        }} 
        className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1 scroll-smooth"
      >
        {isLoading ? (
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">Loading messages...</p>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 text-sm mt-10">
            <MessageCircle className="mx-auto h-8 w-8 mb-2 text-gray-400" />
            There are no comments yet. Be the first to leave a comment.
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="flex items-start space-x-2 group">
              <Avatar className="h-7 w-7 flex-shrink-0">
                <AvatarImage src={msg.avatar_url} />
                <AvatarFallback className="text-xs bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                  {msg.username?.charAt(0)?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <span className={`text-xs font-medium ${
                    msg.is_moderator ? 'text-green-600 dark:text-green-400'
                      : msg.is_vip ? 'text-purple-600 dark:text-purple-400'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {msg.username}
                  </span>
                  {msg.is_moderator && <Badge className="bg-green-500 text-white text-xs h-4 px-1">MOD</Badge>}
                  {msg.is_vip && <Badge className="bg-purple-500 text-white text-xs h-4 px-1">VIP</Badge>}
                  <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-1 inline-block max-w-[90%] break-words">
                  {msg.message}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSendMessage} className="flex items-end gap-2 mt-auto bg-gray-50 dark:bg-[#18181c] rounded-xl px-3 py-2 shadow-inner border border-gray-200 dark:border-gray-800">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-10 w-10 p-0 text-gray-400 hover:text-pink-500 transition"
          onClick={handleLike}
          aria-label="Like"
        >
          <Heart className="w-5 h-5 fill-current" />
        </Button>

        <div className="relative flex-1">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={user ? "Type your message..." : "Login to chat"}
            className="h-10 text-sm rounded-lg pl-4 pr-10 bg-white dark:bg-[#23232b] border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition"
            maxLength={200}
            autoComplete="off"
            disabled={!user || isSending}
          />
        </div>

        <Button 
          type="submit" 
          size="icon" 
          className="h-10 w-10 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center justify-center shadow-md transition disabled:opacity-50" 
          disabled={!newMessage.trim() || !user || isSending}
          aria-label="Send"
        >
          <Send className="h-5 w-5 text-white" />
        </Button>
      </form>

      {!user && (
        <div className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2">
          Please log in to participate in the chat
        </div>
      )}
    </Card>
  );
};
