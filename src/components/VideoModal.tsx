import React, { useState, useEffect, useRef, useCallback } from 'react';
import { specialBackgrounds } from './moment/specialBackgrounds';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, X, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getMediaUrl } from '@/utils/mediaUtils';
import { HeartAnimation } from './HeartAnimation';
import { ViewersModal } from './ViewersModal';
import { LikesModal } from './LikesModal';

// Utility to determine if a color is "light" or "dark"
function getContrastYIQ(bg: string): '#222' | '#fff' {
  if (bg.startsWith('linear-gradient') || bg.startsWith('radial-gradient')) return '#fff';
  if (bg.startsWith('url(')) return '#fff';
  let hex = bg;
  if (hex.startsWith('#')) hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
  if (hex.length !== 6) return '#fff';
  const r = parseInt(hex.substr(0,2),16);
  const g = parseInt(hex.substr(2,2),16);
  const b = parseInt(hex.substr(4,2),16);
  const yiq = ((r*299)+(g*587)+(b*114))/1000;
  return yiq >= 180 ? '#222' : '#fff';
}

interface VideoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl?: string;
  imageUrl?: string;
  user: {
    name: string;
    avatar: string;
  };
  moment?: {
    id: string;
    content?: string;
    likes_count: number;
    userHasLiked: boolean;
    user_id: string;
    reply_count?: number;
    moment_bg?: string;
    moment_font?: string;
    moment_font_size?: number;
    moment_type?: string;
    moment_special_message?: string;
  moment_special_id?: string;
    media_url?: string;
    video_duration?: number;
    is_custom_special_day?: boolean;
    moment_special_icon?: string;
    moment_special_name?: string;
    views_count?: number;
    user?: {
      username?: string;
    };
  };
  onLike?: () => void;
  onReply?: () => void;
  onView?: () => void;
  moments?: any[];
  currentIndex?: number | null;
  onAdvance?: () => void;
  refreshReplyCount?: () => void;
  trimStart?: number;
  trimEnd?: number | null;
}

