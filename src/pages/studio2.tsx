// Animated comment display logic should be placed inside the ReelCard component only ONCE.
// Remove all duplicate declarations from the top-level scope.
import React, { useState, useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
// Custom outro animation styles for TikTok/Instagram style
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
// --- Monetized Series Feature ---
// Implements wallet-based purchase of series using Supabase RPC (transfer_series_payment)
// and records purchases in series_purchases table. See onBuySeries handler for details.
// --------------------------------

// (duplicate import removed)
// import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Video, Radio, Settings as SettingsIcon, UserCheck, Heart, Eye, Grid3x3, Cpu, Smile, GraduationCap, Lightbulb, Music, Gamepad2, Utensils, Dumbbell, Camera, Palette, Trophy, MessageCircle } from 'lucide-react';
import { Volume2, VolumeX } from 'lucide-react';
// Type-only import for ffmpeg
// @ts-ignore
import type { FFmpegModule } from '../types/ffmpeg';
import { useToast } from '@/hooks/use-toast';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useNavigate } from 'react-router-dom';
import { Switch } from '@/components/ui/switch';
// import { useTheme } from 'next-themes';
// import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
// import { Badge } from '@/components/ui/badge';

// Categories with icons
const categories = [
  { name: 'All', icon: Grid3x3 },
  { name: 'Tech', icon: Cpu },
  { name: 'Comedy', icon: Smile },
  { name: 'Sports', icon: Trophy },
  { name: 'Education', icon: GraduationCap },
  { name: 'Inspiration', icon: Lightbulb },
  { name: 'Music', icon: Music },
  { name: 'Gaming', icon: Gamepad2 },
  { name: 'Food', icon: Utensils },
  { name: 'Fitness', icon: Dumbbell },
  { name: 'Lifestyle', icon: Camera },
  { name: 'Art', icon: Palette },
];

