import React, { useState, useEffect, useRef } from 'react';
import leoProfanity from 'leo-profanity';
import * as nsfwjs from 'nsfwjs';
import * as tf from '@tensorflow/tfjs';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Upload, 
  X, 
  Video, 
  Hash, 
  CheckCircle, 
  Clock, 
  Shield,
  Tag,
  Layers,
  DollarSign,
  Calendar,
  FolderOpen,
  Share2
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
// Removed landscape warning components per request

// Add custom life-threatening words to leo-profanity
const customThreatWords = [
  'murder', 'murdered', 'murdering', 'kill', 'killed', 'killing', 'stab', 'stabbed', 'stabbing',
  'assassinate', 'assassinated', 'assassinating', 'slaughter', 'slaughtered', 'slaughtering',
  'execute', 'executed', 'executing', 'behead', 'beheaded', 'beheading', 'decapitate',
  'decapitated', 'decapitating', 'strangle', 'strangled', 'strangling', 'shoot', 'shot',
  'shooting', 'hang', 'hanged', 'hanging', 'lynch', 'lynched', 'lynching', 'poison',
  'poisoned', 'poisoning', 'drown', 'drowned', 'drowning', 'suffocate', 'suffocated',
  'suffocating', 'burn alive', 'burned alive', 'burning alive', 'torture', 'tortured',
  'torturing', 'massacre', 'massacred', 'massacring', 'suicide', 'suicidal', 'homicide',
  'homicidal', 'manslaughter', 'genocide', 'genocidal', 'exterminate', 'exterminated',
  'exterminating', 'eliminate', 'eliminated', 'eliminating', 'terminate', 'terminated',
  'terminating', 'butcher', 'butchered', 'butchering', 'bludgeon', 'bludgeoned', 'bludgeoning',
  'maim', 'maimed', 'maiming', 'disembowel', 'disemboweled', 'disemboweling', 'disfigure',
  'disfigured', 'disfiguring', 'rape', 'raped', 'raping', 'abduct', 'abducted', 'abducting',
  'kidnap', 'kidnapped', 'kidnapping', 'molest', 'molested', 'molesting', 'abuse', 'abused',
  'abusing', 'assault', 'assaulted', 'assaulting', 'batter', 'battered', 'battering', 'beat',
  'beaten', 'beating', 'threaten', 'threatened', 'threatening', 'terrorize', 'terrorized',
  'terrorizing', 'violate', 'violated', 'violating'
];
leoProfanity.add(customThreatWords);

