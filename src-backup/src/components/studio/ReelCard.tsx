import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
// --- OUTRO animation styles (from Studio.tsx) ---
const outroStyles = `
@keyframes scale-in {
  0% { transform: scale(0.8); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
.animate-scale-in {
  animation: scale-in 0.5s cubic-bezier(0.4,0,0.2,1);
}
@keyframes pulse-slow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(75, 45, 128, 0.3); }
  50% { box-shadow: 0 0 12px 4px rgba(124,58,237,0.18); }
}
.animate-pulse-slow {
  animation: pulse-slow 2s infinite;
}
@keyframes marquee {
  0% { transform: translateX(100%); }
  100% { transform: translateX(-100%); }
}
.animate-marquee {
  display: inline-block;
  min-width: 100%;
  position: relative;
  white-space: nowrap;
  animation: marquee 8s linear infinite;
}
`;
if (typeof document !== 'undefined' && !document.getElementById('outro-styles')) {
  const style = document.createElement('style');
  style.id = 'outro-styles';
  style.innerHTML = outroStyles;
  document.head.appendChild(style);
}
import {
  Heart,
  MessageCircle,
  Share,
  Eye,
  Plus,
  Play,
  Pause,
  VideoIcon,
  Radio,
  Settings,
  Users
} from "lucide-react";

import { ENABLE_LIVE } from '@/config/featureFlags';
import { supabase } from '@/integrations/supabase/client';

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ProfileModal } from "./ProfileModal";
import CommentsSection from "./CommentsSection";
import VideoShareModal from './VideoShareModal';
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { ReelVideo } from "@/components/ReelCard";

// Extend ReelVideo with UI fields
type StudioReelVideo = ReelVideo & {
  creator?: { name: string; avatar_url?: string };
  creator_id?: string;
  shares_count?: number;
  title?: string;
  description?: string;
  subscriber_count?: number;
};

interface ReelCardProps {
  video: StudioReelVideo;
  onLike: (id: string) => void;
  onView: (id: string) => void;
  onShare: (id: string) => void;
  onFollow: (creatorId: string) => void;
  isLiked: boolean;
  isFollowing: boolean;
  isActive: boolean;
  userData?: any; // Pass userData as prop
  // When true, hide studio-level controls like the Go Live button regardless of feature flag
  hideLive?: boolean;
}

