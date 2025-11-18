import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Play, Pause, Clock, Eye, Volume2, VolumeX, Heart, MessageCircle, Users } from 'lucide-react';
import { useShowContext } from '@/contexts/ShowContext';
import { useViewTracking } from '@/hooks/useViewTracking';
import { useLiveChatMessages } from '@/hooks/useLiveChatMessages';

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
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const overlayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const youtubePlayerRef = useRef<any>(null);
  const vimeoRef = useRef<HTMLIFrameElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  // Enhanced fullscreen handling with seamless video continuation
  useEffect(() => {
    const handleOrientationChange = () => {
      const isMobile = window.innerWidth < 768;
      const isLandscape = window.matchMedia('(orientation: landscape)').matches;
      
      console.log('Orientation change:', { isMobile, isLandscape, isFullscreen });
      
      // Store current video time before orientation change
      if (videoRef.current) {
        setVideoCurrentTime(videoRef.current.currentTime);
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
      youtubePlayerRef.current.destroy();
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
            setIsVideoPlaying(event.data === 1);
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
            setIsVideoPlaying(true);
          },
        },
      });
    }

    return () => {
      if (youtubePlayerRef.current) {
        youtubePlayerRef.current.destroy();
        youtubePlayerRef.current = null;
      }
    };
  }, [currentShow, ytReady, muted]);

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
      setVideoCurrentTime(videoRef.current.currentTime);
    }
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
            // Restore video time if transitioning between modes
            if (videoRef.current && videoCurrentTime > 0) {
              videoRef.current.currentTime = videoCurrentTime;
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
                  <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 to-gray-900 text-white px-6 py-2 rounded-lg font-medium text-sm shadow w-full h-full flex items-center">
                    <div
                      className="marquee-text whitespace-nowrap animate-marquee"
                      style={{ animationDuration: '18s' }}
                    >
                      {currentShow.description}
                    </div>
                  </div>
                )}
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
        </CardContent>
      </Card>
    </div>
  );
};
