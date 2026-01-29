import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { Camera, CameraOff, Play, X, Maximize2, Minimize2, FlipHorizontal2, Share2, Upload } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SafariCompatibleVideo } from '@/components/SafariCompatibleVideo';
import { 
  getSafariCompatibleMimeType, 
  getFileExtensionFromMimeType, 
  createSafariCompatibleVideoBlob,
  createOptimizedVideoURL,
  cleanupVideoURL,
  isSafariOrIOS 
} from '@/utils/safariVideoUtils';

const RecordVideo = () => {
  // Category list from Studio.tsx header
  const CATEGORY_OPTIONS = [
    'All',
    'Tech',
    'Comedy',
    'Sports',
    'Education',
    'Inspiration',
    'Music',
    'Gaming',
    'Food',
    'Fitness',
    'Lifestyle',
    'Art',
  ];
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
  const [shareToFeed, setShareToFeed] = useState(false);
  const [showShareSettings, setShowShareSettings] = useState(false);
  const [timer, setTimer] = useState(90);
  const [isUploading, setIsUploading] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentMimeType, setCurrentMimeType] = useState<string>('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);

  const location = useLocation();

  // Hash a file using SHA-256, returning hex string - ADDED FROM UPLOAD COMPONENT
  async function hashFile(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

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

  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream]);

  // If the route was opened with ?duration=90 or ?duration=360, auto-start the preview
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      const durationParam = params.get('duration');
      if ((durationParam === '90' || durationParam === '360') && !isPreviewing && !isRecording && !videoUrl) {
        // set timer to the desired duration before starting preview
        setTimer(durationParam === '360' ? 360 : 90);
        // Start the preview automatically so the user sees the camera immediately
        handleStartPreview();
      }
    } catch (e) {
      // ignore malformed URL params
    }
    // Intentionally watch location.search so navigating back to this route restarts preview
  }, [location.search, isPreviewing, isRecording, videoUrl]);

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
    setTimer(90);
    if (!mediaStream) return;
    
    const mimeType = getSafariCompatibleMimeType();
    setCurrentMimeType(mimeType);
    const options: MediaRecorderOptions = {};
    
    if (mimeType) {
      options.mimeType = mimeType;
    }
    
    // Use smaller time slices for better Safari compatibility
    const recorder = new MediaRecorder(mediaStream, options);

    // collect chunks locally to avoid stale state in callbacks
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
      setRecordedChunks(localChunks);
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
  }, [countdown, recordedChunks]);

  const handleStopRecording = () => {
    if (mediaRecorder) mediaRecorder.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setTimer(90);
  };

  const handleSwitchCamera = () => {
    // Toggle facing mode and reinitialize camera stream
    const next = facingMode === 'user' ? 'environment' : 'user';
    (async () => {
      try {
        // Stop existing tracks
        if (mediaStream) {
          mediaStream.getTracks().forEach(t => t.stop());
        }
        // Request new stream with desired facingMode
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: next }, audio: true });
        setMediaStream(stream);
        if (videoRef.current) videoRef.current.srcObject = stream;
        setFacingMode(next);
      } catch (err) {
        console.error('Failed to switch camera:', err);
      }
    })();
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
      alert('Missing required fields for upload.');
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
        alert('You must have a studio channel before uploading.');
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
        alert('Error checking video hash: ' + hashError.message);
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
        alert('Failed to upload video file: ' + uploadError.message);
        setIsUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage.from('studio-videos').getPublicUrl(filePath);

      errorStep = 'database insert';
      const { error: dbError } = await supabase
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
          created_at: new Date().toISOString()
        });
      if (dbError) {
        console.error('Database error:', dbError);
        alert('Database error: ' + dbError.message);
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
      alert('Video uploaded successfully!');
      navigate('/studio');
    } catch (err: any) {
      console.error('Upload error at step:', errorStep, err);
      setIsUploading(false);
      alert(`Failed to upload reel at step: ${errorStep}. Error: ${err?.message || err}`);
    }
  };

  return (
  <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <div className="w-full max-w-xl mx-auto px-4 pt-4">
        <button
          className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-semibold mb-2 hover:underline"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 w-full max-w-7xl mx-auto pb-32">
        {!isPreviewing && !isRecording && !videoUrl && (
          <div className="flex flex-col items-center justify-center text-center mt-16">
            <h2 className="text-2xl font-bold mb-4">Record Video</h2>
            <Button onClick={handleStartPreview}>Start Recording (1 min 30 sec max)</Button>
            {isSafariOrIOS() && (
              <p className="text-sm text-gray-500 mt-2">
                Safari/iOS optimized recording enabled
              </p>
            )}
            {permissionError && (
              <div className="mt-4 text-red-600 text-sm font-semibold bg-red-100 rounded p-3 border border-red-300 max-w-md mx-auto">
                {permissionError}
              </div>
            )}
          </div>
        )}

        {(isPreviewing || isRecording) && (
          <div className="relative w-full flex flex-col items-center mt-4">
            <div
              ref={previewContainerRef}
              className="
                w-full 
                max-w-[1500px] 
                rounded-lg 
                border 
                my-2 
                bg-black 
                overflow-hidden 
                aspect-[9/16] 
                sm:aspect-[9/16] 
                md:aspect-video 
                lg:min-h-[80vh]
                relative
              "
            >
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                webkit-playsinline="true"
                className="w-full h-full object-cover"
              />
              
              <div className="absolute top-2 left-2 flex gap-2 z-10">
                <button
                  type="button"
                  onClick={handleSwitchCamera}
                  className="bg-white bg-opacity-80 rounded-full p-2 shadow hover:bg-opacity-100 transition"
                  title={facingMode === 'user' ? 'Switch to Back Camera' : 'Switch to Front Camera'}
                >
                  {facingMode === 'user' ? (
                    <CameraOff className="w-6 h-6 text-gray-700" />
                  ) : (
                    <Camera className="w-6 h-6 text-gray-700" />
                  )}
                </button>
              </div>
              <div className="absolute top-2 right-2 z-10">
                <button
                  onClick={toggleFullscreen}
                  className="bg-white bg-opacity-80 rounded-full p-2 shadow hover:bg-opacity-100"
                  title="Toggle Fullscreen"
                >
                  {isFullscreen ? <Minimize2 className="w-6 h-6" /> : <Maximize2 className="w-6 h-6" />}
                </button>
              </div>
              {countdown !== null && (
                <div className="absolute inset-0 flex items-center justify-center z-20">
                  <span className="text-white text-7xl font-extrabold animate-pulse drop-shadow-lg bg-black bg-opacity-60 px-10 py-6 rounded-full">
                    {countdown > 0 ? countdown : 'Go!'}
                  </span>
                </div>
              )}
              {isRecording && (
                <>
                  <div className="absolute right-2 top-2 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-semibold animate-pulse z-10">
                    {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
                  </div>
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-4 bg-black bg-opacity-60 text-white px-4 py-2 rounded-full text-base font-semibold animate-pulse z-10">
                    Recording...
                  </div>
                </>
              )}
            </div>

            {countdown === null && (
              <div className="fixed bottom-24 left-0 right-0 flex justify-between items-center px-6 z-50">
                <button
                  onClick={handleSwitchCamera}
                  className="bg-white text-gray-700 p-4 rounded-full shadow-lg focus:outline-none border-2 border-gray-200"
                  title="Switch Camera"
                >
                  <FlipHorizontal2 className="w-6 h-6" />
                </button>
                {!isRecording ? (
                  <button
                    onClick={handleStartRecording}
                    className="bg-green-600 hover:bg-green-700 text-white p-4 rounded-full shadow-lg focus:outline-none border-2 border-white"
                    title="Start Recording"
                  >
                    <Play className="w-6 h-6" />
                  </button>
                ) : (
                  <button
                    onClick={handleStopRecording}
                    className="bg-red-600 hover:bg-red-700 text-white p-4 rounded-full shadow-lg focus:outline-none border-2 border-white"
                    title="Stop Recording"
                  >
                    <CameraOff className="w-6 h-6" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {videoUrl && !isPreviewing && (
          <>
            <div className="mb-4">
              <SafariCompatibleVideo 
                src={videoUrl} 
                className="w-full max-h-64 rounded-lg border"
                onError={(e) => {
                  console.error('Safari video playback error:', e);
                  alert('Video playback issue detected. The video should still upload correctly.');
                }}
                onLoadStart={() => console.log('Safari video loading started')}
                onCanPlay={() => console.log('Safari video ready to play')}
              />
              {isSafariOrIOS() && (
                <p className="text-xs text-gray-500 mt-1">
                  Safari/iOS optimized playback
                </p>
              )}
            </div>
            
            <Input
              type="text"
              placeholder="Caption"
              value={caption}
              onChange={e => setCaption(e.target.value)}
              className="mt-2 mb-2"
              disabled={isUploading}
            />

            {/* Category Multi-select */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Categories (max 3)</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    className={`px-3 py-1 rounded-full border text-xs font-semibold transition-all ${selectedCategories.includes(cat)
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white dark:bg-gray-900 text-black dark:text-white border-gray-300 dark:border-gray-700'}`}
                    onClick={() => {
                      if (selectedCategories.includes(cat)) {
                        setSelectedCategories(selectedCategories.filter(c => c !== cat));
                      } else if (selectedCategories.length < 3) {
                        setSelectedCategories([...selectedCategories, cat]);
                      }
                    }}
                    disabled={!selectedCategories.includes(cat) && selectedCategories.length >= 3}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="text-xs text-gray-500 mt-1">Choose up to 3 categories. These determine where your reel appears in Studio.</div>
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
                    id="share-toggle-record-video"
                  />
                  <label
                    htmlFor="share-toggle-record-video"
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

            {showShareSettings && (
              <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-gradient-to-b from-gray-900 to-gray-950 rounded-2xl border border-gray-800 w-full max-w-md max-h-[80vh] overflow-y-auto p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-center">
                        <Upload className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">Share to Feed</h3>
                        <p className="text-sm text-gray-400">Customize your feed post</p>
                      </div>
                    </div>
                    <button onClick={() => setShowShareSettings(false)} className="text-gray-400">Close</button>
                  </div>
                  <div className="text-sm text-white mb-4">Preview of feed post will appear here.</div>
                  <div className="flex gap-3 mt-4">
                    <button onClick={() => { setShowShareSettings(false); setShareToFeed(false); }} className="flex-1 py-3 rounded-xl bg-gray-800 text-white">Skip Feed</button>
                    <button onClick={() => { setShowShareSettings(false); handleUpload(); }} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white">Share to Feed</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="md:hidden w-full">
        <MobileBottomNav />
      </div>
    </div>
  );
}

export default RecordVideo;