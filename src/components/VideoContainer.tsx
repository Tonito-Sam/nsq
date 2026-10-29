import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Play,
  Pause,
  Clock,
  Eye,
  Volume2,
  VolumeX,
  Heart,
  MessageCircle,
  Users,
  ChevronLeft,
  ChevronRight,
  Radio,
  History,
  RadioTower,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useShowContext } from '@/contexts/ShowContext';
import { useViewTracking } from '@/hooks/useViewTracking';
import { useLiveChatMessages } from '@/hooks/useLiveChatMessages';
import VODLibrary, { VODEpisode } from '@/components/VODLibrary';
import { useNavigate } from 'react-router-dom';
import { recordWatchHistory } from '@/lib/watchHistory';
import { cn } from '@/lib/utils';

interface StudioShow {
  id: string;
  title: string;
  description?: string;
  video_url?: string;
  thumbnail_url?: string;
  duration?: number;
  category?: string;
  show_id?: string;
  show_title?: string;
  scheduled_time?: string;
  end_time?: string;
  time_slot_start?: string;
  program_scheduled_time?: string;
  program_end_time?: string;
  is_live: boolean;
  is_active: boolean;
  created_at: string;
}

interface VideoContainerProps {
  shows?: StudioShow[];
  selectedShowId?: string;
  onLike?: () => void;
  onCommentClick?: () => void;
  currentShowIndex?: number;
  onCurrentShowChange?: (index: number) => void;
  scheduleTransition?: boolean;
  nextProgram?: StudioShow;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

// ─── Live/Timestamp badge helpers ─────────────────────────────────────────────

const PillBadge = ({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode;
  tone?: 'live' | 'scheduled' | 'neutral' | 'brand';
  className?: string;
}) => {
  const tones: Record<string, string> = {
    live: 'bg-red-500 text-white shadow-red-500/30 shadow-lg',
    scheduled: 'bg-blue-500 text-white shadow-blue-500/30 shadow-lg',
    neutral: 'bg-black/70 text-white backdrop-blur-sm',
    brand: 'bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white shadow-purple-500/30 shadow-lg',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide',
        'backdrop-blur-sm transition-all',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
};

export const VideoContainer: React.FC<VideoContainerProps> = ({
  shows = [],
  selectedShowId,
  onLike = () => {},
  onCommentClick = () => {},
  currentShowIndex: externalCurrentShowIndex,
  onCurrentShowChange,
  scheduleTransition = false,
  nextProgram,
}) => {
  const navigate = useNavigate();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [currentShowIndex, setCurrentShowIndex] = useState(0);
  const [ytReady, setYtReady] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [catchUpOpen, setCatchUpOpen] = useState(false);
  const [portalMounted, setPortalMounted] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [playingEpisode, setPlayingEpisode] = useState<VODEpisode | null>(null);
  const [modalPlayerPlaying, setModalPlayerPlaying] = useState(false);
  const [modalPlayerMuted, setModalPlayerMuted] = useState(true);
  const [modalPlayerProgress, setModalPlayerProgress] = useState(0);
  const [modalPlayerDuration, setModalPlayerDuration] = useState(0);
  const [modalAwaitingUserPlay, setModalAwaitingUserPlay] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );

  const videoCurrentTimeRef = useRef<number>(0);
  const youtubeTimePollRef = useRef<number | null>(null);
  const nativeSeekRetryRefs = useRef<number[]>([]);
  const overlayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const youtubePlayerRef = useRef<any>(null);
  const vimeoRef = useRef<HTMLIFrameElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const modalVideoRef = useRef<HTMLVideoElement>(null);
  const modalYoutubePlayerRef = useRef<any>(null);
  const modalPlayerContainerRef = useRef<HTMLDivElement>(null);

  // ─── Modal mount / scroll lock ────────────────────────────────────────────
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);

    if (catchUpOpen) {
      setPortalMounted(true);
      setTimeout(() => setModalVisible(true), 20);
      document.body.style.overflow = 'hidden';
    } else {
      setModalVisible(false);
      setTimeout(() => setPortalMounted(false), 220);
      document.body.style.overflow = 'auto';
      setPlayingEpisode(null);
    }