export function ReelCard({
  video,
  onLike,
  onView,
  onShare,
  onFollow,
  isLiked,
  isFollowing,
  isActive,
  userData = null,
  hideLive = false,
}: ReelCardProps) {
  // Debug: log the video prop, video_url, and userData
  console.log('ReelCard video prop:', video);
  console.log('ReelCard userData:', userData);
  const navigate = useNavigate();
  // Feature flags (imported at top-level)
  const [isPlaying, setIsPlaying] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  // For seekable progress bar
  const [seeking, setSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isMobile = useIsMobile();
  // Recording button navigates directly to the Record page; no inline popover on ReelCard.

  // --- OUTRO overlay state and logic ---
  const [showOutro, setShowOutro] = useState(false);
  const outroAudioRef = useRef<HTMLAudioElement>(null);

  // --- Comment modal and animated comment display state ---
  const [showComment, setShowComment] = useState(false);
  const [commentIndex, setCommentIndex] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentLoading, setCommentLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const commentChannelRef = useRef<any>(null);
  const [commentsCount, setCommentsCount] = useState<number>(video.comments_count ?? 0);

  // --- Fetch comments for this video (Studio.tsx logic) ---
  const fetchComments = async () => {
    setCommentLoading(true);
    try {
      // Use correct PostgREST join syntax for related users table
      if (!video?.id) return;
      if (!supabase) throw new Error('Supabase client not available');
      const { data, error } = await supabase
        .from('studio_video_comments')
        .select('id, user_id, comment, created_at, users:user_id(id,username,avatar_url)')
        .order('created_at', { ascending: false })
        .limit(100)
        .eq('video_id', video.id)
        ;
      if (error) {
        console.error('[ReelCard] fetchComments supabase error:', error);
      } else if (data) {
        const mapped = data.map((c: any) => ({ ...c, user: c.users || null }));
        setComments(mapped);
        setCommentsCount(mapped.length);
      }
    } catch (e) {
      console.error('[ReelCard] fetchComments error:', e);
    } finally {
      setCommentLoading(false);
    }
  };

  // Prefetch comments when this card becomes active so modal opens faster
  useEffect(() => {
    if (!video?.id) return;
    if (isActive && comments.length === 0 && !commentLoading) {
      // fire-and-forget; fetchComments manages its own loading state
      fetchComments().catch(err => console.error('[ReelCard] prefetchComments error:', err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  // Realtime subscription for comments on this video
  useEffect(() => {
    if (!video?.id) return;
    try {
      // Create a channel for this video's comments
      const channel = supabase.channel(`studio-video-comments-${video.id}`);
      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'studio_video_comments', filter: `video_id=eq.${video.id}` },
        (payload: any) => {
          // Append new comment and increment count
          const newComment = { ...payload.new, user: payload.new.users || null };
          setComments(prev => {
            // Avoid duplicates
            if (prev.some(c => String(c.id) === String(newComment.id))) return prev;
            return [...prev, newComment];
          });
          setCommentsCount(c => (c || 0) + 1);
        }
      );
      channel.subscribe();
      commentChannelRef.current = channel;
    } catch (e) {
      console.error('[ReelCard] realtime subscription error:', e);
    }

    return () => {
      if (commentChannelRef.current) {
        supabase.removeChannel(commentChannelRef.current);
        commentChannelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?.id]);

  // 360 eligibility check removed from ReelCard; move gating to the Record page if needed.

  // Open comments modal and load comments
  const handleOpenComments = () => {
    // pause the video when opening comments
    try {
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    } catch (e) {
      console.warn('[ReelCard] Failed to pause video when opening comments', e);
    }
    setShowComments(true);
    setTimeout(fetchComments, 0);
  };

  const handleCloseComments = () => {
    // simply close the comments modal and let the user control playback explicitly
    setShowComments(false);
  };

  // Compute a friendly creator object to display: prefer video.creator, then channel name,
  // then fall back to the logged-in user if this reel belongs to them, otherwise Unknown.
  const displayCreator = ((): { name: string; avatar_url?: string } => {
    // 1) Prefer explicit creator object populated server-side
    if (video.creator && video.creator.name) return { name: video.creator.name, avatar_url: video.creator.avatar_url };
    // 2) Next prefer a channel name if present
    if (video.channel_name) return { name: video.channel_name };
    // 3) If the logged-in user appears to be the owner, use their username (try several id locations)
    const candidateUserIds = [userData?.id, userData?.user_metadata?.id, userData?.sub, userData?.user_metadata?.sub];
    const ownerId = video.user_id || video.creator_id || null;
    if (userData && ownerId && candidateUserIds.some(id => id && String(id) === String(ownerId))) {
      return { name: userData.username || userData?.user_metadata?.username || 'You', avatar_url: userData.avatar_url || userData?.user_metadata?.avatar_url };
    }
    // 4) Last resort, unknown
    return { name: 'Unknown' };
  })();

  // Post a new comment
  const handlePostComment = async () => {
    const userId = userData?.id || userData?.user_metadata?.id;
    const userDisplayName = userData?.username || (userData?.user_metadata && userData.user_metadata.username) || 'Someone';
    const commentText = newComment.trim();
    if (!userId || !commentText || !supabase) return;
    setPosting(true);
    try {
      // Insert the comment and request the generated id so we can reference it
      const { data: commentData, error: commentError } = await supabase
        .from('studio_video_comments')
        .insert({
          user_id: userId,
          video_id: video.id,
          comment: commentText,
        })
        .select('id')
        .single();

      if (!commentError && commentData) {
        setNewComment('');
        // optimistic update of comment count then refresh
        setCommentsCount(c => (c || 0) + 1);
        fetchComments();

        // Create a notification server-side via the backend route so we don't rely on client RLS rules
        try {
          const recipientId = video.user_id || video.creator_id || null;
          if (recipientId && String(recipientId) !== String(userId)) {
            // POST to our backend which will call Supabase with the service role key
            const resp = await fetch('/api/notifications/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_id: recipientId,
                actor_id: userId,
                type: 'comment',
                title: `${userDisplayName} commented`,
                message: commentText.slice(0, 240),
                action_id: commentData.id,
                target_table: 'studio_video_comments',
                data: {
                  comment_id: commentData.id,
                  video_id: video.id,
                  commenter_id: userId,
                }
              })
            });
            if (!resp.ok) {
              const txt = await resp.text().catch(() => '');
              console.error('[ReelCard] notification create failed', resp.status, txt);
            }
          }
        } catch (nErr) {
          // log but don't block the user experience
          console.error('[ReelCard] failed to create notification via server', nErr);
        }
      }
    } finally {
      setPosting(false);
    }
  };

  // Keep local commentsCount in sync if parent video prop updates
  useEffect(() => {
    setCommentsCount(video.comments_count ?? (comments.length || 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.id, video.comments_count]);

  // Animated comment display logic - cycle through comments every 12 seconds
  useEffect(() => {
    if (!isMobile || comments.length === 0) return;
    const commentCycle = () => {
      setShowComment(true);
      setTimeout(() => {
        setShowComment(false);
        setTimeout(() => {
          setCommentIndex(prev => (prev + 1) % comments.length);
        }, 500);
      }, 12000);
    };
    commentCycle();
    const interval = setInterval(commentCycle, 13000);
    return () => clearInterval(interval);
  }, [isMobile, comments]);

  // Outro logic: show overlay and play sound at end of reel (all devices)
  useEffect(() => {
    if (!videoRef.current) return;
    const handleEnded = () => {
      console.log('[ReelCard] Video ended, showing outro overlay');
      setShowOutro(true);
      if (outroAudioRef.current) {
        outroAudioRef.current.currentTime = 0;
        const playPromise = outroAudioRef.current.play();
        if (playPromise && playPromise.catch) {
          playPromise.catch(e => {
            console.warn('[ReelCard] Outro audio play error:', e);
            if (e.name === 'NotAllowedError') {
              console.warn('[ReelCard] Audio autoplay was blocked by the browser.');
            } else if (e.name === 'NotFoundError') {
              console.warn('[ReelCard] Outro audio file not found at /whistle.mp3');
            }
          });
        }
      } else {
        console.warn('[ReelCard] Outro audio element not found!');
      }
      setTimeout(() => {
        setShowOutro(false);
        // Only restart video after outro overlay is hidden
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.currentTime = 0;
            videoRef.current.play();
          }
        }, 100); // slight delay to ensure outro overlay is gone
      }, 3000);
    };
    const vid = videoRef.current;
    vid.addEventListener('ended', handleEnded);
    return () => {
      vid.removeEventListener('ended', handleEnded);
    };
  }, [video.id]);

  // Autoplay/pause depending on active status and mobile
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (isActive && !userPaused) {
      // Attempt to unmute on both desktop and mobile when active.
      // Browsers may block autoplay with sound; if so, fall back to muted playback.
      try {
        videoEl.muted = false;
        setIsMuted(false);
      } catch (e) {
        console.warn('[ReelCard] Could not set muted=false directly', e);
      }

      videoEl
        .play()
        .then(() => {
          setIsPlaying(true);
          onView(video.id);
        })
        .catch((err) => {
          console.warn('[ReelCard] Autoplay with sound blocked or failed, falling back to muted playback:', err);
          try {
            videoEl.muted = true;
            setIsMuted(true);
            videoEl.play().then(() => {
              setIsPlaying(true);
              onView(video.id);
            }).catch((err2) => {
              console.error('[ReelCard] Muted playback also failed:', err2);
            });
          } catch (e2) {
            console.error('[ReelCard] Error during muted fallback playback:', e2);
          }
        });
    } else if (!isActive) {
      videoEl.pause();
      videoEl.currentTime = 0;
      setIsPlaying(false);
    }
  }, [isActive, video.id, onView, isMobile]);

  // Track progress and persist playback position
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    // Restore playback position if available
    const storageKey = `reelcard_video_time_${video.id}`;
    const savedTime = Number(localStorage.getItem(storageKey));
    if (!isNaN(savedTime) && savedTime > 0 && videoEl.currentTime < 1) {
      videoEl.currentTime = savedTime;
    }

    const updateProgress = () => {
      if (videoEl.duration > 0) {
        setProgress((videoEl.currentTime / videoEl.duration) * 100);
        setSeekValue(videoEl.currentTime);
        // Save current time to localStorage
        localStorage.setItem(storageKey, String(videoEl.currentTime));
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      videoEl.currentTime = 0;
      localStorage.setItem(storageKey, '0');
    };

    videoEl.addEventListener("timeupdate", updateProgress);
    videoEl.addEventListener("ended", handleEnded);

    // Save on pause/unmount
    const saveOnPause = () => {
      localStorage.setItem(storageKey, String(videoEl.currentTime));
    };
    videoEl.addEventListener("pause", saveOnPause);

    return () => {
      videoEl.removeEventListener("timeupdate", updateProgress);
      videoEl.removeEventListener("ended", handleEnded);
      videoEl.removeEventListener("pause", saveOnPause);
      // Save on unmount
      localStorage.setItem(storageKey, String(videoEl.currentTime));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.id]);

  const handleVideoClick = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
      setUserPaused(true);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
      setUserPaused(false);
    }
  };


  // (mute toggle removed here because the action button now controls play/pause)

  // Toggle play/pause when user clicks the action button
  const handlePlayPauseToggle = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      // Prefer the actual element state to avoid out-of-sync state vars
      if (!v.paused && !v.ended) {
        v.pause();
        setIsPlaying(false);
        setUserPaused(true);
      } else {
        const playPromise = v.play();
        if (playPromise && (playPromise as Promise<any>).then) {
          await playPromise;
        }
        // Reflect actual element state after attempting play
        setIsPlaying(!v.paused && !v.ended);
        setUserPaused(false);
        try { onView(video.id); } catch (e) { /* ignore */ }
      }
    } catch (err) {
      console.error('[ReelCard] play/pause toggle error:', err);
    }
  };

  // Keep DOM video muted property in sync with isMuted
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);


  const formatCount = (count: number) => {
    if (count < 1000) return count.toString();
    if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
    return `${(count / 1000000).toFixed(1)}M`;
  };

  // small helper to compute days since a date
  const daysSince = (maybeDate?: string | Date | null): number | null => {
    if (!maybeDate) return null;
    const d = typeof maybeDate === 'string' ? new Date(maybeDate) : new Date(maybeDate as Date);
    if (Number.isNaN(d.getTime())) return null;
    const diffDays = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 ? diffDays : null;
  };

  const formatDaysAgo = (maybeDate?: string | Date | null) => {
    const ds = daysSince(maybeDate);
    if (ds === null) return null;
    if (ds === 0) return 'Premiered: today';
    if (ds === 1) return 'Premiered: 1 day ago';
    return `Premiered: ${ds} days ago`;
  };

  const premieredSource = (video as any)?.published_at || (video as any)?.publishedAt || (video as any)?.created_at || (video as any)?.createdAt || null;
  const premieredDays = daysSince(premieredSource as string | Date | null);
  const premieredLabel = formatDaysAgo(premieredSource as string | Date | null);

  // Format time as mm:ss
  function formatTime(s: number) {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  return (
    <div
      className={cn(
        "relative w-full bg-black overflow-hidden",
        isMobile ? "h-screen" : "h-[600px] max-w-[350px] mx-auto rounded-lg"
      )}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Outro overlay and sound (all devices, forced z-index and pointer-events) */}
      {showOutro && (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-black/90 z-[9999] animate-fade-in" style={{pointerEvents:'all'}}>
          <div className="flex flex-col items-center animate-scale-in">
            <div className="relative mb-4">
              <div className="w-20 h-20 flex items-center justify-center">
                <img
                  src="/lovable-uploads/3e6633e4-a22d-4a00-aae1-4e8ac1c93c03.png"
                  alt="Brand Logo"
                  style={{
                    width: 64,
                    height: 64,
                    objectFit: 'contain',
                    filter: 'none',
                    boxShadow: 'none',
                    background: 'none',
                    borderRadius: 0,
                    opacity: 1,
                    display: 'block'
                  }}
                />
              </div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-black/80 px-2 py-0.5 rounded-full text-xs text-white font-semibold border border-white shadow">
                @{video.creator?.name || 'author'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile-only: Animated comment display (fade in/out, 12s per comment) */}
      {isMobile && comments.length > 0 && showComment && (
        <div className="absolute left-1/2 bottom-32 z-30 -translate-x-1/2 w-[90%] max-w-xs text-center pointer-events-none" style={{ background: 'none', boxShadow: 'none', backdropFilter: 'none', transition: 'none', opacity: 1 }}>
          <div className="bg-black/70 px-4 py-3 rounded-xl text-white text-base font-medium shadow-lg animate-fade-in">
            {comments[commentIndex]?.comment}
            <div className="mt-2 text-xs text-gray-300">— @{comments[commentIndex]?.user?.username || 'user'}</div>
          </div>
        </div>
      )}

      {/* Hidden audio element for outro sound */}
      <audio ref={outroAudioRef} src="/whistle.mp3" preload="auto" />
      
      {/* Left studio tools */}
          <div className="absolute top-1/2 left-4 flex flex-col items-center gap-4 -translate-y-1/2 z-20">
            <button
              className="bg-gray-900 bg-opacity-70 p-2 rounded-full hover:bg-purple-600 transition text-white shadow-lg backdrop-blur-md"
              onClick={() => navigate("/studio/upload")}
            >
              <Plus className="h-5 w-5" />
            </button>

            {/* Recording button: navigate straight to the Record page (90s default) */}
            <div className="relative">
              <button
                className="bg-gray-900 bg-opacity-70 p-2 rounded-full hover:bg-purple-600 transition text-white shadow-lg backdrop-blur-md"
                onClick={() => navigate('/studio/record?duration=90')}
                aria-label="Record"
              >
                <VideoIcon className="h-5 w-5" />
              </button>
            </div>

            {!hideLive && ENABLE_LIVE && (
              <button
                className="bg-gray-900 bg-opacity-70 p-2 rounded-full hover:bg-purple-600 transition text-white shadow-lg backdrop-blur-md"
                onClick={() => navigate('/studio/live')}
              >
                <Radio className="h-5 w-5" />
              </button>
            )}
            <button
              className="bg-gray-900 bg-opacity-70 p-2 rounded-full hover:bg-purple-600 transition text-white shadow-lg backdrop-blur-md"
              onClick={() => navigate("/studio/settings")}
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>

      {/* Video */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover cursor-pointer"
        onClick={handleVideoClick}
        muted={isMuted}
        playsInline
      >
        <source src={video.video_url} type="video/mp4" />
        Your browser does not support video playback.
      </video>


    {/* Right side actions */}
  <div className="absolute right-2 bottom-40 flex flex-col gap-6">
        {/* Avatar + ProfileModal + Channel/Subscriber badges */}
        <ProfileModal
          creator={displayCreator}
          channelName={video.channel_name}
          subscriberCount={video.subscriber_count || 0}
          isFollowing={isFollowing}
          onFollow={() => onFollow(video.creator_id || "")}
        >
          <button className="flex flex-col items-center gap-1 group mt-0 mb-2">
            <Avatar className="h-12 w-12 border-2 border-white/20">
              <AvatarImage src={video.creator?.avatar_url} alt={video.creator?.name || 'User'} />
              <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                {(displayCreator.name || 'U').slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {/* Slim, small username badge closely stacked under avatar */}
            <Badge className="-mt-1 px-3 py-0.5 rounded-full bg-purple-700/90 text-white text-[11px] font-medium shadow border border-purple-400/40">
              @{displayCreator.name || 'unknown'}
            </Badge>
            {/* Channel and subscriber badges stacked below username badge */}
            <div className="flex flex-col items-center gap-1 mt-2 w-full">
              {video.channel_name && (
                <Badge variant="secondary" className="text-[11px] bg-white/20 text-white border-white/30 px-3 py-1 rounded-full w-fit">
                  {video.channel_name}
                </Badge>
              )}
              <Badge variant="outline" className="text-[11px] bg-transparent text-white border-white/30 flex items-center gap-1 px-3 py-1 rounded-full w-fit">
                <Users className="h-3 w-3 mr-1" />
                {video.subscriber_count ? video.subscriber_count.toLocaleString() : '0'}
              </Badge>
            </div>
          </button>
        </ProfileModal>

        {/* Action Icons: Like, Comment, Share, View - Capsule Badges */}
        <div className="flex flex-col items-center gap-2">
          <Badge className="flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 text-white text-[10px] font-medium min-w-[48px] justify-center">
            <Button
              onClick={() => onLike(video.id)}
              size="icon"
              variant="ghost"
              className="w-5 h-5 p-0 bg-transparent hover:bg-black/30"
              aria-label="Like"
            >
              <Heart className={cn("w-4 h-4", isLiked ? "fill-red-500 text-red-500" : "text-white")}/>
            </Button>
            {formatCount(video.likes_count ?? 0)}
          </Badge>
          <Badge className="flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 text-white text-[10px] font-medium min-w-[48px] justify-center">
            <Button
              size="icon"
              variant="ghost"
              className="w-5 h-5 p-0 bg-transparent hover:bg-black/30"
              onClick={handleOpenComments}
              aria-label="Comments"
            >
              <MessageCircle className="w-4 h-4 text-white" />
            </Button>
            {formatCount(commentsCount ?? video.comments_count ?? comments.length ?? 0)}
          </Badge>
          <Badge className="flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 text-white text-[10px] font-medium min-w-[48px] justify-center">
              <Button
                onClick={() => {
                  setShowShareModal(true);
                  try { onShare(video.id); } catch (e) { /* ignore */ }
                }}
                size="icon"
                variant="ghost"
                className="w-5 h-5 p-0 bg-transparent hover:bg-black/30"
                aria-label="Share"
              >
                <Share className="w-4 h-4 text-white" />
              </Button>
            {formatCount(video.shares_count ?? 0)}
          </Badge>
          <Badge className="flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 text-white text-[10px] font-medium min-w-[48px] justify-center">
            <Eye className="w-4 h-4 text-white" />
            {formatCount(video.views_count ?? video.views ?? 0)}
          </Badge>
          <Button
            onClick={(e) => { e.stopPropagation(); handlePlayPauseToggle(); }}
            type="button"
            size="icon"
            variant="ghost"
            className="w-12 h-12 rounded-full bg-black/20 hover:bg-black/40 mt-2"
            aria-label="Play/Pause"
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 text-white" />
            ) : (
              <Play className="w-6 h-6 text-white" />
            )}
          </Button>
        </div>
      </div>

      {/* Info overlay */}
      <div className={cn(
        "absolute left-3 right-16 text-white",
        isMobile ? "bottom-24" : "bottom-4"
      )}>
        {/* Original audio */}
        <div className="flex items-center gap-1 text-xs opacity-80 mb-2">
          <span>🎵</span>
          <span>Original audio by @{video.creator?.name || "creator"}</span>
        </div>
        {/* Progress bar directly under original audio, full width, duration below */}
        <div className="w-full flex flex-col items-center justify-center mb-2" style={{position:'relative', zIndex:30, padding:0, margin:0}}>
          <input
            type="range"
            min={0}
            max={videoRef.current?.duration || 0}
            step={0.01}
            value={seeking ? seekValue : (videoRef.current?.currentTime || 0)}
            onChange={e => {
              setSeeking(true);
              setSeekValue(Number(e.target.value));
            }}
            onMouseUp={() => {
              if (videoRef.current) {
                videoRef.current.currentTime = seekValue;
              }
              setSeeking(false);
            }}
            onTouchEnd={() => {
              if (videoRef.current) {
                videoRef.current.currentTime = seekValue;
              }
              setSeeking(false);
            }}
            className="w-full h-1 accent-purple-500 bg-white/30 rounded-lg cursor-pointer"
            style={{
              background: `linear-gradient(to right, #a78bfa 0%, #a78bfa ${progress}%, #fff3 ${progress}%, #fff3 100%)`,
              appearance: 'none',
              height: '4px',
              borderRadius: '2px',
              outline: 'none',
              margin: 0,
              padding: 0,
              boxShadow: '0 2px 8px 0 #0008',
              width: '100vw',
              maxWidth: '100%',
              left: 0,
              right: 0,
            }}
          />
          <div className="w-full flex justify-between mt-1" style={{paddingLeft:0, paddingRight:0}}>
            <span className="text-[10px] text-white/60 select-none">
              {formatTime(videoRef.current?.currentTime || 0)}
            </span>
            <span className="text-[10px] text-white/60 select-none">
              {formatTime(videoRef.current?.duration || 0)}
            </span>
          </div>
        </div>
        {video.title && (
          <h3 className="font-semibold text-sm mb-1 line-clamp-2">
            {video.title}
          </h3>
        )}
        {video.description && (
          <p className="text-sm opacity-90 line-clamp-2 mb-2">
            {video.description}
          </p>
        )}
      </div>

      {/* Play overlay (clickable on desktop) */}
      {showControls && !isPlaying && !isMobile && (
        <div 
          className="absolute inset-0 flex items-center justify-center cursor-pointer"
          onClick={handleVideoClick}
          style={{ zIndex: 30 }}
        >
          <div className="w-16 h-16 bg-black/50 rounded-full flex items-center justify-center">
            <div className="w-0 h-0 border-l-[12px] border-l-white border-y-[8px] border-y-transparent ml-1" />
          </div>
        </div>
      )}
      {/* Comment Modal/Panel - Instagram style slide up from bottom (modular) */}
      <CommentsSection
        show={showComments}
        onClose={handleCloseComments}
        comments={comments}
        commentLoading={commentLoading}
        newComment={newComment}
        posting={posting}
        userData={userData}
        setNewComment={setNewComment}
        handlePostComment={handlePostComment}
        premieredDays={premieredDays}
        premieredLabel={premieredLabel}
        viewerCount={video.views_count ?? video.views}
        likeCount={video.likes_count ?? 0}
        commentsCount={commentsCount}
      />
      <VideoShareModal show={showShareModal} onClose={() => setShowShareModal(false)} videoUrl={video.video_url} videoId={video.id} title={video.title} />
    </div>
  );
}