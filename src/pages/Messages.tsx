import React, { useState, useEffect, useRef } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, MessageCircle, Phone, Video, Send, Mic, MicOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { MessagesSidebar } from '@/components/MessagesSidebar';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { VoicePlayer } from '@/components/VoicePlayer';
import { uploadFile } from '@/utils/mediaUtils';
import { ScrollArea } from '@/components/ui/scroll-area';

declare global {
  interface Window {
    refreshHeaderUnreadCount?: () => void;
  }
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  conversation_id: string;
  read_at?: string | null;
  voice_note_url?: string | null;
  voice_duration?: number | null;
}

interface Conversation {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
  other_user_id: string;
}

const Messages = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const [conversationFetchFailed, setConversationFetchFailed] = useState(false);
  const [conversationLoadError, setConversationLoadError] = useState<string | null>(null);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [voiceNoteUrl, setVoiceNoteUrl] = useState<string | null>(null);
  const [voiceNoteDuration, setVoiceNoteDuration] = useState<number>(0);
  const [followings, setFollowings] = useState<any[]>([]);

  // Notification sound for new messages
  const defaultWhistleSound = React.useRef<HTMLAudioElement | null>(null);
  const messageSubRef = useRef<any>(null);

  useEffect(() => {
    defaultWhistleSound.current = new window.Audio('/whistle.wav');
    defaultWhistleSound.current.volume = 0.7;
    defaultWhistleSound.current.loop = false;
  }, []);

  // Track last played message id to avoid multiple plays
  const lastPlayedMessageId = useRef<string | null>(null);

  // Ref for chat container to scroll to bottom
  const chatContainerRef = useRef<HTMLDivElement>(null);
  // Ref for scroll area viewport (for ScrollArea)
  const scrollAreaViewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      void fetchConversations();
      void fetchFollowings();
    } else {
      setConversations([]);
      setConversationsLoaded(false);
    }
    return () => {
      if (messageSubRef.current) {
        void supabase.removeChannel(messageSubRef.current);
        messageSubRef.current = null;
      }
    };
    // eslint-disable-next-line
  }, [user]);

  useEffect(() => {
    const conversationId = selectedConversation?.id;
    if (!conversationId) {
      setMessages([]);
      setMessagesError(null);
      setMessagesLoading(false);
      return;
    }

    let active = true;
    setMessages([]);
    setMessagesError(null);
    setMessagesLoading(true);
    const subscription = subscribeToMessages(conversationId);
    messageSubRef.current = subscription;
    void fetchMessages(conversationId, () => active);

    return () => {
      active = false;
      if (messageSubRef.current === subscription) messageSubRef.current = null;
      void supabase.removeChannel(subscription);
    };
    // eslint-disable-next-line
  }, [selectedConversation?.id, user?.id]);

  // After conversations load, check if we should auto-select a conversation
  useEffect(() => {
    if (!conversationsLoaded) return;
    const requestedId = conversationId || location.state?.openConversationId;

    if (requestedId) {
      const conversation = conversations.find((item) => item.id === requestedId);
      if (conversation) {
        setConversationLoadError(null);
        setSelectedConversation(conversation);
      } else if (conversationId && !conversationFetchFailed) {
        setSelectedConversation(null);
        setConversationLoadError('This conversation does not exist or you do not have access to it.');
      }
    } else {
      setConversationLoadError(conversationFetchFailed ? 'Could not load conversations. Please retry.' : null);
    }
    // eslint-disable-next-line
  }, [conversations, conversationsLoaded, conversationId, conversationFetchFailed, location.state]);

  // Prevent user from chatting with themselves
  useEffect(() => {
    if (selectedConversation && user && selectedConversation.other_user_id === user.id) {
      setSelectedConversation(null);
      toast({
        title: 'Invalid Conversation',
        description: 'You cannot chat with yourself.',
        variant: 'destructive',
      });
    }
  }, [selectedConversation, user]);

  // Enhanced refresh function for both local and header unread counts
  const refreshUnreadCounts = async () => {
    console.log('Messages page: Refreshing unread counts');
    
    // Refresh conversations list to update local unread counts
    await fetchConversations();
    
    // Also refresh the header unread count
    if (window.refreshHeaderUnreadCount) {
      console.log('Messages page: Calling header refresh function');
      window.refreshHeaderUnreadCount();
    }
    
    // Dispatch custom event for any other listeners
    window.dispatchEvent(new CustomEvent('messagesRead'));
  };

  // Fetch conversations for the current user (as customer or seller)
  const fetchConversations = async () => {
    if (!user) {
      setConversations([]);
      setConversationsLoaded(true);
      return;
    }
    console.log('Messages page: Fetching conversations for user:', user.id);
    setConversationFetchFailed(false);
    setConversationLoadError(null);
    
    try {
      const { data: convs, error } = await supabase
        .from('conversations')
        .select('*')
        .or(`customer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false });
      if (error) throw error;
      if (!convs) return setConversations([]);

      const participantRows = convs.flatMap((conversation) => [
        { conversation_id: conversation.id, user_id: conversation.customer_id, last_read_at: null },
        { conversation_id: conversation.id, user_id: conversation.seller_id, last_read_at: null },
      ]);
      if (participantRows.length > 0) {
        const { error: participantError } = await supabase
          .from('conversation_participants')
          .upsert(participantRows, {
            onConflict: 'conversation_id,user_id',
            ignoreDuplicates: true,
          });
        if (participantError) console.warn('Could not initialize conversation participants:', participantError);
      }

      const convsWithDetails = await Promise.all(
        convs.map(async (conv) => {
          const otherUserId = conv.customer_id === user.id ? conv.seller_id : conv.customer_id;
          if (otherUserId === user.id) return null; // Skip self-conversations
          const { data: otherUser } = await supabase
            .from('users')
            .select('first_name, last_name, username, avatar_url')
            .eq('id', otherUserId)
            .single();
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('content, created_at')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          const { count: unread } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .neq('sender_id', user.id)
            .is('read_at', null);
          
          console.log(`Messages page: Conversation ${conv.id} unread count:`, unread);
          
          return {
            id: conv.id,
            name: otherUser ? `${otherUser.first_name || ''} ${otherUser.last_name || ''}`.trim() || otherUser.username : 'Unknown',
            avatar: otherUser?.avatar_url || '/placeholder.svg',
            lastMessage: lastMsg?.content || '',
            time: lastMsg?.created_at ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
            unread: unread || 0,
            online: false, // Optionally implement online status
            other_user_id: otherUserId,
          };
        })
      );
  setConversations(convsWithDetails.filter((c): c is Conversation => c !== null));
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setConversations([]);
      setConversationFetchFailed(true);
      setConversationLoadError('Could not load conversations. Please retry.');
    } finally {
      setConversationsLoaded(true);
    }
  };

  // Fetch users the current user is following
  const fetchFollowings = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('followers')
        .select('following_id, users:users!followers_following_id_fkey(id, first_name, last_name, username, avatar_url)')
        .eq('follower_id', user.id);
      if (error) throw error;
      const followingUsers = (data || []).map(f => f.users).filter(Boolean);
      setFollowings(followingUsers);
    } catch (error) {
      setFollowings([]);
    }
  };

  // Merge followings and conversations for sidebar
  const sidebarList = React.useMemo(() => {
    // Map conversations by other_user_id for quick lookup
    const convMap = new Map(conversations.map(c => [c.other_user_id, c]));
    // Add all followings as possible chat targets
    const all = [...followings.map(f => {
      const conv = convMap.get(f.id);
      return conv || {
        id: `new-${f.id}`,
        name: `${f.first_name || ''} ${f.last_name || ''}`.trim() || f.username,
        avatar: f.avatar_url || '/placeholder.svg',
        lastMessage: '',
        time: '',
        unread: 0,
        online: false,
        other_user_id: f.id,
        isNew: true,
      };
    })];
    // Add any conversations with non-followings (e.g. received messages)
    conversations.forEach(c => {
      if (!all.find(a => a.other_user_id === c.other_user_id)) {
        all.push(c);
      }
    });
    return all;
  }, [conversations, followings]);

  // Subscribe to new messages in a conversation
  const subscribeToMessages = (conversationId: string) => {
    console.log('Messages page: Subscribing to messages for conversation:', conversationId);
    
    const channel = supabase.channel(`conversation-${conversationId}`);
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      },
      (payload) => {
        console.log('Messages page: New message received:', payload.new);
        const newMessage = payload.new as Message;
        setMessages((previous) => previous.some((message) => message.id === newMessage.id)
          ? previous
          : [...previous, newMessage]);
        
        // If the new message is from someone else, refresh unread counts
        if (newMessage.sender_id !== user?.id) {
          console.log('Messages page: New message from other user, refreshing counts');
          setTimeout(() => refreshUnreadCounts(), 100);
        }
      }
    );
    
    // Also listen for message updates (like read_at changes)
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      },
      (payload) => {
        console.log('Messages page: Message updated:', payload.new);
        // Update the message in our local state
        setMessages(prev => prev.map(msg => 
          msg.id === payload.new.id ? { ...msg, ...payload.new } : msg
        ));
        
        // Refresh unread counts when messages are marked as read
        setTimeout(() => refreshUnreadCounts(), 100);
      }
    );
    
    channel.subscribe();
    return channel;
  };

  // Fetch messages for a conversation
  const fetchMessages = async (conversationId: string, isActive: () => boolean = () => true) => {
    if (!conversationId) return;
    setMessagesLoading(true);
    setMessagesError(null);
    try {
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      if (isActive()) setMessages(messagesData || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      if (isActive()) {
        setMessages([]);
        setMessagesError('Could not load this conversation. Check your connection and retry.');
      }
    } finally {
      if (isActive()) setMessagesLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user) return;
    setLoading(true);
    try {
      const sentAt = new Date().toISOString();
      const messageData = {
        conversation_id: selectedConversation.id,
        sender_id: user.id,
        content: newMessage.trim(),
        created_at: sentAt,
      };
      const { error } = await supabase
        .from('messages')
        .insert(messageData);
      if (error) throw error;
      const { error: conversationError } = await supabase
        .from('conversations')
        .update({ last_message_at: sentAt })
        .eq('id', selectedConversation.id);
      if (conversationError) console.warn('Could not update conversation activity:', conversationError);
      setNewMessage('');
      
      // Refresh unread counts after sending a message
      setTimeout(() => {
        void refreshUnreadCounts();
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const startVoiceCall = () => {
    toast({
      title: 'Voice Call',
      description: 'Voice calling feature coming soon! (WebRTC integration required)',
    });
  };

  const startVideoCall = () => {
    toast({
      title: 'Video Call',
      description: 'Video calling feature coming soon! (WebRTC integration required)',
    });
  };

  const toggleRecording = () => {
    setShowVoiceRecorder((prev) => !prev);
  };

  const handleVoiceRecordingComplete = async (audioBlob: Blob, duration: number) => {
    if (!user || !selectedConversation) return;
    setShowVoiceRecorder(false);
    setLoading(true);
    try {
      // Upload to Supabase Storage
      const file = new File([audioBlob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
      // Use the new dedicated bucket for chat voice notes
      const url = await uploadFile(file, 'messages-voicenotes', 'voice/', user.id);
      // Insert message with voice note URL
      const sentAt = new Date().toISOString();
      const { error } = await supabase.from('messages').insert({
        conversation_id: selectedConversation.id,
        sender_id: user.id,
        content: '',
        voice_note_url: url,
        voice_duration: duration,
        created_at: sentAt,
      });
      if (error) throw error;
      const { error: conversationError } = await supabase
        .from('conversations')
        .update({ last_message_at: sentAt })
        .eq('id', selectedConversation.id);
      if (conversationError) console.warn('Could not update conversation activity:', conversationError);
      setVoiceNoteUrl(null);
      setVoiceNoteDuration(0);
      
      // Refresh unread counts after sending voice message
      setTimeout(() => refreshUnreadCounts(), 100);
    } catch (error: any) {
      toast({
        title: 'Voice Note Error',
        description: error.message || 'Failed to send voice note',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // When a following is clicked and no conversation exists, create one
  const handleSelectConversation = async (conv: any) => {
    if (!user) return;
    if (!conv.isNew) {
      setConversationLoadError(null);
      setSelectedConversation(conv);
      // Navigate to the conversation's unique URL
      navigate(`/messages/${conv.id}`);
      return;
    }

    try {
      const participantId = conv.other_user_id;
      const { data: existingConversation, error: lookupError } = await supabase
        .from('conversations')
        .select('*')
        .or(`and(customer_id.eq.${user.id},seller_id.eq.${participantId}),and(customer_id.eq.${participantId},seller_id.eq.${user.id})`)
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lookupError) throw lookupError;

      let conversation = existingConversation;
      if (!conversation) {
        const { data: createdConversation, error: createError } = await supabase
          .from('conversations')
          .insert({ customer_id: user.id, seller_id: participantId })
          .select()
          .single();
        if (createError) throw createError;
        conversation = createdConversation;
      }

      const { error: participantError } = await supabase
        .from('conversation_participants')
        .upsert([
          { conversation_id: conversation.id, user_id: user.id, last_read_at: null },
          { conversation_id: conversation.id, user_id: participantId, last_read_at: null },
        ], { onConflict: 'conversation_id,user_id', ignoreDuplicates: true });
      if (participantError) console.warn('Could not initialize conversation participants:', participantError);

      await fetchConversations();
      const updatedConv = {
        ...conv,
        id: conversation.id,
        isNew: false,
      };
      setConversationLoadError(null);
      setSelectedConversation(updatedConv);
      navigate(`/messages/${conversation.id}`);
    } catch (error: any) {
      console.error('Failed to start conversation:', error);
      toast({
        title: 'Could not start conversation',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Enhanced mark as read function with better error handling and logging
  const markMessagesAsRead = async (conversationId: string) => {
    if (!user || !conversationId) return;
    
    console.log('Messages page: Marking messages as read for conversation:', conversationId);
    
    try {
      const readAt = new Date().toISOString();
      const { error: participantError } = await supabase
        .from('conversation_participants')
        .upsert(
          { conversation_id: conversationId, user_id: user.id, last_read_at: readAt },
          { onConflict: 'conversation_id,user_id' }
        );
      if (participantError) console.warn('Could not update participant read cursor:', participantError);

      const { data, error } = await supabase
        .from('messages')
        .update({ read_at: readAt })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id)
        .is('read_at', null)
        .select('id');
      
      if (error) {
        console.error('Error marking messages as read:', error);
        return;
      }
      
      console.log('Messages page: Marked messages as read:', data?.length || 0);
      
      // Refresh unread counts after marking messages as read
      setTimeout(() => refreshUnreadCounts(), 200);
      
    } catch (error) {
      console.error('Unexpected error marking messages as read:', error);
    }
  };

  // Mark all messages as read when opening a conversation
  useEffect(() => {
    if (selectedConversation && user) {
      console.log('Messages page: Selected conversation changed, marking messages as read');
      markMessagesAsRead(selectedConversation.id);
    }
    // eslint-disable-next-line
  }, [selectedConversation, user]);

  useEffect(() => {
    if (!user) return;
    // Play sound only once per new message (not sent by self)
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (
        lastMsg.sender_id !== user.id &&
        lastMsg.id !== lastPlayedMessageId.current &&
        defaultWhistleSound.current
      ) {
        defaultWhistleSound.current.currentTime = 0;
        defaultWhistleSound.current.pause();
        defaultWhistleSound.current.play().catch(() => {});
        lastPlayedMessageId.current = lastMsg.id;
      }
    }
    // eslint-disable-next-line
  }, [messages, user]);

  // Scroll to bottom on new messages
  useEffect(() => {
    // Prefer ScrollArea viewport if available
    if (scrollAreaViewportRef.current) {
      scrollAreaViewportRef.current.scrollTop = scrollAreaViewportRef.current.scrollHeight;
    } else if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <Layout hideSidebar hideRightSidebar>
      <div className="flex h-[calc(100vh-64px)]">
        {/* Sidebar: conversations list, collapses on mobile */}
        <aside className="w-full max-w-xs border-r border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 h-full hidden md:flex flex-col">
          <MessagesSidebar
            conversations={sidebarList}
            selectedConversation={selectedConversation}
            setSelectedConversation={handleSelectConversation}
          />
        </aside>
        {/* Mobile sidebar toggle */}
        <div className="md:hidden flex-shrink-0">
          <button
            className="p-2 m-2 rounded-full bg-purple-100 text-purple-700 hover:bg-purple-200 focus:outline-none"
            onClick={() => setShowMobileSidebar(true)}
            aria-label="Open conversations"
          >
            <MessageCircle className="h-6 w-6" />
          </button>
        </div>
        {/* Mobile sidebar drawer */}
        {showMobileSidebar && (
          <div className="fixed inset-0 z-40 flex">
            <div className="w-4/5 max-w-xs bg-white dark:bg-gray-900 shadow-xl h-full">
              <MessagesSidebar
                conversations={sidebarList}
                selectedConversation={selectedConversation}
                setSelectedConversation={async (conv: any) => {
                  await handleSelectConversation(conv);
                  setShowMobileSidebar(false);
                }}
              />
            </div>
            <div className="flex-1 bg-black/30" onClick={() => setShowMobileSidebar(false)} />
          </div>
        )}
        {/* Main chat area */}
        <main className="flex-1 flex flex-col h-full bg-white dark:bg-[#161616]">
          <div className="flex flex-col h-full max-w-3xl mx-auto w-full">
            {/* Conversation header with profile, name, and call icons */}
            {selectedConversation && (
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-white/90 dark:bg-gray-900/80 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedConversation.avatar} />
                    <AvatarFallback>{selectedConversation.name?.charAt(0)?.toUpperCase() || '?'}</AvatarFallback>
                  </Avatar>
                  <div className="font-semibold text-gray-900 dark:text-gray-100 text-base">{selectedConversation.name}</div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={startVoiceCall} aria-label="Voice Call">
                    <Phone className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={startVideoCall} aria-label="Video Call">
                    <Video className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            )}
            <div className="flex-1 flex flex-col min-h-0">
              {/* Make chat/message container scrollable with ScrollArea */}
              <ScrollArea className="flex-1 min-h-0" style={{ maxHeight: '100%' }}>
                <div
                  className="flex flex-col gap-3 justify-end h-full px-2 py-4"
                  ref={el => {
                    (chatContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
                    // Also set viewport ref for ScrollArea
                    if (el && el.parentElement?.classList.contains('radix-scroll-area-viewport')) {
                      (scrollAreaViewportRef as React.MutableRefObject<HTMLDivElement | null>).current = el.parentElement as HTMLDivElement;
                    }
                  }}
                  style={{ minHeight: '100%' }}
                >
                  {!selectedConversation ? (
                    <div className="mx-auto mt-8 max-w-sm text-center text-sm text-gray-500">
                      {conversationLoadError || (conversationsLoaded ? 'Choose a conversation to start messaging.' : 'Loading conversations...')}
                      {conversationLoadError && (
                        <Button variant="outline" size="sm" className="mt-3" onClick={() => void fetchConversations()}>
                          Retry
                        </Button>
                      )}
                    </div>
                  ) : messagesLoading ? (
                    <div className="mt-8 text-center text-sm text-gray-500">Loading messages...</div>
                  ) : messagesError ? (
                    <div className="mx-auto mt-8 max-w-sm text-center text-sm text-red-500">{messagesError}</div>
                  ) : messages.length === 0 ? (
                    <div className="mt-8 text-center text-gray-400">No messages yet.</div>
                  ) : null}
                  {[...messages]
                    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                    .map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] px-4 py-2 rounded-2xl shadow-sm text-sm break-words ${
                            message.sender_id === user?.id
                              ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                          }`}
                        >
                          {message.voice_note_url ? (
                            <VoicePlayer audioUrl={message.voice_note_url} duration={message.voice_duration || 0} />
                          ) : (
                            <>
                              <p>{message.content}</p>
                              <p className="text-xs mt-1 opacity-60 text-right">
                                {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </ScrollArea>
              {/* Input form for sending messages/voice notes, always visible at the bottom */}
              <div className="border-t dark:border-gray-700 p-3 sm:p-4 bg-white/90 dark:bg-gray-900/80 sticky bottom-0 z-10">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={toggleRecording}
                    className={isRecording ? 'bg-red-500 text-white' : ''}
                    aria-label="Record voice message"
                  >
                    {isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                  </Button>
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Type a message..."
                    className="flex-1 rounded-full px-4 py-2 border-0 bg-gray-100 dark:bg-gray-800 focus:ring-2 focus:ring-purple-400"
                    disabled={loading || !selectedConversation}
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || loading || !selectedConversation}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-full shadow-md"
                    aria-label="Send message"
                  >
                    <Send className="h-5 w-5" />
                  </Button>
                </div>
              </div>
              {showVoiceRecorder && selectedConversation && (
                <div className="mb-4">
                  <VoiceRecorder
                    onRecordingComplete={handleVoiceRecordingComplete}
                    onCancel={() => setShowVoiceRecorder(false)}
                  />
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </Layout>
  );
};

export default Messages;
