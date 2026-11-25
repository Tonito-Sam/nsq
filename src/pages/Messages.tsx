import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, MessageCircle, Send, Mic, MicOff, Paperclip, FileText, Camera, Image as ImageIcon, X, ArrowLeft, Loader2, MoreVertical, SwitchCamera, Check } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { VoicePlayer } from '@/components/VoicePlayer';
import { uploadFile } from '@/utils/mediaUtils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { createPodcastShortTranscriber, decodePodcastSpeechAudio } from '@/utils/podcastShortCaptioning';
import { cn } from '@/lib/utils';

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
  message_type?: string | null;
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
  isNew?: boolean;
}

interface Following {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
}

const isAudioFile = (file: File) =>
  file.type.startsWith('audio/')
  || /\.(aac|flac|m4a|mp3|ogg|opus|wav|webm)$/i.test(file.name);

const isImageFile = (file: File) =>
  file.type.startsWith('image/')
  || /\.(avif|gif|heic|heif|jpe?g|png|webp)$/i.test(file.name);

const getAudioDuration = (file: File): Promise<number> => new Promise((resolve, reject) => {
  const audioUrl = URL.createObjectURL(file);
  const audio = new Audio();
  audio.preload = 'metadata';
  audio.onloadedmetadata = () => {
    URL.revokeObjectURL(audioUrl);
    if (!Number.isFinite(audio.duration)) {
      reject(new Error('Could not determine the audio duration.'));
      return;
    }
    resolve(Math.ceil(audio.duration));
  };
  audio.onerror = () => {
    URL.revokeObjectURL(audioUrl);
    reject(new Error('This audio file could not be opened.'));
  };
  audio.src = audioUrl;
});

