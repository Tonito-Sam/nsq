import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Send,
  Eye,
  Heart,
  MessageCircle,
  Tv,
  Gift,
  MoreVertical,
  Reply,
  ThumbsUp,
  Share2,
  Trash2,
  Pin,
  Smile,
  Sparkles,
  Radio,
  X,
} from 'lucide-react';
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
import { cn } from '@/lib/utils';

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

interface LiveChatProps {
  showId?: string;
  showTitle?: string;
  showDescription?: string;
}

// ─── Reusable stat chip ───────────────────────────────────────────────────────

const StatChip = ({
  icon: Icon,
  value,
  tone,
}: {
  icon: React.ElementType;
  value: string | number;
  tone: 'amber' | 'blue' | 'pink' | 'indigo';
}) => {
  const tones = {
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20',
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-blue-500/20',
    pink: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 ring-pink-500/20',
    indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 ring-indigo-500/20',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums ring-1 transition-colors',
        tones[tone],
      )}
    >
      <Icon className="h-3 w-3" />
      {typeof value === 'number' ? value.toLocaleString() : value}
    </span>
  );
};

// ─── Role badge ───────────────────────────────────────────────────────────────

const RoleBadge = ({ children, tone }: { children: React.ReactNode; tone: string }) => (
  <span
    className={cn(
      'inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider',
      tone,
    )}
  >
    {children}
  </span>
);