export const VideoModal: React.FC<VideoModalProps> = (props) => {
  // Video Trimmer State
  const [showTrimmer, setShowTrimmer] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(90);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);

  // Destructure props
  const {
    open,
    onOpenChange,
    videoUrl,
    imageUrl,
    user,
    moment: _moment,
    onLike,
    onReply,
    onView,
    moments = [],
    currentIndex: initialIndex = 0,
    onAdvance,
    refreshReplyCount
  } = props;

  const [comment, setComment] = useState('');
  const [replies, setReplies] = useState<any[]>([]);
  const [likesCount, setLikesCount] = useState<number>(Math.max(0, Number(props.moment?.likes_count) || 0));
  const [replyCount, setReplyCount] = useState<number>(Number(props.moment?.reply_count) || 0);
  const [viewsCount, setViewsCount] = useState<number>(Number(props.moment?.views_count) || 0);
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const { user: currentUser } = useAuth();

  // New state for modals and animations
  const [showViewersModal, setShowViewersModal] = useState(false);
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [showRepliesModal, setShowRepliesModal] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);

  // Story slider state
  const [storyIndex, setStoryIndex] = useState(initialIndex || 0);
  const [progress, setProgress] = useState<number[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);

  // View tracking state
  const [viewTracked, setViewTracked] = useState(false);
  const viewTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Get the current moment from the moments array
  const safeIndex = Math.max(0, Math.min(storyIndex, moments.length - 1));
  const moment = moments.length > 0 ? moments[safeIndex] : _moment;

  // Force re-mount of media/text content on storyIndex change
  const [contentKey, setContentKey] = useState(0);

  // Debug logging for special day detection
  useEffect(() => {
    console.log('=== SPECIAL DAY DEBUG ===');
    console.log('Current moment:', moment);
    console.log('moment.is_custom_special_day:', moment?.is_custom_special_day);
  console.log('moment.moment_special_id:', moment?.moment_special_id);
    console.log('moment.moment_special_icon:', moment?.moment_special_icon);
    console.log('moment.moment_special_name:', moment?.moment_special_name);
    console.log('moment.moment_special_message:', moment?.moment_special_message);
  }, [moment]);

  // Get current media URLs based on the current moment
  const getCurrentMediaUrls = useCallback(() => {
    console.log('Getting current media URLs for moment:', moment?.id, 'index:', storyIndex);

    // If there's no moment, fall back to external props
    if (!moment) {
      console.log('No moment found, using fallback URLs');
      return {
        currentVideoUrl: videoUrl || null,
        currentImageUrl: imageUrl || null,
        currentMediaUrl: ''
      };
    }

    // Normalize moment media URL: if it's a storage key (not a full URL), convert it
    let currentMediaUrl = moment.media_url || '';
    if (currentMediaUrl && !currentMediaUrl.match(/^https?:\/\//i) && !currentMediaUrl.startsWith('data:') && !currentMediaUrl.startsWith('blob:')) {
      try {
        currentMediaUrl = getMediaUrl(currentMediaUrl, 'posts') || currentMediaUrl;
      } catch (e) {
        console.debug('getMediaUrl failed to build full URL for', currentMediaUrl, e);
      }
    }
    console.log('Current media URL from moment:', currentMediaUrl);

    // Prefer the moment's media first. Only fall back to the component-level props
    const isMomentVideo = currentMediaUrl && currentMediaUrl.match(/\.(mp4|webm|ogg|mov|avi)$/i);
    const isMomentImage = currentMediaUrl && currentMediaUrl.match(/\.(jpe?g|png|gif|bmp|webp|svg)$/i);

    const currentVideoUrl = isMomentVideo ? currentMediaUrl : (videoUrl || null);
    const currentImageUrl = isMomentImage ? currentMediaUrl : (imageUrl || null);

    return {
      currentVideoUrl,
      currentImageUrl,
      currentMediaUrl
    };
  }, [moment, videoUrl, imageUrl, storyIndex]);

  const { currentVideoUrl, currentImageUrl, currentMediaUrl } = getCurrentMediaUrls();

  // Determine media type for current moment
  const isVideo = !!(currentVideoUrl || (currentMediaUrl && currentMediaUrl.match(/\.(mp4|webm|ogg|mov|avi)$/i)));
  const isImage = !!(currentImageUrl || (currentMediaUrl && currentMediaUrl.match(/\.(jpe?g|png|gif|bmp|webp|svg)$/i)));

  // Clean up timers
  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (viewTimerRef.current) {
      clearTimeout(viewTimerRef.current);
      viewTimerRef.current = null;
    }
  }, []);

  // Manual navigation handlers
  const handleNext = useCallback(() => {
    setStoryIndex(prevIndex => {
      if (moments.length === 0) return 0;
      if (prevIndex < moments.length - 1) {
        setContentKey(k => k + 1);
        setViewTracked(false); // Reset view tracking for new moment
        return prevIndex + 1;
      } else {
        onOpenChange(false);
        return prevIndex;
      }
    });
  }, [moments.length, onOpenChange]);

  const handlePrev = useCallback(() => {
    setStoryIndex(prevIndex => {
      if (prevIndex > 0) {
        setContentKey(k => k + 1);
        setViewTracked(false); // Reset view tracking for new moment
        return prevIndex - 1;
      }
      return prevIndex;
    });
  }, []);

  // Function to render special day overlay
  const renderSpecialDayOverlay = () => {
    if (!moment) return null;

    let icon = null;
    let message = null;

    console.log('Rendering special day overlay for moment:', moment.id);
    
    // Check for custom special day first
    if (moment.is_custom_special_day) {
      console.log('Found custom special day');
      icon = moment.moment_special_icon;
      message = moment.moment_special_message || moment.moment_special_name;
    }
    // Then check for predefined special days
    else if (moment.moment_special_id) {
      console.log('Found predefined special day with ID:', moment.moment_special_id);
      const special = specialBackgrounds.find(bg => bg.id === moment.moment_special_id);
      console.log('Special background found:', special);
      if (special) {
        icon = special.icon;
        message = moment.moment_special_message || special.description || special.name;
      }
    }

    console.log('Final overlay values - icon:', icon, 'message:', message);

    if (!icon && !message) {
      console.log('No special day content to display');
      return null;
    }

    return (
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 8,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          width: '100%',
          padding: '0 16px',
          pointerEvents: 'none',
          zIndex: 3,
        }}
      >
        {icon && (
          <span
            style={{
              fontSize: 32,
              textShadow: '0 2px 8px #0008',
              background: 'rgba(0,0,0,0.10)',
              borderRadius: 8,
              padding: '2px 6px',
              minWidth: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </span>
        )}
        {message && (
          <span
            style={{
              fontSize: 16,
              color: '#fff',
              background: 'rgba(0,0,0,0.35)',
              borderRadius: 8,
              padding: '2px 10px',
              fontWeight: 600,
              textShadow: '0 1px 4px #000',
              marginLeft: icon ? 'auto' : 0,
              marginRight: 0,
              minWidth: 60,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
            }}
          >
            {message}
          </span>
        )}
      </div>
    );
  };

  // Reset story index when modal opens or initialIndex changes
  useEffect(() => {
    if (open) {
      console.log('Modal opened, setting initial index:', initialIndex, 'moments count:', moments.length);
      setStoryIndex(initialIndex || 0);
      setContentKey(prev => prev + 1);
      setShowTrimmer(false);
      setVideoDuration(null);
      setTrimStart(0);
      setTrimEnd(90);
      setShowReplyForm(false);
      setViewTracked(false); // Reset view tracking
    }
    setProgress(prev => {
      if (moments.length === prev.length) return prev;
      return Array(moments.length).fill(0);
    });
    if (!open) {
      clearTimers();
    }
  }, [open, initialIndex, moments.length, clearTimers]);

  // View tracking effect - triggers after 5 seconds of viewing
  useEffect(() => {
    if (!open || !moment || viewTracked || !currentUser) return;

    console.log('Starting view tracking timer for moment:', moment.id);
    
    // Clear any existing timer
    if (viewTimerRef.current) {
      clearTimeout(viewTimerRef.current);
    }

    // Set a 5-second timer to track the view
    viewTimerRef.current = setTimeout(async () => {
      console.log('5 seconds elapsed, tracking view for moment:', moment.id);
      setViewTracked(true);
      
      try {
        // Check if user already viewed this moment
        const { data: existingView } = await supabase
          .from('moment_views')
          .select('id')
          .eq('moment_id', moment.id)
          .eq('user_id', currentUser.id)
          .single();

        if (!existingView) {
          // Insert new view record
          const { error } = await supabase
            .from('moment_views')
            .insert({
              moment_id: moment.id,
              user_id: currentUser.id,
              viewed_at: new Date().toISOString()
            });

          if (!error) {
            await fetchViewers();
            setViewsCount(prev => prev + 1);
            console.log('View recorded successfully');
          }
        } else {
          await fetchViewers();
        }
      } catch (error) {
        console.error('Error recording view:', error);
      }
      
      // Call the onView prop if provided
      if (onView) {
        onView();
      }
    }, 5000);

    return () => {
      if (viewTimerRef.current) {
        clearTimeout(viewTimerRef.current);
        viewTimerRef.current = null;
      }
    };
  }, [open, moment?.id, viewTracked, currentUser, onView]);

  // Enhanced video duration detection effect
  useEffect(() => {
    if (!open || !isVideo || !moment) {
      console.log('Skipping video duration detection:', { open, isVideo, moment: !!moment });
      return;
    }

    console.log('=== STARTING VIDEO DURATION DETECTION ===');
    console.log('Current video URL:', currentVideoUrl);
    console.log('Current media URL:', currentMediaUrl);
    
    setVideoDuration(null);
    setShowTrimmer(false);
    
    const detectDuration = () => {
      const videoSelectors = [
        `video[src="${currentVideoUrl || currentMediaUrl}"]`,
        'video',
        '.video-container video',
        '[data-testid="video-player"] video'
      ];
      
      let videoElement: HTMLVideoElement | null = null;
      
      for (const selector of videoSelectors) {
        videoElement = document.querySelector(selector) as HTMLVideoElement;
        if (videoElement) {
          console.log('Found video element with selector:', selector);
          break;
        }
      }
      
      if (!videoElement) {
        console.log('No video element found with any selector');
        return;
      }
      
      console.log('Video element found:', {
        src: videoElement.src,
        readyState: videoElement.readyState,
        duration: videoElement.duration
      });
      
      const handleLoadedMetadata = () => {
        console.log('=== VIDEO METADATA LOADED ===');
        console.log('Video duration:', videoElement.duration);
        
        if (videoElement.duration && !isNaN(videoElement.duration)) {
          setVideoDuration(videoElement.duration);
          
          if (videoElement.duration > 90) {
            console.log('Video duration > 90s, SHOWING TRIMMER');
            setShowTrimmer(true);
            setTrimStart(0);
            setTrimEnd(90);
          } else {
            console.log('Video duration <= 90s, not showing trimmer');
          }
        } else {
          console.log('Invalid video duration:', videoElement.duration);
        }
      };

      if (videoElement.readyState >= 1) {
        console.log('Video metadata already loaded');
        handleLoadedMetadata();
      } else {
        console.log('Waiting for video metadata to load...');
        videoElement.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
        
        if (videoElement.readyState === 0) {
          videoElement.load();
        }
      }
    };

    detectDuration();
    const timeout1 = setTimeout(detectDuration, 500);
    const timeout2 = setTimeout(detectDuration, 1000);
    const timeout3 = setTimeout(detectDuration, 2000);
    
    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      clearTimeout(timeout3);
    };
  }, [open, isVideo, moment?.id, currentVideoUrl, currentMediaUrl, contentKey]);

  // Progress animation logic
  useEffect(() => {
    console.log('Progress effect triggered - open:', open, 'moment:', !!moment, 'moments.length:', moments.length, 'storyIndex:', storyIndex);
    
    if (!open || !moment || moments.length === 0) return;

    clearTimers();
    
    setProgress(prev => {
      const arr = [...prev];
      arr[storyIndex] = 0;
      return arr;
    });

    if (isVideo && showTrimmer || showReplyForm) {
      console.log('Video needs trimming or reply form is open, not starting auto-animation');
      return;
    }

    let duration = 7000;
    if (moment.moment_type === 'text' && moment.content) {
      const wordCount = moment.content.split(/\s+/).length;
      duration = Math.max(7000, Math.min(15000, wordCount * 200));
    }
    
    if (moment.moment_type === 'video' && moment.video_duration) {
      duration = Math.max(2000, Math.min(90000, moment.video_duration * 1000));
    } else if (isVideo && videoDuration && videoDuration <= 90) {
      duration = Math.max(2000, Math.min(90000, videoDuration * 1000));
    }

    console.log('Starting progress animation with duration:', duration);
    
    let start = Date.now();
    let frameId: number;
    
    const animate = () => {
      if (!open || !moment || moments.length === 0) return;
      if (isPaused || showReplyForm) {
        frameId = requestAnimationFrame(animate);
        return;
      }
      
      const elapsed = Date.now() - start;
      const percent = Math.min(1, elapsed / duration);
      
      setProgress(prev => {
        const arr = [...prev];
        arr[storyIndex] = percent;
        return arr;
      });
      
      if (percent < 1) {
        frameId = requestAnimationFrame(animate);
      } else {
        setProgress(prev => {
          const arr = [...prev];
          arr[storyIndex] = 1;
          return arr;
        });
        setTimeout(() => handleNext(), 100);
      }
    };
    
    animate();
    
    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [storyIndex, open, moment?.id, isPaused, isVideo, moments.length, handleNext, clearTimers, showTrimmer, videoDuration, showReplyForm]);

  useEffect(() => {
    if (isPaused) {
      pausedTimeRef.current = Date.now() - startTimeRef.current - pausedTimeRef.current;
    } else {
      startTimeRef.current = Date.now();
    }
  }, [isPaused]);

  useEffect(() => {
    if (moment && currentUser && moment.id) {
      fetchReplies();
      fetchLikes();
      fetchViewers();
      // Initialize counts from moment data
      setLikesCount(Math.max(0, Number(moment.likes_count) || 0));
      setReplyCount(Number(moment.reply_count) || 0);
      setViewsCount(Number(moment.views_count) || 0);
    }
  }, [moment?.id, moment?.likes_count, moment?.reply_count, moment?.views_count]);

  // Fetch likes function
  const fetchLikes = async () => {
    if (!moment) return;
    try {
      const { data, error } = await supabase
        .from('likes')
        .select('id, user_id, created_at, users (username, first_name, last_name, avatar_url)')
        .eq('post_id', moment.id)
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        setLikesCount(Math.max(0, data.length));
      }
    } catch (error) {
      console.error('Error fetching likes:', error);
    }
  };

  // Fetch viewers function
  const fetchViewers = async () => {
    if (!moment) return;
    try {
      const { data, error } = await supabase
        .from('moment_views')
        .select('id, user_id, viewed_at, users (username, first_name, last_name, avatar_url)')
        .eq('moment_id', moment.id)
        .order('viewed_at', { ascending: false });
      
      if (!error && data) {
        setViewsCount(Math.max(0, data.length));
      }
    } catch (error) {
      console.error('Error fetching viewers:', error);
    }
  };

  // Fetch replies function
  const fetchReplies = async () => {
    if (!moment) return;
    try {
      const { data, error } = await supabase
        .from('moment_replies')
        .select('id, user_id, content, created_at, users (username, first_name, last_name, avatar_url)')
        .eq('moment_id', moment.id)
        .order('created_at', { ascending: true });
      if (!error && data) {
        setReplies(data);
        setReplyCount(data.length);
      }
    } catch (error) {
      console.error('Error fetching replies:', error);
    }
  };

  const handleSubmitComment = async () => {
    if (!comment.trim() || !moment || !currentUser) return;
    setSending(true);
    setReplyError(null);
    try {
      const { error } = await supabase
        .from('moment_replies')
        .insert({
          moment_id: moment.id,
          user_id: currentUser.id,
          content: comment.trim(),
        });
      if (error) throw error;
      setComment('');
      fetchReplies();
      setReplyCount(c => Number(c) + 1);
      
      if (typeof props.onReply === 'function') {
        props.onReply();
      }
      if (refreshReplyCount) refreshReplyCount();
      
      if (moment.user_id !== currentUser.id) {
        await supabase.from('notifications').insert({
          user_id: moment.user_id,
          type: 'moment_reply',
          title: 'New reply to your moment',
          message: `${currentUser.email || 'Someone'} replied: ${comment.trim()}`,
          data: { momentId: moment.id, userId: currentUser.id, content: comment.trim() },
          read: false
        });
      }
      setShowReplyForm(false);
    } catch (err: any) {
      setReplyError(err.message || 'Failed to send reply.');
    } finally {
      setSending(false);
    }
  };

  const toggleReplyForm = () => {
    setShowReplyForm(!showReplyForm);
  };

  const handleLike = async () => {
    if (!onLike || !moment || !currentUser) return;
    try {
      // Check if user already liked this moment
      const { data: existingLike } = await supabase
        .from('likes')
        .select('id')
        .eq('post_id', moment.id)
        .eq('user_id', currentUser.id)
        .single();

      if (existingLike) {
        // Unlike - remove the like
        await supabase
          .from('likes')
          .delete()
          .eq('post_id', moment.id)
          .eq('user_id', currentUser.id);
        await fetchLikes();
        setShowHeartAnimation(false);
        console.log('Moment unliked');
      } else {
        // Like - add the like
        await supabase
          .from('likes')
          .insert({
            post_id: moment.id,
            user_id: currentUser.id,
            reaction_type: 'like',
            created_at: new Date().toISOString()
          });
        await fetchLikes();
        setShowHeartAnimation(true);
        setTimeout(() => setShowHeartAnimation(false), 1200);
        console.log('Moment liked, showing heart animation');
      }

      // Call the parent onLike handler
      if (onLike) {
        onLike();
      }

    } catch (error) {
      console.error('Error handling like:', error);
    }
  };

  const handleHeartAnimationComplete = () => {
    setShowHeartAnimation(false);
  };

  // Check if current user has liked this moment
  const [userHasLiked, setUserHasLiked] = useState(false);
  
  useEffect(() => {
    const checkUserLike = async () => {
      if (!moment || !currentUser) return;

      try {
        const { data } = await supabase
          .from('likes')
          .select('id')
          .eq('post_id', moment.id)
          .eq('user_id', currentUser.id)
          .single();

        setUserHasLiked(!!data);
      } catch (error) {
        setUserHasLiked(false);
      }
    };

    checkUserLike();
  }, [moment?.id, currentUser?.id, likesCount]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="dark:bg-[#161616] p-0 gap-0"
          style={{ width: '95vw', maxWidth: '95vw', marginLeft: 'auto', marginRight: 'auto', borderRadius: '18px', paddingLeft: '2vw', paddingRight: '2vw' }}
        >
          {/* Progress bar for all moments */}
          <div className="flex w-full gap-1 px-3 pt-3">
            {moments.map((m, idx) => (
              <div key={m.id || idx} className="flex-1 h-1 bg-gray-700 rounded overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-200"
                  style={{ 
                    width: `${(progress[idx] || 0) * 100}%`, 
                    opacity: idx <= storyIndex ? 1 : 0.3
                  }}
                />
              </div>
            ))}
          </div>
          
          <div
            className="relative"
            onMouseDown={() => setIsPaused(true)}
            onMouseUp={() => setIsPaused(false)}
            onMouseLeave={() => setIsPaused(false)}
            onTouchStart={() => setIsPaused(true)}
            onTouchEnd={() => setIsPaused(false)}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="absolute top-2 right-2 z-10 bg-black/50 text-white hover:bg-black/70"
            >
              <X className="h-4 w-4" />
            </Button>
            
            {/* Prev/Next navigation */}
            {storyIndex > 0 && (
              <button 
                onClick={handlePrev} 
                className="absolute left-0 top-0 bottom-0 w-1/4 z-10 bg-transparent cursor-pointer" 
                aria-label="Previous" 
              />
            )}
            {storyIndex < moments.length - 1 && (
              <button 
                onClick={handleNext} 
                className="absolute right-0 top-0 bottom-0 w-1/4 z-10 bg-transparent cursor-pointer" 
                aria-label="Next" 
              />
            )}
            
            {/* Moment content */}
            {isVideo ? (
              <div 
                className="relative w-full max-h-[60vh] flex items-center justify-center bg-black overflow-visible"
                style={{ minHeight: 320, minWidth: '100%', overflow: 'visible' }}
              >
                <video
                  key={`${contentKey}-video-${storyIndex}-${moment?.id}`}
                  src={currentVideoUrl || currentMediaUrl}
                  controls
                  className="w-full max-h-[60vh] object-contain bg-black"
                  style={{ objectFit: 'contain', maxWidth: '100%', maxHeight: '60vh', background: 'black', zIndex: 1 }}
                  autoPlay
                  onEnded={handleNext}
                  onTimeUpdate={(e) => {
                    const videoEl = e.currentTarget;
                    if (trimEnd && videoEl.currentTime >= trimEnd) {
                      videoEl.pause();
                      handleNext();
                    }
                  }}
                />
                {/* Special day overlay for videos */}
                {renderSpecialDayOverlay()}
              </div>
            ) : isImage ? (
              <div className="relative w-full max-h-[60vh] flex items-center justify-center bg-black">
                <img
                  key={`${contentKey}-image-${storyIndex}-${moment?.id}`}
                  src={currentImageUrl || currentMediaUrl}
                  alt="Moment"
                  className="w-full max-h-[60vh] object-contain bg-black"
                  style={{ objectFit: 'contain', maxWidth: '100%', maxHeight: '60vh', background: 'black' }}
                />
                {/* Special day overlay for images */}
                {renderSpecialDayOverlay()}
              </div>
            ) : moment?.moment_type === 'text' ? (
              <div
                key={`${contentKey}-text-${storyIndex}-${moment?.id}`}
                className="w-full flex items-center justify-center text-center relative"
                style={{
                  background: moment.moment_bg || '#222',
                  fontFamily: moment.moment_font || 'inherit',
                  fontSize: moment.moment_font_size ? `${moment.moment_font_size}px` : '2rem',
                  color: getContrastYIQ(moment.moment_bg || '#222'),
                  minHeight: 240,
                  minWidth: '100%',
                  overflow: 'hidden',
                  padding: 24,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 16,
                  boxSizing: 'border-box',
                  wordBreak: 'break-word',
                  backgroundBlendMode: 'overlay',
                  filter: 'brightness(var(--moment-bg-brightness, 1))',
                }}
                data-theme={typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'}
              >
                <style>{`
                  [data-theme="dark"] {
                    --moment-text-color: #fff;
                    --moment-bg-brightness: 0.9;
                  }
                  [data-theme="light"] {
                    --moment-text-color: #222;
                    --moment-bg-brightness: 1.05;
                  }
                `}</style>
                <span style={{ color: getContrastYIQ(moment.moment_bg || '#222'), width: '100%', zIndex: 1 }}>
                  {moment.content}
                </span>
                
                {/* Special day overlay for text moments */}
                {renderSpecialDayOverlay()}
              </div>
            ) : null}
          </div>

          <div className="p-4 space-y-4">
            {/* User info */}
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={user.avatar} />
                <AvatarFallback>{user.name[0]}</AvatarFallback>
              </Avatar>
              <div>
                <span className="font-medium text-gray-900 dark:text-gray-100">{user.name}</span>
                {moment?.user?.username && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">@{moment.user.username}</div>
                )}
                {moment?.content && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{moment.content}</p>
                )}
              </div>
            </div>

            {/* Reactions - Updated with clickable counts and heart animation */}
            <div className="flex items-center space-x-4">
              {onLike && moment && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLike}
                  className={`${userHasLiked ? 'text-red-500' : 'text-gray-500'} hover:text-red-500`}
                >
                  <Heart className={`h-5 w-5 mr-1 ${userHasLiked ? 'fill-current' : ''}`} />
                  <span 
                    className="cursor-pointer hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowLikesModal(true);
                    }}
                  >
                    {likesCount}
                  </span>
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-gray-500 hover:text-blue-500"
                onClick={toggleReplyForm}
              >
                <MessageCircle className="h-5 w-5 mr-1" />
                {replyCount}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-500 hover:text-green-500"
                onClick={() => {
                  fetchViewers();
                  setShowViewersModal(true);
                }}
              >
                <Eye className="h-5 w-5 mr-1" />
                <span className="cursor-pointer hover:underline">
                  {viewsCount}
                </span>
              </Button>
            </div>

            {/* Comment form - now animated and conditionally rendered */}
            {showReplyForm && (
              <div className={`transition-all duration-300 ${showReplyForm ? 'opacity-100 max-h-40' : 'opacity-0 max-h-0'}`}>
                <div className="flex space-x-2">
                  <Input
                    placeholder="Add a comment..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSubmitComment()}
                    className="flex-1"
                    disabled={sending}
                    autoFocus
                  />
                  <Button 
                    onClick={handleSubmitComment}
                    size="sm"
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    disabled={sending}
                  >
                    {sending ? 'Sending...' : 'Send'}
                  </Button>
                </div>
                {replyError && <div className="text-red-500 text-sm mt-1">{replyError}</div>}
              </div>
            )}

            {/* Replies preview (first 2 inline) */}
            {replies.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold mb-2">Replies</h4>
                <ul className="space-y-2">
                  {replies.slice(0, 2).map(reply => (
                    <li key={reply.id} className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <div className="flex items-center gap-2">
                        <img src={reply.users?.avatar_url || '/placeholder.svg'} alt="avatar" className="w-6 h-6 rounded-full" />
                        <span className="font-medium">{reply.users?.first_name || ''} {reply.users?.last_name || ''} (@{reply.users?.username})</span>
                        <span className="text-xs text-gray-400 ml-auto">{new Date(reply.created_at).toLocaleString()}</span>
                      </div>
                      <div className="ml-8 text-gray-800 dark:text-gray-200">{reply.content}</div>
                    </li>
                  ))}
                </ul>
                {replies.length > 2 && (
                  <button
                    className="mt-2 text-blue-500 hover:underline text-sm font-medium"
                    onClick={() => setShowRepliesModal(true)}
                  >
                    View all replies ({replies.length})
                  </button>
                )}
              </div>
            )}
          </div>
        </DialogContent>

        {/* Replies Bottom Sheet Modal */}
        {showRepliesModal && (
          <Dialog open={showRepliesModal} onOpenChange={setShowRepliesModal}>
            <DialogContent className="sm:max-w-[600px] w-full dark:bg-[#161616] p-0 gap-0 rounded-t-2xl mx-auto left-1/2 -translate-x-1/2 fixed bottom-0 animate-slideUp">
              <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mt-2 mb-4" />
              <h4 className="font-semibold mb-2 px-4">All Replies ({replies.length})</h4>
              <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-8" style={{ maxHeight: '50vh' }}>
                <ul className="space-y-2">
                  {replies.map(reply => (
                    <li key={reply.id} className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <div className="flex items-center gap-2">
                        <img src={reply.users?.avatar_url || '/placeholder.svg'} alt="avatar" className="w-6 h-6 rounded-full" />
                        <span className="font-medium">{reply.users?.first_name || ''} {reply.users?.last_name || ''} (@{reply.users?.username})</span>
                        <span className="text-xs text-gray-400 ml-auto">{new Date(reply.created_at).toLocaleString()}</span>
                      </div>
                      <div className="ml-8 text-gray-800 dark:text-gray-200">{reply.content}</div>
                    </li>
                  ))}
                </ul>
              </div>
              <Button className="mt-4 w-full" onClick={() => setShowRepliesModal(false)}>Close</Button>
            </DialogContent>
          </Dialog>
        )}
      </Dialog>

      {/* Heart Animation */}
      <HeartAnimation 
        triggerAnimation={showHeartAnimation}
        onAnimationComplete={handleHeartAnimationComplete}
      />

      {/* Viewers Modal */}
      {moment && (
        <ViewersModal
          open={showViewersModal}
          onOpenChange={setShowViewersModal}
          momentId={moment.id}
          viewsCount={viewsCount}
        />
      )}

      {/* Likes Modal */}
      {moment && (
        <LikesModal
          open={showLikesModal}
          onOpenChange={setShowLikesModal}
          momentId={moment.id}
          likesCount={likesCount}
        />
      )}
    </>
  );
};