const formatTime = (dateString: string) => {
  return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/* ------------------------------------------------------------------ */
/* Camera Capture Modal — real photo capture on any device            */
/* ------------------------------------------------------------------ */
interface CameraCaptureProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ open, onClose, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [capturing, setCapturing] = useState(false);

  // Start / stop the camera when the modal opens/closes or facing changes
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setReady(false);
    setError(null);

    const start = async () => {
      try {
        // Stop any existing stream before starting a new one
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera is not supported in this browser.');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch (err: any) {
        if (cancelled) return;
        const msg =
          err?.name === 'NotAllowedError'
            ? 'Camera permission was denied. Allow camera access and try again.'
            : err?.name === 'NotFoundError'
            ? 'No camera was found on this device.'
            : err?.message || 'Could not open the camera.';
        setError(msg);
      }
    };

    void start();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [open, facingMode]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const handleCapture = async () => {
    const video = videoRef.current;
    if (!video || !ready || capturing) return;
    setCapturing(true);
    try {
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not capture photo.');
      ctx.drawImage(video, 0, 0, width, height);

      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
      );
      if (!blob) throw new Error('Could not create the photo.');
      const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
      onCapture(file);
      onClose();
    } catch (err: any) {
      toast({
        title: 'Camera Error',
        description: err?.message || 'Could not capture the photo.',
        variant: 'destructive',
      });
    } finally {
      setCapturing(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl overflow-hidden bg-black shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white">
          <span className="text-sm font-medium">Take a photo</span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Close camera"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative aspect-[4/3] bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="h-full w-full object-cover"
          />
          {!ready && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80">
              <Loader2 className="h-8 w-8 animate-spin mb-2" />
              <span className="text-sm">Starting camera…</span>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-white/90">
              <Camera className="h-10 w-10 mb-3 opacity-70" />
              <p className="text-sm">{error}</p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-4"
                onClick={onClose}
              >
                Close
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-3 bg-gray-900">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setFacingMode((m) => (m === 'user' ? 'environment' : 'user'))}
            disabled={!ready || capturing}
            className="text-white hover:bg-white/10 rounded-full"
            aria-label="Switch camera"
            title="Switch camera"
          >
            <SwitchCamera className="h-5 w-5" />
          </Button>

          <button
            onClick={handleCapture}
            disabled={!ready || capturing}
            className={cn(
              "h-16 w-16 rounded-full border-4 border-white flex items-center justify-center transition-all duration-150",
              ready && !capturing ? "bg-white active:scale-95" : "bg-white/40"
            )}
            aria-label="Capture photo"
          >
            {capturing ? (
              <Loader2 className="h-6 w-6 text-gray-900 animate-spin" />
            ) : (
              <Check className="h-6 w-6 text-gray-900" />
            )}
          </button>

          <div className="w-10" />
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Messages page                                                      */
/* ------------------------------------------------------------------ */
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
  const [showCamera, setShowCamera] = useState(false);
  const [voiceNoteUrl, setVoiceNoteUrl] = useState<string | null>(null);
  const [voiceNoteDuration, setVoiceNoteDuration] = useState<number>(0);
  const [isAudioDragOver, setIsAudioDragOver] = useState(false);
  const [transcribingMessageId, setTranscribingMessageId] = useState<string | null>(null);
  const [transcriptionProgress, setTranscriptionProgress] = useState<number | null>(null);
  const [transcriptions, setTranscriptions] = useState<Record<string, string>>({});
  const [followings, setFollowings] = useState<Following[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const defaultWhistleSound = useRef<HTMLAudioElement | null>(null);
  const messageSubRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastPlayedMessageId = useRef<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const scrollAreaViewportRef = useRef<HTMLDivElement>(null);
  const voiceNoteInputRef = useRef<HTMLInputElement>(null);
  const photoUploadInputRef = useRef<HTMLInputElement>(null);
  const transcriberRef = useRef<ReturnType<typeof createPodcastShortTranscriber> | null>(null);
  const isMountedRef = useRef(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      transcriberRef.current?.terminate();
    };
  }, []);

  useEffect(() => {
    defaultWhistleSound.current = new window.Audio('/whistle.wav');
    defaultWhistleSound.current.volume = 0.7;
    defaultWhistleSound.current.loop = false;
  }, []);

  const refreshUnreadCounts = useCallback(async () => {
    await fetchConversations();
    if (window.refreshHeaderUnreadCount) {
      window.refreshHeaderUnreadCount();
    }
    window.dispatchEvent(new CustomEvent('messagesRead'));
  }, []);

  const fetchConversations = useCallback(async () => {
    if (!user) {
      setConversations([]);
      setConversationsLoaded(true);
      return;
    }
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
          if (otherUserId === user.id) return null;
          const { data: otherUser } = await supabase
            .from('users')
            .select('first_name, last_name, username, avatar_url')
            .eq('id', otherUserId)
            .single();
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('content, created_at, message_type')
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

          return {
            id: conv.id,
            name: otherUser ? `${otherUser.first_name || ''} ${otherUser.last_name || ''}`.trim() || otherUser.username : 'Unknown',
            avatar: otherUser?.avatar_url || '/placeholder.svg',
            lastMessage: lastMsg?.message_type === 'image' ? '📷 Photo' : lastMsg?.content || '',
            time: lastMsg?.created_at ? formatTime(lastMsg.created_at) : '',
            unread: unread || 0,
            online: false,
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
  }, [user]);

  const fetchFollowings = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('followers')
        .select('following_id, users:users!followers_following_id_fkey(id, first_name, last_name, username, avatar_url)')
        .eq('follower_id', user.id);
      if (error) throw error;
      const followingUsers = (data ?? []).flatMap((follower) => follower.users ?? []);
      setFollowings(followingUsers);
    } catch (error) {
      setFollowings([]);
    }
  }, [user]);

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
  }, [user, fetchConversations, fetchFollowings]);

  const sidebarList = useMemo(() => {
    const convMap = new Map(conversations.map(c => [c.other_user_id, c]));
    const all: Conversation[] = followings.map(f => {
      const conv = convMap.get(f.id);
      return conv || {
        id: `new-${f.id}`,
        name: `${f.first_name || ''} ${f.last_name || ''}`.trim() || f.username || 'Unknown',
        avatar: f.avatar_url || '/placeholder.svg',
        lastMessage: '',
        time: '',
        unread: 0,
        online: false,
        other_user_id: f.id,
        isNew: true,
      };
    });
    conversations.forEach(c => {
      if (!all.find(a => a.other_user_id === c.other_user_id)) {
        all.push(c);
      }
    });
    return all;
  }, [conversations, followings]);

  const filteredSidebarList = useMemo(() => {
    if (!searchQuery.trim()) return sidebarList;
    const query = searchQuery.toLowerCase();
    return sidebarList.filter(c => c.name.toLowerCase().includes(query));
  }, [sidebarList, searchQuery]);

  const subscribeToMessages = useCallback((convId: string) => {
    const channel = supabase.channel(`conversation-${convId}`);
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${convId}`
      },
      (payload) => {
        const newMsg = payload.new as Message;
        setMessages((previous) => previous.some((message) => message.id === newMsg.id)
          ? previous
          : [...previous, newMsg]);

        if (newMsg.sender_id !== user?.id) {
          setTimeout(() => refreshUnreadCounts(), 100);
        }
      }
    );

    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${convId}`
      },
      (payload) => {
        setMessages(prev => prev.map(msg =>
          msg.id === payload.new.id ? { ...msg, ...payload.new } : msg
        ));
        setTimeout(() => refreshUnreadCounts(), 100);
      }
    );

    channel.subscribe();
    return channel;
  }, [user?.id, refreshUnreadCounts]);

  const fetchMessages = useCallback(async (convId: string, isActive: () => boolean = () => true) => {
    if (!convId) return;
    setMessagesLoading(true);
    setMessagesError(null);
    try {
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convId)
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
  }, []);

  useEffect(() => {
    const convId = selectedConversation?.id;
    if (!convId) {
      setMessages([]);
      setMessagesError(null);
      setMessagesLoading(false);
      return;
    }

    let active = true;
    setMessages([]);
    setMessagesError(null);
    setMessagesLoading(true);
    const subscription = subscribeToMessages(convId);
    messageSubRef.current = subscription;
    void fetchMessages(convId, () => active);

    return () => {
      active = false;
      if (messageSubRef.current === subscription) messageSubRef.current = null;
      void supabase.removeChannel(subscription);
    };
  }, [selectedConversation?.id, user?.id, subscribeToMessages, fetchMessages]);

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
  }, [conversations, conversationsLoaded, conversationId, conversationFetchFailed, location.state]);

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

  const markMessagesAsRead = useCallback(async (convId: string) => {
    if (!user || !convId) return;

    try {
      const readAt = new Date().toISOString();
      const { error: participantError } = await supabase
        .from('conversation_participants')
        .upsert(
          { conversation_id: convId, user_id: user.id, last_read_at: readAt },
          { onConflict: 'conversation_id,user_id' }
        );
      if (participantError) console.warn('Could not update participant read cursor:', participantError);

      const { error } = await supabase
        .from('messages')
        .update({ read_at: readAt })
        .eq('conversation_id', convId)
        .neq('sender_id', user.id)
        .is('read_at', null);

      if (error) {
        console.error('Error marking messages as read:', error);
        return;
      }

      setTimeout(() => refreshUnreadCounts(), 200);
    } catch (error) {
      console.error('Unexpected error marking messages as read:', error);
    }
  }, [user, refreshUnreadCounts]);

  useEffect(() => {
    if (selectedConversation && user) {
      markMessagesAsRead(selectedConversation.id);
    }
  }, [selectedConversation, user, markMessagesAsRead]);

  useEffect(() => {
    if (!user || messages.length === 0) return;
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
  }, [messages, user]);

  useEffect(() => {
    if (scrollAreaViewportRef.current) {
      scrollAreaViewportRef.current.scrollTop = scrollAreaViewportRef.current.scrollHeight;
    } else if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

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
      const { error } = await supabase.from('messages').insert(messageData);
      if (error) throw error;
      const { error: conversationError } = await supabase
        .from('conversations')
        .update({ last_message_at: sentAt })
        .eq('id', selectedConversation.id);
      if (conversationError) console.warn('Could not update conversation activity:', conversationError);
      setNewMessage('');
      setTimeout(() => void refreshUnreadCounts(), 100);
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

  const sendVoiceNoteFile = async (file: File, duration: number, conversation: Conversation) => {
    if (!user) return;
    setLoading(true);
    try {
      const url = await uploadFile(file, 'messages-voicenotes', 'voice/', user.id);
      const sentAt = new Date().toISOString();
      const { error } = await supabase.from('messages').insert({
        conversation_id: conversation.id,
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
        .eq('id', conversation.id);
      if (conversationError) console.warn('Could not update conversation activity:', conversationError);
      setVoiceNoteUrl(null);
      setVoiceNoteDuration(0);
      setTimeout(() => void refreshUnreadCounts(), 100);
    } catch (error) {
      toast({
        title: 'Voice Note Error',
        description: error instanceof Error ? error.message : 'Failed to send voice note',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceRecordingComplete = async (audioBlob: Blob, duration: number) => {
    if (!selectedConversation) return;
    setShowVoiceRecorder(false);
    const file = new File([audioBlob], `voice-${Date.now()}.webm`, { type: audioBlob.type || 'audio/webm' });
    await sendVoiceNoteFile(file, duration, selectedConversation);
  };

  const handleVoiceNoteFile = async (file: File) => {
    if (!isAudioFile(file)) {
      toast({
        title: 'Unsupported attachment',
        description: 'Choose an audio file to send as a voice note.',
        variant: 'destructive',
      });
      return;
    }
    if (!selectedConversation) {
      toast({
        title: 'Choose a conversation',
        description: 'Select a conversation before sending a voice note.',
        variant: 'destructive',
      });
      return;
    }
    try {
      const duration = await getAudioDuration(file);
      await sendVoiceNoteFile(file, duration, selectedConversation);
    } catch (error) {
      toast({
        title: 'Voice Note Error',
        description: error instanceof Error ? error.message : 'Could not read the audio file.',
        variant: 'destructive',
      });
    }
  };

  const handlePhotoFile = async (file: File) => {
    if (!isImageFile(file)) {
      toast({
        title: 'Unsupported photo',
        description: 'Choose an image file to share in chat.',
        variant: 'destructive',
      });
      return;
    }
    if (!user || !selectedConversation) {
      toast({
        title: 'Choose a conversation',
        description: 'Select a conversation before sharing a photo.',
        variant: 'destructive',
      });
      return;
    }

    const conversation = selectedConversation;
    setLoading(true);
    try {
      const photoUrl = await uploadFile(file, 'posts', 'messages/photos/', user.id);
      const sentAt = new Date().toISOString();
      const { error } = await supabase.from('messages').insert({
        conversation_id: conversation.id,
        sender_id: user.id,
        content: photoUrl,
        message_type: 'image',
        created_at: sentAt,
      });
      if (error) throw error;
      const { error: conversationError } = await supabase
        .from('conversations')
        .update({ last_message_at: sentAt })
        .eq('id', conversation.id);
      if (conversationError) console.warn('Could not update conversation activity:', conversationError);
      setTimeout(() => void refreshUnreadCounts(), 100);
    } catch (error) {
      toast({
        title: 'Photo Send Error',
        description: error instanceof Error ? error.message : 'Failed to share photo.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const transcribeVoiceNote = async (message: Message) => {
    if (!message.voice_note_url) return;
    setTranscribingMessageId(message.id);
    setTranscriptionProgress(null);

    try {
      const response = await fetch(message.voice_note_url);
      if (!response.ok) throw new Error('Could not download this voice note for transcription.');
      const audioBlob = await response.blob();
      const audioSamples = await decodePodcastSpeechAudio(audioBlob);
      if (!isMountedRef.current) return;
      let transcriber = transcriberRef.current;
      if (!transcriber) {
        transcriber = createPodcastShortTranscriber((progress) => {
          if (isMountedRef.current) setTranscriptionProgress(Math.round(progress));
        });
        transcriberRef.current = transcriber;
      }
      await transcriber.prepare();
      const chunks = await transcriber.transcribe(audioSamples);
      const transcript = chunks
        .map((chunk) => chunk.text.trim())
        .filter(Boolean)
        .join(' ')
        .replace(/\s+([,.;!?])/g, '$1');
      if (!transcript) throw new Error('No speech was detected in this voice note.');
      if (isMountedRef.current) {
        setTranscriptions((current) => ({ ...current, [message.id]: transcript }));
      }
    } catch (error) {
      if (isMountedRef.current) {
        toast({
          title: 'Transcription Error',
          description: error instanceof Error ? error.message : 'Could not transcribe this voice note.',
          variant: 'destructive',
        });
      }
    } finally {
      if (isMountedRef.current) {
        setTranscribingMessageId(null);
        setTranscriptionProgress(null);
      }
    }
  };

  const handleSelectConversation = async (conv: Conversation) => {
    if (!user) return;
    if (!conv.isNew) {
      setConversationLoadError(null);
      setSelectedConversation(conv);
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
      const updatedConv = { ...conv, id: conversation.id, isNew: false };
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

  const handleBackToList = () => {
    setSelectedConversation(null);
    navigate('/messages');
  };

  return (
    <Layout hideSidebar hideRightSidebar>
      <div className="flex h-[calc(100vh-64px)] bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-950 dark:to-gray-900">
        {/* Desktop Sidebar */}
        <aside className="w-full max-w-sm border-r border-slate-200/60 dark:border-gray-800/60 bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl h-full hidden md:flex flex-col shadow-sm">
          <SidebarContent
            conversations={filteredSidebarList}
            selectedConversation={selectedConversation}
            onSelectConversation={handleSelectConversation}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            conversationsLoaded={conversationsLoaded}
            conversationLoadError={conversationLoadError}
            onRetry={() => void fetchConversations()}
          />
        </aside>

        {/* Mobile Sidebar Toggle */}
        <div className="md:hidden">
          <button
            className="p-2.5 m-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95"
            onClick={() => setShowMobileSidebar(true)}
            aria-label="Open conversations"
          >
            <MessageCircle className="h-5 w-5" />
          </button>
        </div>

        {/* Mobile Sidebar Drawer */}
        {showMobileSidebar && (
          <div className="fixed inset-0 z-40 flex md:hidden">
            <div className="w-[85%] max-w-sm bg-white dark:bg-gray-900 shadow-2xl h-full animate-in slide-in-from-left duration-200">
              <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-gray-800">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Messages</h2>
                <button
                  onClick={() => setShowMobileSidebar(false)}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <X className="h-5 w-5 text-slate-500" />
                </button>
              </div>
              <SidebarContent
                conversations={filteredSidebarList}
                selectedConversation={selectedConversation}
                onSelectConversation={async (conv) => {
                  await handleSelectConversation(conv);
                  setShowMobileSidebar(false);
                }}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                conversationsLoaded={conversationsLoaded}
                conversationLoadError={conversationLoadError}
                onRetry={() => void fetchConversations()}
              />
            </div>
            <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setShowMobileSidebar(false)} />
          </div>
        )}

        {/* Main Chat Area */}
        <main
          className="relative flex-1 flex flex-col h-full bg-white dark:bg-gray-950"
          onDragOver={(event) => {
            if (!Array.from(event.dataTransfer.types).includes('Files')) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
            setIsAudioDragOver(Boolean(selectedConversation));
          }}
          onDragLeave={(event) => {
            if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
              setIsAudioDragOver(false);
            }
          }}
          onDrop={(event) => {
            if (!event.dataTransfer.files.length) return;
            event.preventDefault();
            setIsAudioDragOver(false);
            const files = Array.from(event.dataTransfer.files);
            if (files.length !== 1) {
              toast({
                title: 'Send one voice note at a time',
                description: 'Drop a single audio file into the conversation.',
                variant: 'destructive',
              });
              return;
            }
            void handleVoiceNoteFile(files[0]);
          }}
        >
          {isAudioDragOver && (
            <div className="pointer-events-none absolute inset-4 z-20 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-purple-500 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm text-center">
              <div className="rounded-full bg-purple-100 dark:bg-purple-900/30 p-4 mb-4">
                <Mic className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
              <p className="text-lg font-semibold text-purple-700 dark:text-purple-300">Drop audio file here</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">It will be sent as a voice note</p>
            </div>
          )}

          <div className="flex flex-col h-full max-w-4xl mx-auto w-full">
            {/* Chat Header */}
            {selectedConversation && (
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/60 dark:border-gray-800/60 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleBackToList}
                    className="md:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <ArrowLeft className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                  </button>
                  <div className="relative">
                    <Avatar className="h-10 w-10 ring-2 ring-white dark:ring-gray-800 shadow-sm">
                      <AvatarImage src={selectedConversation.avatar} />
                      <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-white font-semibold">
                        {selectedConversation.name?.charAt(0)?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    {selectedConversation.online && (
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white dark:border-gray-900" />
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white text-base leading-tight">
                      {selectedConversation.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {selectedConversation.online ? 'Online' : 'Offline'}
                    </div>
                  </div>
                </div>
                {/* Call & video icons removed — only overflow menu remains */}
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="rounded-full text-slate-500 hover:text-purple-600">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="flex-1 flex flex-col min-h-0">
              <ScrollArea className="flex-1 min-h-0">
                <div
                  className="flex flex-col gap-2 justify-end min-h-full px-3 sm:px-4 py-4"
                  ref={el => {
                    (chatContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
                    if (el && el.parentElement?.classList.contains('radix-scroll-area-viewport')) {
                      (scrollAreaViewportRef as React.MutableRefObject<HTMLDivElement | null>).current = el.parentElement as HTMLDivElement;
                    }
                  }}
                  style={{ minHeight: '100%' }}
                >
                  {!selectedConversation ? (
                    <div className="flex flex-col items-center justify-center flex-1 py-16">
                      <div className="rounded-full bg-slate-100 dark:bg-gray-800 p-6 mb-4">
                        <MessageCircle className="h-12 w-12 text-slate-400 dark:text-slate-500" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Your Messages
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-xs">
                        {conversationLoadError || (conversationsLoaded
                          ? 'Choose a conversation from the sidebar to start messaging.'
                          : 'Loading conversations...')}
                      </p>
                      {conversationLoadError && (
                        <Button variant="outline" size="sm" className="mt-4" onClick={() => void fetchConversations()}>
                          Retry
                        </Button>
                      )}
                    </div>
                  ) : messagesLoading ? (
                    <div className="flex items-center justify-center flex-1 py-16">
                      <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                      <span className="ml-2 text-sm text-slate-500">Loading messages...</span>
                    </div>
                  ) : messagesError ? (
                    <div className="flex flex-col items-center justify-center flex-1 py-16">
                      <p className="text-sm text-red-500 mb-3">{messagesError}</p>
                      <Button variant="outline" size="sm" onClick={() => void fetchMessages(selectedConversation.id)}>
                        Retry
                      </Button>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center flex-1 py-16">
                      <div className="rounded-full bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 p-5 mb-4">
                        <MessageCircle className="h-10 w-10 text-purple-500" />
                      </div>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No messages yet</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Say hello to start the conversation!</p>
                    </div>
                  ) : null}

                  {messages
                    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                    .map((message, index) => {
                      const isOwn = message.sender_id === user?.id;
                      const showAvatar = index === 0 || messages[index - 1]?.sender_id !== message.sender_id;

                      return (
                        <div
                          key={message.id}
                          className={cn(
                            "flex gap-2",
                            isOwn ? "justify-end" : "justify-start",
                            showAvatar ? "mt-4" : "mt-1"
                          )}
                        >
                          {!isOwn && (
                            <div className="w-8 flex-shrink-0">
                              {showAvatar && (
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={selectedConversation?.avatar} />
                                  <AvatarFallback className="text-xs bg-gradient-to-br from-purple-500 to-blue-500 text-white">
                                    {selectedConversation?.name?.charAt(0)?.toUpperCase() || '?'}
                                  </AvatarFallback>
                                </Avatar>
                              )}
                            </div>
                          )}
                          <div
                            className={cn(
                              "max-w-[75%] sm:max-w-[65%] px-4 py-2.5 rounded-2xl shadow-sm text-sm break-words transition-all duration-150",
                              isOwn
                                ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-br-md"
                                : "bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 border border-slate-200/50 dark:border-gray-700/50 rounded-bl-md"
                            )}
                          >
                            {message.voice_note_url ? (
                              <div className="space-y-2 min-w-[200px]">
                                <VoicePlayer audioUrl={message.voice_note_url} duration={message.voice_duration || 0} />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={cn(
                                    "h-auto px-1.5 py-1 text-xs rounded-md",
                                    isOwn ? "text-white/80 hover:text-white hover:bg-white/10" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                                  )}
                                  onClick={() => void transcribeVoiceNote(message)}
                                  disabled={transcribingMessageId !== null}
                                >
                                  <FileText className="mr-1 h-3 w-3" />
                                  {transcribingMessageId === message.id
                                    ? `Transcribing${transcriptionProgress === null ? '…' : ` ${transcriptionProgress}%`}`
                                    : 'Transcribe'}
                                </Button>
                                {transcriptions[message.id] && (
                                  <div className={cn(
                                    "rounded-lg p-2.5 text-sm",
                                    isOwn ? "bg-white/10" : "bg-slate-100 dark:bg-gray-700"
                                  )}>
                                    <p>{transcriptions[message.id]}</p>
                                    <Button
                                      variant="link"
                                      size="sm"
                                      className={cn(
                                        "h-auto px-0 py-1 text-xs",
                                        isOwn ? "text-white/80 hover:text-white" : ""
                                      )}
                                      onClick={() => setNewMessage(transcriptions[message.id])}
                                    >
                                      Use as text
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ) : message.message_type === 'image' ? (
                              <img
                                src={message.content}
                                alt="Shared photo"
                                className="max-h-72 max-w-full rounded-xl object-contain"
                                loading="lazy"
                              />
                            ) : (
                              <>
                                <p className="leading-relaxed">{message.content}</p>
                                <p className={cn(
                                  "text-[10px] mt-1.5 text-right",
                                  isOwn ? "text-white/60" : "text-slate-400 dark:text-slate-500"
                                )}>
                                  {formatTime(message.created_at)}
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Message Input */}
              {selectedConversation && (
                <div className="border-t border-slate-200/60 dark:border-gray-800/60 p-3 sm:p-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl sticky bottom-0 z-10">
                  <div className="flex items-end gap-1.5 sm:gap-2">
                    {/* Hidden gallery input only — camera is handled by modal */}
                    <input
                      ref={photoUploadInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        event.currentTarget.value = '';
                        if (file) void handlePhotoFile(file);
                      }}
                    />
                    <input
                      ref={voiceNoteInputRef}
                      type="file"
                      accept="audio/*,.aac,.flac,.m4a,.mp3,.ogg,.opus,.wav,.webm"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        event.currentTarget.value = '';
                        if (file) void handleVoiceNoteFile(file);
                      }}
                    />

                    <div className="flex items-center gap-0.5">
                      {/* Take a photo — opens live camera modal */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowCamera(true)}
                        disabled={loading}
                        className="rounded-full h-9 w-9 text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                        aria-label="Take a photo"
                        title="Take a photo"
                      >
                        <Camera className="h-5 w-5" />
                      </Button>

                      {/* Upload an existing image — opens gallery/file picker */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => photoUploadInputRef.current?.click()}
                        disabled={loading}
                        className="rounded-full h-9 w-9 text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                        aria-label="Upload a photo"
                        title="Upload a photo"
                      >
                        <ImageIcon className="h-5 w-5" />
                      </Button>

                      {/* Attach audio file as voice note */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => voiceNoteInputRef.current?.click()}
                        disabled={loading}
                        className="rounded-full h-9 w-9 text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                        aria-label="Attach audio voice note"
                        title="Attach audio voice note"
                      >
                        <Paperclip className="h-5 w-5" />
                      </Button>

                      {/* Record voice message */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowVoiceRecorder(!showVoiceRecorder)}
                        className={cn(
                          "rounded-full h-9 w-9 transition-all duration-200",
                          isRecording
                            ? "bg-red-500 text-white hover:bg-red-600 animate-pulse"
                            : "text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                        )}
                        aria-label="Record voice message"
                        title="Record voice message"
                      >
                        {isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                      </Button>
                    </div>

                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder="Type a message..."
                      className="flex-1 rounded-full px-4 py-2.5 border-0 bg-slate-100 dark:bg-gray-800 focus-visible:ring-2 focus-visible:ring-purple-400 text-sm"
                      disabled={loading}
                    />

                    <Button
                      onClick={sendMessage}
                      disabled={!newMessage.trim() || loading}
                      className={cn(
                        "rounded-full h-10 w-10 shadow-md transition-all duration-200",
                        newMessage.trim()
                          ? "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white active:scale-95"
                          : "bg-slate-200 dark:bg-gray-700 text-slate-400 dark:text-gray-500"
                      )}
                      aria-label="Send message"
                    >
                      {loading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Send className="h-5 w-5" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {showVoiceRecorder && selectedConversation && (
                <div className="absolute bottom-20 left-0 right-0 mx-4 z-20">
                  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-gray-700 p-4">
                    <VoiceRecorder
                      onRecordingComplete={handleVoiceRecordingComplete}
                      onCancel={() => setShowVoiceRecorder(false)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Live camera capture modal — real photo taking */}
      <CameraCapture
        open={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={(file) => void handlePhotoFile(file)}
      />
    </Layout>
  );
};

/* ------------------------------------------------------------------ */
/* Sidebar content                                                    */
/* ------------------------------------------------------------------ */
interface SidebarContentProps {
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  onSelectConversation: (conv: Conversation) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  conversationsLoaded: boolean;
  conversationLoadError: string | null;
  onRetry: () => void;
}

const SidebarContent: React.FC<SidebarContentProps> = ({
  conversations,
  selectedConversation,
  onSelectConversation,
  searchQuery,
  onSearchChange,
  conversationsLoaded,
  conversationLoadError,
  onRetry,
}) => {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-200/60 dark:border-gray-800/60">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Messages
          </h2>
          <span className="text-xs font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-gray-800 px-2 py-1 rounded-full">
            {conversations.length}
          </span>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 rounded-xl border-0 bg-slate-100 dark:bg-gray-800 focus-visible:ring-2 focus-visible:ring-purple-400 text-sm"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {!conversationsLoaded ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
            </div>
          ) : conversationLoadError ? (
            <div className="flex flex-col items-center py-12 px-4">
              <p className="text-sm text-slate-500 text-center mb-3">{conversationLoadError}</p>
              <Button variant="outline" size="sm" onClick={onRetry}>
                Retry
              </Button>
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center py-12 px-4">
              <div className="rounded-full bg-slate-100 dark:bg-gray-800 p-3 mb-3">
                <MessageCircle className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
                {searchQuery ? 'No conversations match your search.' : 'No conversations yet. Follow someone to start messaging!'}
              </p>
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-150 text-left",
                  selectedConversation?.id === conv.id
                    ? "bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 ring-1 ring-purple-200 dark:ring-purple-800"
                    : "hover:bg-slate-50 dark:hover:bg-gray-800/50"
                )}
              >
                <div className="relative flex-shrink-0">
                  <Avatar className="h-12 w-12 ring-2 ring-white dark:ring-gray-800 shadow-sm">
                    <AvatarImage src={conv.avatar} />
                    <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-white font-semibold text-sm">
                      {conv.name?.charAt(0)?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  {conv.online && (
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white dark:border-gray-900" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-slate-900 dark:text-white truncate">
                      {conv.name}
                    </span>
                    {conv.time && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0 ml-2">
                        {conv.time}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {conv.isNew ? (
                        <span className="text-purple-500 dark:text-purple-400 italic">Start a conversation</span>
                      ) : conv.lastMessage ? (
                        conv.lastMessage
                      ) : (
                        <span className="italic opacity-60">No messages yet</span>
                      )}
                    </p>
                    {conv.unread > 0 && (
                      <span className="flex-shrink-0 ml-2 h-5 min-w-[20px] px-1.5 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                        {conv.unread > 99 ? '99+' : conv.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default Messages;