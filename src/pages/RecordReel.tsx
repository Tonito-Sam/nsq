import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { Camera, CameraOff, Play, X, Maximize2, Minimize2 } from 'lucide-react';
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

const RecordReel = () => {
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
  }, [countdown, recordedChunks]);

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
          created_at: new Date().toISOString()
        }).select('id');
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
      if (inserted && inserted.length > 0) {
        navigate(`/studio?highlight=${inserted[0].id}`);
      } else {
        navigate('/studio');
      }
    } catch (err: any) {
      console.error('Upload error at step:', errorStep, err);
      setIsUploading(false);
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
                  onClick={handleCancel}
                  className="bg-white text-red-600 p-4 rounded-full shadow-lg focus:outline-none border-2 border-red-200"
                  title="Cancel"
                >
                  <X className="w-6 h-6" />
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
            <Button
              onClick={handleUpload}
              disabled={!caption || !recordedChunks.length || isUploading || selectedCategories.length === 0}
              className="w-full"
            >
              {isUploading ? 'Uploading...' : 'Upload Recording'}
            </Button>
            <Button variant="ghost" className="mt-4 w-full" onClick={handleCancel} disabled={isUploading}>
              Cancel
            </Button>
          </>
        )}
      </div>

      <div className="md:hidden w-full">
        <MobileBottomNav />
      </div>
    </div>
  );
}

export default RecordReel;