function ReelCard({ video, onLike, onView, userLikes, onSubscribe, isSubscribed, subscriberCount, mobile, ownedSeries, onBuySeries, userData, creatorData, isDesktop }: { 
  video: any, 
  onLike: (id: string) => void, 
  onView: (id: string) => void,
  userLikes: Set<string>,
  onSubscribe: (channelId: string, subscribed: boolean) => void,
  isSubscribed: boolean,
  subscriberCount: number,
  mobile?: boolean,
  ownedSeries?: Set<string>, // set of series_title user owns
  onBuySeries?: (seriesTitle: string, authorId: string, price: number) => void,
  userData?: any, // logged in user data
  creatorData?: any, // creator data for this specific video
  isDesktop: boolean
}) {
  // Outro overlay state (must be inside the component)
  const [showOutro, setShowOutro] = useState(false);
  const outroAudioRef = React.useRef<HTMLAudioElement | null>(null);
  // On mobile, unmuted by default; on desktop, muted by default
  const [isMuted, setIsMuted] = useState(() => isDesktop);
  const navigate = useNavigate();
  const [showBuyPrompt, setShowBuyPrompt] = useState(false);
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentLoading, setCommentLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);

  // Animated comment display state
  const [showComment, setShowComment] = useState(false);
  const [commentIndex, setCommentIndex] = useState(0);

  // Resume playback logic
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  // Save playback position and playing state on every timeupdate and play/pause
  useEffect(() => {
    const savePlayback = () => {
      if (videoRef.current && video.id) {
        localStorage.setItem(`studio_playback_${video.id}`, String(videoRef.current.currentTime));
      }
    };
    const savePlaying = () => {
      if (videoRef.current && video.id) {
        localStorage.setItem(`studio_playing_${video.id}`, videoRef.current.paused ? 'false' : 'true');
      }
    };
    if (videoRef.current) {
      videoRef.current.addEventListener('timeupdate', savePlayback);
      videoRef.current.addEventListener('play', savePlaying);
      videoRef.current.addEventListener('pause', savePlaying);
    }
    return () => {
      if (videoRef.current) {
        videoRef.current.removeEventListener('timeupdate', savePlayback);
        videoRef.current.removeEventListener('play', savePlaying);
        videoRef.current.removeEventListener('pause', savePlaying);
      }
    };
  }, [video.id]);

  // Restore playback position and playing state on mount/tab focus
  useEffect(() => {
    const restorePlayback = () => {
      if (videoRef.current && video.id) {
        const saved = localStorage.getItem(`studio_playback_${video.id}`);
        if (saved) {
          videoRef.current.currentTime = Number(saved);
        }
        const wasPlaying = localStorage.getItem(`studio_playing_${video.id}`);
        if (wasPlaying === 'true') {
          // Try to play (may require user gesture depending on browser)
          videoRef.current.play().catch(() => {});
        }
      }
    };
    restorePlayback();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        restorePlayback();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [video.id]);

  // Animated comment display logic - cycle through comments every 12 seconds
  useEffect(() => {
    if (!mobile || comments.length === 0) return;

    const commentCycle = () => {
      setShowComment(true);
      setTimeout(() => {
        setShowComment(false);
        setTimeout(() => {
          setCommentIndex(prev => (prev + 1) % comments.length);
        }, 500); // Wait for fade out before changing comment
      }, 12000); // Show for 12 seconds
    };

    // Start immediately
    commentCycle();
    
    // Set up interval for cycling
    const interval = setInterval(commentCycle, 13000); // 12s show + 1s transition

    return () => clearInterval(interval);
  }, [mobile, comments]);

  // For portal rendering
  // Fetch comments for this video
  const fetchComments = async () => {
    setCommentLoading(true);
    try {
      // Use correct PostgREST join syntax for related users table
      const { data, error } = await supabase
        .from('studio_video_comments')
        .select('id, user_id, comment, created_at, users:user_id(id,username,avatar_url)')
        .eq('video_id', video.id)
        .order('created_at', { ascending: false });
      if (!error && data) {
        setComments(data.map(c => ({ ...c, user: c.users })));
      }
    } catch (e) {
      // ignore
    }
    setCommentLoading(false);
  };

  // Open comments modal and load comments
  const handleOpenComments = () => {
    setShowComments(true);
    // Fetch comments after modal is shown for better UX
    setTimeout(fetchComments, 0);
  };

  // Post a new comment
  const handlePostComment = async () => {
    if (!userData || !newComment.trim()) return;
    setPosting(true);
    try {
      const { error } = await supabase
        .from('studio_video_comments')
        .insert({
          user_id: userData.id,
          video_id: video.id,
          comment: newComment.trim(),
        });
      if (!error) {
        setNewComment('');
        fetchComments();
      }
    } finally {
      setPosting(false);
    }
  };
  // videoRef already declared above, do not redeclare
  const [progress, setProgress] = useState(0); // 0 to 1
  const [duration, setDuration] = useState(0);
  const [seekPreview, setSeekPreview] = useState<{ x: number, percent: number } | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const previewVideoRef = React.useRef<HTMLVideoElement | null>(null);

  // Ensure mute state is synced with device type and button
  React.useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Track video progress and duration
  React.useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const handleTimeUpdate = () => {
      setProgress(vid.currentTime / (vid.duration || 1));
    };
    const handleLoadedMetadata = () => {
      setDuration(vid.duration || 0);
    };
    vid.addEventListener('timeupdate', handleTimeUpdate);
    vid.addEventListener('loadedmetadata', handleLoadedMetadata);
    return () => {
      vid.removeEventListener('timeupdate', handleTimeUpdate);
      vid.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [video.id]);

  // Set initial mute state on mount and when device type changes
  React.useEffect(() => {
    setIsMuted(isDesktop);
    if (videoRef.current) {
      videoRef.current.muted = isDesktop;
    }
  }, [isDesktop, video.id]);

  // On desktop, do not autoplay. On mobile, autoplay when in view.
  React.useEffect(() => {
    if (!videoRef.current) return;
    if (isDesktop) {
      // Pause and mute on desktop by default
      videoRef.current.pause();
      videoRef.current.muted = true;
      setIsMuted(true);
    } else {
      // On mobile, let IntersectionObserver handle autoplay
    }
  }, [isDesktop, video.id]);

  // Show replay button when video ends
  React.useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
  // Removed replay button logic
  return () => {};
  }, [video.id]);
  const [hasViewed, setHasViewed] = useState(false);
  const viewTimer = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    // Only observe/interact for autoplay if mobile
    if (!mobile) return;
    if (!videoRef.current) return;
    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          if (videoRef.current) {
            videoRef.current.muted = false;
            setIsMuted(false);
            // Only autoplay if not already played
            if (videoRef.current.paused) {
              videoRef.current.play().catch((err) => {
                if (!(err instanceof DOMException && err.name === 'AbortError')) {
                  console.error(err);
                }
              });
            }
          }
          if (!hasViewed && !viewTimer.current) {
            viewTimer.current = setTimeout(() => {
              onView(video.id);
              setHasViewed(true);
              viewTimer.current = null;
            }, 5000);
          }
        } else {
          if (videoRef.current) {
            try {
              videoRef.current.pause();
            } catch (err) {
              if (!(err instanceof DOMException && err.name === 'AbortError')) {
                console.error(err);
              }
            }
            videoRef.current.muted = true;
            setIsMuted(true);
          }
          if (viewTimer.current) {
            clearTimeout(viewTimer.current);
            viewTimer.current = null;
          }
        }
      });
    };
    const observer = new window.IntersectionObserver(handleIntersection, { threshold: 0.6 });
    observer.observe(videoRef.current);
    return () => {
      if (videoRef.current) observer.unobserve(videoRef.current);
      if (viewTimer.current) {
        clearTimeout(viewTimer.current);
        viewTimer.current = null;
      }
    };
  }, [video.id, hasViewed, onView, mobile]);

  const handleVideoClick = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch((err) => {
          if (!(err instanceof DOMException && err.name === 'AbortError')) {
            console.error(err);
          }
        });
      } else {
        try {
          videoRef.current.pause();
        } catch (err) {
          if (!(err instanceof DOMException && err.name === 'AbortError')) {
            console.error(err);
          }
        }
      }
    }
  };

  React.useEffect(() => {
    if (!video.is_series || (ownedSeries && ownedSeries.has(video.series_title))) return;
    if (!videoRef.current) return;
    // Limit playback to 1 minute for non-owners
    const handleTimeUpdate = () => {
      if (videoRef.current && videoRef.current.currentTime >= 60) {
        videoRef.current.pause();
        setShowBuyPrompt(true);
      }
    };
    const vid = videoRef.current;
    vid.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      vid.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [video.is_series, ownedSeries]);

  // Outro logic: show overlay and play sound at end of reel (mobile only)
  React.useEffect(() => {
    if (!mobile || !videoRef.current) return;
    const handleEnded = () => {
      console.log('Video ended, showing outro overlay');
      setShowOutro(true);
      if (outroAudioRef.current) {
        outroAudioRef.current.currentTime = 0;
        outroAudioRef.current.play();
      }
      // Hide outro after 3s, then loop video
      setTimeout(() => {
        setShowOutro(false);
        if (videoRef.current) {
          videoRef.current.currentTime = 0;
          videoRef.current.play();
        }
      }, 3000);
    };
    const vid = videoRef.current;
    vid.addEventListener('ended', handleEnded);
    return () => {
      vid.removeEventListener('ended', handleEnded);
    };
  }, [mobile, video.id]);

  // Seek handler for progress bar
  const handleSeek = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!videoRef.current || !duration) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    videoRef.current.currentTime = percent * duration;
    setProgress(percent);
    setSeekPreview(null);
  };

  // Show preview thumbnail on hover/move
  const handleSeekMove = async (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!duration) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    setSeekPreview({ x, percent });
    // Generate preview image from hidden video
    if (previewVideoRef.current) {
      previewVideoRef.current.currentTime = percent * duration;
      previewVideoRef.current.pause();
      // Wait for seeked event
      previewVideoRef.current.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = previewVideoRef.current!.videoWidth;
        canvas.height = previewVideoRef.current!.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(previewVideoRef.current!, 0, 0, canvas.width, canvas.height);
          setPreviewImage(canvas.toDataURL('image/jpeg'));
        }
      };
    }
  };

  const handleSeekLeave = () => {
    setSeekPreview(null);
    setPreviewImage(null);
  };

  return (
  <div className={`relative w-full ${mobile ? 'h-[100dvh] min-h-[100dvh] max-h-[100dvh] flex items-center justify-center bg-black' : 'flex justify-center items-center py-4 md:py-6 bg-black'}`}>
      {/* Outro overlay and sound (mobile only) */}
      {mobile && showOutro && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-50 animate-fade-in">
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
                @{creatorData?.username || 'author'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile-only: Animated comment display (fade in/out, 12s per comment) */}
      {mobile && comments.length > 0 && showComment && (
  <div className="absolute left-1/2 bottom-32 z-30 -translate-x-1/2 w-[90%] max-w-xs text-center pointer-events-none" style={{ background: 'none', boxShadow: 'none', backdropFilter: 'none', transition: 'none', opacity: 1 }}>
          <div className="bg-black/70 px-4 py-3 rounded-xl text-white text-base font-medium shadow-lg animate-fade-in">
            {comments[commentIndex]?.comment}
            <div className="mt-2 text-xs text-gray-300">— @{comments[commentIndex]?.user?.username || 'user'}</div>
          </div>
        </div>
      )}
      
      {/* Hidden audio element for outro sound */}
      {mobile && <audio ref={outroAudioRef} src="/whistle.mp3" preload="auto" />}
      <div className={
        mobile
          ? 'w-full h-full flex items-center justify-center'
          : 'w-full flex justify-center items-center'
      }>
  <div className="w-full relative" style={{ minHeight: mobile ? 'calc(100dvh - 60px)' : undefined }}>
          <video
            ref={videoRef}
            src={video.video_url}
            poster={video.thumbnail_url || undefined}
            muted={isMuted}
            controls={!!ownedSeries}
            // Only loop for owned series (desktop or purchased)
            loop={!!ownedSeries && !mobile}
            disablePictureInPicture
            playsInline
            webkit-playsinline="true"
            x5-playsinline="true"
            preload="metadata"
            crossOrigin="anonymous"
            className={
              mobile
                ? 'w-full h-full min-h-[100dvh] max-h-[100dvh] min-w-[100vw] max-w-[100vw] object-cover object-center aspect-[9/16] bg-black'
                : 'w-full max-w-xs md:max-w-lg lg:max-w-xl xl:max-w-2xl max-h-[50vh] md:max-h-[60vh] rounded-xl object-contain bg-black aspect-video shadow-lg'
            }
            onClick={handleVideoClick}
            onError={e => {
              console.error('Safari reel playback error:', e);
              // Try reloading once
              setTimeout(() => {
                const videoEl = e.target as HTMLVideoElement;
                if (videoEl && typeof videoEl.load === 'function') {
                  videoEl.load();
                }
              }, 100);
            }}
          >
            <source src={video.video_url} type="video/mp4" />
            <source src={video.video_url} type="video/webm" />
            Your browser does not support the video tag.
          </video>
          {/* Hidden preview video for thumbnail generation */}
          <video
            ref={previewVideoRef}
            src={video.video_url}
            style={{ display: 'none' }}
            preload="auto"
          />
          {/* Progress bar below video (always visible, fixed position) - desktop thick bar removed */}
        </div>
      </div>

      {/* Desktop: Profile avatar/username on the left, volume icon on the right, both top-aligned. Mobile: stacked as before. */}
      {isDesktop ? (
        <>
          {creatorData && (
            <button
              onClick={() => setShowProfilePopup(true)}
              className="absolute left-6 top-4 bg-gray-900/80 px-2 py-1 rounded-full text-xs text-white font-semibold flex items-center gap-2 z-30 backdrop-blur-md hover:bg-gray-800/90 transition-colors"
            >
              <img 
                src={creatorData.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + creatorData.username} 
                alt={creatorData.username}
                className="w-4 h-4 rounded-full"
              />
              <span>{creatorData.username}</span>
            </button>
          )}
          <button
            className="absolute right-6 top-4 bg-black bg-opacity-60 rounded-full p-2 z-30 hover:bg-opacity-80"
            onClick={() => {
              setIsMuted(m => {
                if (videoRef.current) videoRef.current.muted = !m;
                return !m;
              });
            }}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="h-6 w-6 text-white" /> : <Volume2 className="h-6 w-6 text-white" />}
          </button>
        </>
      ) : (
        <>
          {/* Mobile: Volume/Mute Toggle - moved further down to avoid header and icon overlap */}
          <button
            className="absolute right-4 bg-black bg-opacity-60 rounded-full p-2 z-30 hover:bg-opacity-80"
            style={{ top: 96 }}
            onClick={() => {
              setIsMuted(m => {
                if (videoRef.current) videoRef.current.muted = !m;
                return !m;
              });
            }}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="h-6 w-6 text-white" /> : <Volume2 className="h-6 w-6 text-white" />}
          </button>
          {/* Mobile: Author badge - moved further down to avoid header and icon overlap */}
          {creatorData && (
            <button
              onClick={() => setShowProfilePopup(true)}
              className="absolute left-4 bg-gray-900/80 px-2 py-1 rounded-full text-xs text-white font-semibold flex items-center gap-2 z-30 backdrop-blur-md hover:bg-gray-800/90 transition-colors"
              style={{ top: 96 }}
            >
              <img 
                src={creatorData.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + creatorData.username} 
                alt={creatorData.username}
                className="w-4 h-4 rounded-full"
              />
              <span>{creatorData.username}</span>
            </button>
          )}
        </>
      )}

  {/* Watch Again button removed as requested */}
      {/* Profile Popup Modal */}
      {showProfilePopup && creatorData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40" onClick={() => setShowProfilePopup(false)}>
          <div
            className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 w-80 relative"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex flex-col items-center">
              <img
                src={creatorData.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + creatorData.username}
                alt={creatorData.username}
                className="w-16 h-16 rounded-full mb-2"
              />
              <span>{creatorData.username}</span>
              <div className="text-gray-500 dark:text-gray-400 text-sm mb-1">@{creatorData.username}</div>
              {userData && userData.id !== video.user_id && (
                <Button
                  size="sm"
                  variant={isSubscribed ? 'outline' : 'default'}
                  onClick={() => onSubscribe(video.channel_id, isSubscribed)}
                  className="mt-2"
                >
                  {isSubscribed ? 'Following' : 'Follow'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

     {/* Desktop and Mobile: channel badge, subscriber button, and original audio on same line */}
{video.channel_name && (
  <div className={`absolute z-30 flex flex-col items-start gap-2 ${
    isDesktop ? 'left-6 right-6 bottom-8' : 'left-4 right-4 bottom-24'
  }`}>
    {/* Channel badge, subscriber button, and original audio on same line */}
    <div className="flex items-center justify-between w-full">
      {/* Left side: Channel badge and subscriber button */}
      <div className="flex items-center gap-2">
        <button
          className="px-2 py-1 rounded-full text-xs text-white font-semibold flex items-center gap-2 backdrop-blur-md transition-colors"
          style={{ background: 'linear-gradient(90deg, #6836beff 0%, #241258ff 100%)' }} // purple gradient
        >
          <Video className="h-4 w-4" />
          <span>{video.channel_name}</span>
        </button>
        <button
          className={`px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-2 backdrop-blur-md transition-colors
            ${isSubscribed ? 'bg-gray-900/80 text-white hover:bg-gray-800/90' : 'bg-green-600 text-white hover:bg-green-700'}`}
          disabled={isSubscribed}
          onClick={() => {
            if (!isSubscribed && userData) {
              onSubscribe(video.channel_id, isSubscribed);
            }
          }}
          style={{ cursor: isSubscribed ? 'default' : 'pointer', minWidth: 60 }}
        >
          <UserCheck className="h-3 w-3" />
          <span className="text-xs">{subscriberCount}</span>
          {!isSubscribed && (
            <span className="ml-1 text-[10px] font-normal" style={{ fontSize: '9px' }}>Subscribe</span>
          )}
        </button>
      </div>

      {/* Right side: Original audio with marquee effect */}
      {creatorData?.username && (
        <div
          className="px-3 py-1 rounded-full text-xs text-white font-semibold flex items-center gap-1 shadow-lg max-w-[160px] overflow-hidden"
          style={{ background: 'linear-gradient(90deg, #d343bbff 0%, #a31981ff 100%)' }}
        >
          <Music className="h-3 w-3 flex-shrink-0" />
          <div className="overflow-hidden relative w-full" style={{ height: '20px' }}>
            <span
              className={creatorData.username.length > 15 ? 'animate-marquee' : ''}
              style={{
                whiteSpace: 'nowrap',
                minWidth: '100%',
              }}
            >
              Original audio by @{creatorData.username}
            </span>
          </div>
        </div>
      )}
    </div>
    
    {/* Full width progress bar */}
    <div className="w-full flex flex-col items-center mt-2" style={{ position: 'relative' }}>
      {seekPreview && previewImage && (
        <div
          style={{ position: 'absolute', left: `calc(${seekPreview.percent * 100}% - 40px)`, bottom: '36px', zIndex: 41 }}
        >
          <img
            src={previewImage}
            alt="Preview"
            className="w-20 h-12 object-cover rounded shadow-lg border border-white"
            style={{ background: '#222' }}
          />
        </div>
      )}
      <div
        className="w-full bg-[#7C3AED]/80 rounded-full cursor-pointer relative"
        style={{ height: '1.5px', zIndex: 42 }}
        onClick={e => {
          handleSeek(e);
          if (videoRef.current) videoRef.current.play();
        }}
        onMouseMove={handleSeekMove}
        onMouseLeave={handleSeekLeave}
      >
        <div
          className="rounded-full bg-[#7C3AED] transition-all duration-200"
          style={{ height: '1.5px', width: `${Math.max(2, progress * 100)}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2"
          style={{ left: `calc(${progress * 100}% - 6px)` }}
        >
          <div className="w-3 h-3 bg-[#7C3AED] rounded-full shadow" />
        </div>
      </div>
    </div>
  </div>
)}

      {/* Action buttons - left side */}
      <div className="absolute top-1/2 left-4 flex flex-col items-center gap-4 -translate-y-1/2 z-20">
        <button className="bg-gray-900 bg-opacity-70 p-2 rounded-full hover:bg-purple-600 transition text-white shadow-lg backdrop-blur-md" onClick={() => navigate('/studio/upload')}>
          <Plus className="h-5 w-5" />
        </button>
        <button className="bg-gray-900 bg-opacity-70 p-2 rounded-full hover:bg-purple-600 transition text-white shadow-lg backdrop-blur-md" onClick={() => navigate('/studio/record')}>
          <Video className="h-5 w-5" />
        </button>
        <button className="bg-gray-900 bg-opacity-70 p-2 rounded-full hover:bg-purple-600 transition text-white shadow-lg backdrop-blur-md" onClick={() => navigate('/studio/live')}>
          <Radio className="h-5 w-5" />
        </button>
        <button className="bg-gray-900 bg-opacity-70 p-2 rounded-full hover:bg-purple-600 transition text-white shadow-lg backdrop-blur-md" onClick={() => navigate('/studio/settings')}>
          <SettingsIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Engagement sidebar (heart, comments, views) - right side */}
      <div className="absolute top-1/2 right-2 flex flex-col items-center gap-5 -translate-y-1/2 z-20">
        <button
          className={`bg-gray-900 bg-opacity-70 p-1.5 rounded-full transition text-white shadow-lg flex flex-col items-center ${userLikes.has(video.id) ? 'bg-pink-600 hover:bg-pink-700' : 'hover:bg-pink-600'}`}
          style={{ marginBottom: 2 }}
          onClick={() => onLike(video.id)}
        >
          <Heart className={`h-4 w-4 ${userLikes.has(video.id) ? 'fill-current' : ''}`} />
          <span className="text-[10px] mt-0.5">{video.likes ?? video.likes_count ?? 0}</span>
        </button>
        <button
          className="bg-gray-900 bg-opacity-70 p-1.5 rounded-full text-white shadow-lg flex flex-col items-center hover:bg-blue-600 transition"
          style={{ marginBottom: 2 }}
          onClick={handleOpenComments}
          aria-label="Comments"
        >
          <MessageCircle className="h-4 w-4" />
          <span className="text-[10px] mt-0.5">{video.comments_count ?? comments.length ?? 0}</span>
        </button>
        <div className="bg-gray-900 bg-opacity-70 p-1.5 rounded-full text-white shadow-lg flex flex-col items-center" style={{ marginBottom: 2 }}>
          <Eye className="h-4 w-4" />
          <span className="text-[10px] mt-0.5">{video.views ?? video.views_count ?? 0}</span>
        </div>
        <button
          className="bg-gray-900 bg-opacity-70 p-1.5 rounded-full hover:bg-blue-600 transition text-white shadow-lg flex flex-col items-center"
          style={{ marginBottom: 2 }}
          onClick={async () => {
            const shareUrl = `https://nexsq.com/studio/reel/${video.id}`;
            if (navigator.share) {
              try {
                await navigator.share({
                  title: video.caption || 'Check out this reel!',
                  url: shareUrl
                });
              } catch (e) {}
            } else {
              await navigator.clipboard.writeText(shareUrl);
              alert('Link copied to clipboard!');
            }
          }}
          aria-label="Share"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75A2.25 2.25 0 0014.25 4.5h-4.5A2.25 2.25 0 007.5 6.75v10.5A2.25 2.25 0 009.75 19.5h4.5A2.25 2.25 0 0016.5 17.25v-3.75m-6-3 6-6m0 0l-6 6m6-6v12" />
          </svg>
          <span className="text-[10px] mt-0.5">{video.shares ?? 0}</span>
        </button>
        <button
          className="bg-gray-900 bg-opacity-70 p-1.5 rounded-full hover:bg-green-600 transition text-white shadow-lg flex flex-col items-center"
          style={{ marginBottom: 2 }}
          onClick={async () => {
            // Dynamically import ffmpeg.wasm (fix for dynamic import)
            const ffmpegModule = await import('@ffmpeg/ffmpeg') as import('@/types/ffmpeg').FFmpegModule;
// TODO: Add types for ffmpeg if needed. This import may fail if types are missing.
            const createFFmpeg = ffmpegModule.createFFmpeg;
            const fetchFile = ffmpegModule.fetchFile;
            const ffmpeg = createFFmpeg({ log: true });
            if (!ffmpeg.isLoaded()) await ffmpeg.load();
            // Fetch main video
            const videoData = await fetchFile(video.video_url);
            ffmpeg.FS('writeFile', 'input.mp4', videoData);

            // Generate outro video using canvas (icon + username)
            const canvas = document.createElement('canvas');
            canvas.width = 720;
            canvas.height = 1280;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#000';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              // Draw brand icon with CORS fix
              const icon = new window.Image();
              icon.crossOrigin = 'anonymous';
              icon.src = '/favicon.ico';
              await new Promise(resolve => { icon.onload = resolve; });
              ctx.drawImage(icon, canvas.width/2-60, canvas.height/2-60, 120, 120);
              // Draw username
              ctx.font = 'bold 48px sans-serif';
              ctx.fillStyle = '#fff';
              ctx.textAlign = 'center';
              ctx.fillText(`@${creatorData?.username || 'author'}`, canvas.width/2, canvas.height/2+90);
            }
            // Convert canvas to video (webm)
            const stream = canvas.captureStream(30);
            const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
            let chunks: Blob[] = [];
            recorder.ondataavailable = e => chunks.push(e.data);
            recorder.start();
            await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5s outro
            recorder.stop();
            await new Promise(resolve => recorder.onstop = resolve);
            const outroBlob = new Blob(chunks, { type: 'video/webm' });
            const outroArrayBuffer = await outroBlob.arrayBuffer();
            ffmpeg.FS('writeFile', 'outro.webm', new Uint8Array(outroArrayBuffer));

            // Fetch outro audio
            const outroAudio = await fetchFile('/whistle.mp3');
            ffmpeg.FS('writeFile', 'outro.mp3', outroAudio);

            // Merge outro video and audio
            await ffmpeg.run(
              '-i', 'outro.webm',
              '-i', 'outro.mp3',
              '-c:v', 'copy',
              '-c:a', 'aac',
              '-shortest',
              'outro_with_audio.mp4'
            );

            // Concatenate main video and outro_with_audio
            await ffmpeg.run(
              '-i', 'input.mp4',
              '-i', 'outro_with_audio.mp4',
              '-filter_complex', '[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[outv][outa]',
              '-map', '[outv]',
              '-map', '[outa]',
              '-c:v', 'libx264',
              '-c:a', 'aac',
              'output.mp4'
            );
            const data = ffmpeg.FS('readFile', 'output.mp4');
            // Create blob and trigger download
            const url = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = `reel-${video.id}-with-outro.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }}
          aria-label="Download"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 8l-4-4m4 4l4-4M4 20h16" />
          </svg>
          <span className="text-[10px] mt-0.5">{video.downloads ?? 0}</span>
        </button>
      </div>
      {/* Caption - bottom center */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-11/12 text-center text-white text-base font-semibold bg-black/40 rounded-xl px-4 py-2 backdrop-blur-md">
        {video.caption}
      </div>

        {/* Comment Modal/Panel - Instagram style slide up from bottom */}
        {showComments && (
  <div
    className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-end md:items-center"
    onClick={() => setShowComments(false)}
  >
    <div
      className="w-full max-w-md mx-auto bg-white dark:bg-gray-900 rounded-t-2xl md:rounded-2xl shadow-lg relative animate-slideUp flex flex-col overflow-hidden"
      style={{
        minHeight: '50vh',
        maxHeight: '75vh',
        marginBottom: '0px'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header - Sticky */}
      <div className="flex-shrink-0 p-4 pb-3 sticky top-0 bg-white dark:bg-gray-900 z-10">
        <div
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 cursor-pointer text-2xl"
          onClick={() => setShowComments(false)}
        >
          ×
        </div>
        <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-3" />
        <h3 className="text-lg font-bold text-black dark:text-white text-center">
          Comments
        </h3>
      </div>

      {/* Comments Area - Independent Scroll */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">
        {commentLoading ? (
          <div className="text-gray-500 text-center py-4">Loading...</div>
        ) : comments.length === 0 ? (
          <div className="text-gray-500 text-center py-4">No comments yet.</div>
        ) : (
          <div className="space-y-3">
            {comments.map((c) => (
              <div key={c.id} className="flex items-start gap-2">
                <img
                  src={
                    c.user?.avatar_url ||
                    'https://api.dicebear.com/7.x/avataaars/svg?seed=' +
                      c.user?.username
                  }
                  alt={c.user?.username}
                  className="w-8 h-8 rounded-full flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-black dark:text-white">
                    {c.user?.username || 'User'}
                  </div>
                  <div className="text-xs text-gray-500 mb-1">
                    {new Date(c.created_at).toLocaleString()}
                  </div>
                  <div className="text-base text-gray-800 dark:text-gray-200 break-words">
                    {c.comment}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input Form - Always Visible */}
      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div
          className="p-4 md:pb-4"
          style={{
            paddingBottom:
              'calc(16px + env(safe-area-inset-bottom) + 70px)' // mobile bottom clearance
          }}
        >
          {userData ? (
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 px-4 py-3 rounded-full border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-black dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={posting}
                onKeyDown={(e) =>
                  e.key === 'Enter' &&
                  !posting &&
                  newComment.trim() &&
                  handlePostComment()
                }
              />
              <Button
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-5 py-3 rounded-full flex-shrink-0 min-w-[70px]"
                onClick={handlePostComment}
                disabled={posting || !newComment.trim()}
              >
                {posting ? '...' : 'Post'}
              </Button>
            </div>
          ) : (
            <div className="text-sm text-gray-500 text-center py-2">
              Log in to post a comment.
            </div>
          )}
        </div>
      </div>
    </div>

    <style>{`
      @keyframes slideUp {
        from { transform: translateY(100%); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .animate-slideUp {
        animation: slideUp 0.35s cubic-bezier(0.4,0,0.2,1);
      }

      /* Remove extra mobile padding on desktop */
      @media (min-width: 768px) {
        .flex-shrink-0 > div {
          padding-bottom: 16px !important;
        }
      }

      /* Mobile viewport handling */
      @supports (height: 100dvh) {
        .mobile-modal {
          height: 100dvh;
        }
      }
    `}</style>
  </div>
)} 


      {/* Series purchase prompt - center */}
      {video.is_series && !ownedSeries && showBuyPrompt && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-50">
          <div className="text-white text-lg font-bold mb-4">Preview ended</div>
          <div className="text-white mb-4">Subscribe to access the full <span className="font-semibold">{video.series_title}</span> series.</div>
          <Button
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-2 rounded-full"
            onClick={() => onBuySeries && onBuySeries(video.series_title, video.user_id, video.subscription_amount)}
          >
            Buy Full Series (${video.subscription_amount})
          </Button>
        </div>
      )}
    </div>
  );
}

// Monetization Card (shared for both desktop and mobile)
const MonetizationCard = ({ channel, totalChannelViews, subscriberCounts, handleToggleMonetization }: any) => {
  // New requirements: 10,000 views and 2,000 subscribers
  const minViews = 10000;
  const minSubscribers = 2000;
  const viewsOk = totalChannelViews >= minViews;
  const subsOk = (subscriberCounts[channel.id] ?? 0) >= minSubscribers;
  const monetizationEnabled = viewsOk && subsOk;

  return (
    <div className="bg-card bg-white/90 dark:bg-card rounded-lg p-4 text-black dark:text-white border border-gray-200 dark:border-gray-800 mb-6">
      <h3 className="text-lg font-bold mb-3">Monetization</h3>
      <div className="flex flex-col gap-4">
        {/* Donate Toggle */}
        <div className="flex items-center justify-between">
          <span>Enable Donations (Live)</span>
          <Switch
            checked={channel?.donation_enabled || false}
            onCheckedChange={checked => handleToggleMonetization('donation', checked)}
            disabled={!monetizationEnabled}
          />
        </div>
        {/* Subscription Toggle */}
        <div className="flex items-center justify-between">
          <span>Enable Subscriptions (Series)</span>
          <Switch
            checked={channel?.subscription_enabled || false}
            onCheckedChange={checked => handleToggleMonetization('subscription', checked)}
            disabled={!monetizationEnabled}
          />
        </div>
        {!monetizationEnabled && (
          <div className="text-xs text-gray-400 mt-2">
            Get <b>10,000 views</b> & <b>2,000 subscribers</b> to enable monetization features.
          </div>
        )}
      </div>
    </div>
  );
};

import { useSearchParams } from 'react-router-dom';
const Studio = () => {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  // Category filter state
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const { user } = useAuth();
  const { toast } = useToast();
  // const { theme, setTheme } = useTheme(); // Remove unused theme
  const navigate = useNavigate();
  const [channel, setChannel] = useState<any>(null);
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const [loading, setLoading] = useState(true);
  const [userLikes, setUserLikes] = useState<Set<string>>(new Set());
  const [userViews, setUserViews] = useState<Set<string>>(new Set());
  // const isDesktop = useMediaQuery('(min-width: 1024px'); // Removed duplicate declaration in Studio
  const [trendingReels, setTrendingReels] = useState<any[]>([]);
  const [topCreators, setTopCreators] = useState<any[]>([]);
  const [mostViewed, setMostViewed] = useState<any[]>([]);
  const [userData, setUserData] = useState<any>(null);
  const [videoCreators, setVideoCreators] = useState<Record<string, any>>({});

  // Subscription state
  const [userSubscriptions, setUserSubscriptions] = useState<Set<string>>(new Set());
  const [subscriberCounts, setSubscriberCounts] = useState<Record<string, number>>({});

  // Fetch channel and videos
  useEffect(() => {
    if (!user) return;
    const fetchChannelAndVideos = async () => {
      setLoading(true);
      const { data: channelData } = await supabase
        .from('studio_channels')
        .select('*')
        .eq('user_id', user.id)
        .single();
      setChannel(channelData);
      setLoading(false);
    };
    fetchChannelAndVideos();
    fetchUserInteractions();
    fetchUserData();
  }, [user]);

  // React Query infinite video feed with caching and background refresh
  const BATCH_SIZE = 10;
  
  const fetchVideosPage = async ({ pageParam = 0 }) => {
    let query = supabase
      .from('studio_videos')
      .select('*, shares, channel:studio_channels(name, id, user_id)')
      .order('created_at', { ascending: false })
      .range(pageParam * BATCH_SIZE, (pageParam + 1) * BATCH_SIZE - 1);
    
    if (selectedCategory && selectedCategory !== 'All') {
      query = query.contains('categories', [selectedCategory]);
    }
    
    const { data: allVideos } = await query;
    let videosWithChannelName = (allVideos || []).map(v => ({
      ...v,
      channel_name: v.channel?.name || '',
      channel_id: v.channel?.id || v.channel_id,
      user_id: v.channel?.user_id || v.user_id,
    }));
    
    // Shuffle videos array for random order (only for first page)
    if (pageParam === 0) {
      for (let i = videosWithChannelName.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [videosWithChannelName[i], videosWithChannelName[j]] = [videosWithChannelName[j], videosWithChannelName[i]];
      }
      
      // If highlightId is present, move that video to the top
      if (highlightId) {
        const idx = videosWithChannelName.findIndex(v => String(v.id) === String(highlightId));
        if (idx > -1) {
          const [highlighted] = videosWithChannelName.splice(idx, 1);
          videosWithChannelName.unshift(highlighted);
        }
      }
    }
    
    // Eager fetch all creators for this batch
    if (videosWithChannelName.length > 0) {
      await fetchVideoCreators(videosWithChannelName);
    }
    
    return {
      videos: videosWithChannelName,
      nextCursor: videosWithChannelName.length === BATCH_SIZE ? pageParam + 1 : undefined,
    };
  };

  const {
    data: videosData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: videosLoading,
    refetch: refetchVideos,
  } = useInfiniteQuery({
    queryKey: ['studio-videos', selectedCategory, highlightId],
    queryFn: fetchVideosPage,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: 0,
    staleTime: 30000, // Consider data fresh for 30 seconds
    gcTime: 300000, // Keep in cache for 5 minutes
  });

  // Flatten all video pages into a single array
  const videos = videosData?.pages.flatMap(page => page.videos) || [];

  // Calculate total views for the current channel from videos
  const totalChannelViews = videos
    .filter(v => v.channel_id === channel?.id)
    .reduce((sum, v) => sum + (v.views || 0), 0);

  // Only allow personalize if owner and total views >= 1000 and subscribers >= 200
  const canPersonalize = channel && user && channel.user_id === user.id && totalChannelViews >= 1000 && (subscriberCounts[channel.id] ?? 0) >= 200;

  // Infinite scroll for React Query (mobile only)
  useEffect(() => {
    if (!videos.length || isDesktop || !hasNextPage || isFetchingNextPage) return;
    
    const handleScroll = () => {
      if ((window.innerHeight + window.scrollY) >= (document.body.offsetHeight - 300)) {
        fetchNextPage();
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [videos, isDesktop, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Fetch user data including username and avatar
  const fetchUserData = async () => {
    if (!user) return;
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('id, username, avatar_url')
        .eq('id', user.id)
        .single();
      
      if (userData) {
        setUserData(userData);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  // Fetch creators data for videos
  const fetchVideoCreators = async (videos: any[]) => {
    const uniqueUserIds = [...new Set(videos.map(v => v.user_id))];
    const creators: Record<string, any> = {};
    
    for (const userId of uniqueUserIds) {
      try {
        const { data: creatorData } = await supabase
          .from('users')
          .select('id, username, avatar_url')
          .eq('id', userId)
          .single();
        
        if (creatorData) {
          creators[userId] = creatorData;
        }
      } catch (error) {
        console.error('Error fetching creator data:', error);
      }
    }
    
    setVideoCreators(prev => ({ ...prev, ...creators }));
  };

  // Fetch user's likes and views
  const fetchUserInteractions = async () => {
    if (!user) return;

    try {
      // Fetch user's likes
      const { data: likesData } = await supabase
        .from('studio_video_likes')
        .select('video_id')
        .eq('user_id', user.id);

      if (likesData) {
        setUserLikes(new Set(likesData.map(like => like.video_id)));
      }

      // Fetch user's views
      const { data: viewsData } = await supabase
        .from('studio_video_views')
        .select('video_id')
        .eq('user_id', user.id);

      if (viewsData) {
        setUserViews(new Set(viewsData.map(view => view.video_id)));
      }
    } catch (error) {
      console.error('Error fetching user interactions:', error);
    }
  };

  // Fetch trending reels, top creators, most viewed
  useEffect(() => {
    const fetchSidebarData = async () => {
      // Trending Reels: most liked in last 7 days
      const { data: trending } = await supabase
        .from('studio_videos')
        .select('*, shares')
        .gt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('likes', { ascending: false })
        .limit(5);
      setTrendingReels(trending || []);

      // Most Viewed: all time
      const { data: most } = await supabase
        .from('studio_videos')
        .select('*, shares')
        .order('views', { ascending: false })
        .limit(5);
      setMostViewed(most || []);

      // Top Creators: channels with most subscribers or engagement
      const { data: creators } = await supabase
        .from('studio_channels')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      setTopCreators(creators || []);
    };
    fetchSidebarData();
  }, []);

  // Fetch user's subscriptions and subscriber counts
  const fetchSubscriptionsAndCounts = async () => {
    if (!user) return;

    // User's subscriptions
    const { data: subsData } = await supabase
      .from('studio_channel_subscribers')
      .select('channel_id')
      .eq('user_id', user.id);
    setUserSubscriptions(new Set((subsData || []).map(s => s.channel_id)));

    // Subscriber counts for all channels in current videos
    const channelIds = Array.from(new Set(videos.map(v => v.channel_id)));
    const counts: Record<string, number> = {};
    for (const channelId of channelIds) {
      const { count } = await supabase
        .from('studio_channel_subscribers')
        .select('*', { count: 'exact', head: true })
        .eq('channel_id', channelId);
      counts[channelId] = count || 0;
    }
    setSubscriberCounts(counts);
  };

  useEffect(() => {
    fetchSubscriptionsAndCounts();
  }, [user, videos]);

  // Create channel
  const handleCreateChannel = async () => {
    if (!user) return;
    // Check if user already has a channel
    const { data: existingChannel } = await supabase
      .from('studio_channels')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (existingChannel) {
      toast({ description: 'You can only have one channel per account.' });
      return;
    }
    let name = '';
    let nameAvailable = false;
    while (!nameAvailable) {
      name = prompt('Enter your 1Studio channel name:')?.trim() || '';
      if (!name) {
        toast({ description: 'Channel name is required.' });
        return;
      }
      // Check for name availability
      const { data: nameExists } = await supabase
        .from('studio_channels')
        .select('id')
        .eq('name', name)
        .single();
      if (nameExists) {
        toast({ description: 'Channel name is already taken. Please choose another.' });
      } else {
        nameAvailable = true;
      }
    }
    const description = prompt('Enter a description for your channel:') || '';
    const { error } = await supabase.from('studio_channels').insert({
      user_id: user.id,
      name,
      description,
    });
    if (!error) window.location.reload();
  };

  // Handle like functionality
  const handleLike = async (videoId: string) => {
    if (!user) return;

    const isCurrentlyLiked = userLikes.has(videoId);
    
    // Optimistic update
    const newUserLikes = new Set(userLikes);
    if (isCurrentlyLiked) {
      newUserLikes.delete(videoId);
    } else {
      newUserLikes.add(videoId);
    }
    setUserLikes(newUserLikes);

    try {
      if (isCurrentlyLiked) {
        // Remove like
        const { error: deleteError } = await supabase
          .from('studio_video_likes')
          .delete()
          .eq('user_id', user.id)
          .eq('video_id', videoId);

        if (deleteError) throw deleteError;

        // Decrement likes count
        const { error: updateError } = await supabase.rpc('decrement_video_likes', {
          video_id: videoId
        });

        if (updateError) throw updateError;
      } else {
        // Add like
        const { error: insertError } = await supabase
          .from('studio_video_likes')
          .insert({
            user_id: user.id,
            video_id: videoId
          });

        if (insertError) throw insertError;

        // Increment likes count
        const { error: updateError } = await supabase.rpc('increment_video_likes', {
          video_id: videoId
        });

        if (updateError) throw updateError;
      }

      // Trigger a background refetch to keep data in sync
      refetchVideos();
    } catch (error) {
      console.error('Error handling like:', error);
      
      // Revert optimistic update on error
      setUserLikes(userLikes);
      
      toast({ description: 'Failed to update like', variant: 'destructive' });
    }
  };

  // Handle view functionality (fix duplicate key error)
  const handleView = async (videoId: string) => {
    if (!user || userViews.has(videoId)) return;

    // Check if view already exists before inserting
    try {
      const { data: existingView, error: viewError } = await supabase
        .from('studio_video_views')
        .select('id')
        .eq('user_id', user.id)
        .eq('video_id', videoId)
        .maybeSingle();
      if (viewError) throw viewError;
      if (existingView) {
        // Already viewed, just update state
        setUserViews(prev => new Set(prev).add(videoId));
        return;
      }
      // Insert new view
      const { error: insertError } = await supabase
        .from('studio_video_views')
        .insert({
          user_id: user.id,
          video_id: videoId
        });
      if (insertError) throw insertError;
      // Increment views count
      const { error: updateError } = await supabase.rpc('increment_video_views', {
        video_id: videoId
      });
      if (updateError) throw updateError;
      setUserViews(prev => new Set(prev).add(videoId));
    } catch (error) {
      console.error('Error handling view:', error);
    }
  };

  // Handle subscribe functionality
  const handleSubscribe = async (channelId: string, isSubscribed: boolean) => {
    if (!user) return;
    if (isSubscribed) {
      await supabase
        .from('studio_channel_subscribers')
        .delete()
        .eq('user_id', user.id)
        .eq('channel_id', channelId);
    } else {
      await supabase
        .from('studio_channel_subscribers')
        .insert({ user_id: user.id, channel_id: channelId });
    }
    fetchSubscriptionsAndCounts();
  };

  // Handle monetization toggle
  const handleToggleMonetization = async (type: 'donation' | 'subscription', enabled: boolean) => {
    if (!channel) return;

    try {
      const { error } = await supabase
        .from('studio_channels')
        .update({
          [`${type}_enabled`]: enabled
        })
        .eq('id', channel.id);

      if (error) throw error;

      // Update local channel state
      setChannel((prev: any) => prev ? { ...prev, [`${type}_enabled`]: enabled } : null);

      toast({ description: `Monetization ${enabled ? 'enabled' : 'disabled'} for ${type}.` });
    } catch (error) {
      console.error('Error updating monetization:', error);
      toast({ description: 'Failed to update monetization', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Custom Studio Header */}
      <header
        className="fixed top-0 left-0 right-0 z-40 px-2 py-2 sm:px-4 sm:py-3 pointer-events-auto"
        style={{ background: 'none', border: 'none', boxShadow: 'none' }}
      >
        <div className="flex items-center max-w-7xl mx-auto px-0 sm:px-0">
          {/* Favicon as Home button */}
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-foreground hover:text-primary transition-colors"
            style={{ minWidth: 40 }}
            aria-label="Home"
          >
            <img src="/favicon.ico" alt="Home" className="h-8 w-8 rounded-lg shadow-sm" />
          </button>

          {/* Categories - Centered on desktop, scrollable on mobile, with right arrow on mobile */}
          <div className="relative flex-1 flex justify-center items-center">
            <div
              id="category-scroll-container"
              className="flex items-center gap-3 sm:gap-3 overflow-x-auto px-0 sm:px-0 no-scrollbar py-1 ml-4 sm:ml-8"
              style={{
                WebkitOverflowScrolling: 'touch',
                overflowX: 'auto',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                overscrollBehaviorX: 'contain',
                scrollSnapType: 'x mandatory',
                maxWidth: '100vw',
              }}
            >
              {categories.map((category) => {
                const IconComponent = category.icon;
                const isActive = selectedCategory === category.name;
                return (
                  <button
                    key={category.name}
                    className={`flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition-colors whitespace-nowrap min-w-[40px] sm:min-w-0 focus:outline-none focus:ring-2 focus:ring-purple-400 ${isActive ? 'bg-purple-600 text-white shadow-lg' : 'bg-white/70 dark:bg-[#232946]/70 text-black dark:text-white hover:bg-purple-100 dark:hover:bg-[#312e81]'}`}
                    style={{ minWidth: 40, border: 'none', scrollSnapAlign: 'start' }}
                    onClick={() => setSelectedCategory(category.name)}
                  >
                    <IconComponent className="h-5 w-5 sm:h-4 sm:w-4" />
                    <span className="text-[9px] font-medium mt-0.5 hidden sm:inline">{category.name}</span>
                  </button>
                );
              })}
            </div>
            {/* Right arrow for horizontal scroll, only visible on mobile */}
            <button
              type="button"
              className="ml-2 bg-white/80 dark:bg-[#232946]/80 rounded-full p-1 shadow border border-gray-200 dark:border-gray-700 flex items-center justify-center z-10 hover:bg-purple-100 dark:hover:bg-[#312e81] transition sm:hidden"
              style={{ width: 24, height: 24 }}
              aria-label="Scroll right"
              onClick={() => {
                const container = document.getElementById('category-scroll-container');
                if (container) {
                  container.scrollBy({ left: 80, behavior: 'smooth' });
                }
              }}
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 5L12 10L7 15" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="flex w-full max-w-7xl mx-auto items-stretch min-h-screen pt-16 sm:pt-16 relative" style={{ paddingTop: '56px' }}>
        {/* Left Sidebar - Responsive for desktop, avoid header overlap */}
        {isDesktop && (
          <div className="hidden lg:flex flex-col fixed left-0 top-16 h-[calc(100vh-56px)] w-48 md:w-56 lg:w-64 p-2 md:p-4" style={{ zIndex: 10 }}>
            {/* Trending Reels */}
            <div className="mb-8 bg-white dark:bg-card rounded-lg p-4 border border-gray-200 dark:border-gray-800">
              <h3 className="text-xl font-bold text-black dark:text-white mb-4">Trending Reels</h3>
              {trendingReels.length === 0 ? (
                <div className="text-gray-600 dark:text-gray-400 text-sm">No trending reels yet.</div>
              ) : (
                <div className="space-y-3">
                  {trendingReels.map((reel, index) => (
                    <div key={reel.id} className="flex items-center space-x-3 text-black dark:text-white">
                      <span className="text-purple-600 dark:text-purple-400 font-semibold">#{index + 1}</span>
                      <div>
                        <div className="text-sm font-medium truncate">{reel.caption || 'Untitled'}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">{reel.likes} likes</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Creators */}
            <div className="mb-8 bg-white dark:bg-card rounded-lg p-4 border border-gray-200 dark:border-gray-800">
              <h3 className="text-xl font-bold text-black dark:text-white mb-4">Top Creators</h3>
              {topCreators.length === 0 ? (
                <div className="text-gray-600 dark:text-gray-400 text-sm">No creators yet.</div>
              ) : (
                <div className="space-y-3">
                  {topCreators.map((creator, index) => (
                    <div key={creator.id} className="flex items-center space-x-3 text-black dark:text-white">
                      <span className="text-purple-600 dark:text-purple-400 font-semibold">#{index + 1}</span>
                      <div className="text-sm font-medium truncate">{creator.name || 'Unnamed'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Most Viewed */}
            <div className="bg-white dark:bg-card rounded-lg p-4 border border-gray-200 dark:border-gray-800">
              <h3 className="text-xl font-bold text-black dark:text-white mb-4">Most Viewed</h3>
              {mostViewed.length === 0 ? (
                <div className="text-gray-600 dark:text-gray-400 text-sm">No videos yet.</div>
              ) : (
                <div className="space-y-3">
                  {mostViewed.map((reel, index) => (
                    <div key={reel.id} className="flex items-center space-x-3 text-black dark:text-white">
                      <span className="text-purple-600 dark:text-purple-400 font-semibold">#{index + 1}</span>
                      <div>
                        <div className="text-sm font-medium truncate">{reel.caption || 'Untitled'}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">{reel.views} views</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Main Content - Responsive max width and padding, fit for small screens */}
        <div className={
          isDesktop
            ? 'flex-1 mx-auto px-1 md:px-2 py-2 md:py-4 h-full flex flex-col justify-center items-center'
            : 'fixed inset-0 w-full h-full overflow-y-auto snap-y snap-mandatory bg-black'
        } style={!isDesktop ? { paddingTop: 0, background: '#000', zIndex: 0 } : {}}>
          {loading || videosLoading ? (
            <div className="flex items-center justify-center py-8">
              <div>Loading...</div>
            </div>
          ) : !channel ? (
            <div className="text-center py-8">
              <p className="mb-4">Create your 1Studio channel to get started</p>
              <Button onClick={handleCreateChannel}>Create Channel</Button>
            </div>
          ) : videos.length === 0 ? (
            <div className="text-center py-8">
              <div>No reels yet. Upload your first video!</div>
            </div>
          ) : (
            isDesktop ? (
              <div className="flex flex-col items-center w-full gap-4 md:gap-6">
                {videos.map(video => (
                  <div key={video.id} className="w-full max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-br from-gray-900/70 via-gray-800/60 to-purple-900/60 backdrop-blur-xl border border-gray-800">
                    <ReelCard 
                      video={video} 
                      onLike={handleLike} 
                      onView={handleView}
                      userLikes={userLikes}
                      onSubscribe={handleSubscribe}
                      isSubscribed={userSubscriptions.has(video.channel_id)}
                      subscriberCount={subscriberCounts[video.channel_id] || 0}
                      userData={userData}
                      creatorData={videoCreators[video.user_id]}
                      isDesktop={isDesktop}
                    />
                  </div>
                ))}
                {isFetchingNextPage && (
                  <div className="flex items-center justify-center py-4">
                    <div>Loading more videos...</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-full flex flex-col snap-y snap-mandatory overflow-y-auto">
                {videos.map(video => (
                  <div key={video.id} className="w-full h-[100dvh] snap-start flex-shrink-0">
                    <ReelCard 
                      video={video} 
                      onLike={handleLike} 
                      onView={handleView}
                      userLikes={userLikes}
                      onSubscribe={handleSubscribe}
                      isSubscribed={userSubscriptions.has(video.channel_id)}
                      subscriberCount={subscriberCounts[video.channel_id] || 0}
                      mobile
                      ownedSeries={userSubscriptions}
                      userData={userData}
                      creatorData={videoCreators[video.user_id]}
                      isDesktop={isDesktop}
                      onBuySeries={async (seriesTitle, authorId, price) => {
                        if (!user) {
                          alert('You must be logged in to purchase a series.');
                          return;
                        }
                        const confirmed = confirm(`Buy access to ${seriesTitle} for $${price}? This will be deducted from your wallet balance.`);
                        if (!confirmed) return;
                        try {
                          // 1. Fetch user balance
                          const { data: userData, error: userError } = await supabase
                            .from('users')
                            .select('id, balance')
                            .eq('id', user.id)
                            .single();
                          if (userError || !userData) throw new Error('Could not fetch your wallet balance.');
                          if ((userData.balance ?? 0) < price) {
                            alert('Insufficient wallet balance. Please top up your wallet.');
                            return;
                          }
                          // 2. Fetch author balance
                          const { data: authorData, error: authorError } = await supabase
                            .from('users')
                            .select('id, balance')
                            .eq('id', authorId)
                            .single();
                          if (authorError || !authorData) throw new Error('Could not fetch author wallet.');
                          // 3. Debit user, credit author (atomic update)
                          const { error: updateError } = await supabase.rpc('transfer_series_payment', {
                            buyer_id: user.id,
                            author_id: authorId,
                            amount: price
                          });
                          if (updateError) throw new Error('Transaction failed. Please try again.');
                          // 4. Record purchase
                          const { error: purchaseError } = await supabase
                            .from('series_purchases')
                            .insert({
                              user_id: user.id,
                              series_title: seriesTitle,
                              author_id: authorId,
                              amount: price,
                              purchased_at: new Date().toISOString()
                            });
                          if (purchaseError) throw new Error('Could not record purchase.');
                          // 5. Update ownedSeries state
                          setUserSubscriptions(prev => new Set(prev).add(seriesTitle));
                          alert('Payment successful! You now own this series.');
                        } catch (err: any) {
                          alert(err.message || 'Purchase failed.');
                        }
                      }}
                    />
                  </div>
                ))}
                {isFetchingNextPage && (
                  <div className="w-full h-[100dvh] snap-start flex-shrink-0 flex items-center justify-center">
                    <div>Loading more videos...</div>
                  </div>
                )}
                {/* All Squared Up message at end of feed */}
                {!hasNextPage && videos.length > 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400">
                    <button
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-600 text-white font-semibold hover:bg-purple-700 transition"
                      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                      <span className="font-bold text-lg">You're all squared up!</span>
                    </button>
                  </div>
                )}
              </div>
              
            )
          )}
        </div>
        {/* Right Sidebar - Responsive for desktop, avoid header overlap */}
        {isDesktop && user && channel && (
          <div className="hidden lg:flex flex-col fixed right-0 top-16 h-[calc(100vh-56px)] w-48 md:w-64 lg:w-80 p-2 md:p-6 space-y-4 md:space-y-6" style={{ zIndex: 10 }}>
            {/* Your Studio Card */}
            <div className="bg-card bg-white/90 dark:bg-card rounded-lg p-4 text-black dark:text-white border border-gray-200 dark:border-gray-800 mb-6">
              <h3 className="text-xl font-bold mb-3">Your Studio</h3>
              <div className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">{channel.name}</div>
              <div className="text-base text-gray-800 dark:text-gray-200 mb-3 font-medium">{channel.description}</div>
              <div className="text-xs text-purple-700 dark:text-purple-300 mb-2 font-semibold">
                Link: <a href={`https://nexsq.com/studio/${channel.id}`} className="underline text-purple-600 dark:text-purple-400" target="_blank" rel="noopener noreferrer">https://nexsq.com/studio/{channel.id}</a>
              </div>
              {/* Overall View Tracker */}
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-4 h-4 text-purple-500" />
                <span className="text-base text-gray-900 dark:text-white font-semibold">Total Views: <span className="font-bold">{totalChannelViews}</span></span>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <UserCheck className="w-4 h-4 text-purple-500" />
                <span className="text-base text-gray-900 dark:text-white font-semibold">Subscribers: <span className="font-bold">{subscriberCounts[channel.id] ?? 0}</span></span>
              </div>
              {/* Progress Tracker Bar */}
              {!canPersonalize && (
                <div className="mb-2">
                  <div className="w-full h-3 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden mb-1">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 via-purple-600 to-fuchsia-500 transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.floor(((totalChannelViews / 1000) + ((subscriberCounts[channel.id] ?? 0) / 200)) / 2 * 100))}%`
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600 dark:text-gray-300 font-semibold">
                    <span>{totalChannelViews}/1000 views</span>
                    <span>{subscriberCounts[channel.id] ?? 0}/200 subs</span>
                  </div>
                </div>
              )}
              {/* End Progress Tracker Bar */}
              {canPersonalize ? (
                <Button size="sm" variant="outline" onClick={() => navigate('/studio/settings')}>Personalize Studio Link</Button>
              ) : (
                <div className="text-xs text-gray-600 dark:text-gray-300 mb-2 font-semibold">Get 1000 views & 200 subscribers to customize your studio link!</div>
              )}
            </div>
            {/* Invite Friends Card */}
            <div className="bg-card bg-white/90 dark:bg-card rounded-lg p-4 text-black dark:text-white border border-gray-200 dark:border-gray-800 mb-6">
              <h3 className="text-lg font-bold mb-3">Invite Friends</h3>
              <div className="text-sm mb-3">Share your channel link to invite friends to subscribe!</div>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={`https://nexsq.com/studio/${channel.id}`}
                  className="flex-1 bg-gray-800 text-white border-none focus:ring-0 focus:outline-none text-xs px-2 py-1 rounded"
                  style={{ minWidth: 0 }}
                />
                <Button
                  size="sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(`https://nexsq.com/studio/${channel.id}`);
                    toast({ description: 'Link copied to clipboard!' });
                  }}
                  className="text-xs"
                >
                  Copy Link
                </Button>
              </div>
            </div>
            {/* Monetization Card */}
            <MonetizationCard channel={channel} totalChannelViews={totalChannelViews} subscriberCounts={subscriberCounts} handleToggleMonetization={handleToggleMonetization} />
          </div>
        )}
      </div>
      
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <MobileBottomNav />
      </div>
    </div>
  );
};

export default Studio;
