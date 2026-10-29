import { useEffect, useMemo, useRef, useState } from 'react';
import { Heart, MessageCircle, Share2, Volume2, VolumeX, Play, Pause, User, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { StudioReelVideo } from '@/hooks/useStudioReels';

export interface StudioReelCardProps {
  video: StudioReelVideo;
  isActive: boolean;
  isLiked: boolean;
  isFollowing: boolean;
  mobile?: boolean;
  onLike: (videoId: string) => void;
  onView: (videoId: string) => void;
  onShare: (videoId: string) => void;
  onOpenComments?: () => void;
  onFollow?: () => void;
  userData?: any;
  hideLive?: boolean;
}

export function StudioReelCard({
  video,
  isActive,
  isLiked,
  isFollowing,
  mobile = false,
  onLike,
  onView,
  onShare,
  onOpenComments,
  onFollow,
  userData,
  hideLive = false,
}: StudioReelCardProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [viewSent, setViewSent] = useState(false);
  const [aspect, setAspect] = useState<'portrait' | 'landscape' | 'square'>('portrait');

  const displayName = video.channel_name || video.creator?.name || 'Unknown';
  const labelSubtitle = video.description || video.title || '';

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const attemptPlay = async () => {
      if (userPaused) return;
      try {
        await el.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    };

    if (isActive) {
      if (el.readyState >= 3) {
        void attemptPlay();
      } else {
        el.addEventListener('loadeddata', attemptPlay, { once: true });
      }
    } else {
      el.pause();
      setIsPlaying(false);
    }
  }, [isActive, userPaused]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const onLoaded = () => {
      const width = el.videoWidth;
      const height = el.videoHeight;
      if (width > height * 1.1) setAspect('landscape');
      else if (height > width * 1.1) setAspect('portrait');
      else setAspect('square');
    };

    el.addEventListener('loadedmetadata', onLoaded);
    return () => el.removeEventListener('loadedmetadata', onLoaded);
  }, [video.video_url]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const handleTimeUpdate = () => {
      if (!el.duration || el.duration === Infinity) return;
      setProgress(el.currentTime / el.duration);
      if (!viewSent && isActive && (el.currentTime >= 1 || el.currentTime / el.duration >= 0.2)) {
        setViewSent(true);
        onView(video.id);
      }
    };

    el.addEventListener('timeupdate', handleTimeUpdate);
    return () => el.removeEventListener('timeupdate', handleTimeUpdate);
  }, [isActive, onView, video.id, viewSent]);

  const togglePlay = async () => {
    const el = videoRef.current;
    if (!el) return;

    if (!el.paused) {
      el.pause();
      setIsPlaying(false);
      setUserPaused(true);
    } else {
      try {
        await el.play();
        setIsPlaying(true);
        setUserPaused(false);
      } catch {
        setIsPlaying(false);
      }
    }
  };

  const toggleMute = () => {
    setIsMuted((current) => !current);
  };

  return (
    <div
      className={`relative w-full ${mobile ? 'h-[100dvh]' : 'h-full'} overflow-hidden bg-black text-white`}
    >
      <video
        ref={videoRef}
        src={video.video_url}
        className={`w-full h-full ${aspect === 'landscape' ? 'object-contain' : 'object-cover'}`}
        playsInline
        muted={isMuted}
        loop
        preload="auto"
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent pointer-events-none" />

      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 py-3 z-20">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border border-white/20 bg-white/5">
            <AvatarImage src={video.creator?.avatar_url || undefined} alt={displayName} />
            <AvatarFallback>{displayName?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
          </Avatar>
          <div>
            <div className="text-sm font-semibold">{displayName}</div>
            <div className="text-[11px] text-gray-300">{video.channel_name ? `Channel · ${video.channel_name}` : 'Creator'}</div>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full bg-black/60 px-3 py-2 text-xs font-medium text-white hover:bg-white/10 transition"
          onClick={toggleMute}
          aria-label={isMuted ? 'Unmute video' : 'Mute video'}
        >
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          {isMuted ? 'Muted' : 'Sound'}
        </button>
      </div>

      <div className="absolute left-4 right-4 bottom-24 z-20">
        <div className="mb-2 text-sm font-semibold text-white">{video.title || labelSubtitle || 'Short video'}</div>
        {labelSubtitle ? <div className="text-xs text-gray-300 line-clamp-2">{labelSubtitle}</div> : null}
      </div>

      <div className="absolute bottom-4 right-4 flex flex-col items-center gap-4 z-20">
        <button
          type="button"
          className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-black/70 text-white shadow-lg ring-1 ring-white/10 hover:bg-purple-600 transition"
          onClick={() => onLike(video.id)}
          aria-label="Like"
        >
          <Heart className={`h-5 w-5 ${isLiked ? 'text-red-400 fill-red-400' : 'text-white'}`} />
        </button>
        {onOpenComments ? (
          <button
            type="button"
            className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-black/70 text-white shadow-lg ring-1 ring-white/10 hover:bg-white/10 transition"
            onClick={onOpenComments}
            aria-label="Comments"
          >
            <MessageCircle className="h-5 w-5" />
          </button>
        ) : null}
        <button
          type="button"
          className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-black/70 text-white shadow-lg ring-1 ring-white/10 hover:bg-white/10 transition"
          onClick={() => onShare(video.id)}
          aria-label="Share"
        >
          <Share2 className="h-5 w-5" />
        </button>
        <div className="mt-2 text-xs text-gray-300 text-center">
          <div>{video.views_count ? `${video.views_count.toLocaleString()} views` : '0 views'}</div>
          <div>{video.likes_count ? `${video.likes_count.toLocaleString()} likes` : '0 likes'}</div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
        <div className="h-full bg-purple-500 transition-all" style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }} />
      </div>

      <button
        type="button"
        onClick={togglePlay}
        className="absolute bottom-24 left-4 h-12 w-12 rounded-full bg-black/70 text-white shadow-lg flex items-center justify-center hover:bg-white/10 transition z-20"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
      </button>
    </div>
  );
}