export const LiveChat: React.FC<LiveChatProps> = ({
  showId: showIdOverride,
  showTitle,
  showDescription,
}) => {
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
  const chatShowId = showIdOverride || currentShow?.id || 'default-show';
  const isCurrentShow = !showIdOverride || showIdOverride === currentShow?.id;
  const chatShowTitle =
    showTitle || (isCurrentShow ? currentShow?.title : undefined) || 'General Chat';
  const chatShowDescription =
    showDescription ?? (isCurrentShow ? currentShow?.description : undefined);
  const chatShow = { id: chatShowId, title: chatShowTitle, description: chatShowDescription };

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const [pickerPos, setPickerPos] = useState<{ left: number; top: number } | null>(null);
  const [userLikedShow, setUserLikedShow] = useState(false);
  const [replyDraft, setReplyDraft] = useState('');

  // ─── Keep video playing when chat mounts / modal toggles ─────────────────
  useEffect(() => {
    const tryPlayVideo = async () => {
      const v = document.querySelector('video') as HTMLVideoElement | null;
      if (!v) return;
      if (v.paused) {
        try {
          await v.play();
        } catch {}
      }
    };
    tryPlayVideo();
  }, [showDonationModal]);

  // ─── Notify VideoContainer overlay is active ─────────────────────────────
  useEffect(() => {
    const sendOverlayEvent = (active: boolean) => {
      try {
        try {
          (window as any).__videoOverlayActive = !!active;
        } catch {}
        window.dispatchEvent(
          new CustomEvent('video-overlay-change', { detail: { overlayActive: active } }),
        );
      } catch {
        try {
          (window as any).__videoOverlayActive = !!active;
        } catch {}
        const ev = document.createEvent('CustomEvent');
        ev.initCustomEvent('video-overlay-change', false, false, { overlayActive: active });
        window.dispatchEvent(ev);
      }
    };
    sendOverlayEvent(true);
    return () => sendOverlayEvent(false);
  }, []);

  useEffect(() => {
    const active = !!showDonationModal;
    try {
      (window as any).__videoOverlayActive = active;
    } catch {}
    try {
      window.dispatchEvent(
        new CustomEvent('video-overlay-change', { detail: { overlayActive: active } }),
      );
    } catch {
      const ev = document.createEvent('CustomEvent');
      ev.initCustomEvent('video-overlay-change', false, false, { overlayActive: active });
      window.dispatchEvent(ev);
    }
  }, [showDonationModal]);

  const quickReactions: Reaction[] = [
    { emoji: '👍', name: 'Thumbs Up' },
    { emoji: '❤️', name: 'Heart' },
    { emoji: '😂', name: 'Laughing' },
    { emoji: '😮', name: 'Wow' },
    { emoji: '😢', name: 'Sad' },
    { emoji: '🎉', name: 'Celebration' },
  ];

  const POPULAR_EMOJIS = ['❤️', '🔥', '😂', '😮', '😢', '👏', '👍', '🎉', '🙏', '🤣'];

  const enrichMessagesWithProfiles = async (chatMessages: ChatMessage[]): Promise<ChatMessage[]> => {
    const allMessages = chatMessages.flatMap((message) => [message, ...(message.replies || [])]);
    const userIds = [...new Set(allMessages.map((message) => message.user_id).filter((id): id is string => !!id))];
    if (userIds.length === 0) return chatMessages;

    const { data: profiles, error } = await supabase
      .from('users')
      .select('id, username, first_name, last_name, avatar_url')
      .in('id', userIds);
    if (error) {
      console.warn('Could not load Live Chat author profiles:', error);
      return chatMessages;
    }

    const profilesById = new Map((profiles || []).map((profile) => [profile.id, profile]));
    const enrich = (message: ChatMessage): ChatMessage => {
      const profile = message.user_id ? profilesById.get(message.user_id) : undefined;
      if (!profile) return { ...message, username: message.username || 'User' };

      const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
      return {
        ...message,
        username: profile.username || fullName || message.username || 'User',
        avatar_url: profile.avatar_url || undefined,
      };
    };

    return chatMessages.map((message) => ({
      ...enrich(message),
      replies: (message.replies || []).map(enrich),
    }));
  };

  // ─── Fetch messages with replies ─────────────────────────────────────────
  const fetchMessages = async () => {
    if (chatShowId === 'default-show') {
      setMessages([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const { data: parentMessages, error } = await supabase
        .from('live_chat')
        .select('*')
        .eq('show_id', chatShowId)
        .is('reply_to', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

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
            reactions: msg.reactions || {},
          };
        }),
      );
      setMessages(await enrichMessagesWithProfiles(messagesWithReplies as ChatMessage[]));
    } catch (err) {
      console.error('Error fetching messages:', err);
      toast({ title: 'Error', description: 'Failed to load messages', variant: 'destructive' });
    }
    setIsLoading(false);
  };

  const subscribeToLiveChat = () => {
    if (chatShowId === 'default-show') return;
    supabase
      .channel(`live_chat_${chatShowId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_chat',
          filter: `show_id=eq.${chatShowId}`,
        },
        () => {
          fetchMessages();
        },
      )
      .subscribe();
  };

  useEffect(() => {
    fetchMessages();
    subscribeToLiveChat();
    return () => {
      supabase.removeAllChannels();
    };
  }, [chatShowId]);

  // ─── Fetch user's like status ────────────────────────────────────────────
  useEffect(() => {
    const fetchUserLike = async () => {
      if (!user || chatShowId === 'default-show') {
        setUserLikedShow(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('show_likes')
          .select('id')
          .eq('show_id', chatShowId)
          .eq('user_id', user.id)
          .single();
        if (error && (error as any).code !== 'PGRST116') {
          console.debug('show_likes select error:', error);
        }
        setUserLikedShow(!!data);
      } catch (err) {
        console.debug('Failed to query show_likes:', err);
        setUserLikedShow(false);
      }
    };
    fetchUserLike();
  }, [user, chatShowId]);

  // ─── Auto-scroll to bottom ───────────────────────────────────────────────
  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (isNearBottom) {
      setTimeout(() => {
        el.scrollTop = el.scrollHeight;
      }, 100);
    }
  }, [messages]);

  // ─── Close pickers on outside click ──────────────────────────────────────
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

  // ─── Position emoji picker ───────────────────────────────────────────────
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

  // ─── Reply submit ────────────────────────────────────────────────────────
  const handleReplySubmit = async (parentId: string) => {
    if (!replyDraft.trim() || !user) return;
    const messageData: any = {
      message: replyDraft.trim(),
      username: user.user_metadata?.first_name || user.email?.split('@')[0] || 'Anonymous',
      show_id: chatShowId,
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
      const { data: inserted, error } = await supabase
        .from('live_chat')
        .insert(messageData)
        .select()
        .single();
      if (error) throw error;
      const [newMsg] = await enrichMessagesWithProfiles([inserted as ChatMessage]);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === parentId
            ? { ...m, replies: [...(m.replies || []), newMsg], reply_count: (m.reply_count ?? 0) + 1 }
            : m,
        ),
      );
      setReplyDraft('');
      setReplyingTo(null);
      toast({ title: 'Reply posted' });

      (async () => {
        try {
          try {
            await supabase.rpc('increment_show_comments', { show_id: chatShowId });
          } catch {
            const { data: row } = await supabase
              .from('studio_shows')
              .select('comment_count')
              .eq('id', chatShowId)
              .single();
            const serverCount = (row && (row as any).comment_count) || 0;
            await supabase
              .from('studio_shows')
              .update({ comment_count: serverCount + 1 })
              .eq('id', chatShowId);
          }
        } catch (err) {
          console.error('Failed to persist comment_count increment for reply:', err);
        }
      })();
    } catch (err) {
      console.error('Failed to post reply', err);
      toast({ title: 'Error', description: 'Failed to post reply', variant: 'destructive' });
    }
  };

  // ─── Quick inline react ──────────────────────────────────────────────────
  const handleQuickReact = async (messageId: string, emoji: string) => {
    if (!user) {
      toast({ title: 'Login required', description: 'Please log in to react', variant: 'destructive' });
      return;
    }
    try {
      const { data: msg } = await supabase
        .from('live_chat')
        .select('reactions')
        .eq('id', messageId)
        .single();
      const currentReactions = (msg?.reactions as Record<string, number>) || {};
      const newReactions = { ...currentReactions, [emoji]: (currentReactions[emoji] || 0) + 1 };
      await supabase.from('live_chat').update({ reactions: newReactions }).eq('id', messageId);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, reactions: newReactions } : m)),
      );
      setActiveReactions((prev) => ({
        ...prev,
        [messageId]: [...(prev[messageId] || []), emoji],
      }));
    } catch (err) {
      console.error('Quick react failed', err);
    }
  };

  // ─── Send message ────────────────────────────────────────────────────────
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) {
      if (!user) {
        toast({
          title: 'Authentication required',
          description: 'Please log in to send messages',
          variant: 'destructive',
        });
      }
      return;
    }
    setIsSending(true);
    try {
      const messageData: any = {
        message: newMessage.trim(),
        username: user.user_metadata?.first_name || user.email?.split('@')[0] || 'Anonymous',
        show_id: chatShowId,
        user_id: user.id,
        avatar_url: user.user_metadata?.avatar_url || null,
        is_moderator: user.user_metadata?.is_moderator || false,
        is_vip: user.user_metadata?.is_vip || false,
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString(),
        like_count: 0,
        reply_count: 0,
        reactions: {},
      };
      if (replyingTo) messageData.reply_to = replyingTo.id;

      const { data: inserted, error } = await supabase
        .from('live_chat')
        .insert(messageData)
        .select()
        .single();
      if (error) throw error;
      const [newMsg] = await enrichMessagesWithProfiles([inserted as ChatMessage]);

      if (replyingTo) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === replyingTo.id
              ? { ...m, replies: [...(m.replies || []), newMsg], reply_count: (m.reply_count ?? 0) + 1 }
              : m,
          ),
        );
      } else {
        setMessages((prev) => [newMsg, ...prev]);
      }
      setNewMessage('');
      setReplyingTo(null);

      (async () => {
        try {
          try {
            await supabase.rpc('increment_show_comments', { show_id: chatShowId });
          } catch {
            const { data: row } = await supabase
              .from('studio_shows')
              .select('comment_count')
              .eq('id', chatShowId)
              .single();
            const serverCount = (row && (row as any).comment_count) || 0;
            await supabase
              .from('studio_shows')
              .update({ comment_count: serverCount + 1 })
              .eq('id', chatShowId);
          }
        } catch (err) {
          console.error('Failed to persist comment_count increment:', err);
        }
      })();

      toast({
        title: 'Message sent!',
        description: replyingTo ? 'Reply posted' : 'Your message has been posted.',
      });
    } catch (err) {
      console.error('Error sending message:', err);
      toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  // ─── Reaction to message ─────────────────────────────────────────────────
  const handleReaction = async (messageId: string, emoji: string) => {
    if (!user) {
      toast({
        title: 'Login required',
        description: 'Please log in to react to messages',
        variant: 'destructive',
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

      if (userReactions.includes(emoji)) {
        reactions[emoji] = Math.max(0, (reactions[emoji] || 1) - 1);
        setActiveReactions((prev) => ({
          ...prev,
          [messageId]: prev[messageId]?.filter((e) => e !== emoji) || [],
        }));
      } else {
        reactions[emoji] = (reactions[emoji] || 0) + 1;
        setActiveReactions((prev) => ({
          ...prev,
          [messageId]: [...(prev[messageId] || []), emoji],
        }));
      }

      await supabase
        .from('live_chat')
        .update({
          reactions,
          like_count: (Object.values(reactions) as number[]).reduce((a, b) => a + b, 0),
        })
        .eq('id', messageId);
      setShowReactionsPicker(null);
    } catch (err) {
      console.error('Error adding reaction:', err);
    }
  };

  // ─── Toggle like show ────────────────────────────────────────────────────
  const handleToggleLikeShow = async () => {
    if (!user) {
      toast({
        title: 'Login required',
        description: 'Please log in to like this show',
        variant: 'destructive',
      });
      return;
    }
    if (chatShowId === 'default-show') return;
    try {
      const { data, error } = await supabase.rpc('toggle_show_like', {
        p_show_id: chatShowId,
        p_user_id: user.id,
      });
      if (error) throw error;
      const newCount = Array.isArray(data) ? data[0] : data;
      const likeNumber =
        typeof newCount === 'object' && newCount !== null && 'toggle_show_like' in (newCount as any)
          ? (newCount as any).toggle_show_like
          : typeof newCount === 'number'
            ? newCount
            : Number(newCount);
      if (!Number.isNaN(likeNumber)) setLikeCount(likeNumber as number);
      setUserLikedShow((prev) => !prev);
      toast({ title: userLikedShow ? 'Unliked' : 'Liked!' });
    } catch (err) {
      console.error('RPC toggle_show_like failed, falling back:', err);
      try {
        const existing = await supabase
          .from('show_likes')
          .select('id')
          .eq('show_id', chatShowId)
          .eq('user_id', user.id)
          .single();
        if (existing.data) {
          await supabase.from('show_likes').delete().eq('id', existing.data.id);
          const newVal = Math.max(0, (likeCount ?? 1) - 1);
          await supabase.from('studio_shows').update({ like_count: newVal }).eq('id', chatShowId);
          setLikeCount(newVal);
          setUserLikedShow(false);
          toast({ title: 'Unliked' });
        } else {
          await supabase.from('show_likes').insert({ show_id: chatShowId, user_id: user.id });
          const newVal = (likeCount ?? 0) + 1;
          await supabase.from('studio_shows').update({ like_count: newVal }).eq('id', chatShowId);
          setLikeCount(newVal);
          setUserLikedShow(true);
          toast({ title: 'Liked!' });
        }
      } catch (e) {
        console.error('Fallback like update failed', e);
      }
    }
  };

  // ─── Delete message ──────────────────────────────────────────────────────
  const handleDeleteMessage = async (messageId: string, userId: string) => {
    if (
      !user ||
      (user.id !== userId && !user.user_metadata?.is_moderator && !user.user_metadata?.is_admin)
    ) {
      toast({
        title: 'Permission denied',
        description: "You don't have permission to delete this message",
        variant: 'destructive',
      });
      return;
    }
    try {
      await supabase.from('live_chat').delete().eq('id', messageId);
      (async () => {
        try {
          if (chatShowId === 'default-show') return;
          try {
            await supabase.rpc('decrement_show_comments', { show_id: chatShowId });
          } catch {
            const { data: row } = await supabase
              .from('studio_shows')
              .select('comment_count')
              .eq('id', chatShowId)
              .single();
            const serverCount = (row && (row as any).comment_count) || 0;
            await supabase
              .from('studio_shows')
              .update({ comment_count: Math.max(0, serverCount - 1) })
              .eq('id', chatShowId);
          }
        } catch (err) {
          console.error('Failed to persist comment_count decrement:', err);
        }
      })();
      toast({ title: 'Deleted', description: 'Message deleted successfully' });
    } catch (err) {
      console.error('Error deleting message:', err);
      toast({ title: 'Error', description: 'Failed to delete message', variant: 'destructive' });
    }
  };

  // ─── Pin message ─────────────────────────────────────────────────────────
  const handlePinMessage = async (messageId: string) => {
    if (!user?.user_metadata?.is_moderator) {
      toast({
        title: 'Moderator only',
        description: 'Only moderators can pin messages',
        variant: 'destructive',
      });
      return;
    }
    try {
      await supabase.from('live_chat').update({ is_pinned: false }).eq('show_id', chatShowId);
      await supabase.from('live_chat').update({ is_pinned: true }).eq('id', messageId);
      toast({ title: 'Pinned', description: 'Message pinned to top' });
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
    const date = typeof maybeDate === 'string' ? new Date(maybeDate) : (maybeDate as Date);
    if (Number.isNaN(date.getTime())) return null;
    const diffMs = Date.now() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'Premiered: in the future';
    if (diffDays === 0) return 'Premiered: today';
    if (diffDays === 1) return 'Premiered: 1 day ago';
    return `Premiered: ${diffDays} days ago`;
  };

  const premieredSource =
    (isCurrentShow ? (currentShow as any)?.premiered_at : undefined) ||
    (isCurrentShow ? (currentShow as any)?.premieredAt : undefined) ||
    (isCurrentShow ? (currentShow as any)?.premieredOn : undefined) ||
    (isCurrentShow ? (currentShow as any)?.start_time : undefined) ||
    (isCurrentShow ? (currentShow as any)?.created_at : undefined) ||
    (isCurrentShow ? (currentShow as any)?.createdAt : undefined) ||
    null;

  const daysSince = (maybeDate?: string | Date | null): number | null => {
    if (!maybeDate) return null;
    const d = typeof maybeDate === 'string' ? new Date(maybeDate) : (maybeDate as Date);
    if (Number.isNaN(d.getTime())) return null;
    const diffDays = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 ? diffDays : null;
  };
  const premieredDays = daysSince(premieredSource as string | Date | null);

  // ─── Message renderer ────────────────────────────────────────────────────
  const renderMessage = (msg: ChatMessage, isReply = false) => {
    const isOwnMessage = user?.id === msg.user_id;
    return (
      <div
        key={msg.id}
        className={cn(
          'group relative',
          isReply ? 'ml-9 mt-2' : 'mb-1',
          isReply && 'before:absolute before:-left-4 before:top-3 before:h-[calc(100%-0.75rem)] before:w-px before:bg-border/60',
        )}
      >
        <div
          className={cn(
            'flex items-start gap-2.5 rounded-2xl px-3 py-2.5 transition-colors',
            isReply
              ? 'bg-transparent'
              : isOwnMessage
                ? 'bg-gradient-to-br from-purple-500/8 to-fuchsia-500/5 ring-1 ring-purple-500/10'
                : 'hover:bg-muted/40',
          )}
        >
          <Avatar className="h-8 w-8 flex-shrink-0 ring-1 ring-border/50">
            <AvatarImage src={msg.avatar_url} />
            <AvatarFallback className="text-[11px] font-bold bg-gradient-to-br from-purple-500 to-fuchsia-500 text-white">
              {msg.username?.charAt(0)?.toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            {/* Header row */}
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <span
                className={cn(
                  'text-[13px] font-semibold truncate',
                  isOwnMessage ? 'text-purple-700 dark:text-purple-300' : 'text-foreground',
                )}
              >
                {msg.username}
              </span>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {formatTime(msg.timestamp)}
              </span>
              {msg.is_superadmin && (
                <RoleBadge tone="bg-red-500/15 text-red-600 dark:text-red-400">Admin</RoleBadge>
              )}
              {msg.is_admin && (
                <RoleBadge tone="bg-orange-500/15 text-orange-600 dark:text-orange-400">Staff</RoleBadge>
              )}
              {msg.is_moderator && (
                <RoleBadge tone="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">Mod</RoleBadge>
              )}
              {msg.is_vip && (
                <RoleBadge tone="bg-purple-500/15 text-purple-600 dark:text-purple-400">VIP</RoleBadge>
              )}
              {msg.is_pinned && (
                <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  <Pin className="h-2.5 w-2.5" />
                  Pinned
                </span>
              )}

              {/* Actions menu — floated right */}
              <div className="ml-auto -mr-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity rounded-md"
                    >
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
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
                      <DropdownMenuItem
                        onClick={() => handleDeleteMessage(msg.id, msg.user_id || '')}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    )}
                    {user?.user_metadata?.is_moderator && (
                      <DropdownMenuItem onClick={() => handlePinMessage(msg.id)}>
                        <Pin className="h-4 w-4 mr-2" />
                        {msg.is_pinned ? 'Unpin' : 'Pin message'}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Reply context chip */}
            {replyingTo?.id === msg.id && (
              <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20">
                <Reply className="h-2.5 w-2.5" />
                Replying to @{replyingTo.username}
              </div>
            )}

            {/* Message body */}
            <p className="text-[13px] leading-relaxed text-foreground/90 break-words">
              {msg.message}
            </p>

            {/* Reactions */}
            {msg.reactions && Object.keys(msg.reactions).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {Object.entries(msg.reactions).map(([emoji, count]) => {
                  const isActive = (activeReactions[msg.id] || []).includes(emoji);
                  return (
                    <button
                      key={emoji}
                      onClick={() => handleReaction(msg.id, emoji)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-all',
                        'ring-1 hover:scale-105 active:scale-95',
                        isActive
                          ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 ring-purple-500/30'
                          : 'bg-muted/60 text-muted-foreground ring-border/60 hover:bg-muted',
                      )}
                    >
                      <span>{emoji}</span>
                      <span className="tabular-nums">{count}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Quick actions row */}
            <div className="flex items-center gap-3 mt-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              <div className="flex items-center gap-1">
                {[
                  { emoji: '❤️', color: 'hover:bg-pink-500/10' },
                  { emoji: '🔥', color: 'hover:bg-amber-500/10' },
                  { emoji: '👎', color: 'hover:bg-slate-500/10' },
                ].map(({ emoji, color }) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleQuickReact(msg.id, emoji)}
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-xs transition-all hover:scale-110 active:scale-90',
                      color,
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  setReplyingTo(msg);
                  setReplyDraft('');
                }}
                className="text-[11px] font-medium text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                Reply
              </button>

              {(msg.reply_count ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={() => setReplyingTo(msg)}
                  className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {msg.reply_count} {msg.reply_count === 1 ? 'reply' : 'replies'}
                </button>
              )}
            </div>

            {/* Inline reply composer */}
            <div
              className={cn(
                'transition-all duration-200 ease-out overflow-hidden',
                replyingTo?.id === msg.id ? 'max-h-40 opacity-100 mt-2' : 'max-h-0 opacity-0',
              )}
            >
              {replyingTo?.id === msg.id && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleReplySubmit(msg.id);
                  }}
                  className="flex gap-2 items-start"
                >
                  <textarea
                    value={replyDraft}
                    onChange={(e) => setReplyDraft(e.target.value)}
                    placeholder="Write a reply..."
                    className="flex-1 min-h-[44px] max-h-[120px] p-2 rounded-lg bg-muted/50 border border-border/60 text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-shadow"
                  />
                  <div className="flex flex-col gap-1.5">
                    <Button type="submit" size="sm" disabled={!replyDraft.trim()} className="h-8 text-xs">
                      Reply
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setReplyingTo(null);
                        setReplyDraft('');
                      }}
                      className="h-8 text-xs"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Nested replies */}
        {msg.replies && msg.replies.length > 0 && (
          <div className="relative mt-1 ml-9 border-l border-border/50 pl-4">
            {msg.replies.map((reply) => renderMessage(reply, true))}
          </div>
        )}

        {/* Reactions picker (floating) */}
        {showReactionsPicker === msg.id && (
          <div className="absolute reaction-picker mt-2 p-1.5 bg-popover rounded-xl shadow-xl border border-border/60 z-50">
            <div className="flex gap-0.5">
              {quickReactions.map((reaction) => (
                <button
                  key={reaction.emoji}
                  onClick={() => handleReaction(msg.id, reaction.emoji)}
                  className="flex h-8 w-8 items-center justify-center text-lg rounded-lg hover:scale-125 hover:bg-muted transition-transform"
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

  const totalMessageCount = messages.reduce(
    (acc, msg) => acc + 1 + (msg.replies?.length || 0),
    0,
  );

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <>
      <Card
        data-livechat
        className="relative flex h-[85vh] max-h-[900px] min-h-[360px] flex-col rounded-2xl border-border/60 bg-card shadow-xl overflow-hidden"
      >
        {/* ── Header ── */}
        <div className="relative shrink-0 overflow-hidden border-b border-border/50 bg-gradient-to-br from-purple-500/8 via-fuchsia-500/5 to-pink-500/8 px-4 py-3.5">
          <div className="pointer-events-none absolute -top-12 -right-8 h-32 w-32 rounded-full bg-purple-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-8 h-24 w-24 rounded-full bg-fuchsia-500/15 blur-3xl" />

          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400">
                Live Chat
              </span>
            </div>
            <h2 className="text-base font-bold text-foreground leading-tight truncate">
              {chatShowTitle}
            </h2>
            {chatShowDescription && (
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                {chatShowDescription}
              </p>
            )}
          </div>
        </div>

        {/* ── Stats bar ── */}
        <div className="shrink-0 border-b border-border/50 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatChip
              icon={Tv}
              value={premieredDays === 0 ? 'Today' : premieredDays !== null ? `${premieredDays}d` : 'Live'}
              tone="amber"
            />
            <StatChip icon={Eye} value={viewerCount} tone="blue" />
            <StatChip icon={Heart} value={likeCount} tone="pink" />
            <StatChip icon={MessageCircle} value={totalMessageCount} tone="indigo" />
          </div>
        </div>

        {/* ── Message list ── */}
        <div
          ref={chatContainerRef}
          className="min-h-0 flex-1 overflow-y-auto px-2 py-3 scroll-smooth custom-scrollbar"
        >
          {isLoading ? (
            <div className="space-y-3 px-2 py-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-2.5 bg-muted rounded w-1/3 animate-pulse" />
                    <div className="h-2.5 bg-muted rounded w-3/4 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/15 to-fuchsia-500/10 ring-1 ring-purple-500/20">
                <MessageCircle className="h-6 w-6 text-purple-500 dark:text-purple-400" />
              </div>
              <p className="text-sm font-medium text-foreground">No messages yet</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Be the first to say hello!</p>
            </div>
          ) : (
            <>
              {messages.filter((msg) => msg.is_pinned).length > 0 && (
                <div className="mb-3 px-1">
                  <div className="mb-1.5 flex items-center gap-1.5 px-2">
                    <Pin className="h-3 w-3 text-amber-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      Pinned
                    </span>
                  </div>
                  <div className="rounded-xl bg-amber-500/5 ring-1 ring-amber-500/15 p-1">
                    {messages.filter((msg) => msg.is_pinned).map((msg) => renderMessage(msg))}
                  </div>
                </div>
              )}
              {messages.filter((msg) => !msg.is_pinned).map((msg) => renderMessage(msg))}
            </>
          )}
        </div>

        {/* ── Replying-to banner ── */}
        {replyingTo && (
          <div className="shrink-0 mx-3 mb-2 flex items-center justify-between gap-2 rounded-xl bg-blue-500/8 px-3 py-2 ring-1 ring-blue-500/20">
            <div className="flex items-start gap-2 min-w-0">
              <Reply className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                  Replying to @{replyingTo.username}
                </div>
                <p className="text-[11px] text-muted-foreground truncate">{replyingTo.message}</p>
              </div>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="shrink-0 rounded-full p-1 hover:bg-blue-500/15 transition-colors"
              aria-label="Cancel reply"
            >
              <X className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            </button>
          </div>
        )}

        {/* ── Composer ── */}
        <div className="shrink-0 border-t border-border/50 bg-card/60 backdrop-blur-sm px-3 py-3">
          <form onSubmit={handleSendMessage} className="space-y-2">
            {/* Textarea with emoji opener */}
            <div className="relative rounded-2xl border border-border/60 bg-background/60 focus-within:border-purple-500/50 focus-within:ring-2 focus-within:ring-purple-500/15 transition-all">
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={user ? 'Type your message…' : 'Please login to chat'}
                className="min-h-[56px] max-h-[120px] resize-none border-0 bg-transparent text-[13px] rounded-2xl px-3.5 py-3 pb-7 focus-visible:ring-0 focus-visible:ring-offset-0"
                maxLength={500}
                autoComplete="off"
                disabled={!user || isSending}
              />
              <div className="absolute bottom-2 right-3 text-[10px] tabular-nums text-muted-foreground">
                {newMessage.length}/500
              </div>
            </div>

            {/* Action row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  ref={openerRef}
                  onClick={(e) => {
                    openerRef.current = e.currentTarget as HTMLButtonElement;
                    setShowEmojiPicker(!showEmojiPicker);
                  }}
                  disabled={!user}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/60 hover:bg-muted transition-colors disabled:opacity-50"
                  aria-label="Open emoji picker"
                >
                  <Smile className="h-4 w-4 text-muted-foreground" />
                </button>

                <button
                  type="button"
                  onClick={handleToggleLikeShow}
                  disabled={!user}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full transition-all disabled:opacity-50',
                    userLikedShow
                      ? 'bg-pink-500/15 ring-1 ring-pink-500/40'
                      : 'bg-muted/60 hover:bg-muted',
                  )}
                  aria-label="Like this show"
                >
                  <Heart
                    className={cn(
                      'h-4 w-4 transition-colors',
                      userLikedShow ? 'fill-pink-500 text-pink-500' : 'text-muted-foreground',
                    )}
                  />
                </button>

                <button
                  type="button"
                  onClick={() => setShowDonationModal(true)}
                  disabled={!user}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/10 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                  aria-label="Donate to show"
                >
                  <Gift className="h-4 w-4 text-amber-500" />
                </button>
              </div>

              <Button
                type="submit"
                disabled={!newMessage.trim() || !user || isSending}
                className={cn(
                  'h-9 gap-1.5 rounded-full px-4 text-xs font-semibold',
                  'bg-gradient-to-br from-purple-600 to-fuchsia-500 hover:from-purple-700 hover:to-fuchsia-600',
                  'shadow-md shadow-purple-500/20 transition-all hover:shadow-lg hover:shadow-purple-500/30',
                  'disabled:opacity-40 disabled:shadow-none',
                )}
              >
                {isSending ? (
                  <>
                    <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Sending
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    Send
                  </>
                )}
              </Button>
            </div>
          </form>

          {!user && (
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Please log in to participate in the chat
            </p>
          )}
        </div>
      </Card>

      {/* ── Emoji picker ── */}
      {showEmojiPicker &&
        pickerPos &&
        createPortal(
          <div
            ref={pickerRef}
            style={{ position: 'fixed', left: pickerPos.left, top: pickerPos.top, zIndex: 99999 }}
            className="w-64 rounded-2xl border border-border/60 bg-popover p-3 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="mb-2 flex items-center gap-1.5 px-0.5">
              <Sparkles className="h-3 w-3 text-purple-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Quick reactions
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {POPULAR_EMOJIS.map((emoji, i) => (
                <button
                  key={`${emoji}-${i}`}
                  type="button"
                  title={emoji}
                  onClick={() => {
                    setNewMessage((m) => (m || '') + emoji);
                    setShowEmojiPicker(false);
                  }}
                  className="flex h-10 items-center justify-center rounded-lg text-xl transition-all hover:scale-110 hover:bg-muted active:scale-95"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}

      <DonationModal
        isOpen={showDonationModal}
        onClose={() => setShowDonationModal(false)}
        show={chatShow}
        user={user}
      />
    </>
  );
};

// ─── Donation Modal (modernized) ──────────────────────────────────────────────

const DonationModal = ({ isOpen, onClose, show, user }: any) => {
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleDonate = async () => {
    if (!amount || !user) return;
    setIsProcessing(true);
    try {
      const donationData = {
        message: `🎁 Donated $${amount}${message ? `: ${message}` : ''}`,
        username: user.user_metadata?.first_name || user.email?.split('@')[0],
        show_id: show?.id || 'default-show',
        user_id: user.id,
        avatar_url: user.user_metadata?.avatar_url,
        timestamp: new Date().toISOString(),
        is_donation: true,
      };
      await supabase.from('live_chat').insert(donationData);
      toast({
        title: 'Donation sent!',
        description: `Thank you for donating $${amount} to ${show?.title || 'the show'}!`,
      });
      setAmount('');
      setMessage('');
      onClose();
    } catch (err) {
      console.error('Error processing donation:', err);
      toast({ title: 'Error', description: 'Failed to process donation', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const presetAmounts = [5, 10, 20, 50, 100];

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/70 backdrop-blur-sm p-0 sm:items-center sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className={cn(
          'relative w-full max-w-md overflow-hidden rounded-t-3xl sm:rounded-2xl',
          'border border-border/60 bg-card shadow-2xl',
          'animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-2 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 sm:pt-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/25">
              <Gift className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold leading-tight">Support the Show</h3>
              <p className="text-xs text-muted-foreground truncate max-w-[220px]">
                {show?.title || 'this show'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 pb-5 space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your donation will be announced in chat and helps support{' '}
            <span className="font-medium text-foreground">{show?.title || 'this show'}</span>.
          </p>

          {/* Amount presets */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Amount
            </label>
            <div className="grid grid-cols-5 gap-1.5 mb-2.5">
              {presetAmounts.map((amt) => {
                const isActive = amount === amt.toString();
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAmount(amt.toString())}
                    className={cn(
                      'rounded-xl py-2.5 text-sm font-semibold tabular-nums transition-all',
                      isActive
                        ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/25 scale-105'
                        : 'bg-muted/60 text-foreground hover:bg-muted',
                    )}
                  >
                    ${amt}
                  </button>
                );
              })}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                $
              </span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Custom amount"
                className="w-full rounded-xl border border-border/60 bg-background/60 py-2.5 pl-7 pr-3 text-sm focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/15 transition-all"
                min="1"
              />
            </div>
          </div>

          {/* Optional message */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Optional Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a message with your donation"
              className="w-full resize-none rounded-xl border border-border/60 bg-background/60 p-3 text-sm focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/15 transition-all"
              rows={2}
              maxLength={100}
            />
            <div className="flex justify-end mt-1">
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {message.length}/100
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl h-11">
              Cancel
            </Button>
            <Button
              onClick={handleDonate}
              disabled={!amount || isProcessing || !user}
              className={cn(
                'flex-1 h-11 rounded-xl gap-2 font-semibold',
                'bg-gradient-to-br from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600',
                'shadow-lg shadow-amber-500/25 transition-all',
              )}
            >
              {isProcessing ? (
                <>
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Processing
                </>
              ) : (
                <>
                  <Gift className="h-4 w-4" />
                  Donate ${amount || '0'}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};