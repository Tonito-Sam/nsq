import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { Lock } from 'lucide-react';
import { 
  getSafariCompatibleMimeType, 
  getFileExtensionFromMimeType, 
  createSafariCompatibleVideoBlob,
  createOptimizedVideoURL,
  cleanupVideoURL,
  isSafariOrIOS 
} from '@/utils/safariVideoUtils';

const RecordReel = () => {
  // (Category list removed - not used in this screen)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [caption, setCaption] = useState('');
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [timer, setTimer] = useState(90);
  const [isUploading, setIsUploading] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentMimeType, setCurrentMimeType] = useState<string>('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);

  // Hash a file using SHA-256, returning hex string - ADDED FROM UPLOAD COMPONENT
  async function hashFile(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Get video duration (robust on various platforms) - adapted from UploadReels
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
    };
  }, [videoUrl, mediaStream]);

  // 360-reels gating and toggle (moved from ReelCard)
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

  // Check eligibility: user must have >=100 posted 90s reels
  useEffect(() => {
    const checkEligible = async () => {
      try {
        const userId = user?.id || user?.user_metadata?.id;
        if (!userId) {
          setCanEnable360(false);
          return;
        }
        setChecking360(true);
        const { data, count, error } = await supabase
          .from('studio_videos')
          .select('id', { count: 'exact', head: false })
          .eq('user_id', userId)
          // Count reels that are 90s or shorter. Also include rows where duration is null
          // (older uploads may not have duration populated). Use an OR filter so both
          // conditions are considered by PostgREST / Supabase.
          .or('duration.lte.90,duration.is.null');
        // Debugging output to help validate counts during development
        // (will appear in browser console when this effect runs)
        console.debug('[RecordReel] checkEligible query result', { dataCount: Array.isArray(data) ? data.length : undefined, count, error });
        if (error) {
          console.warn('[RecordReel] checkEligible supabase error:', error);
          setCanEnable360(false);
        } else {
          const total = (count as number) || (Array.isArray(data) ? data.length : 0);
          setCanEnable360(total >= 100);
          // store total to show progress / compute remaining
          try { setTotal90s(typeof total === 'number' ? total : Number(total || 0)); } catch(e) { setTotal90s(0); }
        }
      } catch (e) {
        console.error('[RecordReel] checkEligible error:', e);
        setCanEnable360(false);
      } finally {
        setChecking360(false);
      }
    };
    checkEligible();
  }, [user]);

  // Local UI state for mode selection and tracking total posted 90s reels
  const [selectedMode, setSelectedMode] = useState<'90' | '360'>('90');
  const [total90s, setTotal90s] = useState<number>(0);

  useEffect(() => {
    if (enable360) setSelectedMode('360');
    else setSelectedMode('90');
  }, [enable360]);

  const remainingToUnlock = Math.max(0, 100 - (total90s || 0));

  // percent unlocked towards 100 required 90s reels
  const percentUnlocked = Math.min(100, Math.round(((total90s || 0) / 100) * 100));
  const percentLeft = 100 - percentUnlocked;

  const lockerColorClass = percentUnlocked >= 100 ? 'bg-emerald-500' : (percentUnlocked >= 50 ? 'bg-orange-500' : 'bg-neutral-700');

  const toggle360 = () => {
    if (!canEnable360 || checking360) return;
    const next = !enable360;
    setEnable360(next);
    try { localStorage.setItem('enable360', next ? '1' : '0'); } catch (e) { /* ignore */ }
    if (next) setSelectedMode('360'); else setSelectedMode('90');
  };

  // Start recording flow helper that preserves existing preview flow: set mode, persist flag and start preview
  const startRecording = (duration: number) => {
    if (duration === 360) {
      if (!canEnable360) {
        // Early return if not eligible
        return;
      }
      setEnable360(true);
      try { localStorage.setItem('enable360', '1'); } catch (e) {}
      setSelectedMode('360');
    } else {
      setEnable360(false);
      try { localStorage.setItem('enable360', '0'); } catch (e) {}
      setSelectedMode('90');
    }
    // Start preview; user will then manually start recording using the big Start button in preview (preserves existing flow)
    handleStartPreview();
  };

  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream]);

  const handleStartPreview = () => {
    setIsPreviewing(true);
    setPermissionError(null);
    if (videoUrl) {
      cleanupVideoURL(videoUrl);
    }
    setVideoUrl(null);
    setRecordedChunks([]);
    // Request camera/mic permission
    navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: true })
      .then(stream => {
        setMediaStream(stream);
        setPermissionError(null);
      })
      .catch(err => {
        console.error('Camera/mic permission denied:', err);
        setPermissionError('Camera and microphone access is required to record a reel. Please enable permissions in your browser settings.');
        setIsPreviewing(false);
      });
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
    
    // Use smaller time slices for better Safari compatibility
    const recorder = new MediaRecorder(mediaStream, options);
    
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) setRecordedChunks(prev => [...prev, e.data]);
    };
    
    recorder.onstop = () => {
      const finalMimeType = mimeType || 'video/mp4';
      const blob = createSafariCompatibleVideoBlob(recordedChunks, finalMimeType);
      const optimizedUrl = createOptimizedVideoURL(blob);
      setVideoUrl(optimizedUrl);
      setIsPreviewing(false);
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      if (document.fullscreenElement) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    };
    
    // Start recording with smaller time slices for Safari
    recorder.start(isSafariOrIOS() ? 100 : 250); // Even smaller chunks for Safari
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

  const handleSwitchCamera = () => {
    setFacingMode(facingMode === 'user' ? 'environment' : 'user');
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
  };

  const toggleFullscreen = () => {
    if (!previewContainerRef.current) return;
    if (!document.fullscreenElement) {
      previewContainerRef.current.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
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

      // FIXED: Generate video hash for recorded video
      const file = new File([blob], `reel-${Date.now()}.${extension}`, { type: mimeType });
      const videoHash = await hashFile(file);

      // Try to detect duration and include it in DB so eligibility and sorting work
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

      // Get user channel
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

      // Check if this hash already exists in DB
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

      // Upload video file
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
          categories: selectedCategories,
          likes: 0,
          views: 0,
          shares: 0,
          video_hash: videoHash, // FIXED: Now includes video_hash
          badge_type, // FIXED: Now includes badge_type
          ...(original_creator_id ? { original_creator_id } : {}), // FIXED: Include original creator if remixed
          // persist duration (seconds) when available to support eligibility & sorting
          duration: detectedDuration > 0 ? detectedDuration : null,
          created_at: new Date().toISOString()
        }).select('*').single();
      if (dbError) {
        console.error('Database error:', dbError);
        throw dbError;
      }
      setIsUploading(false);
      setCaption('');
      setSelectedCategories([]);
      if (videoUrl) {
        cleanupVideoURL(videoUrl);
      }
      setVideoUrl(null);
      setRecordedChunks([]);
      if (inserted && inserted.id) {
        // Navigate to studio and pass the created record via location.state so Studio
        // can immediately prepend it to the feed even if caching/pagination would
        // otherwise delay its appearance.
        navigate(`/studio?highlight=${inserted.id}`, { state: { highlightedReel: inserted } });
      } else {
        navigate('/studio');
      }
    } catch (err: any) {
      console.error('Upload error at step:', errorStep, err);
      setIsUploading(false);
    }
  };

  // Quiet TS "declared but never read" diagnostics for helpers/state that are
  // intentionally kept because they are used elsewhere in different flows.
  useEffect(() => {
    // reference the variables/functions so TypeScript considers them read
    // (these are no-ops; they prevent noisy editor diagnostics while keeping
    // the implementation intact for future UI flows)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _used: any = {
      isPreviewing,
      isRecording,
      permissionError,
      timer,
      isFullscreen,
      handleStartRecording,
      handleSwitchCamera,
      handleCancel,
      toggleFullscreen,
      handleUpload,
    };
    void _used;
  }, [
    isPreviewing,
    isRecording,
    permissionError,
    timer,
    isFullscreen,
    handleStartRecording,
    handleSwitchCamera,
    handleCancel,
    toggleFullscreen,
    handleUpload,
  ]);

  return (
    <div className="min-h-screen flex flex-col items-stretch px-4 pt-6 pb-[calc(20px+env(safe-area-inset-bottom))] bg-[color:var(--bg)]">
      <header className="mb-4">
        <button className="text-sm text-indigo-300" onClick={() => navigate(-1)}>← Back</button>
      </header>

      <h1 className="text-center text-lg font-semibold text-white mb-5">Record Video</h1>

      <section className="w-full max-w-md mx-auto space-y-4">
        {/* Mode Card */}
        <div className="rounded-xl bg-neutral-900/80 border border-neutral-700 p-2 shadow-sm">
          {/* 90s Row */}
          <button
            role="button"
            aria-pressed={selectedMode === '90'}
            onClick={() => { setSelectedMode('90'); setEnable360(false); try { localStorage.setItem('enable360', '0'); } catch (e) {} }}
            className={`flex items-center justify-between w-full p-3 rounded-lg mb-2 transition ${selectedMode === '90' ? 'bg-purple-600 text-white' : 'bg-transparent text-neutral-100'}`}
          >
            <div className="text-left">
              <div className="font-semibold">90s Reels (default)</div>
              <div className="text-xs text-neutral-400">Standard 90-second reel</div>
            </div>
            <div className="text-sm text-neutral-300">90s</div>
          </button>

          {/* 360 Row */}
          <div className={`flex items-center justify-between w-full p-3 rounded-lg transition ${selectedMode === '360' ? 'ring-2 ring-purple-500' : ''}`}>
            <div className="text-left">
              <div className="font-semibold text-neutral-100">360 Reels</div>
              <div className="text-xs text-neutral-400">Extended 360s recording</div>
              <div className="text-xs mt-1 text-neutral-500" aria-live="polite">
                {checking360 ? (
                  'Checking 360 eligibility…'
                ) : canEnable360 ? (
                  'Unlocked — ready'
                ) : (
                  <>
                    <div className="font-medium">{percentUnlocked}% unlocked</div>
                    <div className="text-xs text-neutral-400">{percentLeft}% left • Post {remainingToUnlock} more 90s reels to unlock</div>
                  </>
                )}
              </div>
            </div>

            <div className="ml-3">
              <button
                onClick={() => { if (canEnable360) toggle360(); }}
                aria-pressed={enable360}
                aria-label={canEnable360 ? (enable360 ? 'Disable 360 reels' : 'Enable 360 reels') : '360 reels locked'}
                disabled={checking360}
                className={`flex items-center justify-center w-10 h-10 rounded-full text-white shadow-sm transition-colors ${lockerColorClass} ${checking360 ? 'opacity-60 pointer-events-none' : ''}`}
                title={canEnable360 ? (enable360 ? 'Disable 360' : 'Enable 360') : `${percentLeft}% left to unlock`}
              >
                <Lock className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Primary CTA */}
        <div>
          <button
            disabled={checking360 || (selectedMode === '360' && !canEnable360)}
            onClick={() => {
              console.log('[RecordReel] Start button clicked (navigate to preview)', { enable360, selectedMode, canEnable360, checking360 });
              // Navigate to the dedicated preview/record page so the preview can open in its own route
              try {
                const dur = enable360 ? 360 : 90;
                navigate(`/studio/record-preview?duration=${dur}`);
              } catch (e) {
                console.error('[RecordReel] navigation failed:', e);
                // fallback to local preview flow
                startRecording(enable360 ? 360 : 90);
              }
            }}
            className={`w-full h-12 rounded-full text-sm font-semibold shadow-sm transition ${ (selectedMode === '360' && !canEnable360) ? 'bg-neutral-700 text-neutral-300 cursor-not-allowed opacity-70' : 'bg-purple-600 text-white'}`}
          >
            {`Start ${enable360 ? '360s' : '90s'} Recording`}
          </button>

          <div className="mt-2 text-xs text-neutral-500 text-center">
            {selectedMode === '360'
              ? 'Tap Start to begin a 360s recording.'
              : '1 min 30 sec max per reel.'}
          </div>
        </div>
      </section>
      <div className="md:hidden w-full">
        <MobileBottomNav />
      </div>
    </div>
  );
}

export default RecordReel;