    return () => {
      document.body.style.overflow = 'auto';
      setPortalMounted(false);
      setModalVisible(false);
      window.removeEventListener('resize', handleResize);
    };
  }, [catchUpOpen]);

  // ─── Orientation / fullscreen handling (unchanged logic) ─────────────────
  useEffect(() => {
    const handleOrientationChange = () => {
      const isTouchDevice = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
      const isMobile = window.innerWidth < 768 ||
        (isTouchDevice && Math.min(window.innerWidth, window.innerHeight) <= 600);
      const isLandscape = window.matchMedia('(orientation: landscape)').matches;

      if (videoRef.current) {
        const t = videoRef.current.currentTime;
        setVideoCurrentTime(t);
        videoCurrentTimeRef.current = t;
        try {
          sessionStorage.setItem(
            'nsq_video_time',
            JSON.stringify({ showId: currentShow?.id, time: t, ts: Date.now() }),
          );
        } catch {}
      }
      if (youtubePlayerRef.current && typeof youtubePlayerRef.current.getCurrentTime === 'function') {
        try {
          const t = youtubePlayerRef.current.getCurrentTime();
          if (typeof t === 'number' && !isNaN(t)) {
            setVideoCurrentTime(t);
            videoCurrentTimeRef.current = t;
            try {
              sessionStorage.setItem(
                'nsq_video_time',
                JSON.stringify({ showId: currentShow?.id, time: t, ts: Date.now() }),
              );
            } catch {}
          }
        } catch {}
      }

      if (isMobile && isLandscape && !isFullscreen) {
        setIsFullscreen(true);
        setShowOverlay(true);
        document.body.style.overflow = 'hidden';
        setTimeout(() => {
          const element = videoContainerRef.current;
          if (element) {
            if (element.requestFullscreen) element.requestFullscreen().catch(() => {});
            else if ((element as any).webkitRequestFullscreen) (element as any).webkitRequestFullscreen();
            else if ((element as any).mozRequestFullScreen) (element as any).mozRequestFullScreen();
            else if ((element as any).msRequestFullscreen) (element as any).msRequestFullscreen();
          }
        }, 100);
      } else if ((!isLandscape || !isMobile) && isFullscreen) {
        setIsFullscreen(false);
        setShowOverlay(true);
        document.body.style.overflow = 'auto';
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        else if ((document as any).webkitFullscreenElement) (document as any).webkitExitFullscreen();
        else if ((document as any).mozFullScreenElement) (document as any).mozCancelFullScreen();
        else if ((document as any).msFullscreenElement) (document as any).msExitFullscreen();
      }
    };

    const handleFullscreenChange = () => {
      const isFs = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      if (!isFs && isFullscreen) {
        setIsFullscreen(false);
        document.body.style.overflow = 'auto';
      }
      setShowOverlay(true);
    };

    const handleOrientationWithDelay = () => setTimeout(handleOrientationChange, 100);

    window.addEventListener('orientationchange', handleOrientationWithDelay);
    window.addEventListener('resize', handleOrientationChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    handleOrientationChange();

    return () => {
      window.removeEventListener('orientationchange', handleOrientationWithDelay);
      window.removeEventListener('resize', handleOrientationChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      document.body.style.overflow = 'auto';
    };
  }, [isFullscreen]);

  // ─── Overlay auto-hide (unchanged logic) ─────────────────────────────────
  useEffect(() => {
    const HIDE_DELAY = 10000;
    const showAndReset = () => {
      setShowOverlay(true);
      if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
      overlayTimeoutRef.current = setTimeout(() => setShowOverlay(false), HIDE_DELAY);
    };
    const container = videoContainerRef.current || document.body;
    showAndReset();
    container.addEventListener('mousemove', showAndReset as any);
    container.addEventListener('mousedown', showAndReset as any);
    container.addEventListener('touchstart', showAndReset as any);
    return () => {
      container.removeEventListener('mousemove', showAndReset as any);
      container.removeEventListener('mousedown', showAndReset as any);
      container.removeEventListener('touchstart', showAndReset as any);
      if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
    };
  }, []);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  useEffect(() => {
    if (shows.length === 0) {
      setCurrentShowIndex(0);
      return;
    }
    setCurrentShowIndex((index) => Math.min(index, shows.length - 1));
  }, [shows.length]);

  useEffect(() => {
    if (typeof externalCurrentShowIndex === 'number') {
      setCurrentShowIndex(externalCurrentShowIndex);
    }
  }, [externalCurrentShowIndex]);

  useEffect(() => {
    if (scheduleTransition) {
      videoRef.current?.pause();
      try {
        youtubePlayerRef.current?.pauseVideo?.();
      } catch {}
      setIsVideoPlaying(false);
      setPaused(true);
      return;
    }
    setPaused(false);
  }, [scheduleTransition]);

  const { setCurrentShow, setViewerCount, setLikeCount, viewerCount, likeCount } = useShowContext();

  // ─── URL helpers ─────────────────────────────────────────────────────────
  const isYouTubeUrl = (url: string) =>
    /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//.test(url);
  const isVimeoUrl = (url: string) => /^(https?:\/\/)?(www\.)?vimeo\.com\//.test(url);
  const extractYouTubeID = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };
  const extractVimeoID = (url: string) => {
    const regExp = /vimeo\.com\/(?:video\/)?(\d+)/;
    const match = url.match(regExp);
    return match ? match[1] : null;
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return '0:00';
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getTimeStatus = (show: StudioShow) => {
    if (show.is_live) return { text: 'LIVE', tone: 'live' as const, icon: Radio };
    if (show.scheduled_time) {
      try {
        const scheduledTime = new Date(show.scheduled_time);
        const now = new Date();
        if (scheduledTime > now) {
          return {
            text: `Starts ${scheduledTime.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'Africa/Johannesburg',
            })}`,
            tone: 'scheduled' as const,
            icon: Clock,
          };
        }
      } catch {}
    }
    return { text: formatDuration(show.duration), tone: 'neutral' as const, icon: Clock };
  };

  const sortedShows = shows;
  const currentShow = scheduleTransition
    ? undefined
    : selectedShowId
      ? sortedShows.find((show) => show.id === selectedShowId || show.show_id === selectedShowId) || sortedShows[currentShowIndex]
      : sortedShows[currentShowIndex];
  const trackingShowId = currentShow?.show_id || currentShow?.id;

  const { viewCount } = useViewTracking({
    showId: trackingShowId,
    isPlaying: isVideoPlaying,
    onViewCountUpdate: (count) => setViewerCount(count),
  });

  const showId = trackingShowId;
  const { messages } = useLiveChatMessages(showId);

  useEffect(() => {
    if (currentShow) {
      setCurrentShow({
        ...currentShow,
        id: trackingShowId || currentShow.id,
        title: currentShow.show_title || currentShow.title,
      });
      setViewerCount(viewCount);
      setLikeCount(Math.floor(viewCount * 0.1) + 5);
    } else {
      setCurrentShow(null);
      setViewerCount(0);
      setLikeCount(0);
    }
  }, [currentShow, viewCount, setCurrentShow, setViewerCount, setLikeCount]);

  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setYtReady(true);
      return;
    }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    window.onYouTubeIframeAPIReady = () => setYtReady(true);
    return () => {
      window.onYouTubeIframeAPIReady = () => {};
    };
  }, []);

  const moveToNextShow = () => {
    const nextIndex = (currentShowIndex + 1) % sortedShows.length;
    setCurrentShowIndex(nextIndex);
    if (typeof onCurrentShowChange === 'function') onCurrentShowChange(nextIndex);
  };

  // ─── YouTube player (main) ────────────────────────────────────────────────
  useEffect(() => {
    if (scheduleTransition || !currentShow || !ytReady || !isYouTubeUrl(currentShow.video_url || '')) return;
    const videoId = extractYouTubeID(currentShow.video_url || '');
    if (!videoId) return;

    if (youtubePlayerRef.current) {
      try {
        youtubePlayerRef.current.destroy();
      } catch {}
      youtubePlayerRef.current = null;
    }

    const playerId = `youtube-player-${currentShow.id}`;
    const playerElement = document.getElementById(playerId);

    if (playerElement) {
      youtubePlayerRef.current = new window.YT.Player(playerId, {
        videoId,
        playerVars: {
          autoplay: 1,
          mute: muted ? 1 : 0,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          widget_referrer: window.location.href,
          origin: window.location.origin,
        },
        events: {
          onStateChange: (event: any) => {
            const playing = event.data === 1;
            setIsVideoPlaying(playing);
            if (playing && currentShow?.video_url) {
              recordWatchHistory({
                id: currentShow.id,
                show_id: trackingShowId || currentShow.id,
                title: currentShow.title,
                description: currentShow.description,
                video_url: currentShow.video_url,
                thumbnail_url: currentShow.thumbnail_url,
                duration: currentShow.duration,
                category: currentShow.category,
              });
            }
            if (playing) {
              if (!youtubeTimePollRef.current) {
                youtubeTimePollRef.current = window.setInterval(() => {
                  try {
                    if (
                      youtubePlayerRef.current &&
                      typeof youtubePlayerRef.current.getCurrentTime === 'function'
                    ) {
                      const t = youtubePlayerRef.current.getCurrentTime();
                      if (typeof t === 'number' && !isNaN(t)) {
                        videoCurrentTimeRef.current = t;
                        setVideoCurrentTime(t);
                        try {
                          sessionStorage.setItem(
                            'nsq_video_time',
                            JSON.stringify({ showId: currentShow?.id, time: t, ts: Date.now() }),
                          );
                        } catch {}
                      }
                    }
                  } catch {}
                }, 1000);
              }
            } else {
              if (youtubeTimePollRef.current) {
                clearInterval(youtubeTimePollRef.current);
                youtubeTimePollRef.current = null;
              }
            }
            if (event.data === 0) moveToNextShow();
          },
          onReady: (event: any) => {
            if (muted) event.target.mute();
            try {
              if (!videoCurrentTimeRef.current) {
                const raw = sessionStorage.getItem('nsq_video_time');
                if (raw) {
                  const parsed = JSON.parse(raw);
                  if (parsed && parsed.showId === currentShow?.id && typeof parsed.time === 'number') {
                    videoCurrentTimeRef.current = parsed.time;
                  }
                }
              }
            } catch {}
            try {
              const seekToTime = videoCurrentTimeRef.current || videoCurrentTime;
              if (typeof event.target.seekTo === 'function' && seekToTime > 0) {
                event.target.seekTo(seekToTime, true);
              }
            } catch {}
            setIsVideoPlaying(true);
          },
        },
      });
    }

    return () => {
      if (youtubePlayerRef.current) {
        try {
          youtubePlayerRef.current.destroy();
        } catch {}
        youtubePlayerRef.current = null;
      }
      if (youtubeTimePollRef.current) {
        clearInterval(youtubeTimePollRef.current);
        youtubeTimePollRef.current = null;
      }
    };
  }, [currentShow, ytReady, muted, scheduleTransition]);

  // ─── Persisted time restore ──────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('nsq_video_time');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.showId === currentShow?.id && typeof parsed.time === 'number') {
          videoCurrentTimeRef.current = parsed.time;
          setVideoCurrentTime(parsed.time);
        }
      }
    } catch {}
    nativeSeekRetryRefs.current.forEach((id) => clearTimeout(id));
    nativeSeekRetryRefs.current = [];
    return () => {
      nativeSeekRetryRefs.current.forEach((id) => clearTimeout(id));
      nativeSeekRetryRefs.current = [];
    };
  }, [currentShow]);

  // ─── Native video handlers ───────────────────────────────────────────────
  const handleVideoEnded = () => {
    setIsVideoPlaying(false);
    moveToNextShow();
  };

  const handleVideoPlay = () => {
    setIsVideoPlaying(true);
    setPaused(false);
    if (currentShow?.video_url) {
      recordWatchHistory({
        id: currentShow.id,
        show_id: trackingShowId || currentShow.id,
        title: currentShow.title,
        description: currentShow.description,
        video_url: currentShow.video_url,
        thumbnail_url: currentShow.thumbnail_url,
        duration: currentShow.duration,
        category: currentShow.category,
      });
    }
  };

  const handleVideoPause = () => {
    setIsVideoPlaying(false);
    setPaused(true);
  };

  const togglePlayPause = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      if (youtubePlayerRef.current && typeof youtubePlayerRef.current.playVideo === 'function') {
        const state = youtubePlayerRef.current.getPlayerState
          ? youtubePlayerRef.current.getPlayerState()
          : null;
        if (state === 1) {
          youtubePlayerRef.current.pauseVideo();
          setIsVideoPlaying(false);
          setPaused(true);
        } else {
          youtubePlayerRef.current.playVideo();
          setIsVideoPlaying(true);
          setPaused(false);
        }
        return;
      }
      if (videoRef.current) {
        if (videoRef.current.paused) {
          await videoRef.current.play();
          setIsVideoPlaying(true);
          setPaused(false);
        } else {
          videoRef.current.pause();
          setIsVideoPlaying(false);
          setPaused(true);
        }
      }
    } catch {}
  };

  const handleVideoTimeUpdate = () => {
    if (videoRef.current) {
      const t = videoRef.current.currentTime;
      setVideoCurrentTime(t);
      videoCurrentTimeRef.current = t;
      try {
        sessionStorage.setItem(
          'nsq_video_time',
          JSON.stringify({ showId: currentShow?.id, time: t, ts: Date.now() }),
        );
      } catch {}
    }
  };

  const restoreNativePosition = (seekToTime: number) => {
    if (!videoRef.current || !seekToTime || seekToTime <= 0) return;
    try {
      videoRef.current.currentTime = seekToTime;
    } catch {}
    let attempts = 0;
    const maxAttempts = 6;
    const trySeek = () => {
      if (!videoRef.current) return;
      attempts += 1;
      const current = videoRef.current.currentTime || 0;
      const diff = Math.abs(current - seekToTime);
      if (diff > 0.5 && attempts <= maxAttempts) {
        try {
          videoRef.current.currentTime = seekToTime;
        } catch {}
        const id = window.setTimeout(trySeek, 250);
        nativeSeekRetryRefs.current.push(id);
      } else {
        try {
          if (videoRef.current.paused) {
            const p = videoRef.current.play();
            if (p && typeof p.then === 'function') p.then(() => {}).catch(() => {});
          }
        } catch {}
      }
    };
    trySeek();
  };

  const handleMuteToggle = () => {
    setMuted(!muted);
    if (youtubePlayerRef.current) {
      if (muted) youtubePlayerRef.current.unMute();
      else youtubePlayerRef.current.mute();
    }
    if (videoRef.current) videoRef.current.muted = !muted;
  };

  const handleLike = () => {
    setLikeCount(likeCount + 1);
    onLike();
  };

  const handleCommentClick = () => onCommentClick();

  // ─── Auto-scroll marquee (unchanged) ─────────────────────────────────────
  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    let lastTimestamp = 0;
    const speed = 0.06;
    let animationFrame: number;
    let lastCardIndex = 0;
    let autoPause = false;
    const getCardWidth = () => {
      const card = scroll.querySelector('.autofade-card');
      return card ? (card as HTMLElement).offsetWidth : 0;
    };
    const scrollStep = (timestamp: number) => {
      if (!scroll || paused) {
        animationFrame = requestAnimationFrame(scrollStep);
        return;
      }
      if (!lastTimestamp) lastTimestamp = timestamp;
      const elapsed = timestamp - lastTimestamp;
      lastTimestamp = timestamp;
      if (!autoPause) scroll.scrollLeft += speed * elapsed;
      const cardWidth = getCardWidth();
      if (cardWidth > 0) {
        const cardIndex = Math.round(scroll.scrollLeft / cardWidth);
        if (cardIndex !== lastCardIndex && !autoPause) {
          autoPause = true;
          lastCardIndex = cardIndex;
          setTimeout(() => {
            autoPause = false;
          }, 1200);
        }
      }
      if (scroll.scrollLeft >= scroll.scrollWidth / 2) {
        scroll.scrollLeft = 0;
        lastCardIndex = 0;
      }
      animationFrame = requestAnimationFrame(scrollStep);
    };
    animationFrame = requestAnimationFrame(scrollStep);
    return () => cancelAnimationFrame(animationFrame);
  }, [shows, paused]);

  useEffect(() => {
    if (currentShowIndex >= sortedShows.length) {
      setCurrentShowIndex(0);
      if (typeof onCurrentShowChange === 'function') onCurrentShowChange(0);
    }
  }, [currentShowIndex, sortedShows.length]);

  // ─── Modal player functions (unchanged logic) ────────────────────────────
  const playEpisode = useCallback(
    (episode: VODEpisode) => {
      setCatchUpOpen(true);
      setPlayingEpisode(episode);
      setModalPlayerPlaying(false);
      setModalPlayerProgress(0);
      const shouldMute = true;
      setModalPlayerMuted(shouldMute);

      const initModalYouTube = (videoId: string) => {
        let attempts = 0;
        const maxAttempts = 20;
        const tryCreate = () => {
          attempts += 1;
          const el = document.getElementById('modal-youtube-player');
          if (!el || !(window as any).YT || !(window as any).YT.Player) {
            if (attempts < maxAttempts) setTimeout(tryCreate, 250);
            return;
          }
          if (modalYoutubePlayerRef.current) {
            try {
              modalYoutubePlayerRef.current.destroy();
            } catch {}
            modalYoutubePlayerRef.current = null;
          }
          try {
            modalYoutubePlayerRef.current = new window.YT.Player('modal-youtube-player', {
              videoId,
              playerVars: {
                autoplay: 1,
                mute: shouldMute ? 1 : 0,
                controls: 1,
                rel: 0,
                modestbranding: 1,
                playsinline: 1,
              },
              events: {
                onStateChange: (event: any) => {
                  setModalPlayerPlaying(event.data === 1);
                  if (event.data === 0) setModalPlayerPlaying(false);
                },
                onReady: (event: any) => {
                  try {
                    event.target.mute();
                  } catch {}
                  try {
                    setModalPlayerDuration(event.target.getDuration());
                  } catch {}
                  try {
                    event.target.playVideo();
                  } catch {}
                  setModalPlayerPlaying(true);
                  const poll = () => {
                    if (modalYoutubePlayerRef.current) {
                      try {
                        const t = modalYoutubePlayerRef.current.getCurrentTime();
                        if (typeof t === 'number') setModalPlayerProgress(t);
                      } catch {}
                      setTimeout(poll, 500);
                    }
                  };
                  poll();
                },
              },
            });
          } catch {}
        };
        tryCreate();
      };

      const isYouTube = episode.video_url && isYouTubeUrl(episode.video_url);
      const isVimeo = episode.video_url && isVimeoUrl(episode.video_url);

      if (isMobile) {
        if (!isYouTube && modalVideoRef.current) {
          modalVideoRef.current.src = episode.video_url || '';
          modalVideoRef.current.load();
        }
        setModalAwaitingUserPlay(true);
        return;
      }

      if (episode.video_url && isYouTubeUrl(episode.video_url)) {
        const videoId = extractYouTubeID(episode.video_url);
        if (videoId) initModalYouTube(videoId);
      } else if (episode.video_url && isVimeoUrl(episode.video_url)) {
        // handled in render
      } else if (episode.video_url) {
        setTimeout(() => {
          try {
            if (modalVideoRef.current) {
              modalVideoRef.current.pause();
              modalVideoRef.current.src = episode.video_url || '';
              modalVideoRef.current.load();
              modalVideoRef.current.muted = shouldMute;
              const p = modalVideoRef.current.play();
              if (p && typeof (p as any).then === 'function') {
                (p as any).then(() => setModalPlayerPlaying(true)).catch(() => setModalPlayerPlaying(false));
              } else {
                setModalPlayerPlaying(!modalVideoRef.current.paused);
              }
            }
          } catch {}
        }, 150);
      }
    },
    [modalPlayerMuted, modalPlayerPlaying],
  );

  useEffect(() => {
    if (!playingEpisode) return;
    const isYouTube = playingEpisode.video_url && isYouTubeUrl(playingEpisode.video_url);
    if (!isYouTube && modalVideoRef.current) {
      try {
        modalVideoRef.current.muted = modalPlayerMuted;
        const p = modalVideoRef.current.play();
        if (p && typeof (p as any).then === 'function') {
          (p as any).then(() => setModalPlayerPlaying(true)).catch(() => setModalPlayerPlaying(false));
        } else {
          setModalPlayerPlaying(!modalVideoRef.current.paused);
        }
      } catch {}
    }
  }, [playingEpisode, modalPlayerMuted]);

  const handleModalPlayerPlayPause = useCallback(() => {
    if (modalYoutubePlayerRef.current) {
      if (modalPlayerPlaying) modalYoutubePlayerRef.current.pauseVideo();
      else modalYoutubePlayerRef.current.playVideo();
    } else if (modalVideoRef.current) {
      if (modalVideoRef.current.paused) modalVideoRef.current.play();
      else modalVideoRef.current.pause();
    }
    setModalPlayerPlaying(!modalPlayerPlaying);
  }, [modalPlayerPlaying]);

  const handleModalPlayerMuteToggle = useCallback(() => {
    const newMuted = !modalPlayerMuted;
    setModalPlayerMuted(newMuted);
    if (modalYoutubePlayerRef.current) {
      if (newMuted) modalYoutubePlayerRef.current.mute();
      else modalYoutubePlayerRef.current.unMute();
    } else if (modalVideoRef.current) {
      modalVideoRef.current.muted = newMuted;
    }
  }, [modalPlayerMuted]);

  const handleModalPlayerProgress = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setModalPlayerProgress(value);
    if (modalYoutubePlayerRef.current) modalYoutubePlayerRef.current.seekTo(value, true);
    else if (modalVideoRef.current) modalVideoRef.current.currentTime = value;
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ─── Render helpers ──────────────────────────────────────────────────────
  const renderVideoPlayer = (isFullscreenMode: boolean = false) => {
    if (!currentShow?.video_url) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
          <Play className="h-16 w-16 text-gray-400" />
        </div>
      );
    }

    if (isYouTubeUrl(currentShow.video_url)) {
      return (
        <div
          id={`youtube-player-${currentShow.id}`}
          className="w-full h-full"
          style={{
            position: isFullscreenMode ? 'absolute' : 'relative',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
          }}
        />
      );
    }

    if (isVimeoUrl(currentShow.video_url)) {
      return (
        <iframe
          ref={vimeoRef}
          className="w-full h-full"
          src={`https://player.vimeo.com/video/${extractVimeoID(
            currentShow.video_url,
          )}?autoplay=1&muted=${muted ? 1 : 0}&controls=1&api=1&player_id=vimeoPlayer&playsinline=1`}
          title={currentShow.title}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          style={{
            position: isFullscreenMode ? 'absolute' : 'relative',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
          }}
        />
      );
    }

    return (
      <div className="relative w-full h-full">
        <video
          key={`${currentShow.id}-${isFullscreenMode ? 'fullscreen' : 'normal'}`}
          ref={videoRef}
          className="w-full h-full object-cover"
          poster={currentShow.thumbnail_url || '/placeholder.svg'}
          controls
          muted={muted}
          playsInline
          preload="metadata"
          onEnded={handleVideoEnded}
          onPlay={handleVideoPlay}
          onPause={handleVideoPause}
          onTimeUpdate={handleVideoTimeUpdate}
          autoPlay
          style={{
            position: isFullscreenMode ? 'absolute' : 'relative',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          onLoadedMetadata={() => {
            const seekToTime = videoCurrentTimeRef.current || videoCurrentTime;
            if (videoRef.current && seekToTime > 0) restoreNativePosition(seekToTime);
          }}
          {...(isIOS && { 'webkit-playsinline': 'true', 'x-webkit-airplay': 'allow' })}
        >
          <source src={currentShow.video_url} type="video/mp4" />
          <source src={currentShow.video_url} type="video/webm" />
          Your browser does not support the video tag.
        </video>
        {!isYouTubeUrl(currentShow.video_url) && (
          <button
            onClick={handleMuteToggle}
            className={cn(
              'absolute bottom-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors',
              isFullscreenMode ? 'z-20' : 'z-10',
            )}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        )}
      </div>
    );
  };

  const renderModalPlayer = () => {
    if (!playingEpisode) return null;
    const isYouTube = playingEpisode.video_url && isYouTubeUrl(playingEpisode.video_url);
    const isVimeo = playingEpisode.video_url && isVimeoUrl(playingEpisode.video_url);

    return (
      <div className="mb-8 rounded-xl overflow-hidden bg-gray-900 border border-gray-800">
        <div className="relative aspect-video" ref={modalPlayerContainerRef}>
          {isYouTube ? (
            isMobile && modalAwaitingUserPlay ? (
              <div className="w-full h-full flex items-center justify-center bg-black/60">
                <button
                  onClick={() => {
                    setModalAwaitingUserPlay(false);
                    const videoId = extractYouTubeID(playingEpisode.video_url || '');
                    if (videoId) {
                      try {
                        if (modalYoutubePlayerRef.current) {
                          try {
                            modalYoutubePlayerRef.current.destroy();
                          } catch {}
                          modalYoutubePlayerRef.current = null;
                        }
                        modalYoutubePlayerRef.current = new window.YT.Player('modal-youtube-player', {
                          videoId,
                          playerVars: { autoplay: 1, mute: modalPlayerMuted ? 1 : 0, playsinline: 1 },
                          events: {
                            onReady: (ev: any) => {
                              try {
                                ev.target.playVideo();
                              } catch {}
                              setModalPlayerPlaying(true);
                            },
                            onStateChange: (ev: any) => setModalPlayerPlaying(ev.data === 1),
                          },
                        });
                      } catch {}
                    }
                  }}
                  className="bg-white/10 hover:bg-white/20 text-white rounded-full p-6"
                >
                  <Play size={36} />
                </button>
              </div>
            ) : (
              <div id="modal-youtube-player" className="w-full h-full" />
            )
          ) : isVimeo ? (
            <iframe
              className="w-full h-full"
              src={`https://player.vimeo.com/video/${extractVimeoID(
                playingEpisode.video_url!,
              )}?autoplay=1&muted=${modalPlayerMuted ? 1 : 0}&controls=0`}
              title={playingEpisode.title}
              allow="autoplay; fullscreen"
              allowFullScreen
            />
          ) : (
            <video
              ref={modalVideoRef}
              className="w-full h-full"
              src={playingEpisode.video_url}
              poster={playingEpisode.thumbnail_url}
              muted={modalPlayerMuted}
              playsInline
              onPlay={() => setModalPlayerPlaying(true)}
              onPause={() => setModalPlayerPlaying(false)}
              onTimeUpdate={(e) => {
                const video = e.currentTarget;
                setModalPlayerProgress(video.currentTime);
                setModalPlayerDuration(video.duration);
              }}
              onLoadedMetadata={(e) => setModalPlayerDuration(e.currentTarget.duration)}
              autoPlay={!isMobile}
            />
          )}

          {modalAwaitingUserPlay && !isYouTube && (
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                onClick={() => {
                  setModalAwaitingUserPlay(false);
                  try {
                    if (modalVideoRef.current) {
                      modalVideoRef.current.muted = modalPlayerMuted;
                      const p = modalVideoRef.current.play();
                      if (p && typeof (p as any).then === 'function') {
                        (p as any).then(() => setModalPlayerPlaying(true)).catch(() => setModalPlayerPlaying(false));
                      }
                    }
                  } catch {}
                }}
                className="bg-white/10 hover:bg-white/20 text-white rounded-full p-6"
              >
                <Play size={36} />
              </button>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300">
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <input
                type="range"
                min="0"
                max={modalPlayerDuration || 100}
                value={modalPlayerProgress}
                onChange={handleModalPlayerProgress}
                className="w-full h-1.5 mb-4 rounded-lg appearance-none cursor-pointer bg-gray-700 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={handleModalPlayerPlayPause}
                    className="text-white hover:text-purple-300 transition-colors p-2 hover:bg-white/10 rounded-full"
                  >
                    {modalPlayerPlaying ? <Pause size={20} /> : <Play size={20} />}
                  </button>
                  <button
                    onClick={handleModalPlayerMuteToggle}
                    className="text-white hover:text-purple-300 transition-colors p-2 hover:bg-white/10 rounded-full"
                  >
                    {modalPlayerMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                  </button>
                  <span className="text-sm text-gray-300 font-mono">
                    {formatTime(modalPlayerProgress)} / {formatTime(modalPlayerDuration)}
                  </span>
                </div>
                <div className="text-sm text-gray-300">{playingEpisode.title}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4">
          <h3 className="text-lg font-semibold text-white mb-2">{playingEpisode.title}</h3>
          {playingEpisode.description && (
            <p className="text-sm text-gray-300 mb-3">{playingEpisode.description}</p>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock size={14} className="text-gray-400" />
              <span className="text-xs text-gray-400">
                {playingEpisode.duration ? formatTime(playingEpisode.duration) : 'N/A'}
              </span>
            </div>
            <button
              onClick={() => setPlayingEpisode(null)}
              className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1 hover:bg-gray-800 rounded-lg"
            >
              Close Player
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (shows.length === 0) {
    return (
      <div className="w-full rounded-2xl border border-border/60 bg-gradient-to-br from-purple-500/10 via-fuchsia-500/5 to-pink-500/10 p-8 mb-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-500 shadow-lg shadow-purple-500/25">
            <RadioTower className="h-6 w-6 text-white" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Studio Shows Available</h3>
          <p className="text-sm text-muted-foreground">
            Check back later for live shows and videos!
          </p>
        </div>
      </div>
    );
  }

  const videoWrapperClass = isFullscreen
    ? 'fixed inset-0 bg-black z-[9999] flex items-center justify-center'
    : 'w-full mb-6';
  const videoWrapperStyle = isFullscreen
    ? { width: '100vw', height: '100vh', backgroundColor: 'black' }
    : {};

  const timeStatus = currentShow
    ? getTimeStatus(currentShow)
    : { text: 'Next up', tone: 'scheduled' as const, icon: Clock };
  const StatusIcon = timeStatus.icon;
  const nextProgramStart = nextProgram?.time_slot_start || nextProgram?.program_scheduled_time || nextProgram?.scheduled_time;
  const formatNextProgramStart = (value?: string) => {
    if (!value) return null;
    const timeMatch = value.match(/(?:T|^)(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      return new Date(2000, 0, 1, Number(timeMatch[1]), Number(timeMatch[2])).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      });
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  // ─── Now Watching / description / Catch Up bar ────────────────────────────
  // (this is the section you asked to modernize)

  return (
    <div ref={videoContainerRef} className={videoWrapperClass} style={videoWrapperStyle}>
      <Card
        className={cn(
          isFullscreen
            ? 'w-full h-full m-0 p-0 bg-transparent border-none shadow-none'
            : 'mb-4 overflow-hidden rounded-2xl border-border/60',
        )}
      >
        <CardContent className={isFullscreen ? 'p-0 w-full h-full' : 'p-0'}>
          <div
            className={cn(
              isFullscreen
                ? 'relative w-full h-full'
                : 'relative aspect-video overflow-hidden bg-black',
            )}
          >
            {scheduleTransition ? (
              <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-neutral-950 text-white">
                {nextProgram?.thumbnail_url && (
                  <img
                    src={nextProgram.thumbnail_url}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-45"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-br from-black/85 via-black/55 to-fuchsia-950/70" />
                <div className="relative z-10 mx-auto max-w-2xl px-6 py-10 text-center">
                  <PillBadge tone="brand">
                    <Sparkles className="h-3.5 w-3.5" />
                    Next on NexSq TV
                  </PillBadge>
                  <h2 className="mt-5 text-2xl font-bold tracking-tight sm:text-4xl">
                    {nextProgram?.show_title || nextProgram?.title || 'No show scheduled'}
                  </h2>
                  {nextProgram ? (
                    <p className="mt-3 text-sm text-white/75">
                      {formatNextProgramStart(nextProgramStart)
                        ? `Starts at ${formatNextProgramStart(nextProgramStart)}`
                        : 'Coming up next'}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm text-white/75">No more shows are scheduled right now.</p>
                  )}
                </div>
              </div>
            ) : currentShow?.video_url ? (
              renderVideoPlayer(isFullscreen)
            ) : currentShow?.thumbnail_url ? (
              <div className="relative w-full h-full">
                <img
                  src={currentShow.thumbnail_url}
                  alt={currentShow.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/placeholder.svg';
                  }}
                />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                  <div className="bg-white/90 dark:bg-black/90 rounded-full p-4">
                    <Play className="h-8 w-8 text-gray-900 dark:text-white" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                <Play className="h-16 w-16 text-gray-400" />
              </div>
            )}

            {/* Overlays */}
            <div
              className={cn(
                'absolute inset-0 transition-opacity duration-300 pointer-events-none',
                showOverlay && !scheduleTransition ? 'opacity-100' : 'opacity-0',
              )}
            >
              {/* Center play/pause */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlayPause(e);
                }}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-3 rounded-full z-30 pointer-events-auto backdrop-blur-sm ring-1 ring-white/10 transition-transform hover:scale-105 active:scale-95"
                aria-label="Play/Pause"
              >
                {isVideoPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
              </button>

              {/* Exit fullscreen */}
              {isFullscreen && (
                <button
                  onClick={() => {
                    setIsFullscreen(false);
                    document.body.style.overflow = 'auto';
                    if (document.exitFullscreen) document.exitFullscreen();
                    else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
                    else if ((document as any).mozCancelFullScreen) (document as any).mozCancelFullScreen();
                    else if ((document as any).msExitFullscreen) (document as any).msExitFullscreen();
                  }}
                  className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full z-20 pointer-events-auto backdrop-blur-sm"
                >
                  <X className="h-5 w-5" />
                </button>
              )}

              {/* LIVE pill */}
              {currentShow?.is_live && (
                <div className={cn('absolute top-4 left-4 pointer-events-auto', isFullscreen ? 'z-20' : 'z-10')}>
                  <PillBadge tone="live">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                    </span>
                    LIVE
                  </PillBadge>
                </div>
              )}

              {/* Time status pill */}
              {currentShow && (
                <div
                  className={cn(
                    'absolute bottom-4 left-4 pointer-events-auto',
                    isFullscreen ? 'z-20' : 'z-10',
                  )}
                >
                  <PillBadge tone={timeStatus.tone}>
                    <StatusIcon className="h-3.5 w-3.5" />
                    {timeStatus.text}
                  </PillBadge>
                </div>
              )}

              {/* Mobile floating stat chips */}
              <div
                className={cn(
                  'sm:hidden absolute bottom-16 right-2 flex flex-col space-y-2 pointer-events-auto',
                  isFullscreen ? 'z-20' : 'z-10',
                )}
              >
                <div className="flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-sm px-2.5 py-1">
                  <Users className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-[10px] font-semibold text-white tabular-nums">
                    {viewerCount.toLocaleString()}
                  </span>
                </div>
                <button
                  className="flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-sm px-2.5 py-1 hover:bg-black/80 transition-colors"
                  onClick={handleLike}
                >
                  <Heart className="w-3.5 h-3.5 fill-pink-500 text-pink-500" />
                  <span className="text-[10px] font-semibold text-white tabular-nums">
                    {likeCount}
                  </span>
                </button>
                <button
                  className="flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-sm px-2.5 py-1 hover:bg-black/80 transition-colors"
                  onClick={handleCommentClick}
                >
                  <MessageCircle className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-[10px] font-semibold text-white tabular-nums">
                    {messages.length}
                  </span>
                </button>
              </div>

              {/* Mute toggle for YouTube */}
              {isYouTubeUrl(currentShow?.video_url || '') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMuteToggle();
                  }}
                  className={cn(
                    'absolute bottom-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors pointer-events-auto backdrop-blur-sm',
                    isFullscreen ? 'z-20' : 'z-10',
                  )}
                >
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
              )}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════
              NOW WATCHING · DESCRIPTION · CATCH UP  —  modernized section
              ═══════════════════════════════════════════════════════════════════ */}
          {!isFullscreen && currentShow && (
                <div className="p-3">
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_auto] gap-3">
                {/* ── Now Watching card ── */}
                    <div className="relative overflow-hidden rounded-xl p-2.5 bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 ring-1 ring-white/5 shadow-lg">
                  {/* subtle gradient orb */}
                  <div className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-purple-500/25 blur-2xl" />
                  <div className="pointer-events-none absolute -bottom-10 -left-10 h-24 w-24 rounded-full bg-fuchsia-500/20 blur-2xl" />

                  <div className="relative">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white/70">
                        Now Watching
                      </span>
                      {currentShow.is_live && (
                        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold text-red-300 ring-1 ring-red-500/30">
                          LIVE
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-white leading-snug line-clamp-2">
                      {currentShow.title}
                    </h3>
                  </div>
                </div>

                {/* ── Description with marquee ── */}
                {currentShow.description ? (
                  <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 ring-1 ring-white/5 px-4 py-2 flex items-center shadow-lg">
                    {/* edge fades */}
                    <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-slate-800 to-transparent z-10" />
                    <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-slate-900 to-transparent z-10" />
                    <div
                      className="marquee-text whitespace-nowrap text-sm font-medium text-white/85"
                      style={{ animationDuration: '18s' }}
                    >
                      {currentShow.description}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-slate-800/50 ring-1 ring-white/5 px-4 py-2 flex items-center">
                    <span className="text-sm text-white/40 italic">No description</span>
                  </div>
                )}

                {/* ── Catch Up button ── */}
                <button
                  onClick={() => navigate('/catch-up')}
                  className={cn(
                    'group relative inline-flex items-center justify-center gap-2.5 overflow-hidden rounded-xl',
                    'px-4 py-2 text-sm font-bold text-white min-h-[2.75rem]',
                    'bg-gradient-to-br from-purple-600 via-fuchsia-500 to-pink-500',
                    'shadow-lg shadow-purple-500/25 ring-1 ring-white/15',
                    'transition-all duration-200 hover:shadow-xl hover:shadow-fuchsia-500/30 hover:scale-[1.02] active:scale-[0.98]',
                  )}
                  aria-label="Open Catch Up"
                >
                  {/* shine sweep */}
                  <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent group-hover:translate-x-full transition-transform duration-700" />
                  <History className="relative h-4 w-4 transition-transform group-hover:-rotate-12" />
                  <span className="relative">Catch Up</span>
                  <Sparkles className="relative h-3.5 w-3.5 text-white/70 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>

              <style>{`
                @keyframes marquee {
                  0% { transform: translateX(100%); }
                  100% { transform: translateX(-100%); }
                }
                .marquee-text {
                  display: inline-block;
                  will-change: transform;
                  animation: marquee 18s linear infinite;
                }
              `}</style>
            </div>
          )}

          {/* ─── Catch Up Modal (unchanged structure, minor polish) ─── */}
          {portalMounted &&
            currentShow &&
            createPortal(
              <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 pointer-events-auto">
                <div
                  className={cn(
                    'absolute inset-0 bg-black/90 backdrop-blur-md transition-opacity duration-300',
                    modalVisible ? 'opacity-100' : 'opacity-0',
                  )}
                  onClick={() => setCatchUpOpen(false)}
                />

                <div
                  className={cn(
                    'relative bg-gray-900 dark:bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden transform transition-all duration-300',
                    modalVisible
                      ? 'opacity-100 scale-100 translate-y-0'
                      : 'opacity-0 scale-95 translate-y-4',
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800 px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-white">Catch Up</h2>
                        <p className="text-sm text-gray-400 mt-1">
                          Watch all past shows you've missed
                        </p>
                      </div>
                      <button
                        onClick={() => setCatchUpOpen(false)}
                        className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg"
                        aria-label="Close modal"
                      >
                        <X size={24} />
                      </button>
                    </div>
                  </div>

                  <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
                    <div className="p-6">
                      {renderModalPlayer()}

                      <div className="mb-8">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xl font-semibold text-white"></h3>
                          <div className="flex items-center space-x-2 text-sm text-gray-400">
                            <span>Scroll for more</span>
                            <ChevronRight size={16} />
                          </div>
                        </div>
                        <VODLibrary
                          showId=""
                          showAllPastShows={true}
                          onEpisodeSelect={playEpisode}
                          playingEpisodeId={playingEpisode?.id}
                        />
                      </div>

                      <div className="flex items-center justify-between pt-6 border-t border-gray-800">
                        <button className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 rounded-lg hover:bg-gray-800">
                          <ChevronLeft size={20} />
                          <span>Previous</span>
                        </button>
                        <div className="flex items-center space-x-2">
                          {[1, 2, 3, 4, 5].map((num) => (
                            <button
                              key={num}
                              className={cn(
                                'w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors',
                                num === 1
                                  ? 'bg-purple-600 text-white'
                                  : 'text-gray-400 hover:text-white hover:bg-gray-800',
                              )}
                            >
                              {num}
                            </button>
                          ))}
                        </div>
                        <button className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-gray-800">
                          <span>Next</span>
                          <ChevronRight size={20} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>,
              document.body,
            )}
        </CardContent>
      </Card>
    </div>
  );
};