import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Lock, 
  Camera, 
  Clock, 
  ChevronLeft, 
  Zap, 
  Sparkles, 
  Shield,
  Video,
  Play,
  Square,
  Maximize2,
  X,
  Upload,
  Hash,
  Timer,
  FlipHorizontal2,
  Monitor,
  Smartphone,
  RotateCw,
  AlertCircle,
  Tag, // ADDED
  Users, // ADDED
  Globe, // ADDED
  Share2
} from 'lucide-react';
import { 
  getSafariCompatibleMimeType, 
  getFileExtensionFromMimeType, 
  createSafariCompatibleVideoBlob,
  createOptimizedVideoURL,
  cleanupVideoURL,
  isSafariOrIOS 
} from '@/utils/safariVideoUtils';

const RecordReel = () => {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [caption, setCaption] = useState('');
  const captionRef = useRef<HTMLInputElement | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDeviceId, setVideoDeviceId] = useState<string | null>(null);
  const [isLandscape, setIsLandscape] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? window.innerWidth > window.innerHeight : false;
  });
  const [orientation, setOrientation] = useState<'portrait' | 'landscape' | 'unknown'>('unknown');
  const [preferredOrientation, setPreferredOrientation] = useState<'auto' | 'portrait' | 'landscape'>('auto');
  const [timer, setTimer] = useState(90);
  const [isUploading, setIsUploading] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentMimeType, setCurrentMimeType] = useState<string>('');
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const [isOrientationLocked, setIsOrientationLocked] = useState(false);
  
  // ADDED: Share to feed states
  const [shareToFeed, setShareToFeed] = useState(false);
  const [feedCaption, setFeedCaption] = useState('');
  const feedCaptionRef = useRef<HTMLTextAreaElement | null>(null);
  const [feedCategories, setFeedCategories] = useState<string[]>([]);
  const [feedAudience, setFeedAudience] = useState<'public' | 'followers' | 'private'>('public');
  const [showShareSettings, setShowShareSettings] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const orientationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ADDED: Category options for feed
  const CATEGORY_OPTIONS = [
    'All', 'Tech', 'Comedy', 'Sports', 'Education', 'Inspiration',
    'Music', 'Gaming', 'Food', 'Fitness', 'Lifestyle', 'Art',
    'Kickstart',
  ];

  // ADDED: Audience options
  const AUDIENCE_OPTIONS = [
    { id: 'public', label: 'Public', icon: Globe, description: 'Visible to everyone' },
    { id: 'followers', label: 'Followers', icon: Users, description: 'Only your followers' },
    { id: 'private', label: 'Private', icon: Lock, description: 'Only you' }
  ];

  // Hash a file using SHA-256
  async function hashFile(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Get video duration
  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      try {
        const url = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;
        let done = false;
        const finish = (val: number) => {
          if (done) return;
          done = true;
          try { URL.revokeObjectURL(url); } catch {}
          resolve(val);
        };
        const timeoutId = window.setTimeout(() => {
          finish(-1);
        }, 7000);
        video.onloadedmetadata = () => {
          window.clearTimeout(timeoutId);
          if (!isFinite(video.duration) || video.duration === 0) {
            video.currentTime = 0.001;
            setTimeout(() => {
              finish(Number.isFinite(video.duration) ? Math.floor(video.duration) : -1);
            }, 250);
          } else {
            finish(Math.floor(video.duration));
          }
        };
        video.onerror = () => {
          window.clearTimeout(timeoutId);
          finish(-1);
        };
        video.src = url;
        try { video.load(); } catch {}
      } catch {
        resolve(-1);
      }
    });
  };

  // Cleanup video URL on unmount
  useEffect(() => {
    return () => {
      if (videoUrl) {
        cleanupVideoURL(videoUrl);
      }
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
      if (orientationTimeoutRef.current) {
        clearTimeout(orientationTimeoutRef.current);
      }
    };
  }, [videoUrl, mediaStream]);

  // 360-reels gating and toggle
  const location = useLocation();
  const [checking360, setChecking360] = useState(false);
  const [canEnable360, setCanEnable360] = useState(false);
  const [enable360, setEnable360] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('enable360');
      return v === '1';
    } catch (e) { return false; }
  });

  // If the page was opened with ?duration=360, pre-enable the toggle if permitted
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const duration = params.get('duration');
    if (duration === '360') {
      setEnable360(true);
    }
  }, [location.search]);
  // Selected mode state: '90' or '360'
  const [selectedMode, setSelectedMode] = useState<'90' | '360'>('90');

  // Unlock/locker UI helpers
  const [total90s, setTotal90s] = useState<number>(0);
  const requiredToUnlock360 = 10;
  const percentUnlocked = Math.min(100, Math.round((total90s / requiredToUnlock360) * 100));
  const remainingToUnlock = Math.max(0, requiredToUnlock360 - total90s);
  const lockerColorClass = canEnable360 ? 'bg-emerald-600/80 text-white' : 'bg-black/60';

  // Fetch user's count of 90s reels to determine unlock progress
  useEffect(() => {
    let mounted = true;
    const fetch90sCount = async () => {
      try {
        if (!user || !user.id) return;
        // Count studio_videos for this user with duration <= 90 (seconds)
        const { count, error } = await supabase
          .from('studio_videos')
          .select('*', { head: true, count: 'exact' })
          .eq('user_id', user.id)
          .lte('duration', 90);

        if (error) {
          console.warn('Failed to fetch 90s count:', error);
          return;
        }

        if (mounted && typeof count === 'number') {
          setTotal90s(count);
          setCanEnable360(count >= requiredToUnlock360);
        }
      } catch (e) {
        // ignore
      }
    };

    fetch90sCount();
    return () => { mounted = false; };
  }, [user]);

  const toggle360 = async () => {
    const next = !enable360;
    if (next && !canEnable360) {
      return;
    }
    setEnable360(next);
    try { localStorage.setItem('enable360', next ? '1' : '0'); } catch (e) {}
    if (next) setSelectedMode('360'); else setSelectedMode('90');
  };

  // Device orientation detection and management
  useEffect(() => {
    const updateOrientation = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isLandscapeMode = width > height;
      
      setIsLandscape(isLandscapeMode);
      setOrientation(isLandscapeMode ? 'landscape' : 'portrait');
      
      // Update video constraints based on orientation
      if (mediaStream && videoRef.current) {
        applyOrientationConstraints(isLandscapeMode);
      }
    };

    // Initial orientation
    updateOrientation();

    // Listen for orientation changes
    window.addEventListener('resize', updateOrientation);
    window.addEventListener('orientationchange', updateOrientation);

    // Try to use Screen Orientation API if available
    if (screen.orientation && 'onchange' in screen.orientation) {
      screen.orientation.addEventListener('change', updateOrientation);
    }

    return () => {
      window.removeEventListener('resize', updateOrientation);
      window.removeEventListener('orientationchange', updateOrientation);
      if (screen.orientation && 'onchange' in screen.orientation) {
        screen.orientation.removeEventListener('change', updateOrientation);
      }
    };
  }, [mediaStream]);

  // Function to apply orientation-based constraints to video
  const applyOrientationConstraints = (landscapeMode: boolean) => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    
    // Adjust video display based on orientation
    if (landscapeMode) {
      video.style.width = 'auto';
      video.style.height = '100%';
      video.style.objectFit = 'cover';
    } else {
      video.style.width = '100%';
      video.style.height = 'auto';
      video.style.objectFit = 'cover';
    }
  };

  // Toggle orientation lock
  const toggleOrientationLock = () => {
    setIsOrientationLocked(!isOrientationLocked);
    
    const so: any = (typeof screen !== 'undefined' ? (screen as any).orientation : null);
    if (!isOrientationLocked && so && typeof so.lock === 'function') {
      // Try to lock orientation to current orientation
      const targetOrientation = isLandscape ? 'landscape' : 'portrait';
      try {
        so.lock(targetOrientation).catch((err: unknown) => {
          console.warn('Failed to lock orientation:', err);
          setIsOrientationLocked(false);
        });
      } catch (e) {
        // Some browsers throw synchronously
        console.warn('Orientation lock error:', e);
        setIsOrientationLocked(false);
      }
    } else if (isOrientationLocked && so && typeof so.unlock === 'function') {
      try {
        so.unlock();
      } catch (e) {
        // ignore
      }
    }
  };

  // Set preferred orientation
  const setOrientationPreference = (pref: 'auto' | 'portrait' | 'landscape') => {
    setPreferredOrientation(pref);
    
    // If in preview mode, update camera constraints
    if (mediaStream && isPreviewing) {
      initializeCamera(facingMode, pref);
    }
  };

  // Initialize camera with orientation support
  const initializeCamera = async (newFacingMode?: 'user' | 'environment', orientationPref?: 'auto' | 'portrait' | 'landscape') => {
    const mode = newFacingMode || facingMode;
    const pref = orientationPref || preferredOrientation;
    
    // Stop existing stream if any
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
    }
    
    try {
      const constraints: any = { audio: true };
      
      // Calculate ideal video dimensions based on preferred orientation
      let idealWidth = 1280;
      let idealHeight = 720;
      
      if (pref === 'landscape' || (pref === 'auto' && isLandscape)) {
        // Landscape preference
        idealWidth = 1280;
        idealHeight = 720;
      } else if (pref === 'portrait') {
        // Portrait preference
        idealWidth = 720;
        idealHeight = 1280;
      }

      if (videoDeviceId) {
        constraints.video = { 
          deviceId: { exact: videoDeviceId }, 
          width: { ideal: idealWidth }, 
          height: { ideal: idealHeight },
          facingMode: { ideal: mode }
        };
      } else {
        constraints.video = { 
          facingMode: { ideal: mode }, 
          width: { ideal: idealWidth }, 
          height: { ideal: idealHeight }
        };
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // After getting permission, update available video devices
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const vids = devices.filter(d => d.kind === 'videoinput');
        setVideoDevices(vids);
        if (!videoDeviceId && vids.length > 0) {
          const preferred = vids.find(v => {
            const lbl = v.label.toLowerCase();
            if (mode === 'environment') return lbl.includes('back') || lbl.includes('rear') || lbl.includes('environment');
            return lbl.includes('front') || lbl.includes('user');
          });
          if (preferred) setVideoDeviceId(preferred.deviceId);
        }
      } catch (e) {
        // ignore enumerate errors
      }

      setMediaStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Apply initial orientation styling
        setTimeout(() => {
          applyOrientationConstraints(isLandscape);
        }, 100);
      }
      setPermissionError(null);
      return stream;
    } catch (err) {
      console.error('Camera/mic permission denied:', err);
      setPermissionError('Camera and microphone access is required to record a reel. Please enable permissions in your browser settings.');
      setIsPreviewing(false);
      return null;
    }
  };

  // Start recording flow helper
  const startRecording = (duration: number) => {
    if (duration === 360) {
      if (!canEnable360) return;
      setEnable360(true);
      try { localStorage.setItem('enable360', '1'); } catch (e) {}
      setSelectedMode('360');
    } else {
      setEnable360(false);
      try { localStorage.setItem('enable360', '0'); } catch (e) {}
      setSelectedMode('90');
    }
    handleStartPreview();
  };

  // Auto-start preview if route is /studio/record-preview
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      const duration = params.get('duration');
      if (location.pathname && location.pathname.includes('record-preview')) {
        const durNum = duration ? Number(duration) : (enable360 ? 360 : 90);
        setTimeout(() => {
          startRecording(durNum);
        }, 50);
      }
    } catch (e) {}
  }, [location.pathname]);

  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
      applyOrientationConstraints(isLandscape);
    }
  }, [mediaStream, isLandscape]);

  // Keep trying to play live preview while recording to avoid a black screen
  useEffect(() => {
    if (!isRecording || !videoRef.current) return;
    let cancelled = false;
    const tryPlay = async () => {
      if (cancelled) return;
      try {
        await videoRef.current?.play();
      } catch (e) {
        // ignore play errors
      }
    };
    tryPlay();
    const iv = setInterval(tryPlay, 1000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [isRecording, mediaStream]);

  // Ensure live preview remains attached and playing while recording
  useEffect(() => {
    if (!mediaStream || !videoRef.current) return;
    try {
      if (videoRef.current.srcObject !== mediaStream) {
        videoRef.current.srcObject = mediaStream;
      }
      // Try to play the video element — some browsers require a play() call
      const playPromise = (videoRef.current as HTMLVideoElement).play();
      if (playPromise && typeof (playPromise as any).catch === 'function') {
        (playPromise as any).catch(() => {
          // ignore play errors (autoplay policy); UI remains responsive
        });
      }
    } catch (e) {
      // ignore
    }
  }, [mediaStream, isRecording]);

  // Pause other page videos when opening preview so background reels don't keep playing
  useEffect(() => {
    if (!isPreviewing) return;
    try {
      document.querySelectorAll('video').forEach(v => {
        try {
          if (v !== videoRef.current) (v as HTMLVideoElement).pause();
        } catch (e) {}
      });
    } catch (e) {}
  }, [isPreviewing]);

  // When in landscape fullscreen preview, add a body class to hide global chrome (header/footer)
  useEffect(() => {
    const cls = 'studio-fullscreen-preview';
    try {
      if (isPreviewing && isLandscape) {
        document.body.classList.add(cls);
      } else {
        document.body.classList.remove(cls);
      }
    } catch (e) {
      // ignore
    }
    return () => {
      try { document.body.classList.remove(cls); } catch (e) {}
    };
  }, [isPreviewing, isLandscape]);

  // Populate available video input devices when component mounts
  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (!mounted) return;
        const vids = devices.filter(d => d.kind === 'videoinput');
        setVideoDevices(vids);
      } catch (e) {
        // ignore
      }
    };
    refresh();
    return () => { mounted = false; };
  }, []);

  const handleStartPreview = async () => {
    setIsPreviewing(true);
    setPermissionError(null);
    if (videoUrl) {
      cleanupVideoURL(videoUrl);
    }
    setVideoUrl(null);
    setRecordedChunks([]);
    // Determine effective orientation preference for this preview
    const effectivePref: 'auto' | 'portrait' | 'landscape' = preferredOrientation === 'auto'
      ? (isLandscape ? 'landscape' : 'portrait')
      : preferredOrientation;

    await initializeCamera(undefined, effectivePref);
  };

  const handleStartRecording = () => {
    if (!mediaStream) return;
    setCountdown(3);
  };

  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 0) {
      const timeout = setTimeout(() => setCountdown(countdown - 1), 800);
      return () => clearTimeout(timeout);
    }
    setCountdown(null);
    setRecordedChunks([]);
    setTimer(enable360 ? 360 : 90);
    if (!mediaStream) return;
    
    const mimeType = getSafariCompatibleMimeType();
    setCurrentMimeType(mimeType);
    const options: MediaRecorderOptions = {};
    
    if (mimeType) {
      options.mimeType = mimeType;
    }
    
    const recorder = new MediaRecorder(mediaStream, options);

    // Use a local chunks array to avoid stale React state in recorder callbacks
    const localChunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        localChunks.push(e.data);
      }
    };

    recorder.onstop = () => {
      const finalMimeType = mimeType || 'video/mp4';
      const blob = createSafariCompatibleVideoBlob(localChunks.length ? localChunks : recordedChunks, finalMimeType);
      const optimizedUrl = createOptimizedVideoURL(blob);
      // update state with final chunks
      setRecordedChunks(localChunks);
      setVideoUrl(optimizedUrl);
      setIsPreviewing(false);
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      if (document.fullscreenElement) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
      // Unlock orientation if locked
      if (isOrientationLocked) {
        const so: any = (typeof screen !== 'undefined' ? (screen as any).orientation : null);
        if (so && typeof so.unlock === 'function') {
          try { so.unlock(); } catch (e) {}
        }
        setIsOrientationLocked(false);
      }
    };
    
    recorder.start(isSafariOrIOS() ? 100 : 250);
    setMediaRecorder(recorder);
    setIsRecording(true);
    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          handleStopRecording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [countdown, recordedChunks, enable360]);

  const handleStopRecording = () => {
    if (mediaRecorder) mediaRecorder.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setTimer(90);
  };

  // Preserve caret/selection on controlled inputs to avoid cursor jumping
  const handleCaptionChange = (e: any) => {
    const val = e.target.value;
    const start = e.target.selectionStart ?? val.length;
    const end = e.target.selectionEnd ?? start;
    setCaption(val);
    // restore selection on next frame
    requestAnimationFrame(() => {
      try {
        if (captionRef.current) {
          captionRef.current.setSelectionRange(start, end);
          captionRef.current.focus();
        }
      } catch (e) {}
    });
  };

  const handleFeedCaptionChange = (e: any) => {
    const val = e.target.value;
    const start = e.target.selectionStart ?? val.length;
    const end = e.target.selectionEnd ?? start;
    setFeedCaption(val);
    requestAnimationFrame(() => {
      try {
        if (feedCaptionRef.current) {
          feedCaptionRef.current.setSelectionRange(start, end);
          feedCaptionRef.current.focus();
        }
      } catch (e) {}
    });
  };

  const handleSwitchCamera = async () => {
    if (isSwitchingCamera || isRecording) return;

    setIsSwitchingCamera(true);
    try {
      let vids: MediaDeviceInfo[] = videoDevices || [];
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        vids = devices.filter(d => d.kind === 'videoinput');
        setVideoDevices(vids);
      } catch (e) {}

      if (vids && vids.length > 1) {
        const ids = vids.map(d => d.deviceId);
        const currentId = videoDeviceId || (mediaStream ? mediaStream.getVideoTracks()[0]?.getSettings()?.deviceId || null : null);
        const currentIndex = ids.indexOf(currentId as string);
        const nextIndex = (currentIndex + 1) % ids.length;
        const nextDeviceId = ids[nextIndex];
        setVideoDeviceId(nextDeviceId);
        await initializeCamera();
        setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
      } else {
        const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
        setFacingMode(newFacingMode);
        await initializeCamera(newFacingMode);
      }
    } catch (error) {
      console.error('Failed to switch camera:', error);
    } finally {
      setIsSwitchingCamera(false);
    }
  };

  const handleCancel = () => {
    setIsPreviewing(false);
    setIsRecording(false);
    if (videoUrl) {
      cleanupVideoURL(videoUrl);
    }
    setVideoUrl(null);
    setRecordedChunks([]);
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      setMediaStream(null);
    }
    if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
    // Unlock orientation if locked
    if (isOrientationLocked) {
      const so: any = (typeof screen !== 'undefined' ? (screen as any).orientation : null);
      if (so && typeof so.unlock === 'function') {
        try { so.unlock(); } catch (e) {}
      }
      setIsOrientationLocked(false);
    }
  };

  const toggleFullscreen = () => {
    if (!previewContainerRef.current) return;
    if (!document.fullscreenElement) {
      previewContainerRef.current.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  // ADDED: Function to upload to feed
  const uploadToFeed = async (opts: { videoId: string; caption?: string; categories?: string[]; audience?: string; userId?: string }) => {
    try {
      const { videoId, caption, categories, audience, userId } = opts;
      const { data: inserted, error: feedError } = await supabase
        .from('feed_posts')
        .insert({
          user_id: userId || user?.id,
          video_id: videoId,
          caption: (caption || '').trim(),
          categories: categories && categories.length > 0 ? categories : null,
          audience: (audience as any) || 'public',
          likes_count: 0,
          comments_count: 0,
          shares_count: 0,
          created_at: new Date().toISOString()
        })
        .select('*')
        .single();

      if (feedError) {
        console.error('Feed upload error:', feedError);
        throw feedError;
      }
      return inserted;
    } catch (err) {
      console.error('Feed upload failed:', err);
      throw err;
    }
  };

  const handleUpload = async () => {
    if (!user || !caption || !recordedChunks.length || isUploading || selectedCategories.length === 0) {
      return;
    }

    setIsUploading(true);
    let errorStep = '';
    try {
      let mimeType = currentMimeType || getSafariCompatibleMimeType();
      let blob = createSafariCompatibleVideoBlob(recordedChunks, mimeType);
      let extension = getFileExtensionFromMimeType(mimeType);

      const file = new File([blob], `reel-${Date.now()}.${extension}`, { type: mimeType });
      const videoHash = await hashFile(file);

      let detectedDuration = -1;
      try {
        detectedDuration = await getVideoDuration(file);
      } catch (e) {
        console.warn('[RecordReel] failed to get video duration', e);
        detectedDuration = -1;
      }
      
      console.log('Uploading video:', {
        size: file.size,
        type: file.type,
        name: file.name,
        hash: videoHash,
        isSafari: isSafariOrIOS()
      });

      errorStep = 'channel retrieval';
      const { data: channel, error: channelError } = await supabase
        .from('studio_channels')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (channelError || !channel) {
        setIsUploading(false);
        return;
      }

      errorStep = 'hash check';
      const { data: existing, error: hashError } = await supabase
        .from('studio_videos')
        .select('id, user_id')
        .eq('video_hash', videoHash)
        .maybeSingle();

      if (hashError) {
        console.error('Hash check error:', hashError);
        setIsUploading(false);
        return;
      }

      const isOriginal = !existing;
      const badge_type = isOriginal ? 'creator' : 'remixer';
      const original_creator_id = existing ? existing.user_id : null;

      errorStep = 'file upload';
      const filePath = `${user.id}/recorded_reel_${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('studio-videos').upload(filePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        setIsUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage.from('studio-videos').getPublicUrl(filePath);

      errorStep = 'database insert';
      const { data: inserted, error: dbError } = await supabase
        .from('studio_videos')
        .insert({
          user_id: user.id,
          channel_id: channel.id,
          video_url: urlData.publicUrl,
          caption: caption.trim(),
          share_to_feeds: shareToFeed,
          categories: selectedCategories,
          likes: 0,
          views: 0,
          shares: 0,
          video_hash: videoHash,
          badge_type,
          ...(original_creator_id ? { original_creator_id } : {}),
          duration: detectedDuration > 0 ? detectedDuration : null,
          created_at: new Date().toISOString()
        }).select('*').single();
        
      if (dbError) {
        console.error('Database error:', dbError);
        throw dbError;
      }
      
      // ADDED: Upload to feed if enabled — automatically share publicly using same caption/categories
      if (shareToFeed && inserted) {
        try {
          await uploadToFeed({
            videoId: inserted.id,
            caption: caption.trim(),
            categories: selectedCategories,
            audience: 'public',
            userId: user.id
          });
          console.log('Successfully shared to feed');
        } catch (e) {
          console.warn('Failed to auto-share to feed:', e);
        }
      }
      
      setIsUploading(false);
      setCaption('');
      setSelectedCategories([]);
      setFeedCaption('');
      setFeedCategories([]);
      setShareToFeed(false);
      
      if (videoUrl) {
        cleanupVideoURL(videoUrl);
      }
      setVideoUrl(null);
      setRecordedChunks([]);
      
      if (inserted && inserted.id) {
        navigate(`/studio?highlight=${inserted.id}`, { state: { highlightedReel: inserted } });
      } else {
        navigate('/studio');
      }
    } catch (err: any) {
      console.error('Upload error at step:', errorStep, err);
      setIsUploading(false);
    }
  };

  // ADDED: Share to Feed Settings Modal
  const ShareToFeedModal = () => {
    if (!videoUrl || !showShareSettings) return null;

    return (
      <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-gradient-to-b from-gray-900 to-gray-950 rounded-2xl border border-gray-800 w-full max-w-md max-h-[80vh] overflow-y-auto">
          {/* Header */}
          <div className="p-6 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Share to Feed</h3>
                  <p className="text-sm text-gray-400">Customize how your reel appears in the feed</p>
                </div>
              </div>
              <button
                onClick={() => setShowShareSettings(false)}
                className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Caption */}
            <div>
              <label className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                <Hash className="h-4 w-4 text-gray-400" />
                Feed Caption
              </label>
              <textarea
                placeholder="Add a caption for your feed post..."
                value={feedCaption}
                onChange={handleFeedCaptionChange}
                ref={feedCaptionRef}
                className="w-full min-h-[80px] rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              />
              <div className="text-xs text-gray-500 mt-1">
                {feedCaption.length}/280 characters
              </div>
            </div>

            {/* Categories */}
            <div>
              <label className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <Tag className="h-4 w-4 text-gray-400" />
                Feed Categories
                <span className="text-xs text-gray-500">(Optional)</span>
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {CATEGORY_OPTIONS.map(cat => {
                  const selected = feedCategories.includes(cat);
                  const disabled = !selected && feedCategories.length >= 3;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        if (selected) {
                          setFeedCategories(feedCategories.filter(c => c !== cat));
                        } else if (feedCategories.length < 3) {
                          setFeedCategories([...feedCategories, cat]);
                        }
                      }}
                      disabled={disabled}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                        selected
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
              <div className="text-xs text-gray-500">
                {feedCategories.length === 0 ? (
                  "No categories selected"
                ) : feedCategories.length === 3 ? (
                  <span className="text-green-400">✓ Maximum categories selected</span>
                ) : (
                  `${3 - feedCategories.length} more can be selected`
                )}
              </div>
            </div>

            {/* Audience */}
            <div>
              <label className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <Globe className="h-4 w-4 text-gray-400" />
                Audience
              </label>
              <div className="grid grid-cols-1 gap-2">
                {AUDIENCE_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const selected = feedAudience === option.id;
                  return (
                    <button
                      key={option.id}
                      onClick={() => setFeedAudience(option.id as any)}
                      className={`p-4 rounded-xl border transition-all text-left ${
                        selected
                          ? 'border-purple-500 bg-gradient-to-r from-purple-600/10 to-pink-600/10'
                          : 'border-gray-700 bg-gray-900/30 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          selected 
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600' 
                            : 'bg-gray-800'
                        }`}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className="font-medium text-white">{option.label}</div>
                          <div className="text-xs text-gray-400">{option.description}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Preview */}
            <div className="pt-4 border-t border-gray-800">
              <div className="text-sm font-medium text-white mb-3">Preview</div>
              <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-center">
                    <span className="text-white font-bold">Y</span>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">You</div>
                    <div className="text-xs text-gray-400">Just now</div>
                  </div>
                </div>
                <div className="text-sm text-white mb-3">
                  {feedCaption || caption || "Check out my new reel!"}
                </div>
                <div className="aspect-video bg-gray-800 rounded-lg flex items-center justify-center">
                  <Video className="w-12 h-12 text-gray-600" />
                </div>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-800">
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <span>❤️</span>
                    <span>0 likes</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <span>💬</span>
                    <span>0 comments</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400 ml-auto">
                    <span>👁️</span>
                    <span>{feedAudience === 'public' ? 'Public' : feedAudience === 'followers' ? 'Followers only' : 'Private'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-800">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setShowShareSettings(false);
                  setShareToFeed(false);
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-gray-800 text-white font-medium hover:bg-gray-700 transition-colors"
              >
                Skip Feed
              </button>
              <button
                onClick={() => {
                  setShowShareSettings(false);
                  handleUpload();
                }}
                disabled={isUploading}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isUploading ? 'Uploading...' : 'Share to Feed'}
              </button>
            </div>
          </div>
        </div>
      </div>

      // (fixed action was moved into RecordedPreview to avoid duplicate controls)
    );
  };

  // Recorded Video Preview Section
  const RecordedPreview = () => {
    if (!videoUrl) return null;

    return (
      <div className="fixed inset-0 z-[9999] bg-black overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                if (videoUrl) cleanupVideoURL(videoUrl);
                setVideoUrl(null);
              }}
              className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Back</span>
            </button>
            <h2 className="text-lg font-semibold text-white">Review Recording</h2>
            <div className="w-10"></div> {/* Spacer */}
          </div>
        </div>

        {/* Video Preview */}
        <div className="flex items-center justify-center bg-black w-full py-6">
          <video
            src={videoUrl}
            controls
            autoPlay
            playsInline
            className="w-full"
            style={{ maxHeight: '60vh', width: '100%', objectFit: 'cover' }}
          />
        </div>

        {/* Upload Section */}
        <div className="p-6 bg-gradient-to-t from-gray-900 to-transparent border-t border-gray-800">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Caption */}
            <div>
              <label className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                <Hash className="h-4 w-4 text-gray-400" />
                Reel Caption
              </label>
              <input
                type="text"
                placeholder="What's this reel about?"
                value={caption}
                onChange={handleCaptionChange}
                ref={captionRef}
                className="w-full h-12 rounded-xl border border-gray-700 bg-gray-900/50 px-4 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              />
              <div className="text-xs text-gray-500 mt-1">
                {caption.length}/280 characters
              </div>
            </div>

            {/* Categories */}
            <div>
              <label className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <Tag className="h-4 w-4 text-gray-400" />
                Categories
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {CATEGORY_OPTIONS.map(cat => {
                  const selected = selectedCategories.includes(cat);
                  const disabled = !selected && selectedCategories.length >= 3;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        if (selected) {
                          setSelectedCategories(selectedCategories.filter(c => c !== cat));
                        } else if (selectedCategories.length < 3) {
                          setSelectedCategories([...selectedCategories, cat]);
                        }
                      }}
                      disabled={disabled}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                        selected
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
              <div className="text-xs text-gray-500">
                {selectedCategories.length === 0 ? (
                  "Select 1-3 categories"
                ) : selectedCategories.length === 3 ? (
                  <span className="text-green-400">✓ Maximum categories selected</span>
                ) : (
                  `${3 - selectedCategories.length} more can be selected`
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
              {/* Share to Feeds Toggle */}
              <div className="flex items-center gap-2 bg-accent/50 rounded-lg px-4 py-2 w-full sm:w-auto justify-center sm:justify-start">
                <Share2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Share to Feeds</span>
                <div className="relative inline-block w-10 h-5 ml-2">
                  <input
                    type="checkbox"
                    checked={shareToFeed}
                    onChange={e => setShareToFeed(e.target.checked)}
                    className="sr-only peer"
                    id="share-toggle-record"
                  />
                  <label
                    htmlFor="share-toggle-record"
                    className="absolute cursor-pointer top-0 left-0 right-0 bottom-0 bg-gray-300 dark:bg-gray-700 rounded-full transition-colors peer-checked:bg-primary before:absolute before:content-[''] before:h-3.5 before:w-3.5 before:left-0.5 before:bottom-0.5 before:bg-white before:rounded-full before:transition-transform peer-checked:before:translate-x-5"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 w-full sm:w-auto justify-center sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (videoUrl) cleanupVideoURL(videoUrl);
                    setVideoUrl(null);
                    setRecordedChunks([]);
                  }}
                  className="rounded-full w-full sm:w-auto"
                >
                  Discard
                </Button>
                <Button
                  onClick={() => {
                    if (shareToFeed) {
                      setShowShareSettings(true);
                    } else {
                      handleUpload();
                    }
                  }}
                  disabled={!caption || selectedCategories.length === 0 || isUploading}
                  className="rounded-full px-8 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg w-full sm:w-auto"
                  size="lg"
                >
                  {isUploading ? (
                    <span className="flex items-center gap-2">
                      <Skeleton className="h-4 w-4 rounded-full" />
                      Uploading...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Upload Reel
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Preview/Recording UI Component
  const PreviewUI = () => {
    if (!isPreviewing) return null;

    const videoClass = isLandscape
      ? 'w-auto h-full object-contain'
      : 'w-full h-auto object-contain';

    return (
      <div className="fixed inset-0 z-[9999] bg-black">
        <div
          ref={previewContainerRef}
          className={`relative w-full h-full bg-black ${isLandscape ? 'flex items-center justify-center' : ''}`}
        >
          {/* Camera Preview */}
          <div className={`absolute inset-0 ${isLandscape ? 'flex items-center justify-center' : ''}`}>
            <div className={`relative ${isLandscape ? 'w-full max-w-6xl' : 'w-full h-full'}`}>
              {/* Orientation Indicator */}
              <div className={`absolute top-4 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-2 bg-black/60 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full ${
                orientation === 'landscape' ? 'border border-yellow-500/50' : ''
              }`}>
                {orientation === 'landscape' ? (
                  <>
                    <Monitor className="w-3.5 h-3.5 text-yellow-400" />
                    <span>Landscape Mode</span>
                  </>
                ) : (
                  <>
                    <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                    <span>Portrait Mode</span>
                  </>
                )}
              </div>
              
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ display: 'block', margin: '0 auto', width: '100%', height: '100vh' }}
              />
            </div>
            
            {/* Countdown Overlay */}
            {countdown && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-50">
                <div className="flex flex-col items-center">
                  <div className="text-white text-9xl font-bold animate-pulse mb-2">
                    {countdown}
                  </div>
                  <div className="text-white text-lg opacity-80">
                    Recording starts in...
                  </div>
                </div>
              </div>
            )}
            
            {/* Recording Timer */}
            {isRecording && (
              <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-40">
                <div className="flex items-center gap-2 bg-red-600/90 backdrop-blur-sm px-4 py-2 rounded-full animate-pulse">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  <div className="text-white font-mono text-sm">
                    {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
                  </div>
                  <div className="text-xs text-white/80">
                    {enable360 ? '360s' : '90s'}
                  </div>
                  <div className="text-xs text-white/60">
                    • {isLandscape ? 'Landscape' : 'Portrait'}
                  </div>
                </div>
              </div>
            )}
            
            {/* Top Controls */}
            <div className="absolute top-4 left-4 z-40 flex flex-col gap-2">
              {/* Orientation Controls */}
              <div className="flex gap-1">
                <button
                  onClick={() => setOrientationPreference('portrait')}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    preferredOrientation === 'portrait' 
                      ? 'bg-blue-600/80 text-white' 
                      : 'bg-black/60 backdrop-blur-sm text-gray-300 hover:bg-black/80'
                  }`}
                  title="Portrait mode"
                >
                  <Smartphone className="w-4 h-4" />
                </button>
                
                <button
                  onClick={() => setOrientationPreference('landscape')}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    preferredOrientation === 'landscape' 
                      ? 'bg-yellow-600/80 text-white' 
                      : 'bg-black/60 backdrop-blur-sm text-gray-300 hover:bg-black/80'
                  }`}
                  title="Landscape mode"
                >
                  <Monitor className="w-4 h-4" />
                </button>
                
                <button
                  onClick={toggleOrientationLock}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    isOrientationLocked 
                      ? 'bg-green-600/80 text-white' 
                      : 'bg-black/60 backdrop-blur-sm text-gray-300 hover:bg-black/80'
                  }`}
                  title={isOrientationLocked ? "Unlock orientation" : "Lock current orientation"}
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>
              
              {/* Camera Facing Mode */}
              <div className="bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                {facingMode === 'user' ? 'Front Camera' : 'Back Camera'}
              </div>
            </div>
            
            {/* Right Controls */}
            <div className="absolute top-4 right-4 flex flex-col gap-2 z-40">
              <button
                onClick={toggleFullscreen}
                className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-colors"
                aria-label="Toggle fullscreen"
              >
                <Maximize2 className="w-5 h-5 text-white" />
              </button>
              
              <button
                onClick={handleCancel}
                className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-colors"
                aria-label="Cancel recording"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            
            {/* Bottom Controls */}
            <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center gap-6 z-40">
              {/* Camera Flip Button */}
              <button
                onClick={handleSwitchCamera}
                disabled={isSwitchingCamera || isRecording}
                className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed group relative"
                aria-label={`Switch to ${facingMode === 'user' ? 'back' : 'front'} camera`}
              >
                {isSwitchingCamera ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <div className="relative">
                    <FlipHorizontal2 className="w-7 h-7 text-white" />
                    <div className="absolute -top-2 -right-2">
                      <div className={`w-5 h-5 rounded-full bg-black/80 border border-white/30 flex items-center justify-center ${facingMode === 'environment' ? 'rotate-0' : 'rotate-180'}`}>
                        <span className="text-xs text-white font-bold">
                          {facingMode === 'user' ? '1' : '2'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </button>
              
              {/* Record Button */}
              <button
                onClick={isRecording ? handleStopRecording : handleStartRecording}
                disabled={isSwitchingCamera || countdown !== null}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all transform hover:scale-105 disabled:opacity-70 disabled:cursor-not-allowed ${
                  isRecording 
                    ? 'bg-red-600 border-4 border-red-300/50 animate-pulse' 
                    : 'bg-white border-4 border-white/30'
                }`}
                aria-label={isRecording ? 'Stop recording' : 'Start recording'}
              >
                {isRecording ? (
                  <Square className="w-8 h-8 text-white" />
                ) : (
                  <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center">
                    {countdown === null ? (
                      <Play className="w-6 h-6 text-white ml-1" />
                    ) : (
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    )}
                  </div>
                )}
              </button>
              
              {/* Orientation Guide */}
              <div className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center relative group">
                {isLandscape ? (
                  <Monitor className="w-7 h-7 text-yellow-400" />
                ) : (
                  <Smartphone className="w-7 h-7 text-blue-400" />
                )}
                
                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  {isLandscape ? 'Landscape recording' : 'Portrait recording'}
                  <br />
                  {preferredOrientation === 'auto' ? 'Auto orientation' : `${preferredOrientation} preferred`}
                </div>
              </div>
            </div>
            
            {/* Recording Status */}
            {isRecording && (
              <div className="absolute bottom-28 left-1/2 transform -translate-x-1/2 z-40">
                <div className="bg-red-600/90 text-white text-xs px-3 py-1 rounded-full animate-pulse flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  <span>Recording</span>
                  <span className="text-white/60">• {isLandscape ? 'Landscape' : 'Portrait'}</span>
                </div>
              </div>
            )}
            
            {/* Orientation Tips */}
            {!isRecording && (
              <div className="absolute bottom-32 left-1/2 transform -translate-x-1/2 z-40">
                <div className="bg-black/60 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-lg max-w-xs text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    {isLandscape ? (
                      <>
                        <Monitor className="w-3 h-3 text-yellow-400" />
                        <span>Rotate device for portrait mode</span>
                      </>
                    ) : (
                      <>
                        <Smartphone className="w-3 h-3 text-blue-400" />
                        <span>Rotate device for landscape mode</span>
                      </>
                    )}
                  </div>
                  {preferredOrientation !== 'auto' && (
                    <div className="text-white/60 text-[10px]">
                      {preferredOrientation === 'landscape' ? 'Landscape mode preferred' : 'Portrait mode preferred'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // If user is previewing and device is in landscape, render only the preview UI
  if (isPreviewing && isLandscape) {
    return (
      <div className="min-h-screen bg-black">
        <PreviewUI />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-purple-950">
      <PreviewUI />
      <RecordedPreview />
      <ShareToFeedModal />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors group"
          >
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Back</span>
          </button>
          
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-purple-400" />
            <h1 className="text-lg font-semibold text-white">Create Reel</h1>
          </div>
          
          <div className="w-10"></div> {/* Spacer */}
        </div>

        {/* Hero Section */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 mb-4">
            <Video className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Record Your Story</h2>
          <p className="text-gray-400 text-sm">Create engaging short videos for your audience</p>
          
          {/* Orientation Indicator */}
          <div className="mt-4 inline-flex items-center gap-2 bg-gray-800/50 backdrop-blur-sm text-gray-300 text-xs px-3 py-1.5 rounded-full">
            {orientation === 'landscape' ? (
              <>
                <Monitor className="w-3.5 h-3.5" />
                <span>Landscape view</span>
              </>
            ) : (
              <>
                <Smartphone className="w-3.5 h-3.5" />
                <span>Portrait view</span>
              </>
            )}
          </div>
        </div>

        {/* Duration Selector Card */}
        <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 backdrop-blur-sm rounded-2xl border border-gray-800 p-6 mb-6 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-semibold text-white">Select Duration</h3>
          </div>
          
          {/* 90s Option */}
          <button
            onClick={() => { setSelectedMode('90'); setEnable360(false); }}
            className={`w-full p-4 rounded-xl mb-3 transition-all duration-300 ${
              selectedMode === '90' 
                ? 'bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30' 
                : 'bg-gray-800/30 border border-gray-700/50 hover:border-gray-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  selectedMode === '90' 
                    ? 'bg-gradient-to-br from-purple-600 to-pink-600' 
                    : 'bg-gray-700'
                }`}>
                  <span className="text-sm font-bold text-white">90</span>
                </div>
                <div className="text-left">
                  <div className="font-semibold text-white">90s Reels</div>
                  <div className="text-xs text-gray-400">Standard short format</div>
                </div>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                selectedMode === '90' 
                  ? 'bg-purple-500/20 text-purple-300' 
                  : 'bg-gray-700/50 text-gray-300'
              }`}>
                1:30 min
              </div>
            </div>
          </button>
          
          {/* 360s Option */}
          <div className={`p-4 rounded-xl transition-all duration-300 ${
            selectedMode === '360' 
              ? 'bg-gradient-to-r from-emerald-600/20 to-teal-600/20 border border-emerald-500/30' 
              : 'bg-gray-800/30 border border-gray-700/50'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <button
                  onClick={toggle360}
                  disabled={!canEnable360 || checking360}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                    canEnable360 
                      ? 'cursor-pointer hover:scale-105' 
                      : 'cursor-not-allowed opacity-70'
                  } ${lockerColorClass}`}
                  title={canEnable360 ? (enable360 ? 'Disable 360' : 'Enable 360') : `${remainingToUnlock} more 90s reels to unlock`}
                >
                  <Lock className="w-5 h-5 text-white" />
                </button>
                <div className="text-left">
                  <div className="font-semibold text-white">360s Reels</div>
                  <div className="text-xs text-gray-400">Extended format</div>
                </div>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                selectedMode === '360' 
                  ? 'bg-emerald-500/20 text-emerald-300' 
                  : 'bg-gray-700/50 text-gray-300'
              }`}>
                6:00 min
              </div>
            </div>
            
            {/* Unlock Progress */}
            {!checking360 && !canEnable360 && (
              <div className="mt-3 pt-3 border-t border-gray-700/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400">Progress to unlock</span>
                  <span className="text-xs font-medium text-gray-300">{percentUnlocked}%</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                    style={{ width: `${percentUnlocked}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-gray-400">
                  Post {remainingToUnlock} more 90s reels to unlock 360s recording
                </div>
              </div>
            )}
            
            {/* Unlocked Status */}
            {canEnable360 && (
              <div className="mt-3 pt-3 border-t border-emerald-500/30">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm text-emerald-400 font-medium">360s Unlocked!</span>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  You've posted {total90s} reels. 360s recording is now available.
                </p>
              </div>
            )}
            
            {/* Checking Status */}
            {checking360 && (
              <div className="mt-3 pt-3 border-t border-gray-700/50">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm text-gray-400">Checking eligibility...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Features Card */}
        <div className="bg-gradient-to-br from-gray-900/60 to-gray-900/30 backdrop-blur-sm rounded-2xl border border-gray-800 p-6 mb-6">
          <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-400" />
            Recording Features
          </h4>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-800/30 rounded-xl p-3 border border-gray-700/50">
              <div className="w-8 h-8 rounded-lg bg-purple-600/20 flex items-center justify-center mb-2">
                <Monitor className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-xs font-medium text-white">Auto Orientation</div>
              <div className="text-xs text-gray-400 mt-1">Supports landscape & portrait</div>
            </div>
            
            <div className="bg-gray-800/30 rounded-xl p-3 border border-gray-700/50">
              <div className="w-8 h-8 rounded-lg bg-emerald-600/20 flex items-center justify-center mb-2">
                <Shield className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xs font-medium text-white">Copyright Safe</div>
              <div className="text-xs text-gray-400 mt-1">Original content detection</div>
            </div>
          </div>
        </div>

        {/* Start Button */}
        <button
          disabled={checking360 || (selectedMode === '360' && !canEnable360)}
          onClick={() => {
            console.log('[RecordReel] Start button clicked', { enable360, selectedMode, canEnable360 });
            try {
              const dur = enable360 ? 360 : 90;
              navigate(`/studio/record-preview?duration=${dur}`);
            } catch (e) {
              console.error('[RecordReel] navigation failed:', e);
              startRecording(enable360 ? 360 : 90);
            }
          }}
          className={`w-full py-4 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-3 shadow-lg ${
            checking360 || (selectedMode === '360' && !canEnable360)
              ? 'bg-gray-700 text-gray-300 cursor-not-allowed opacity-70'
              : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 hover:shadow-xl active:scale-95'
          }`}
        >
          <Camera className="w-5 h-5" />
          {selectedMode === '360' && !canEnable360
            ? `Need ${remainingToUnlock} More Reels`
            : `Start ${enable360 ? '360s' : '90s'} Recording`}
        </button>

        {/* Orientation Tips */}
        <div className="mt-6 p-4 bg-gradient-to-r from-gray-900/40 to-gray-900/20 backdrop-blur-sm rounded-xl border border-gray-800">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0">
              <Monitor className="w-4 h-4 text-blue-400" />
            </div>
            <div>
            
              <div className="text-xs text-gray-400 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
             
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-500"></div>
           
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30">
        <MobileBottomNav />
      </div>
    </div>
  );
}

export default RecordReel;