const UploadReels = () => {
  const [nsfwModel, setNsfwModel] = useState<nsfwjs.NSFWJS | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (!nsfwModel) {
      nsfwjs.load().then(setNsfwModel).catch(() => setNsfwModel(null));
    }
  }, [nsfwModel]);

  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [caption, setCaption] = useState('');
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [videoPreviews, setVideoPreviews] = useState<string[]>([]);
  const [portraitPreviewIndex, setPortraitPreviewIndex] = useState<number | null>(null);
  const [portraitApplied, setPortraitApplied] = useState<Record<number, boolean>>({});
  const [isSeries, setIsSeries] = useState(false);
  const [shareToFeeds, setShareToFeeds] = useState<boolean>(false);
  const [subscriptionCycle, setSubscriptionCycle] = useState('monthly');
  const [isPaid, setIsPaid] = useState(true);
  const [subscriptionAmount, setSubscriptionAmount] = useState(1);
  const [seriesTitle, setSeriesTitle] = useState('');
  const [seriesDescription, setSeriesDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'scanning' | 'uploading' | 'complete'>('idle');
  
  // NEW STATES for aspect ratio detection
  const [videoMetadatas, setVideoMetadatas] = useState<Array<{
    duration: number;
    width: number;
    height: number;
    aspectRatio: 'portrait' | 'landscape' | 'square';
  }>>([]);

  const CATEGORY_OPTIONS = [
    'All', 'Tech', 'Comedy', 'Sports', 'Education', 'Inspiration',
    'Music', 'Gaming', 'Food', 'Fitness', 'Lifestyle', 'Art',
  ];

  // Pause any playing videos on the page to avoid background playback when uploading
  useEffect(() => {
    try {
      document.querySelectorAll('video').forEach(v => {
        try { (v as HTMLVideoElement).pause(); } catch (e) {}
      });
    } catch (e) {}
    return () => {};
  }, []);

  // NEW: Video metadata function (replaces getVideoDuration)
  const getVideoMetadata = (file: File): Promise<{
    duration: number;
    width: number;
    height: number;
    aspectRatio: 'portrait' | 'landscape' | 'square';
  }> => {
    return new Promise((resolve) => {
      try {
        const url = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;
        
        let done = false;
        const finish = (data: any) => {
          if (done) return;
          done = true;
          try { URL.revokeObjectURL(url); } catch {}
          resolve(data);
        };
        
        const timeoutId = window.setTimeout(() => {
          finish({ duration: -1, width: 0, height: 0, aspectRatio: 'square' });
        }, 7000);
        
        video.onloadedmetadata = () => {
          window.clearTimeout(timeoutId);
          
          const width = video.videoWidth;
          const height = video.videoHeight;
          const duration = Math.floor(video.duration);
          
          // Calculate aspect ratio
          let aspectRatio: 'portrait' | 'landscape' | 'square' = 'square';
          const ratio = width / height;
          
          if (ratio > 1.1) aspectRatio = 'landscape';
          else if (ratio < 0.9) aspectRatio = 'portrait';
          
          finish({ duration, width, height, aspectRatio });
        };
        
        video.onerror = () => {
          window.clearTimeout(timeoutId);
          finish({ duration: -1, width: 0, height: 0, aspectRatio: 'square' });
        };
        
        video.src = url;
        try { video.load(); } catch {}
      } catch {
        resolve({ duration: -1, width: 0, height: 0, aspectRatio: 'square' });
      }
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) {
      setVideoFiles([]);
      setVideoPreviews([]);
      setVideoMetadatas([]);
      return;
    }

    const clonedFiles: File[] = [];
    const metadatas: Array<{
      duration: number;
      width: number;
      height: number;
      aspectRatio: 'portrait' | 'landscape' | 'square';
    }> = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Get metadata
      const metadata = await getVideoMetadata(file);
      metadatas.push(metadata);
      
      // Clone file
      try {
        const buf = await file.arrayBuffer();
        clonedFiles.push(new File([buf], file.name, { type: file.type, lastModified: file.lastModified }));
      } catch (err) {
        clonedFiles.push(file);
      }
    }
    
    setVideoMetadatas(metadatas);
    setVideoFiles(clonedFiles);
  };

  useEffect(() => {
    if (!videoFiles.length) {
      setVideoPreviews(prev => {
        prev.forEach(url => URL.revokeObjectURL(url));
        return [];
      });
      return;
    }
    const urls = videoFiles.map(file => URL.createObjectURL(file));
    setVideoPreviews(prev => {
      prev.forEach(url => URL.revokeObjectURL(url));
      return urls;
    });
    return () => {
      urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [videoFiles]);

  async function hashFile(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  const scanVideoFile = async (file: File): Promise<boolean> => {
    if (!nsfwModel) return false;
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = url;
      video.muted = true;
      video.playsInline = true;
      video.currentTime = 0;
      let nsfwFound = false;
      let checkedFrames = 0;
      let settled = false;
      const settle = (val: boolean) => {
        if (settled) return;
        settled = true;
        try { URL.revokeObjectURL(url); } catch {}
        resolve(val);
      };
      const safetyTimeout = window.setTimeout(() => {
        settle(false);
      }, 8000);
      const checkFrame = async () => {
        if (nsfwFound || checkedFrames > 10) {
          window.clearTimeout(safetyTimeout);
          settle(nsfwFound);
          return;
        }
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          checkedFrames++;
          if (video.currentTime + 2 < (video.duration || 60)) {
            video.currentTime += 2;
          } else {
            window.clearTimeout(safetyTimeout);
            settle(nsfwFound);
          }
          return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx && canvas.width > 0 && canvas.height > 0) {
          try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const img = tf.browser.fromPixels(canvas);
            const predictions = await nsfwModel.classify(img);
            img.dispose();
            nsfwFound = predictions.some(
              p => (p.className === 'Porn' || p.className === 'Hentai' || p.className === 'Sexy') && p.probability > 0.7
            );
          } catch (error) {}
        }
        checkedFrames++;
        if (!nsfwFound && video.currentTime + 2 < (video.duration || 60)) {
          video.currentTime += 2;
        } else {
          window.clearTimeout(safetyTimeout);
          settle(nsfwFound);
        }
      };
      video.onloadedmetadata = () => {
        setTimeout(checkFrame, 120);
      };
      video.onseeked = checkFrame;
      video.onerror = () => {
        window.clearTimeout(safetyTimeout);
        settle(false);
      };
      try { video.load(); } catch {}
    });
  };

  const handleUploadVideo = async () => {
    if (!videoFiles.length) {
      toast({ description: 'No video files found for upload. Please re-select your video.', variant: 'destructive' });
      setUploading(false);
      return;
    }
    if (!caption || !user || selectedCategories.length === 0) return;

    if (leoProfanity.check(caption)) {
      toast({ description: 'Caption contains inappropriate language.', variant: 'destructive' });
      return;
    }

    if (!nsfwModel) {
      toast({ description: 'Moderation model is still loading. Try again in a few seconds.', variant: 'destructive' });
      return;
    }

    // Landscape warnings removed: proceed with upload normally

    setUploadStatus('scanning');
    for (const file of videoFiles) {
      const isNSFW = await scanVideoFile(file);
      if (isNSFW) {
        toast({ description: 'One or more videos contain NSFW content and cannot be uploaded.', variant: 'destructive' });
        setUploadStatus('idle');
        return;
      }
    }

    if (videoFiles.some(file => file.size > 5368709120)) {
      toast({ description: 'Each video must be 5GB or less.', variant: 'destructive' });
      setUploadStatus('idle');
      return;
    }

    setUploading(true);
    setUploadStatus('uploading');
    setProgress(0);

    try {
      const durations = videoMetadatas.map(m => m.duration);
      const failedDuration = durations.some(d => d === -1);
      const tooLong = durations.some(d => d !== -1 && d > 300);

      if (tooLong) {
        toast({ description: 'All videos must be 5 minutes or less.', variant: 'destructive' });
        setUploading(false);
        setUploadStatus('idle');
        return;
      }
      if (failedDuration) {
        toast({
          description: 'Could not read video length on this device. Continuing upload anyway.',
          variant: "default"
        });
      }

      const { data: channel, error: channelError } = await supabase
        .from('studio_channels')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (channelError || !channel) {
        toast({
          description: `You must have a studio channel before uploading. Error: ${channelError ? channelError.message : 'No channel found.'}`,
          variant: 'destructive'
        });
        setUploading(false);
        setUploadStatus('idle');
        return;
      }

      let lastInsertedId: string | null = null;

      for (let i = 0; i < videoFiles.length; i++) {
        const videoFile = videoFiles[i];
        const videoHash = await hashFile(videoFile);

        const { data: existing, error: hashError } = await supabase
          .from('studio_videos')
          .select('id, user_id')
          .eq('video_hash', videoHash)
          .maybeSingle();

        if (hashError) {
          toast({ description: `Error checking video hash: ${hashError.message || JSON.stringify(hashError)}`, variant: 'destructive' });
          setUploading(false);
          setUploadStatus('idle');
          return;
        }

        const isOriginal = !existing;
        const badge_type = isOriginal ? 'creator' : 'remixer';
        const original_creator_id = existing ? existing.user_id : null;

        const fileExt = videoFile.name.split('.').pop();
        const filePath = `${user.id}/reel_${Date.now()}_${i + 1}.${fileExt}`;

        let uploadResult;
        try {
          uploadResult = await supabase.storage.from('studio-videos').upload(filePath, videoFile, {
            cacheControl: '3600',
            upsert: false,
          });
        } catch (err) {
          toast({ description: `Exception during upload: ${err instanceof Error ? err.message : JSON.stringify(err)}`, variant: 'destructive' });
          setUploading(false);
          setUploadStatus('idle');
          return;
        }
        const { error: uploadError } = uploadResult || {};
        if (uploadError) {
          toast({ description: `Failed to upload video file: ${uploadError.message || JSON.stringify(uploadError)}`, variant: 'destructive' });
          setUploading(false);
          setUploadStatus('idle');
          return;
        }

        setProgress(Math.round(((i + 1) / videoFiles.length) * 100));

        let urlData;
        try {
          const urlRes = supabase.storage.from('studio-videos').getPublicUrl(filePath);
          urlData = urlRes.data;
        } catch (err) {
          toast({ description: `Exception getting public URL: ${err instanceof Error ? err.message : JSON.stringify(err)}`, variant: 'destructive' });
          setUploading(false);
          setUploadStatus('idle');
          return;
        }

        let inserted, dbError;
        try {
          const detectedDuration = Array.isArray(durations) && typeof durations[i] !== 'undefined' ? durations[i] : -1;
          const dbRes = await supabase.from('studio_videos').insert({
            user_id: user.id,
            channel_id: channel.id,
            video_url: urlData.publicUrl,
            caption,
            categories: selectedCategories,
            share_to_feeds: shareToFeeds,
            likes: 0,
            views: 0,
            created_at: new Date().toISOString(),
            video_hash: videoHash,
            badge_type,
            duration: detectedDuration > 0 ? detectedDuration : null,
            ...(original_creator_id ? { original_creator_id } : {}),
            ...(isSeries
              ? {
                  is_series: true,
                  series_title: seriesTitle,
                  series_description: seriesDescription,
                  subscription_cycle: subscriptionCycle,
                  subscription_amount: isPaid ? subscriptionAmount : 0,
                  is_paid: isPaid,
                }
              : {}),
          }).select('id');
          inserted = dbRes.data;
          dbError = dbRes.error;
        } catch (err) {
          toast({ description: `Exception inserting DB record: ${err instanceof Error ? err.message : JSON.stringify(err)}`, variant: 'destructive' });
          setUploading(false);
          setUploadStatus('idle');
          return;
        }
        if (dbError) {
          toast({ description: `Database error: ${dbError.message || JSON.stringify(dbError)}`, variant: 'destructive' });
          setUploading(false);
          setUploadStatus('idle');
          return;
        }
        if (inserted && inserted.length > 0) {
          lastInsertedId = inserted[0].id;
        }
      }

      setUploadStatus('complete');
      toast({ description: 'Videos uploaded successfully!' });
      setCaption('');
      setVideoFiles([]);
      setVideoMetadatas([]);
      videoPreviews.forEach(url => URL.revokeObjectURL(url));
      setVideoPreviews([]);
      setIsSeries(false);
      setSeriesTitle('');
      setSeriesDescription('');
      setUploading(false);
      setProgress(0);

      setTimeout(() => {
        if (lastInsertedId) {
          navigate(`/studio?highlight=${lastInsertedId}`);
        } else {
          navigate('/studio');
        }
      }, 1500);
    } catch (error) {
      toast({ description: `Upload failed: ${error instanceof Error ? error.message : JSON.stringify(error)}`, variant: 'destructive' });
      setUploading(false);
      setProgress(0);
      setUploadStatus('idle');
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const removeVideoFile = (index: number) => {
    const newFiles = [...videoFiles];
    newFiles.splice(index, 1);
    setVideoFiles(newFiles);
    
    const newMetadatas = [...videoMetadatas];
    newMetadatas.splice(index, 1);
    setVideoMetadatas(newMetadatas);
    
    const newPreviews = [...videoPreviews];
    URL.revokeObjectURL(newPreviews[index]);
    newPreviews.splice(index, 1);
    setVideoPreviews(newPreviews);
  };

  // Helper to get aspect ratio badge color
  const getAspectRatioBadgeClass = (aspectRatio: 'portrait' | 'landscape' | 'square') => {
    switch (aspectRatio) {
      case 'landscape':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'portrait':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'square':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  // Helper to get aspect ratio label
  const getAspectRatioLabel = (aspectRatio: 'portrait' | 'landscape' | 'square') => {
    switch (aspectRatio) {
      case 'landscape':
        return '🖥️ Landscape';
      case 'portrait':
        return '📱 Portrait';
      case 'square':
        return '⏹️ Square';
      default:
        return 'Unknown';
    }
  };

  // Note: landscape count/notifications removed per user request

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <Header />
      
      {/* Modern Header */}
      <div className="max-w-4xl mx-auto px-4 pt-6">
        <div className="flex items-center justify-between mb-6">
          <button
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
            <span className="font-medium">Back to Studio</span>
          </button>
          
          <div className="flex items-center gap-2">
         
           
          </div>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Upload Content
          </h1>
        
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-32">
        {/* Landscape warnings and format guide removed per user request */}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Video Upload */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upload Card */}
            <Card className="border-2 border-dashed border-muted hover:border-primary/50 transition-all duration-300">
              <CardContent className="p-4">
                <div 
                  onClick={triggerFileInput}
                  className="cursor-pointer text-center py-6 hover:bg-accent/50 rounded-lg transition-colors"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  
                  {videoFiles.length === 0 ? (
                    <>
                      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
                        <Upload className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="text-base font-semibold mb-1">Drag & drop videos or click to browse</h3>
                     
                      <Button variant="outline" size="default" className="gap-2">
                        <FolderOpen className="h-4 w-4" />
                        Choose Files
                      </Button>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-center gap-2 text-lg font-semibold">
                        <Video className="h-5 w-5 text-primary" />
                        <span>{videoFiles.length} video{videoFiles.length !== 1 ? 's' : ''} selected</span>
                        {/* Landscape count badge removed */}
                      </div>
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>Ready to upload</span>
                      </div>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Upload className="h-4 w-4" />
                        Add More Videos
                      </Button>
                    </div>
                  )}
                </div>

                {/* Video Previews */}
                {videoPreviews.length > 0 && (
                  <div className="space-y-4 mt-6">
                    {videoPreviews.map((url, index) => (
                      <div key={index} className="group relative rounded-lg overflow-hidden border">
                        {/* Preview as portrait / apply transform buttons */}
                        <div className="absolute top-2 left-12 z-10 flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => setPortraitPreviewIndex(index)}
                          >
                            Preview as Portrait
                          </Button>
                          <Button
                            size="sm"
                            variant={portraitApplied[index] ? 'secondary' : 'ghost'}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => setPortraitApplied(prev => ({ ...prev, [index]: !prev[index] }))}
                          >
                            {portraitApplied[index] ? 'Portrait Applied' : 'Mark Portrait'}
                          </Button>
                        </div>
                        <div className="absolute top-2 right-2 z-10">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removeVideoFile(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        {/* Aspect info and crop guides removed */}
                        
                        <video
                          src={url}
                          controls
                          playsInline
                          preload="metadata"
                          className="w-full aspect-video bg-black"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                          <div className="text-white text-sm font-medium">
                            {videoFiles[index]?.name || `Video ${index + 1}`}
                          </div>
                          <div className="text-white/70 text-xs flex items-center gap-2">
                            <span>{(videoFiles[index]?.size / (1024 * 1024)).toFixed(1)} MB</span>
                            <span>•</span>
                            <span>{videoMetadatas[index]?.width}×{videoMetadatas[index]?.height}</span>
                            <span>•</span>
                            <span>Video {index + 1}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Progress Section */}
            {uploadStatus !== 'idle' && (
              <Card className="bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        uploadStatus === 'scanning' ? 'bg-amber-100 text-amber-600' :
                        uploadStatus === 'uploading' ? 'bg-blue-100 text-blue-600' :
                        'bg-green-100 text-green-600'
                      }`}>
                        {uploadStatus === 'scanning' && <Shield className="h-5 w-5" />}
                        {uploadStatus === 'uploading' && <Skeleton className="h-5 w-5 rounded-full" />}
                        {uploadStatus === 'complete' && <CheckCircle className="h-5 w-5" />}
                      </div>
                      <div>
                        <h4 className="font-semibold capitalize">{uploadStatus}</h4>
                        <p className="text-sm text-muted-foreground">
                          {uploadStatus === 'scanning' && 'Checking content for safety...'}
                          {uploadStatus === 'uploading' && 'Uploading your videos...'}
                          {uploadStatus === 'complete' && 'Upload complete!'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">{progress}%</div>
                      <div className="text-xs text-muted-foreground">{videoFiles.length} files</div>
                    </div>
                  </div>
                  <Progress value={progress} className="h-2" />
                </CardContent>
              </Card>
            )}

            {/* Caption Section */}
            <Card>
              <CardContent className="p-6">
                <label className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  Caption
                </label>
                <Input
                  type="text"
                  placeholder="Caption This"
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  className="h-12 text-lg"
                />
                <div className="flex items-center justify-between mt-2">
                  <div className="text-xs text-muted-foreground">
                    {caption.length}/280 characters
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <Shield className="h-3 w-3" />
                    <span>AI Content Moderation Active</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Settings */}
          <div className="space-y-6">
            {/* Categories Card */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
                      <Tag className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Content Categories</h3>
                     
                    </div>
                  </div>
                  <Badge variant="secondary" className="px-3 py-1.5">
                    {selectedCategories.length}/3
                  </Badge>
                </div>

                <div className="mb-6">
                  <div className="flex flex-wrap gap-3">
                    {CATEGORY_OPTIONS.map(cat => {
                      const selected = selectedCategories.includes(cat);
                      const disabled = !selected && selectedCategories.length >= 3;
                      return (
                        <button
                          key={cat}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            if (selected) {
                              setSelectedCategories(selectedCategories.filter(c => c !== cat));
                            } else if (selectedCategories.length < 3) {
                              setSelectedCategories([...selectedCategories, cat]);
                            }
                          }}
                          disabled={disabled}
                          className={`text-sm font-medium whitespace-nowrap px-3 py-1 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-purple-400 ${selected ? 'bg-purple-600 text-white border-transparent' : 'bg-white dark:bg-gray-900 text-black dark:text-white border border-gray-300 dark:border-gray-700'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedCategories.length > 0 && (
                  <div className="animate-in fade-in duration-300">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm font-medium text-muted-foreground">Selected:</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {selectedCategories.map(cat => (
                        <div
                          key={cat}
                          className="group inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20"
                        >
                          <span className="font-medium text-sm">{cat}</span>
                          <button
                            type="button"
                            onClick={() => setSelectedCategories(selectedCategories.filter(c => c !== cat))}
                            className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3 text-primary" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-6 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {selectedCategories.length === 0 ? (
                        "No categories selected"
                      ) : selectedCategories.length === 3 ? (
                        <span className="text-green-600 font-medium">✓ Maximum categories selected</span>
                      ) : (
                        `${3 - selectedCategories.length} more can be selected`
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {[...Array(3)].map((_, i) => (
                        <div
                          key={i}
                          className={`
                            h-2 w-8 rounded-full transition-all duration-300
                            ${i < selectedCategories.length 
                              ? 'bg-primary' 
                              : 'bg-muted'
                            }
                          `}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* NEW: Video Summary Card */}
            {videoFiles.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-4">Video Summary</h3>
                  
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {videoFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                          <div className={`
                            h-8 w-8 rounded-full flex items-center justify-center
                            bg-primary/10 text-primary
                          `}>
                            {/* Aspect icon removed */}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {file.name.length > 20 ? `${file.name.substring(0, 20)}...` : file.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {videoMetadatas[index]?.width}×{videoMetadatas[index]?.height} • 
                              {(file.size / (1024 * 1024)).toFixed(1)} MB
                            </p>
                          </div>
                        </div>
                        <Badge 
                          variant="outline"
                          className={`
                            ${videoMetadatas[index]?.aspectRatio === 'landscape' ? 'border-amber-300 text-amber-700' :
                              videoMetadatas[index]?.aspectRatio === 'portrait' ? 'border-green-300 text-green-700' :
                              'border-blue-300 text-blue-700'}
                          `}
                        >
                          {videoMetadatas[index]?.aspectRatio?.charAt(0).toUpperCase() || '?'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  
                  {/* Landscape note removed */}
                </CardContent>
              </Card>
            )}

            {/* Series Card */}
            <Card className="mb-28">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Layers className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Series Settings</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Subscription Series</label>
                    <div className="relative inline-block w-12 h-6">
                      <input
                        type="checkbox"
                        checked={isSeries}
                        onChange={e => setIsSeries(e.target.checked)}
                        className="sr-only peer"
                        id="series-toggle"
                      />
                      <label
                        htmlFor="series-toggle"
                        className="absolute cursor-pointer top-0 left-0 right-0 bottom-0 bg-gray-200 dark:bg-gray-700 rounded-full transition-colors peer-checked:bg-primary before:absolute before:content-[''] before:h-5 before:w-5 before:left-0.5 before:bottom-0.5 before:bg-white before:rounded-full before:transition-transform peer-checked:before:translate-x-6"
                      />
                    </div>
                  </div>

                  {isSeries && (
                    <div className="space-y-4 animate-in fade-in">
                      <div>
                        <label className="block text-sm font-medium mb-2">Series Title</label>
                        <Input
                          placeholder="Enter series title"
                          value={seriesTitle}
                          onChange={e => setSeriesTitle(e.target.value)}
                          className="h-10"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-2">Description</label>
                        <textarea
                          placeholder="Describe your series"
                          value={seriesDescription}
                          onChange={e => setSeriesDescription(e.target.value)}
                          className="w-full min-h-[80px] rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium mb-2 flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Subscription Cycle
                        </label>
                        <select
                          value={subscriptionCycle}
                          onChange={e => setSubscriptionCycle(e.target.value)}
                          className="w-full h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <option value="monthly">Monthly</option>
                          <option value="quarterly">Quarterly</option>
                          <option value="yearly">Yearly</option>
                        </select>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant={!isPaid ? "default" : "outline"}
                          onClick={() => setIsPaid(false)}
                          className="w-full"
                        >
                          Free
                        </Button>
                        <Button
                          variant={isPaid ? "default" : "outline"}
                          onClick={() => setIsPaid(true)}
                          className="w-full gap-2"
                        >
                          <DollarSign className="h-4 w-4" />
                          Paid
                        </Button>
                      </div>
                      
                      {isPaid && (
                        <div>
                          <label className="block text-sm font-medium mb-2">Price (USD)</label>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="number"
                              min="1"
                              value={subscriptionAmount}
                              onChange={e => setSubscriptionAmount(Number(e.target.value))}
                              className="h-10 pl-9"
                            />
                          </div>
                        </div>
                      )}
                      
                      <div className="rounded-lg bg-primary/5 p-3">
                        <p className="text-xs text-muted-foreground">
                          <span className="font-semibold">Note:</span> Minimum 5 videos required for subscription series
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Upload Requirements removed per request */}
          </div>
        </div>

        {/* Portrait preview modal overlay */}
        {portraitPreviewIndex !== null && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80">
            <div className="w-[360px] max-w-[90vw] h-[640px] bg-black rounded-lg overflow-hidden p-4 relative">
              <video
                src={videoPreviews[portraitPreviewIndex]}
                controls
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 right-3 flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setPortraitPreviewIndex(null)}>Close</Button>
                <Button size="sm" variant="default" onClick={() => {
                  setPortraitApplied(prev => ({ ...prev, [portraitPreviewIndex]: true }));
                  setPortraitPreviewIndex(null);
                }}>Apply Portrait</Button>
              </div>
            </div>
          </div>
        )}

        {/* spacer so fixed action buttons don't overlap content on mobile */}
        <div className="h-28 md:h-24" />

        {/* Fixed Action Buttons - Fixed layout with Share to Feeds toggle */}
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 w-full max-w-4xl px-4 z-50">
          <div className="bg-background/95 backdrop-blur-lg border rounded-2xl shadow-xl p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Video className="h-4 w-4" />
                  <span>{videoFiles.length} selected</span>
                  {selectedCategories.length > 0 && (
                    <>
                      <span>•</span>
                      <Tag className="h-4 w-4" />
                      <span>{selectedCategories.length} categories</span>
                    </>
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
                      checked={shareToFeeds}
                      onChange={e => setShareToFeeds(e.target.checked)}
                      className="sr-only peer"
                      id="share-toggle"
                    />
                    <label
                      htmlFor="share-toggle"
                      className="absolute cursor-pointer top-0 left-0 right-0 bottom-0 bg-gray-300 dark:bg-gray-700 rounded-full transition-colors peer-checked:bg-primary before:absolute before:content-[''] before:h-3.5 before:w-3.5 before:left-0.5 before:bottom-0.5 before:bg-white before:rounded-full before:transition-transform peer-checked:before:translate-x-5"
                    />
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-center gap-3 w-full sm:w-auto justify-center sm:justify-end">
                  <Button
                    variant="outline"
                    onClick={() => navigate('/studio')}
                    className="rounded-full w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUploadVideo}
                    disabled={
                      videoFiles.length < 1 ||
                      !caption ||
                      selectedCategories.length === 0 ||
                      (isSeries && videoFiles.length < 5) ||
                      (isSeries && (!seriesTitle || !seriesDescription || (isPaid && !subscriptionAmount))) ||
                      uploading
                    }
                    className="rounded-full px-8 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg w-full sm:w-auto"
                    size="lg"
                  >
                    {uploading ? (
                      <span className="flex items-center gap-2">
                        <Skeleton className="h-4 w-4 rounded-full" />
                        Uploading {progress}%
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        {isSeries ? 'Publish Series' : 'Publish Now'}
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="md:hidden">
        <MobileBottomNav />
      </div>
    </div>
  );
};

export default UploadReels;