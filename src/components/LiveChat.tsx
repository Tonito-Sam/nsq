import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Send, Eye, Heart, MessageCircle, Tv, Gift, MoreVertical, Reply, ThumbsUp, Share2, Trash2 } from 'lucide-react';
import { EMOJI_PICKER_LIST } from '@/components/studio/emojiList';
import { useShowContext } from '@/contexts/ShowContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
  reply_to?: string;
  reactions?: Record<string, number>;
  like_count?: number;
  reply_count?: number;
  user_id?: string;
  is_admin?: boolean;
  is_superadmin?: boolean;
  replies?: ChatMessage[];
  show_name?: string;
  channel_name?: string;
}

interface Reaction {
  emoji: string;
  name: string;
}

export const LiveChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [activeReactions, setActiveReactions] = useState<Record<string, string[]>>({});
  const [showReactionsPicker, setShowReactionsPicker] = useState<string | null>(null);
  const [showDonationModal, setShowDonationModal] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isAtTopRef = useRef(true);

  const { currentShow, viewerCount, likeCount, setLikeCount } = useShowContext();
  const { user } = useAuth();

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const [pickerPos, setPickerPos] = useState<{ left: number; top: number } | null>(null);
  // Reply draft for inline reply form
  const [replyDraft, setReplyDraft] = useState('');

  // Ensure video keeps playing / resumes when chat mounts or modal toggles
  useEffect(() => {
    const tryPlayVideo = async () => {
      const v = document.querySelector('video') as HTMLVideoElement | null;
      if (!v) return;
      if (v.paused) {
        try {
          await v.play();
          console.debug('Resumed video playback from LiveChat');
        } catch (err) {
          // Autoplay may be blocked; that's fine
          console.debug('Unable to autoplay video from LiveChat', err);
        }
      }
    };

    // run on mount
    tryPlayVideo();

    // also try again when donation modal opens/closes
  }, [showDonationModal]);

  // Notify VideoContainer that LiveChat is an overlay while mounted
  useEffect(() => {
    const sendOverlayEvent = (active: boolean) => {
      try {
        // persist current overlay state so late-mounted listeners can query it
        try { (window as any).__videoOverlayActive = !!active; } catch (e) { /* ignore */ }
        window.dispatchEvent(new CustomEvent('video-overlay-change', { detail: { overlayActive: active } }));
      } catch (e) {
        // older browsers may not support CustomEvent constructor
        try { (window as any).__videoOverlayActive = !!active; } catch (err) { /* ignore */ }
        const ev = document.createEvent('CustomEvent');
        ev.initCustomEvent('video-overlay-change', false, false, { overlayActive: active });
        window.dispatchEvent(ev);
      }
    };

    // when LiveChat mounts, overlay is active
    sendOverlayEvent(true);
    // when LiveChat unmounts, notify that overlay is gone
    return () => sendOverlayEvent(false);
  }, []);

  // Notify when donation modal opens/closes specifically
  useEffect(() => {
    const active = !!showDonationModal;
    try { (window as any).__videoOverlayActive = active; } catch (e) { /* ignore */ }
    try {
      window.dispatchEvent(new CustomEvent('video-overlay-change', { detail: { overlayActive: active } }));
    } catch (e) {
      const ev = document.createEvent('CustomEvent');
      ev.initCustomEvent('video-overlay-change', false, false, { overlayActive: active });
      window.dispatchEvent(ev);
    }
  }, [showDonationModal]);

  // Quick reactions emojis
  const quickReactions: Reaction[] = [
    { emoji: '👍', name: 'Thumbs Up' },
    { emoji: '❤️', name: 'Heart' },
    { emoji: '😂', name: 'Laughing' },
    { emoji: '😮', name: 'Wow' },
    { emoji: '😢', name: 'Sad' },
    { emoji: '🎉', name: 'Celebration' },
  ];

  // Fetch messages with replies
  const fetchMessages = async () => {
    const showId = currentShow?.id || 'default-show';
    setIsLoading(true);
    try {
      const { data: parentMessages, error } = await supabase
        .from('live_chat')
        .select('*')
        .eq('show_id', showId)
        .is('reply_to', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Fetch replies for each parent message
      const messagesWithReplies = await Promise.all(
        (parentMessages || []).map(async (msg) => {
          const { data: replies } = await supabase
            .from('live_chat')
            .select('*')
            .eq('reply_to', msg.id)
            .order('created_at', { ascending: true })
            .limit(10);

          return {
            ...msg,
            replies: replies || [],
            like_count: msg.like_count || 0,
            reply_count: msg.reply_count || 0,
            reactions: msg.reactions || {}
          };
        })
      );

      setMessages(messagesWithReplies);
    } catch (err) {
      console.error('Error fetching messages:', err);
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive"
      });
    }
    setIsLoading(false);
  };

  // Subscribe to real-time updates
  const subscribeToLiveChat = () => {
    const showId = currentShow?.id || 'default-show';
    
    supabase
      .channel(`live_chat_${showId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_chat',
        filter: `show_id=eq.${showId}`,
      }, (payload) => {
        console.log('Chat update:', payload);
        fetchMessages(); // Refresh on any change
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

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    
    // Only auto-scroll if user is near bottom
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (isNearBottom) {
      setTimeout(() => {
        el.scrollTop = el.scrollHeight;
      }, 100);
    }
  }, [messages]);

  // Close pickers when clicking outside
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      
      if (showEmojiPicker && pickerRef.current && target && !pickerRef.current.contains(target)) {
        setShowEmojiPicker(false);
      }
      
      if (showReactionsPicker && !(target as Element)?.closest('.reaction-picker')) {
        setShowReactionsPicker(null);
      }
    };
    
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [showEmojiPicker, showReactionsPicker]);

  // Position picker
  useEffect(() => {
    if (showEmojiPicker && openerRef.current) {
      const r = openerRef.current.getBoundingClientRect();
      const left = Math.max(8, r.left);
      const top = Math.max(8, r.top - 220);
      setPickerPos({ left, top });
    } else {
      setPickerPos(null);
    }
  }, [showEmojiPicker]);

  // Submit an inline reply
  const handleReplySubmit = async (parentId: string) => {
    if (!replyDraft.trim() || !user) return;
    const showId = currentShow?.id || 'default-show';
    const messageData: any = {
      message: replyDraft.trim(),
      username: user.user_metadata?.first_name || user.email?.split('@')[0] || 'Anonymous',
      show_id: showId,
      user_id: user.id,
      avatar_url: user.user_metadata?.avatar_url || null,
      is_moderator: user.user_metadata?.is_moderator || false,
      is_vip: user.user_metadata?.is_vip || false,
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
      like_count: 0,
      reply_count: 0,
      reactions: {},
      reply_to: parentId,
    };

    try {
      const { data: inserted, error } = await supabase.from('live_chat').insert(messageData).select().single();
      if (error) throw error;
      const newMsg = inserted as ChatMessage;

      // update local parent message replies
      setMessages(prev => prev.map(m => m.id === parentId ? { ...m, replies: [...(m.replies || []), newMsg], reply_count: (m.reply_count ?? 0) + 1 } : m));
      setReplyDraft('');
      setReplyingTo(null);
      toast({ title: 'Reply posted' });
    } catch (err) {
      console.error('Failed to post reply', err);
      toast({ title: 'Error', description: 'Failed to post reply', variant: 'destructive' });
    }
  };

  // Quick inline reaction (heart/fire/thumbs-down)
  const handleQuickReact = async (messageId: string, emoji: string) => {
    if (!user) {
      toast({ title: 'Login required', description: 'Please log in to react', variant: 'destructive' });
      return;
    }

    try {
      // fetch current reactions
      const { data: msg } = await supabase.from('live_chat').select('reactions').eq('id', messageId).single();
      const currentReactions = (msg?.reactions as Record<string, number>) || {};
      const newReactions = { ...currentReactions, [emoji]: (currentReactions[emoji] || 0) + 1 };

      // persist
      await supabase.from('live_chat').update({ reactions: newReactions }).eq('id', messageId);

      // update local state optimistically
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions: newReactions } : m));
      setActiveReactions(prev => ({ ...prev, [messageId]: [...(prev[messageId] || []), emoji] }));
    } catch (err) {
      console.error('Quick react failed', err);
    }
  };

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !user) {
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please log in to send messages",
          variant: "destructive"
        });
      }
      return;
    }

    setIsSending(true);
    
    try {
      const showId = currentShow?.id || 'default-show';
      const messageData: any = {
        message: newMessage.trim(),
        username: user.user_metadata?.first_name || user.email?.split('@')[0] || 'Anonymous',
        show_id: showId,
        user_id: user.id,
        avatar_url: user.user_metadata?.avatar_url || null,
        is_moderator: user.user_metadata?.is_moderator || false,
        is_vip: user.user_metadata?.is_vip || false,
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString(),
        like_count: 0,
        reply_count: 0,
        reactions: {}
      };

      if (replyingTo) {
        messageData.reply_to = replyingTo.id;
      }

      // Insert and return the inserted row so we can optimistically update UI
      const { data: inserted, error } = await supabase
        .from('live_chat')
        .insert(messageData)
        .select()
        .single();

      if (error) throw error;

      const newMsg = inserted as ChatMessage;

      // Optimistically update local state so the new message shows immediately
      if (replyingTo) {
        setMessages(prev => prev.map(m =>
          m.id === replyingTo.id
            ? { ...m, replies: [...(m.replies || []), newMsg], reply_count: (m.reply_count ?? 0) + 1 }
            : m
        ));
      } else {
        setMessages(prev => [newMsg, ...prev]);
      }

      setNewMessage('');
      setReplyingTo(null);
      
      toast({
        title: "Message sent!",
        description: replyingTo ? "Reply posted" : "Your message has been posted.",
      });
      
    } catch (err) {
      console.error('Error sending message:', err);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  // Handle reaction to message
  const handleReaction = async (messageId: string, emoji: string) => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please log in to react to messages",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data: message } = await supabase
        .from('live_chat')
        .select('reactions, like_count')
        .eq('id', messageId)
        .single();

      if (!message) return;

      const reactions = message.reactions || {};
      const userReactions = activeReactions[messageId] || [];
      
      // Toggle reaction
      if (userReactions.includes(emoji)) {
        // Remove reaction
        reactions[emoji] = Math.max(0, (reactions[emoji] || 1) - 1);
        setActiveReactions(prev => ({
          ...prev,
          [messageId]: prev[messageId]?.filter(e => e !== emoji) || []
        }));
      } else {
        // Add reaction
        reactions[emoji] = (reactions[emoji] || 0) + 1;
        setActiveReactions(prev => ({
          ...prev,
          [messageId]: [...(prev[messageId] || []), emoji]
        }));
      }

      // Update message
      await supabase
        .from('live_chat')
        .update({ 
          reactions,
          like_count: (Object.values(reactions) as number[]).reduce((a, b) => a + b, 0)
        })
        .eq('id', messageId);

      setShowReactionsPicker(null);
      
    } catch (err) {
      console.error('Error adding reaction:', err);
    }
  };

  // Like show (increment global like count)
  const handleLikeShow = () => {
    setLikeCount(likeCount + 1);
    toast({
      title: "Liked!",
      description: "You liked this show",
    });
  };

  // Delete message
  const handleDeleteMessage = async (messageId: string, userId: string) => {
    if (!user || (user.id !== userId && !user.user_metadata?.is_moderator && !user.user_metadata?.is_admin)) {
      toast({
        title: "Permission denied",
        description: "You don't have permission to delete this message",
        variant: "destructive"
      });
      return;
    }

    try {
      await supabase.from('live_chat').delete().eq('id', messageId);
      toast({
        title: "Deleted",
        description: "Message deleted successfully",
      });
    } catch (err) {
      console.error('Error deleting message:', err);
      toast({
        title: "Error",
        description: "Failed to delete message",
        variant: "destructive"
      });
    }
  };

  // Pin message
  const handlePinMessage = async (messageId: string) => {
    if (!user?.user_metadata?.is_moderator) {
      toast({
        title: "Moderator only",
        description: "Only moderators can pin messages",
        variant: "destructive"
      });
      return;
    }

    try {
      // Unpin all other messages first
      await supabase
        .from('live_chat')
        .update({ is_pinned: false })
        .eq('show_id', currentShow?.id || 'default-show');

      // Pin selected message
      await supabase
        .from('live_chat')
        .update({ is_pinned: true })
        .eq('id', messageId);

      toast({
        title: "Pinned",
        description: "Message pinned to top",
      });
    } catch (err) {
      console.error('Error pinning message:', err);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDaysAgo = (maybeDate?: string | Date | null) => {
    if (!maybeDate) return null;
    const date = typeof maybeDate === 'string' ? new Date(maybeDate) : maybeDate as Date;
    if (Number.isNaN(date.getTime())) return null;

    const diffMs = Date.now() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return `Premiered: in the future`;
    if (diffDays === 0) return `Premiered: today`;
    if (diffDays === 1) return `Premiered: 1 day ago`;
    return `Premiered: ${diffDays} days ago`;
  };

  const premieredSource = (currentShow as any)?.premiered_at || (currentShow as any)?.premieredAt || 
                         (currentShow as any)?.premieredOn || (currentShow as any)?.start_time || 
                         (currentShow as any)?.created_at || (currentShow as any)?.createdAt || null;
  const premieredLabel = formatDaysAgo(premieredSource as string | Date | null);

  const daysSince = (maybeDate?: string | Date | null): number | null => {
    if (!maybeDate) return null;
    const d = typeof maybeDate === 'string' ? new Date(maybeDate) : maybeDate as Date;
    if (Number.isNaN(d.getTime())) return null;
    const diffDays = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 ? diffDays : null;
  };
  const premieredDays = daysSince(premieredSource as string | Date | null);

  // Render message with replies
  const renderMessage = (msg: ChatMessage, isReply = false) => {
    return (
      <div key={msg.id} className={`group ${isReply ? 'ml-8 mt-2' : 'mb-4'}`}>
        <div className="flex items-start space-x-3">
          <Avatar className="h-8 w-8 flex-shrink-0 mt-1">
            <AvatarImage src={msg.avatar_url} />
            <AvatarFallback className="text-xs bg-gradient-to-r from-blue-500 to-purple-500 text-white">
              {msg.username?.charAt(0)?.toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center space-x-2">
                <span className={`text-sm font-medium ${{
                  true: '',
                } as any}`}>{/* placeholder for conditional classes */}
                  {msg.username}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatTime(msg.timestamp)}
                </span>
                {msg.is_superadmin && <Badge className="bg-red-500 text-white text-xs h-4 px-1">ADMIN</Badge>}
                {msg.is_admin && <Badge className="bg-orange-500 text-white text-xs h-4 px-1">STAFF</Badge>}
                {msg.is_moderator && <Badge className="bg-green-500 text-white text-xs h-4 px-1">MOD</Badge>}
                {msg.is_vip && <Badge className="bg-purple-500 text-white text-xs h-4 px-1">VIP</Badge>}
                {msg.is_pinned && <Badge className="bg-yellow-500 text-white text-xs h-4 px-1">PINNED</Badge>}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setReplyingTo(msg)}>
                    <Reply className="h-4 w-4 mr-2" />
                    Reply
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowReactionsPicker(msg.id)}>
                    <ThumbsUp className="h-4 w-4 mr-2" />
                    React
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </DropdownMenuItem>
                  {(user?.id === msg.user_id || user?.user_metadata?.is_moderator) && (
                    <DropdownMenuItem onClick={() => handleDeleteMessage(msg.id, msg.user_id || '')} className="text-red-600">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  )}
                  {user?.user_metadata?.is_moderator && (
                    <DropdownMenuItem onClick={() => handlePinMessage(msg.id)}>
                      📌 Pin message
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {replyingTo?.id === msg.id && (
              <div className="mb-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs">
                Replying to @{replyingTo.username}
              </div>
            )}

            <p className="text-sm text-gray-900 dark:text-gray-100 mb-2 break-words">
              {msg.message}
            </p>

            {/* Reactions display */}
            {msg.reactions && Object.keys(msg.reactions).length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {Object.entries(msg.reactions).map(([emoji, count]) => (
                  <button
                    key={emoji}
                    onClick={() => handleReaction(msg.id, emoji)}
                    className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
                      (activeReactions[msg.id] || []).includes(emoji)
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <span>{emoji}</span>
                    <span>{count}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Message actions: quick reacts and reply */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => handleQuickReact(msg.id, '❤️')} className="text-xs text-pink-500">❤️</button>
                <button type="button" onClick={() => handleQuickReact(msg.id, '🔥')} className="text-xs text-yellow-400">🔥</button>
                <button type="button" onClick={() => handleQuickReact(msg.id, '👎')} className="text-xs text-gray-500">👎</button>
              </div>

              <button
                type="button"
                onClick={() => { setReplyingTo(msg); setReplyDraft(''); }}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
              >
                Reply
              </button>

              {(msg.reply_count ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={() => setReplyingTo(msg)}
                  className="text-xs text-blue-600 dark:text-blue-400"
                >
                  {msg.reply_count ?? 0} { (msg.reply_count ?? 0) === 1 ? 'reply' : 'replies' }
                </button>
              )}
            </div>

            {/* Inline easedown reply form */}
            <div className={`transition-all duration-200 ease-out overflow-hidden ${replyingTo?.id === msg.id ? 'max-h-40 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
              {replyingTo?.id === msg.id && (
                <form onSubmit={(e) => { e.preventDefault(); handleReplySubmit(msg.id); }} className="flex gap-2 items-start mt-2">
                  <textarea
                    value={replyDraft}
                    onChange={(e) => setReplyDraft(e.target.value)}
                    placeholder="Write a reply..."
                    className="flex-1 min-h-[48px] max-h-[120px] p-2 rounded-md bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm"
                  />
                  <div className="flex flex-col gap-2">
                    <Button type="submit" disabled={!replyDraft.trim()}>Reply</Button>
                    <Button variant="ghost" onClick={() => { setReplyingTo(null); setReplyDraft(''); }}>Cancel</Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Replies */}
        {msg.replies && msg.replies.length > 0 && (
          <div className="mt-3 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
            {msg.replies.map(reply => renderMessage(reply, true))}
          </div>
        )}

        {/* Reactions picker */}
        {showReactionsPicker === msg.id && (
          <div className="absolute reaction-picker mt-2 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
            <div className="flex gap-2">
              {quickReactions.map(reaction => (
                <button
                  key={reaction.emoji}
                  onClick={() => handleReaction(msg.id, reaction.emoji)}
                  className="p-1 text-lg hover:scale-125 transition-transform"
                  title={reaction.name}
                >
                  {reaction.emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Card data-livechat className="p-4 dark:bg-[#0f0f0f] bg-white dark:border-gray-800 max-h-[60vh] md:h-[600px] flex flex-col rounded-2xl shadow-xl">
        {/* Header */}
        <div className="mb-4 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl">
          <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1 uppercase tracking-wider">LIVE CHAT</div>
          <div className="font-bold text-lg text-gray-900 dark:text-gray-100 mb-1">
            {currentShow?.title || 'General Chat'}
          </div>
          {currentShow?.description && (
            <div className="text-sm text-gray-600 dark:text-gray-400">{currentShow.description}</div>
          )}
        </div>

        {/* Stats bar */}
        <div className="flex items-center mb-4 pb-3 border-b dark:border-gray-800">
          <div className="w-full flex flex-wrap items-center gap-3 shrink min-w-0 overflow-hidden">
            <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800">
              <Tv className="w-3 h-3 mr-1 text-yellow-600 dark:text-yellow-400" />
              <span className="text-xs font-medium text-yellow-700 dark:text-yellow-300">
                {premieredDays === 0 ? 'Today' : premieredDays !== null ? `${premieredDays}d` : 'Live'}
              </span>
            </Badge>

            <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800">
              <Eye className="w-3 h-3 mr-1 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                {viewerCount.toLocaleString()}
              </span>
            </Badge>

            <Badge variant="outline" className="bg-pink-50 dark:bg-pink-900/30 border-pink-200 dark:border-pink-800">
              <Heart className="w-3 h-3 mr-1 text-pink-600 dark:text-pink-400" />
              <span className="text-xs font-medium text-pink-700 dark:text-pink-300">
                {likeCount}
              </span>
            </Badge>

            <Badge variant="outline" className="bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800">
              <MessageCircle className="w-3 h-3 mr-1 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
                {messages.reduce((acc, msg) => acc + 1 + (msg.replies?.length || 0), 0)}
              </span>
            </Badge>
          </div>
        </div>

        {/* Chat messages */}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 pb-48 scroll-smooth custom-scrollbar"
          style={{ minHeight: 0 }}
        >
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <div className="mt-4 space-y-3">
                <div className="flex items-start space-x-3 justify-center">
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800 animate-pulse" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-3/4 animate-pulse" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/2 animate-pulse" />
                  </div>
                </div>
                <div className="flex items-start space-x-3 justify-center">
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800 animate-pulse" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-2/3 animate-pulse" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/3 animate-pulse" />
                  </div>
                </div>
              </div>
           </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <MessageCircle className="mx-auto h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm">No messages yet. Be the first to chat!</p>
            </div>
          ) : (
            <>
              {/* Pinned messages first */}
              {messages.filter(msg => msg.is_pinned).map(msg => renderMessage(msg))}
              
              {/* Regular messages */}
              {messages.filter(msg => !msg.is_pinned).map(msg => renderMessage(msg))}
            </>
          )}
        </div>

        {/* Reply indicator */}
        {replyingTo && (
          <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-between">
            <div className="text-sm">
              <span className="text-blue-600 dark:text-blue-400">Replying to @{replyingTo.username}</span>
              <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{replyingTo.message}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReplyingTo(null)}
              className="h-6 w-6 p-0"
            >
              ×
            </Button>
          </div>
        )}

        {/* Chat input - NEW DESIGN */}
        <div
          className="mt-auto sticky bg-white dark:bg-gray-900 z-30 pt-3"
          style={{ bottom: '72px', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
         >
           <form onSubmit={handleSendMessage} className="space-y-3">
            {/* Main text area */}
            <div className="relative">
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={user ? "Type your message here..." : "Please login to chat"}
                className="min-h-[64px] max-h-[120px] resize-none text-sm rounded-xl px-4 py-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all pr-12 z-30"
                maxLength={500}
                autoComplete="off"
                disabled={!user || isSending}
              />
              
              {/* Character counter */}
              <div className="absolute bottom-2 right-3 text-xs text-gray-400">
                {newMessage.length}/500
              </div>
            </div>
            
            {/* Action buttons row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Emoji button */}
                <button
                  type="button"
                  ref={openerRef}
                  onClick={(e) => {
                    openerRef.current = e.currentTarget as HTMLButtonElement;
                    setShowEmojiPicker(!showEmojiPicker);
                  }}
                  disabled={!user}
                  className="h-10 w-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition disabled:opacity-50 z-50"
                  aria-label="Open emoji picker"
                >
                  😊
                </button>
                
                {/* Like show button */}
                <button
                  type="button"
                  onClick={async () => {
                    // compute new value and update (setLikeCount expects number)
                    const newVal = (likeCount ?? 0) + 1;
                    setLikeCount(newVal);
                    // best-effort persist to backend if show id available
                    try {
                      if (currentShow?.id) {
                        await supabase
                          .from('shows')
                          .update({ like_count: newVal })
                          .eq('id', currentShow.id);
                      }
                    } catch (e) {
                      console.error('Failed to persist like count', e);
                    }
                  }}
                  disabled={!user}
                  className="h-10 w-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition disabled:opacity-50 z-30"
                  aria-label="Like this show"
                >
                  <Heart className="h-5 w-5 text-pink-500" />
                </button>
                
                {/* Donate button */}
                <button
                  type="button"
                  onClick={() => setShowDonationModal(true)}
                  disabled={!user}
                  className="h-10 w-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition disabled:opacity-50 z-30"
                  aria-label="Donate to show"
                >
                  <Gift className="h-5 w-5 text-yellow-500" />
                </button>
              </div>
               
              {/* Send button */}
              <Button
                type="submit"
                disabled={!newMessage.trim() || !user || isSending}
                className="px-6 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 transition-all disabled:opacity-50 z-30"
              >
                {isSending ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Sending...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    Send
                  </div>
                )}
              </Button>
            </div>
          </form>
          
          {!user && (
            <div className="mt-3 text-center text-sm text-gray-500 dark:text-gray-400">
              Please log in to participate in the chat
            </div>
          )}
        </div>
      </Card>

      {/* Emoji picker portal */}
      {showEmojiPicker && pickerPos && createPortal(
        <div
          ref={pickerRef}
          style={{ position: 'fixed', left: pickerPos.left, top: pickerPos.top, zIndex: 99999 }}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3 w-64"
        >
          <div className="grid grid-cols-8 gap-2">
            {EMOJI_PICKER_LIST.slice(0, 48).map((e: any, i: number) => (
              <button
                key={`${e.char}-${i}`}
                type="button"
                title={e.name}
                onClick={() => {
                  setNewMessage((m) => (m || '') + e.char);
                  setShowEmojiPicker(false);
                }}
                className="p-1 text-lg rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                {e.char}
              </button>
            ))}
          </div>
          <div className="mt-2 text-xs text-gray-500 text-center">
            Click an emoji to add it
          </div>
        </div>,
        document.body
      )}

      {/* Donation modal */}
      <DonationModal
        isOpen={showDonationModal}
        onClose={() => setShowDonationModal(false)}
        show={currentShow}
        user={user}
      />
    </>
  );
};

// DonationModal component (create a new file or add here)
const DonationModal = ({ isOpen, onClose, show, user }: any) => {
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  if (!isOpen) return null;
  
  const handleDonate = async () => {
    if (!amount || !user) return;
    
    setIsProcessing(true);
    try {
      // Record donation in chat
      const donationData = {
        message: `🎁 Donated $${amount}${message ? `: ${message}` : ''}`,
        username: user.user_metadata?.first_name || user.email?.split('@')[0],
        show_id: show?.id || 'default-show',
        user_id: user.id,
        avatar_url: user.user_metadata?.avatar_url,
        timestamp: new Date().toISOString(),
        is_donation: true
      };
      
      await supabase.from('live_chat').insert(donationData);
      
      toast({
        title: "Donation sent!",
        description: `Thank you for donating $${amount} to ${show?.title || 'the show'}!`,
      });
      
      setAmount('');
      setMessage('');
      onClose();
      
    } catch (err) {
      console.error('Error processing donation:', err);
      toast({
        title: "Error",
        description: "Failed to process donation",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  const presetAmounts = [5, 10, 20, 50, 100];
  
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Support the Show</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">×</button>
        </div>
        
        <div className="mb-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Your donation will be announced in chat and helps support {show?.title || 'this show'}!
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Amount ($)</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {presetAmounts.map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAmount(amt.toString())}
                    className={`px-4 py-2 rounded-lg border ${
                      amount === amt.toString()
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700'
                    }`}
                  >
                    ${amt}
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Custom amount"
                className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent"
                min="1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Optional Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Add a message with your donation"
                className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent"
                rows={2}
                maxLength={100}
              />
            </div>
          </div>
        </div>
        
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleDonate}
            disabled={!amount || isProcessing || !user}
            className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-500"
          >
            {isProcessing ? 'Processing...' : `Donate $${amount || '0'}`}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};