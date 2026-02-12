import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Play, Pause, Clock, Eye, Volume2, VolumeX, Heart, MessageCircle, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useShowContext } from '@/contexts/ShowContext';
import { useViewTracking } from '@/hooks/useViewTracking';
import { useLiveChatMessages } from '@/hooks/useLiveChatMessages';
import VODLibrary, { VODEpisode } from '@/components/VODLibrary';

interface StudioShow {
  id: string;
  title: string;
  description?: string;
  video_url?: string;
  thumbnail_url?: string;
  duration?: number;
  scheduled_time?: string;
  end_time?: string;
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
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export const VideoContainer: React.FC<VideoContainerProps> = ({
  shows = [],
  selectedShowId,
  onLike = () => {},
  onCommentClick = () => {},
  currentShowIndex: externalCurrentShowIndex,
  onCurrentShowChange
}) => {
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
  // NEW STATES FOR MODAL PLAYER
  const [playingEpisode, setPlayingEpisode] = useState<VODEpisode | null>(null);
  const [modalPlayerPlaying, setModalPlayerPlaying] = useState(false);
  const [modalPlayerMuted, setModalPlayerMuted] = useState(true);
  const [modalPlayerProgress, setModalPlayerProgress] = useState(0);
  const [modalPlayerDuration, setModalPlayerDuration] = useState(0);
  const [modalAwaitingUserPlay, setModalAwaitingUserPlay] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean>(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  
  // keep a ref for the latest time to avoid stale closures when seeking on remount
  const videoCurrentTimeRef = useRef<number>(0);
  const youtubeTimePollRef = useRef<number | null>(null);
  const nativeSeekRetryRefs = useRef<number[]>([]);
  const overlayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const youtubePlayerRef = useRef<any>(null);
  const vimeoRef = useRef<HTMLIFrameElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  // NEW REFS FOR MODAL PLAYER
  const modalVideoRef = useRef<HTMLVideoElement>(null);
  const modalYoutubePlayerRef = useRef<any>(null);
  const modalPlayerContainerRef = useRef<HTMLDivElement>(null);

  // Manage body scroll and portal mount/animation for Catch Up modal
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);

    if (catchUpOpen) {
      setPortalMounted(true);
      // small delay to trigger CSS transition after mount
      setTimeout(() => setModalVisible(true), 20);
      document.body.style.overflow = 'hidden';
    } else {
      // start closing animation if open
      setModalVisible(false);
      setTimeout(() => setPortalMounted(false), 220);
      document.body.style.overflow = 'auto';
      // Reset modal player when closing
      setPlayingEpisode(null);
    }

    return () => {
      document.body.style.overflow = 'auto';
      setPortalMounted(false);
      setModalVisible(false);
      window.removeEventListener('resize', handleResize);
    };
  }, [catchUpOpen]);

  useEffect(() => {
    const handleOrientationChange = () => {
      const isMobile = window.innerWidth < 768;
      const isLandscape = window.matchMedia('(orientation: landscape)').matches;
      
      console.log('Orientation change:', { isMobile, isLandscape, isFullscreen });
      
      // Store current video time before orientation change
      if (videoRef.current) {
        const t = videoRef.current.currentTime;
        setVideoCurrentTime(t);
        videoCurrentTimeRef.current = t;
        try {
          sessionStorage.setItem('nsq_video_time', JSON.stringify({ showId: currentShow?.id, time: t, ts: Date.now() }));
        } catch (err) {
          /* ignore storage errors */
        }
      }
      // If a YouTube player exists, capture its current time as well
      if (youtubePlayerRef.current && typeof youtubePlayerRef.current.getCurrentTime === 'function') {
        try {
          const t = youtubePlayerRef.current.getCurrentTime();
          if (typeof t === 'number' && !isNaN(t)) {
            setVideoCurrentTime(t);
            videoCurrentTimeRef.current = t;
            try {
              sessionStorage.setItem('nsq_video_time', JSON.stringify({ showId: currentShow?.id, time: t, ts: Date.now() }));
            } catch (err) {
              /* ignore storage errors */
            }
          }
        } catch (err) {
          console.warn('Failed to read YouTube currentTime:', err);
        }
      }
      
      if (isMobile && isLandscape && !isFullscreen) {
        console.log('Entering fullscreen mode');
        setIsFullscreen(true);
        setShowOverlay(true);
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
        
        // Request fullscreen on the video container
        setTimeout(() => {
          const element = videoContainerRef.current;
          if (element) {
            if (element.requestFullscreen) {
              element.requestFullscreen().catch(console.error);
            } else if ((element as any).webkitRequestFullscreen) {
              (element as any).webkitRequestFullscreen();
            } else if ((element as any).mozRequestFullScreen) {
              (element as any).mozRequestFullScreen();
            } else if ((element as any).msRequestFullscreen) {
              (element as any).msRequestFullscreen();
            }
          }
        }, 100);
      } else if ((!isLandscape || !isMobile) && isFullscreen) {
        console.log('Exiting fullscreen mode');
        setIsFullscreen(false);
        setShowOverlay(true);
        
        // Restore body scroll
        document.body.style.overflow = 'auto';
        
        // Exit fullscreen
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(console.error);
        } else if ((document as any).webkitFullscreenElement) {
          (document as any).webkitExitFullscreen();
        } else if ((document as any).mozFullScreenElement) {
          (document as any).mozCancelFullScreen();
        } else if ((document as any).msFullscreenElement) {
          (document as any).msExitFullscreen();
        }
      }
    };

    const handleFullscreenChange = () => {
      const isFs = !!(document.fullscreenElement || 
                     (document as any).webkitFullscreenElement || 
                     (document as any).mozFullScreenElement || 
                     (document as any).msFullscreenElement);
      
      console.log('Fullscreen state changed:', isFs);
      
      if (!isFs && isFullscreen) {
        setIsFullscreen(false);
        document.body.style.overflow = 'auto';
      }
      
      setShowOverlay(true);
    };

    // Add delay to handle orientation change properly
    const handleOrientationWithDelay = () => {
      setTimeout(handleOrientationChange, 100);
    };

    // Event listeners
    window.addEventListener('orientationchange', handleOrientationWithDelay);
    window.addEventListener('resize', handleOrientationChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    // Initial check
    handleOrientationChange();

    return () => {
      window.removeEventListener('orientationchange', handleOrientationWithDelay);
      window.removeEventListener('resize', handleOrientationChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      
      // Cleanup
      document.body.style.overflow = 'auto';
    };
  }, [isFullscreen]);

  // Show overlay on touch in fullscreen, hide after 3s
  useEffect(() => {
    // Auto-hide overlay after 10s of inactivity. Re-show on mousemove/touchstart.
    const HIDE_DELAY = 10000; // 10 seconds

    const showAndReset = () => {
      setShowOverlay(true);
      if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
      overlayTimeoutRef.current = setTimeout(() => setShowOverlay(false), HIDE_DELAY);
    };

    const container = videoContainerRef.current || document.body;
    // start with overlay visible and schedule hide
    showAndReset();

    // show overlay on interactions
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

  const [shuffledShows, setShuffledShows] = useState<StudioShow[]>([]);
  useEffect(() => {
    if (!shows || shows.length === 0) {
      setShuffledShows([]);
      return;
    }
    const arr = [...shows];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    setShuffledShows(arr);
    // initialize index and notify parent if present
    setCurrentShowIndex(0);
    if (typeof onCurrentShowChange === 'function') onCurrentShowChange(0);
  }, [shows]);

  // Accept external currentShowIndex if provided by parent (Feed)
  useEffect(() => {
    if (typeof externalCurrentShowIndex === 'number') {
      setCurrentShowIndex(externalCurrentShowIndex);
    }
  }, [externalCurrentShowIndex]);

  const { setCurrentShow, setViewerCount, setLikeCount, viewerCount, likeCount } = useShowContext();

  const isYouTubeUrl = (url: string) => /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//.test(url);
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
    if (show.is_live) return { text: 'LIVE', className: 'bg-red-500 text-white' };
    
    if (show.scheduled_time) {
      try {
        const scheduledTime = new Date(show.scheduled_time);
        const now = new Date();
        
        if (scheduledTime > now) {
          return { 
            text: `Starts ${scheduledTime.toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              timeZone: 'Africa/Johannesburg'
            })}`, 
            className: 'bg-blue-500 text-white' 
          };
        }
      } catch (error) {
        console.error('Date parsing error:', error);
      }
    }
    
    return { text: formatDuration(show.duration), className: 'bg-black/70 text-white' };
  };

  const sortedShows = shuffledShows;
  const currentShow = selectedShowId 
    ? sortedShows.find(show => show.id === selectedShowId) || sortedShows[currentShowIndex]
    : sortedShows[currentShowIndex];

  const { viewCount } = useViewTracking({
    showId: currentShow?.id,
    isPlaying: isVideoPlaying,
    onViewCountUpdate: (count) => {
      console.log(`View count updated for ${currentShow?.title}: ${count}`);
      setViewerCount(count);
    }
  });

  const showId = currentShow?.id;
  const { messages } = useLiveChatMessages(showId);

  useEffect(() => {
    if (currentShow) {
      console.log('VideoContainer: Setting current show in context:', currentShow);
      setCurrentShow(currentShow);
      setViewerCount(viewCount);
      setLikeCount(Math.floor(viewCount * 0.1) + 5);
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

    window.onYouTubeIframeAPIReady = () => {
      setYtReady(true);
    };

    return () => {
      window.onYouTubeIframeAPIReady = () => {};
    };
  }, []);

  const moveToNextShow = () => {
    const nextIndex = (currentShowIndex + 1) % sortedShows.length;
    setCurrentShowIndex(nextIndex);
    if (typeof onCurrentShowChange === 'function') onCurrentShowChange(nextIndex);
  };

  useEffect(() => {
    if (!currentShow || !ytReady || !isYouTubeUrl(currentShow.video_url || '')) return;

    const videoId = extractYouTubeID(currentShow.video_url || '');
    if (!videoId) return;

    if (youtubePlayerRef.current) {
      try {
        youtubePlayerRef.current.destroy();
      } catch (err) {
        console.warn('Error destroying previous YouTube player', err);
      }
      youtubePlayerRef.current = null;
    }

    const playerId = `youtube-player-${currentShow.id}`;
    const playerElement = document.getElementById(playerId);
    
    if (playerElement) {
      youtubePlayerRef.current = new window.YT.Player(playerId, {
        videoId: videoId,
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
            console.log('YouTube player state change:', event.data);
            const playing = event.data === 1;
            setIsVideoPlaying(playing);

            // manage polling of currentTime while playing to keep the ref fresh
            if (playing) {
              // start poll
              if (!youtubeTimePollRef.current) {
                youtubeTimePollRef.current = window.setInterval(() => {
                  try {
                    if (youtubePlayerRef.current && typeof youtubePlayerRef.current.getCurrentTime === 'function') {
                      const t = youtubePlayerRef.current.getCurrentTime();
                      if (typeof t === 'number' && !isNaN(t)) {
                        videoCurrentTimeRef.current = t;
                        setVideoCurrentTime(t);
                        try {
                          sessionStorage.setItem('nsq_video_time', JSON.stringify({ showId: currentShow?.id, time: t, ts: Date.now() }));
                        } catch (err) {
                          /* ignore */
                        }
                      }
                    }
                  } catch (err) {
                    console.warn('YT poll error', err);
                  }
                }, 1000);
              }
            } else {
              // stopped/paused/ended -> clear poll
              if (youtubeTimePollRef.current) {
                clearInterval(youtubeTimePollRef.current);
                youtubeTimePollRef.current = null;
              }
            }

            if (event.data === 0) {
              console.log('Video ended, moving to next show');
              moveToNextShow();
            }
          },
          onReady: (event: any) => {
            console.log('YouTube player ready');
            if (muted) {
              event.target.mute();
            }

            // If we don't have a fresh time in the ref, try reading from sessionStorage
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
            } catch (err) {
              /* ignore parse errors */
            }

            // Restore playback position if available
            try {
              const seekToTime = videoCurrentTimeRef.current || videoCurrentTime;
              if (typeof event.target.seekTo === 'function' && seekToTime > 0) {
                event.target.seekTo(seekToTime, true);
              }
            } catch (err) {
              console.warn('Failed to seek YouTube player:', err);
            }

            setIsVideoPlaying(true);
          },
        },
      });
    }

    return () => {
      if (youtubePlayerRef.current) {
        try {
          youtubePlayerRef.current.destroy();
        } catch (err) {
          console.warn('Error destroying YouTube player on cleanup', err);
        }
        youtubePlayerRef.current = null;
      }
      if (youtubeTimePollRef.current) {
        clearInterval(youtubeTimePollRef.current);
        youtubeTimePollRef.current = null;
      }
    };
  }, [currentShow, ytReady, muted]);

  // When the currentShow changes, try to load any persisted time for native videos as well
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
    } catch (err) {
      // ignore
    }

    // cleanup any pending native seek retries when show changes
    nativeSeekRetryRefs.current.forEach(id => clearTimeout(id));
    nativeSeekRetryRefs.current = [];

    return () => {
      nativeSeekRetryRefs.current.forEach(id => clearTimeout(id));
      nativeSeekRetryRefs.current = [];
    };
  }, [currentShow]);

  const handleVideoEnded = () => {
    console.log('Regular video ended, moving to next show');
    setIsVideoPlaying(false);
    moveToNextShow();
  };

  const handleVideoPlay = () => {
    console.log('Video started playing');
    setIsVideoPlaying(true);
    setPaused(false);
  };

  const handleVideoPause = () => {
    console.log('Video paused');
    setIsVideoPlaying(false);
    setPaused(true);
  };

  const togglePlayPause = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      // If a YouTube player is present, use its API
      if (youtubePlayerRef.current && typeof youtubePlayerRef.current.playVideo === 'function') {
        const state = youtubePlayerRef.current.getPlayerState ? youtubePlayerRef.current.getPlayerState() : null;
        // YT state 1 == playing
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

      // Native video element
      if (videoRef.current) {
        if (videoRef.current.paused) {
          // attempt to play (may require user gesture in some browsers)
          await videoRef.current.play();
          setIsVideoPlaying(true);
          setPaused(false);
        } else {
          videoRef.current.pause();
          setIsVideoPlaying(false);
          setPaused(true);
        }
      }
    } catch (err) {
      console.error('[VideoContainer] play/pause toggle error:', err);
    }
  };

  const handleVideoTimeUpdate = () => {
    if (videoRef.current) {
      const t = videoRef.current.currentTime;
      setVideoCurrentTime(t);
      videoCurrentTimeRef.current = t;
      try {
        sessionStorage.setItem('nsq_video_time', JSON.stringify({ showId: currentShow?.id, time: t, ts: Date.now() }));
      } catch (err) {
        /* ignore storage errors */
      }
    }
  };

  // Robustly restore native video position with retries and optional autoplay
  const restoreNativePosition = (seekToTime: number) => {
    if (!videoRef.current || !seekToTime || seekToTime <= 0) return;

    try {
      videoRef.current.currentTime = seekToTime;
    } catch (err) {
      console.warn('Initial native seek failed:', err);
    }

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
        } catch (err) {
          // ignore
        }
        const id = window.setTimeout(trySeek, 250);
        nativeSeekRetryRefs.current.push(id);
      } else {
        // if video is paused try to play (muted autoplay more likely to succeed)
        try {
          if (videoRef.current.paused) {
            const p = videoRef.current.play();
            if (p && typeof p.then === 'function') {
              p.then(() => {
                // played
              }).catch(() => {
                // play rejected
              });
            }
          }
        } catch (err) {
          // ignore play errors
        }
      }
    };

    // start retry loop if needed
    trySeek();
  };

  const handleMuteToggle = () => {
    setMuted(!muted);
    if (youtubePlayerRef.current) {
      if (muted) {
        youtubePlayerRef.current.unMute();
      } else {
        youtubePlayerRef.current.mute();
      }
    }
    if (videoRef.current) {
      videoRef.current.muted = !muted;
    }
  };

  const handleLike = () => {
    setLikeCount(likeCount + 1);
    onLike();
  };

  const handleCommentClick = () => {
    console.log('VideoContainer: Comment button clicked');
    onCommentClick();
  };

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

      if (!autoPause) {
        scroll.scrollLeft += speed * elapsed;
      }

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

  // MODAL PLAYER FUNCTIONS
  const playEpisode = useCallback((episode: VODEpisode) => {
    // Ensure modal is open so DOM nodes mount
    setCatchUpOpen(true);

    setPlayingEpisode(episode);
    setModalPlayerPlaying(false);
    setModalPlayerProgress(0);

    // Force-muted autoplay to comply with browser policies
    const shouldMute = true;
    setModalPlayerMuted(shouldMute);

    // Initialize YouTube player for modal with retries until DOM + YT API are ready
    const initModalYouTube = (videoId: string) => {
      let attempts = 0;
      const maxAttempts = 20;

      const tryCreate = () => {
        attempts += 1;
        const el = document.getElementById('modal-youtube-player');
        if (!el || !(window as any).YT || !(window as any).YT.Player) {
          if (attempts < maxAttempts) {
            setTimeout(tryCreate, 250);
          } else {
            console.warn('YT player element or API never became available for modal');
          }
          return;
        }

        if (modalYoutubePlayerRef.current) {
          try { modalYoutubePlayerRef.current.destroy(); } catch (err) { /* ignore */ }
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
                try { event.target.mute(); } catch (err) { /* ignore */ }
                try { setModalPlayerDuration(event.target.getDuration()); } catch (err) { /* ignore */ }
                try { event.target.playVideo(); } catch (err) { /* ignore */ }
                setModalPlayerPlaying(true);

                const poll = () => {
                  if (modalYoutubePlayerRef.current) {
                    try {
                      const t = modalYoutubePlayerRef.current.getCurrentTime();
                      if (typeof t === 'number') setModalPlayerProgress(t);
                    } catch (err) { /* ignore */ }
                    setTimeout(poll, 500);
                  }
                };
                poll();
              }
            }
          });
        } catch (err) {
          console.warn('Failed to create modal YouTube player', err);
        }
      };

      tryCreate();
    };

    // On mobile, defer actual autoplay until the user taps the modal play button
    const isYouTube = episode.video_url && isYouTubeUrl(episode.video_url);
    const isVimeo = episode.video_url && isVimeoUrl(episode.video_url);

    if (isMobile) {
      // Ensure video src is set for native players so the user can tap to play
      if (!isYouTube && modalVideoRef.current) {
        modalVideoRef.current.src = episode.video_url || '';
        modalVideoRef.current.load();
      }
      // Show awaiting user play overlay
      setModalAwaitingUserPlay(true);
      return;
    }

    if (episode.video_url && isYouTubeUrl(episode.video_url)) {
      const videoId = extractYouTubeID(episode.video_url);
      if (videoId) initModalYouTube(videoId);
    } else if (episode.video_url && isVimeoUrl(episode.video_url)) {
      // vimeo iframe includes autoplay params in renderModalPlayer
    } else if (episode.video_url) {
      // Native video: set src and attempt to load/play after mount
      setTimeout(() => {
        try {
          if (modalVideoRef.current) {
            modalVideoRef.current.pause();
            modalVideoRef.current.src = episode.video_url || '';
            modalVideoRef.current.load();
            modalVideoRef.current.muted = shouldMute;
            const p = modalVideoRef.current.play();
            if (p && typeof (p as any).then === 'function') {
              (p as any).then(() => setModalPlayerPlaying(true)).catch((err: any) => {
                console.warn('Modal native video play rejected:', err);
                setModalPlayerPlaying(false);
              });
            } else {
              setModalPlayerPlaying(!modalVideoRef.current.paused);
            }
          }
        } catch (err) {
          console.warn('Error starting modal native video', err);
        }
      }, 150);
    }
  }, [modalPlayerMuted, modalPlayerPlaying]);

  // When a native modal video is selected, attempt to autoplay it once the DOM node is mounted
  useEffect(() => {
    if (!playingEpisode) return;

    const isYouTube = playingEpisode.video_url && isYouTubeUrl(playingEpisode.video_url);
    const isVimeo = playingEpisode.video_url && isVimeoUrl(playingEpisode.video_url);

    if (!isYouTube && modalVideoRef.current) {
      try {
        modalVideoRef.current.muted = modalPlayerMuted;
        const p = modalVideoRef.current.play();
        if (p && typeof (p as any).then === 'function') {
          (p as any).then(() => setModalPlayerPlaying(true)).catch(() => setModalPlayerPlaying(false));
        } else {
          setModalPlayerPlaying(!modalVideoRef.current.paused);
        }
      } catch (err) {
        console.warn('Failed to autoplay modal native video', err);
      }
    }
  }, [playingEpisode, modalPlayerMuted]);

  const handleModalPlayerPlayPause = useCallback(() => {
    if (modalYoutubePlayerRef.current) {
      if (modalPlayerPlaying) {
        modalYoutubePlayerRef.current.pauseVideo();
      } else {
        modalYoutubePlayerRef.current.playVideo();
      }
    } else if (modalVideoRef.current) {
      if (modalVideoRef.current.paused) {
        modalVideoRef.current.play();
      } else {
        modalVideoRef.current.pause();
      }
    }
    setModalPlayerPlaying(!modalPlayerPlaying);
  }, [modalPlayerPlaying]);

  const handleModalPlayerMuteToggle = useCallback(() => {
    const newMuted = !modalPlayerMuted;
    setModalPlayerMuted(newMuted);
    
    if (modalYoutubePlayerRef.current) {
      if (newMuted) {
        modalYoutubePlayerRef.current.mute();
      } else {
        modalYoutubePlayerRef.current.unMute();
      }
    } else if (modalVideoRef.current) {
      modalVideoRef.current.muted = newMuted;
    }
  }, [modalPlayerMuted]);

  const handleModalPlayerProgress = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setModalPlayerProgress(value);
    
    if (modalYoutubePlayerRef.current) {
      modalYoutubePlayerRef.current.seekTo(value, true);
    } else if (modalVideoRef.current) {
      modalVideoRef.current.currentTime = value;
    }
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
            height: '100%'
          }}
        />
      );
    }

    if (isVimeoUrl(currentShow.video_url)) {
      return (
        <iframe
          ref={vimeoRef}
          className="w-full h-full"
          src={`https://player.vimeo.com/video/${extractVimeoID(currentShow.video_url)}?autoplay=1&muted=${muted ? 1 : 0}&controls=1&api=1&player_id=vimeoPlayer&playsinline=1`}
          title={currentShow.title}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          style={{
            position: isFullscreenMode ? 'absolute' : 'relative',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%'
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
            objectFit: 'cover'
          }}
          onLoadedMetadata={() => {
            // Restore video time if transitioning between modes (with retries)
            const seekToTime = videoCurrentTimeRef.current || videoCurrentTime;
            if (videoRef.current && seekToTime > 0) {
              restoreNativePosition(seekToTime);
            }
          }}
          {...(isIOS && {
            'webkit-playsinline': 'true',
            'x-webkit-airplay': 'allow',
          })}
        >
          <source src={currentShow.video_url} type="video/mp4" />
          <source src={currentShow.video_url} type="video/webm" />
          Your browser does not support the video tag.
        </video>
        {!isYouTubeUrl(currentShow.video_url) && (
          <button
            onClick={handleMuteToggle}
            className={`absolute bottom-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors ${isFullscreenMode ? 'z-20' : 'z-10'}`}
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
            // On mobile we wait for an explicit user tap before creating the YouTube iframe/player
            isMobile && modalAwaitingUserPlay ? (
              <div className="w-full h-full flex items-center justify-center bg-black/60">
                <button
                  onClick={() => {
                    setModalAwaitingUserPlay(false);
                    const videoId = extractYouTubeID(playingEpisode.video_url || '');
                    if (videoId) {
                      // create player now that user gesture occurred
                      try {
                        if (modalYoutubePlayerRef.current) {
                          try { modalYoutubePlayerRef.current.destroy(); } catch (e) {}
                          modalYoutubePlayerRef.current = null;
                        }
                        modalYoutubePlayerRef.current = new window.YT.Player('modal-youtube-player', {
                          videoId,
                          playerVars: { autoplay: 1, mute: modalPlayerMuted ? 1 : 0, playsinline: 1 },
                          events: {
                            onReady: (ev: any) => { try { ev.target.playVideo(); } catch (e){}; setModalPlayerPlaying(true); },
                            onStateChange: (ev: any) => setModalPlayerPlaying(ev.data === 1)
                          }
                        });
                      } catch (err) {
                        console.warn('YT init after user gesture failed', err);
                      }
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
              src={`https://player.vimeo.com/video/${extractVimeoID(playingEpisode.video_url!)}?autoplay=1&muted=${modalPlayerMuted ? 1 : 0}&controls=0`}
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
              onLoadedMetadata={(e) => {
                setModalPlayerDuration(e.currentTarget.duration);
              }}
              autoPlay={!isMobile}
            />
          )}

          {/* Mobile: user-play overlay for native videos when awaiting gesture */}
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
                  } catch (err) {
                    console.warn('Mobile manual play failed', err);
                  }
                }}
                className="bg-white/10 hover:bg-white/20 text-white rounded-full p-6"
              >
                <Play size={36} />
              </button>
            </div>
          )}

          {/* Modal player controls */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300">
            <div className="absolute bottom-0 left-0 right-0 p-4">
              {/* Progress bar */}
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
                
                <div className="text-sm text-gray-300">
                  {playingEpisode.title}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Episode info */}
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

  if (shows.length === 0 || !currentShow) {
    return (
      <div className="w-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg p-6 mb-4">
        <div className="text-center text-white">
          <h3 className="text-lg font-semibold mb-2">No Studio Shows Available</h3>
          <p className="text-sm opacity-90">Check back later for live shows and videos!</p>
        </div>
      </div>
    );
  }

  // Always render the video player once, only change container style for fullscreen
  const videoWrapperClass = isFullscreen
    ? "fixed inset-0 bg-black z-[9999] flex items-center justify-center"
    : "w-full mb-6";
  const videoWrapperStyle = isFullscreen
    ? { width: '100vw', height: '100vh', backgroundColor: 'black' }
    : {};

  return (
    <div ref={videoContainerRef} className={videoWrapperClass} style={videoWrapperStyle}>
      <Card className={isFullscreen ? "w-full h-full m-0 p-0 bg-transparent border-none shadow-none" : "mb-4"}>
        <CardContent className={isFullscreen ? "p-0 w-full h-full" : "p-0"}>
          <div className={isFullscreen ? "relative w-full h-full" : "relative aspect-video rounded-lg overflow-hidden bg-black"}>
            {currentShow?.video_url ? (
              renderVideoPlayer(isFullscreen)
            ) : currentShow?.thumbnail_url ? (
              <div className="relative w-full h-full">
                <img
                  src={currentShow.thumbnail_url}
                  alt={currentShow.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/placeholder.svg';
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

            {/* Overlays and controls */}
            <div className={`absolute inset-0 transition-opacity duration-300 ${showOverlay ? 'opacity-100' : 'opacity-0'} pointer-events-none`}>
              {/* Centered Play/Pause floating control */}
              <button
                onClick={(e) => { e.stopPropagation(); togglePlayPause(e); }}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-3 rounded-full z-30 pointer-events-auto"
                aria-label="Play/Pause"
              >
                {isVideoPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
              </button>

              {/* Exit fullscreen button (only in fullscreen) */}
              {isFullscreen && (
                <button
                  onClick={() => {
                    setIsFullscreen(false);
                    document.body.style.overflow = 'auto';
                    if (document.exitFullscreen) {
                      document.exitFullscreen();
                    } else if ((document as any).webkitExitFullscreen) {
                      (document as any).webkitExitFullscreen();
                    } else if ((document as any).mozCancelFullScreen) {
                      (document as any).mozCancelFullScreen();
                    } else if ((document as any).msExitFullscreen) {
                      (document as any).msExitFullscreen();
                    }
                  }}
                  className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full z-20 pointer-events-auto"
                >
                  <X className="h-5 w-5" />
                </button>
              )}

              {/* Live indicator */}
              {currentShow?.is_live && (
                <div className={`absolute top-4 left-4 z-${isFullscreen ? '20' : '10'} pointer-events-auto`}> 
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <Badge className="bg-red-500 text-white text-sm font-medium">LIVE</Badge>
                  </div>
                </div>
              )}

              {currentShow && (
                <div className={`absolute bottom-4 left-4 px-3 py-1 rounded-full text-sm font-medium z-${isFullscreen ? '20' : '10'} ${getTimeStatus(currentShow).className} pointer-events-auto`}>
                  {currentShow.is_live && <Eye className="inline w-4 h-4 mr-1" />}
                  {!currentShow.is_live && currentShow.scheduled_time && <Clock className="inline w-4 h-4 mr-1" />}
                  {getTimeStatus(currentShow).text}
                </div>
              )}

              {/* Mobile Overlay Bar */}
              <div className={`sm:hidden absolute bottom-16 right-2 flex flex-col space-y-2 z-${isFullscreen ? '20' : '10'} pointer-events-auto`}>
                <div className="flex flex-row items-center bg-black/50 text-white px-3 py-1 rounded-full pointer-events-auto">
                  <Users className="w-4 h-4 text-red-500 mr-1" />
                  <span className="text-[10px] font-medium">{viewerCount.toLocaleString()}</span>
                </div>
                <div className="flex flex-row items-center bg-black/50 text-pink-500 px-3 py-1 rounded-full cursor-pointer hover:bg-black/70 pointer-events-auto" onClick={handleLike}>
                  <Heart className="w-4 h-4 fill-current mr-1" />
                  <span className="text-[10px] font-medium text-white">{likeCount}</span>
                </div>
                <div className="flex flex-row items-center bg-black/50 text-blue-500 px-3 py-1 rounded-full cursor-pointer hover:bg-black/70 pointer-events-auto" onClick={handleCommentClick}>
                  <MessageCircle className="w-4 h-4 mr-1" />
                  <span className="text-[10px] font-medium text-white">{messages.length}</span>
                </div>
              </div>

              {/* Mute toggle for YouTube in overlays */}
              {isYouTubeUrl(currentShow?.video_url || '') && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleMuteToggle(); }}
                  className={`absolute bottom-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors z-${isFullscreen ? '20' : '10'} pointer-events-auto`}
                >
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
              )}
            </div>
          </div>
          {/* Description and Now Watching (portrait only) */}
          {!isFullscreen && currentShow && (
            <div className="p-4 flex flex-col gap-2">
              <div className="flex flex-col sm:flex-row gap-2 items-stretch w-full overflow-hidden min-h-[4.25rem]">
                <div
                  className="flex flex-col justify-between text-white px-4 py-2 rounded-lg shadow w-full sm:w-1/3 max-w-full"
                  style={{
                    backgroundImage: 'linear-gradient(to right, #2d5676, #7812bb)',
                  }}
                >
                  <div className="flex items-center space-x-1 mb-1">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                    <span className="text-[10px] font-semibold uppercase bg-white/20 text-white px-2 py-1 rounded-full shadow">
                      Now Watching
                    </span>
                  </div>
                  <span className="text-sm font-bold line-clamp-1 mt-auto">
                    {currentShow.title}
                  </span>
                </div>
                {currentShow.description && (
                  <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 to-gray-900 text-white px-6 py-2 rounded-lg font-medium text-sm shadow w-full h-full flex items-center min-h-[3.5rem]">
                    <div
                      className="marquee-text whitespace-nowrap animate-marquee"
                      style={{ animationDuration: '18s' }}
                    >
                      {currentShow.description}
                    </div>
                  </div>
                )}
                {/* IMPROVED CATCH UP BUTTON - matches description badge height */}
                <div className="flex items-center">
                  <button
                    onClick={() => setCatchUpOpen(true)}
                    className="inline-flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow h-full min-h-[3.5rem] transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      backgroundImage: 'linear-gradient(to right, #8B5CF6, #EC4899)',
                      height: '100%',
                      minHeight: '3.5rem'
                    }}
                    aria-label="Open Catch Up"
                  >
                    <Clock className="w-4 h-4" />
                    <span>Catch Up</span>
                  </button>
                </div>
              </div>
              
              <style>{`
                @keyframes marquee {
                  0% { transform: translateX(100%); }
                  100% { transform: translateX(-100%); }
                }
                .animate-marquee {
                  display: inline-block;
                  will-change: transform;
                  animation: marquee 18s linear infinite;
                }
              `}</style>
            </div>
          )}
          {/* Enhanced Modal */}
          {portalMounted && currentShow && createPortal(
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 pointer-events-auto">
              {/* Backdrop */}
              <div 
                className={`absolute inset-0 bg-black/90 backdrop-blur-md transition-opacity duration-300 ${modalVisible ? 'opacity-100' : 'opacity-0'}`}
                onClick={() => setCatchUpOpen(false)}
              />
              
              {/* Modal Content */}
              <div 
                className={`relative bg-gray-900 dark:bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden transform transition-all duration-300 ${modalVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'}`}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-white">Catch Up</h2>
                      <p className="text-sm text-gray-400 mt-1">Watch all past shows you've missed</p>
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

                {/* Content Area */}
                <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
                  <div className="p-6">
                    {/* Inline Player */}
                    {renderModalPlayer()}

                    {/* VOD Library - show all past shows across all series */}
                    <div className="mb-8">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-semibold text-white"></h3>
                        <div className="flex items-center space-x-2 text-sm text-gray-400">
                          <span>Scroll for more</span>
                          <ChevronRight size={16} />
                        </div>
                      </div>
                      
                      <VODLibrary 
                        showId={""}
                        showAllPastShows={true}
                        onEpisodeSelect={playEpisode}
                        playingEpisodeId={playingEpisode?.id}
                      />
                    </div>

                    {/* Pagination Controls */}
                    <div className="flex items-center justify-between pt-6 border-t border-gray-800">
                      <button className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 rounded-lg hover:bg-gray-800">
                        <ChevronLeft size={20} />
                        <span>Previous</span>
                      </button>
                      <div className="flex items-center space-x-2">
                        {[1, 2, 3, 4, 5].map((num) => (
                          <button
                            key={num}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors ${num === 1 ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
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
            document.body
          )}
        </CardContent>
      </Card>
    </div>
  );
};