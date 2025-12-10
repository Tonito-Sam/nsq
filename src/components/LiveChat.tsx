
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Send, Eye, Heart, MessageCircle, Tv } from 'lucide-react';
import { EMOJI_PICKER_LIST } from '@/components/studio/emojiList';
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
  const isAtTopRef = useRef(true);

  const { currentShow, viewerCount, likeCount, setLikeCount } = useShowContext();
  const { user } = useAuth();

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const [pickerPos, setPickerPos] = useState<{ left: number; top: number } | null>(null);

  console.log('LiveChat: user object:', user);
  console.log('LiveChat: currentShow:', currentShow);

  // NOTE: premieredSource is computed below after formatDaysAgo to avoid using the helper before it's declared.

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
        // fetch newest first so we can render newest at the top
        .order('timestamp', { ascending: false })
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
        // prepend newest message so newest items remain on top
        setMessages((prev) => [payload.new as ChatMessage, ...prev].slice(0, 100));
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
    if (!el) return;
    // If user is at the top (showing newest) then keep newest visible when messages update
    if (isAtTopRef.current) {
      el.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [messages]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (showEmojiPicker) {
        // If picker exists and click is outside, close
        if (pickerRef.current && target && !pickerRef.current.contains(target)) {
          setShowEmojiPicker(false);
        }
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [showEmojiPicker]);

  // compute portal position when openerRef set and picker opens
  useEffect(() => {
    if (showEmojiPicker && openerRef.current) {
      const r = openerRef.current.getBoundingClientRect();
      // position picker above the opener button
      const left = Math.max(8, r.left);
      const top = Math.max(8, r.top - 220); // 220px above button
      setPickerPos({ left, top });
    } else {
      setPickerPos(null);
    }
  }, [showEmojiPicker]);

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

  // Returns a friendly "Premiered: X days ago" string for a date.
  const formatDaysAgo = (maybeDate?: string | Date | null) => {
    if (!maybeDate) return null;
    const date = typeof maybeDate === 'string' ? new Date(maybeDate) : new Date(maybeDate as Date);
    if (Number.isNaN(date.getTime())) return null;

    const diffMs = Date.now() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return `Premiered: in the future`;
    if (diffDays === 0) return `Premiered: today`;
    if (diffDays === 1) return `Premiered: 1 day ago`;
    return `Premiered: ${diffDays} days ago`;
  };

  // Determine premiere source from a few possible field names (use any to avoid strict type checks)
  const premieredSource = (currentShow as any)?.premiered_at || (currentShow as any)?.premieredAt || (currentShow as any)?.premieredOn || (currentShow as any)?.start_time || (currentShow as any)?.created_at || (currentShow as any)?.createdAt || null;
  const premieredLabel = formatDaysAgo(premieredSource as string | Date | null);

  // Compact days-since helper (returns number of days or null)
  const daysSince = (maybeDate?: string | Date | null): number | null => {
    if (!maybeDate) return null;
    const d = typeof maybeDate === 'string' ? new Date(maybeDate) : new Date(maybeDate as Date);
    if (Number.isNaN(d.getTime())) return null;
    const diffDays = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 ? diffDays : null;
  };
  const premieredDays = daysSince(premieredSource as string | Date | null);

  const handleLike = () => {
    setLikeCount(likeCount + 1);
  };

  return (
    <Card className="p-4 dark:bg-[#161616] bg-white dark:border-gray-700 max-h-[80vh] md:h-[500px] flex flex-col rounded-xl shadow-md">
      <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg">
        <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">NOW SHOWING</div>
        <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
          {currentShow?.title || 'General Chat'}
        </div>
        {/* Hide long description on small screens so chat input remains visible */}
        {currentShow?.description && (
          <div className="hidden md:block text-xs text-gray-500 dark:text-gray-400 mt-1">{currentShow.description}</div>
        )}
      </div>

      {/* Mobile: show input directly under WATCHING on small screens */}
      <div className="md:hidden mb-3 px-1">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2 bg-gray-50 dark:bg-[#18181c] rounded-xl p-2 border border-gray-200 dark:border-gray-800">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9 p-0 text-gray-400 hover:text-pink-500 transition"
            onClick={handleLike}
            aria-label="Like"
          >
            <Heart className="w-4 h-4 fill-current" />
          </Button>

          <div className="relative flex-1">
            <button
              type="button"
              onClick={(e) => { openerRef.current = e.currentTarget as HTMLButtonElement; setShowEmojiPicker(v => !v); }}
              aria-label="Emoji picker"
              className="absolute left-1 top-1.5 h-6 w-6 flex items-center justify-center text-lg"
            >
              😊
            </button>

            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={user ? "Type your message..." : "Login to chat"}
              className="h-9 text-sm rounded-lg pl-10 pr-8 bg-white dark:bg-[#23232b] border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition"
              maxLength={200}
              autoComplete="off"
              disabled={!user || isSending}
            />
            <button type="submit" className="absolute right-1 top-1.5 h-6 w-6 flex items-center justify-center bg-purple-600 rounded text-white">
              <Send className="h-3 w-3" />
            </button>

            {showEmojiPicker && pickerPos && createPortal(
              <div ref={pickerRef} style={{ position: 'fixed', left: pickerPos.left, top: pickerPos.top, zIndex: 99999 }} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg p-2 w-56">
                <div className="grid grid-cols-6 gap-2">
                  {EMOJI_PICKER_LIST.map((e: any, i: number) => (
                    <button
                      key={`${e.char}-${i}`}
                      type="button"
                      title={e.name}
                      onClick={() => {
                        setNewMessage((m) => (m || '') + e.char + ' ');
                        setShowEmojiPicker(false);
                      }}
                      className="p-1 text-lg rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      {e.char}
                    </button>
                  ))}
                </div>
              </div>,
              document.body
            )}
          </div>
        </form>
      </div>

    <div className="flex items-center mb-4 pb-3 border-b dark:border-gray-700">
  <div className="w-full flex flex-wrap items-center gap-4 shrink min-w-0 overflow-hidden">

    {/* Premiered badge */}
    <button
      type="button"
      aria-label="Premiered"
      title={premieredLabel || ''}
      className="inline-flex items-center flex-nowrap space-x-1 bg-yellow-50 dark:bg-yellow-900 px-2 py-1 rounded-md whitespace-nowrap min-w-0"
    >
      <Tv className="w-4 h-4 text-yellow-600 dark:text-yellow-300" />
      <span className="text-xs font-medium text-yellow-700 dark:text-yellow-300">
        {premieredDays === 0 ? 'today' : premieredDays !== null ? `${premieredDays}d` : '-'}
      </span>
    </button>

    {/* Views badge */}
    <button
      type="button"
      aria-label="Views"
      className="inline-flex items-center flex-nowrap space-x-1 bg-blue-50 dark:bg-blue-900 px-2 py-1 rounded-md whitespace-nowrap min-w-0"
    >
      <Eye className="w-4 h-4 text-blue-600 dark:text-blue-300" />
      <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
        {viewerCount.toLocaleString()}
      </span>
    </button>

    {/* Likes badge */}
    <button
      type="button"
      aria-label="Likes"
      className="inline-flex items-center flex-nowrap space-x-1 bg-pink-50 dark:bg-pink-900 px-2 py-1 rounded-md whitespace-nowrap min-w-0"
    >
      <Heart className="w-4 h-4 text-pink-600 dark:text-pink-300" />
      <span className="text-xs font-medium text-pink-700 dark:text-pink-300">
        {likeCount}
      </span>
    </button>

    {/* Comments badge */}
    <button
      type="button"
      aria-label="Comments"
      className="inline-flex items-center flex-nowrap space-x-1 bg-indigo-50 dark:bg-indigo-900 px-2 py-1 rounded-md whitespace-nowrap min-w-0"
    >
      <MessageCircle className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
      <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
        {messages.length}
      </span>
    </button>

  </div>
</div>


      <div
        ref={chatContainerRef}
        onScroll={() => {
          const el = chatContainerRef.current;
          if (!el) return;
          const threshold = 80;
          // when scrollTop is near 0 we consider user at top (newest messages)
          isAtTopRef.current = el.scrollTop < threshold;
        }}
        className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1 scroll-smooth"
        // ensure the messages area can shrink on very small viewports
        style={{ minHeight: 0 }}
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
                  <div className="flex flex-col">
                    <span className={`text-xs font-medium ${
                      msg.is_moderator ? 'text-green-600 dark:text-green-400'
                        : msg.is_vip ? 'text-purple-600 dark:text-purple-400'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {msg.username}
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                  {msg.is_moderator && <Badge className="bg-green-500 text-white text-xs h-4 px-1">MOD</Badge>}
                  {msg.is_vip && <Badge className="bg-purple-500 text-white text-xs h-4 px-1">VIP</Badge>}
                </div>
                <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-1 inline-block max-w-[90%] break-words">
                  {msg.message}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

<form
  onSubmit={handleSendMessage}
  className="hidden md:flex items-end gap-2 mt-auto bg-gray-50 dark:bg-[#18181c] rounded-xl px-3 py-2 shadow-inner border border-gray-200 dark:border-gray-800"
>
  {/* Like button */}
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

  {/* Input wrapper */}
  <div className="relative flex-1">

    {/* Emoji button */}
    <button
      type="button"
      onClick={(e) => { openerRef.current = e.currentTarget as HTMLButtonElement; setShowEmojiPicker(v => !v); }}
      aria-label="Emoji picker"
      className="absolute left-3 top-3 h-6 w-6 flex items-center justify-center text-lg"
    >
      😊
    </button>

    {/* Textarea input */}
    <textarea
      value={newMessage}
      onChange={(e) => setNewMessage(e.target.value)}
      placeholder={user ? "Type your message..." : "Login to chat"}
      rows={2}
      className="w-full h-auto min-h-[40px] max-h-[160px] resize-none text-sm rounded-lg pl-10 pr-12 py-2 bg-white dark:bg-[#23232b] border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition"
      maxLength={400}
      autoComplete="off"
      disabled={!user || isSending}
    />

    {/* Send button inside the field */}
    <button
      type="submit"
      disabled={!newMessage.trim() || !user || isSending}
      aria-label="Send"
      className="absolute right-2 bottom-2 h-8 w-8 flex items-center justify-center rounded-md bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 transition"
    >
      <Send className="w-4 h-4" />
    </button>

    {/* Emoji picker */}
    {showEmojiPicker && pickerPos && createPortal(
      <div
        ref={pickerRef}
        style={{ position: 'fixed', left: pickerPos.left, top: pickerPos.top, zIndex: 99999 }}
        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg p-2 w-56"
      >
        <div className="grid grid-cols-6 gap-2">
          {EMOJI_PICKER_LIST.map((e: any, i: number) => (
            <button
              key={`${e.char}-${i}`}
              type="button"
              title={e.name}
              onClick={() => {
                setNewMessage((m) => (m || '') + e.char + ' ');
                setShowEmojiPicker(false);
              }}
              className="p-1 text-lg rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {e.char}
            </button>
          ))}
        </div>
      </div>,
      document.body
    )}

  </div>
</form>


      {!user && (
        <div className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2">
          Please log in to participate in the chat
        </div>
      )}
    </Card>
  );
};
