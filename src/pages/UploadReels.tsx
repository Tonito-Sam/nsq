import React, { useState } from 'react';
import leoProfanity from 'leo-profanity';

// Add custom life-threatening words to leo-profanity
const customThreatWords = [
  'murder', 'murdered', 'murdering', 'kill', 'killed', 'killing', 'stab', 'stabbed', 'stabbing', 'assassinate', 'assassinated', 'assassinating', 'slaughter', 'slaughtered', 'slaughtering', 'execute', 'executed', 'executing', 'behead', 'beheaded', 'beheading', 'decapitate', 'decapitated', 'decapitating', 'strangle', 'strangled', 'strangling', 'shoot', 'shot', 'shooting', 'hang', 'hanged', 'hanging', 'lynch', 'lynched', 'lynching', 'poison', 'poisoned', 'poisoning', 'drown', 'drowned', 'drowning', 'suffocate', 'suffocated', 'suffocating', 'burn alive', 'burned alive', 'burning alive', 'torture', 'tortured', 'torturing', 'massacre', 'massacred', 'massacring', 'suicide', 'suicidal', 'homicide', 'homicidal', 'manslaughter', 'genocide', 'genocidal', 'exterminate', 'exterminated', 'exterminating', 'eliminate', 'eliminated', 'eliminating', 'terminate', 'terminated', 'terminating', 'butcher', 'butchered', 'butchering', 'bludgeon', 'bludgeoned', 'bludgeoning', 'maim', 'maimed', 'maiming', 'disembowel', 'disemboweled', 'disemboweling', 'disfigure', 'disfigured', 'disfiguring', 'rape', 'raped', 'raping', 'abduct', 'abducted', 'abducting', 'kidnap', 'kidnapped', 'kidnapping', 'molest', 'molested', 'molesting', 'abuse', 'abused', 'abusing', 'assault', 'assaulted', 'assaulting', 'batter', 'battered', 'battering', 'beat', 'beaten', 'beating', 'threaten', 'threatened', 'threatening', 'terrorize', 'terrorized', 'terrorizing', 'violate', 'violated', 'violating'
];
leoProfanity.add(customThreatWords);
import * as nsfwjs from 'nsfwjs';
import * as tf from '@tensorflow/tfjs';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { MobileBottomNav } from '@/components/MobileBottomNav';

const UploadReels = () => {
  // NSFWJS model state
  const [nsfwModel, setNsfwModel] = useState<nsfwjs.NSFWJS | null>(null);
  React.useEffect(() => {
    if (!nsfwModel) {
      nsfwjs.load().then(setNsfwModel);
    }
  }, [nsfwModel]);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [caption, setCaption] = useState('');
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [isSeries, setIsSeries] = useState(false);
  const [subscriptionCycle, setSubscriptionCycle] = useState('monthly');
  const [isPaid, setIsPaid] = useState(true);
  const [subscriptionAmount, setSubscriptionAmount] = useState(1);
  const [seriesTitle, setSeriesTitle] = useState('');
  const [seriesDescription, setSeriesDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

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

  // Get video duration helper
  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(Math.floor(video.duration));
      };
      video.onerror = () => reject(new Error('Failed to load video metadata'));
      video.src = URL.createObjectURL(file);
    });
  };

  // Hash a file using SHA-256, returning hex string
  async function hashFile(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Helper: scan video file for NSFW by extracting frames - FIXED VERSION
  const scanVideoFile = async (file: File): Promise<boolean> => {
    if (!nsfwModel) return false;
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = URL.createObjectURL(file);
      video.muted = true;
      video.currentTime = 0;
      let nsfwFound = false;
      let checkedFrames = 0;
      
      const checkFrame = async () => {
        if (nsfwFound || checkedFrames > 10) {
          URL.revokeObjectURL(video.src);
          resolve(nsfwFound);
          return;
        }
        
        // FIXED: Ensure video has valid dimensions before creating canvas
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          console.warn('Video dimensions not ready, skipping frame');
          checkedFrames++;
          if (video.currentTime + 2 < video.duration) {
            video.currentTime += 2;
          } else {
            resolve(nsfwFound);
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
            nsfwFound = predictions.some(p => (p.className === 'Porn' || p.className === 'Hentai' || p.className === 'Sexy') && p.probability > 0.7);
          } catch (error) {
            console.warn('Error processing video frame:', error);
          }
        }
        
        checkedFrames++;
        if (!nsfwFound && video.currentTime + 2 < video.duration) {
          video.currentTime += 2;
        } else {
          resolve(nsfwFound);
        }
      };
      
      video.onloadedmetadata = () => {
        // Wait a bit more for video to be fully ready
        setTimeout(checkFrame, 100);
      };
      video.onseeked = checkFrame;
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve(false); // Skip NSFW check if video can't be loaded
      };
    });
  };

  const handleUploadVideo = async () => {
    if (!videoFiles.length || !caption || !user || selectedCategories.length === 0) return;
    // Profanity check for caption
    if (leoProfanity.check(caption)) {
      toast({ description: 'Caption contains inappropriate language.', variant: 'destructive' });
      return;
    }
    // NSFW check for all videos
    if (!nsfwModel) {
      toast({ description: 'Content moderation model is still loading. Please wait a moment and try again.', variant: 'destructive' });
      return;
    }
    for (const file of videoFiles) {
      const isNSFW = await scanVideoFile(file);
      if (isNSFW) {
        toast({ description: 'One or more videos contain inappropriate (NSFW/violent) content and cannot be uploaded.', variant: 'destructive' });
        return;
      }
    }
    // 500MB = 524288000 bytes
    if (videoFiles.some(file => file.size > 524288000)) {
      toast({ description: 'Each video must be 500MB or less.', variant: 'destructive' });
      return;
    }
    setUploading(true);

    try {
      // Check all videos are <= 5 mins (300 seconds)
      const durations = await Promise.all(videoFiles.map(file => getVideoDuration(file)));
      if (durations.some(duration => duration > 300)) {
        toast({ description: 'All videos must be 5 minutes or less.', variant: 'destructive' });
        setUploading(false);
        return;
      }

      // Get user channel
      const { data: channel, error: channelError } = await supabase
        .from('studio_channels')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (channelError || !channel) {
        toast({ description: 'You must have a studio channel before uploading.', variant: 'destructive' });
        setUploading(false);
        return;
      }

      // Upload files one by one, checking hash for creator/remixer
      let lastInsertedId = null;
      for (let i = 0; i < videoFiles.length; i++) {
        const videoFile = videoFiles[i];
        const videoHash = await hashFile(videoFile);

        // Check if this hash already exists in DB
        const { data: existing, error: hashError } = await supabase
          .from('studio_videos')
          .select('id, user_id')
          .eq('video_hash', videoHash)
          .maybeSingle();

        if (hashError) {
          toast({ description: 'Error checking video hash.', variant: 'destructive' });
          setUploading(false);
          return;
        }

        const isOriginal = !existing;
        const badge_type = isOriginal ? 'creator' : 'remixer';
        const original_creator_id = existing ? existing.user_id : null;

        // Upload video file
        const fileExt = videoFile.name.split('.').pop();
        const filePath = `${user.id}/reel_${Date.now()}_${i + 1}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('studio-videos').upload(filePath, videoFile);

        if (uploadError) {
          toast({ description: 'Failed to upload video file.', variant: 'destructive' });
          setUploading(false);
          return;
        }

        const { data: urlData } = supabase.storage.from('studio-videos').getPublicUrl(filePath);

        // Insert record into DB
        const { data: inserted, error: dbError } = await supabase.from('studio_videos').insert({
          user_id: user.id,
          channel_id: channel.id,
          video_url: urlData.publicUrl,
          caption,
          categories: selectedCategories,
          likes: 0,
          views: 0,
          created_at: new Date().toISOString(),
          video_hash: videoHash,
          badge_type,
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

        if (dbError) {
          toast({ description: `Database error: ${dbError.message}`, variant: 'destructive' });
          setUploading(false);
          return;
        }
        if (inserted && inserted.length > 0) {
          lastInsertedId = inserted[0].id;
        }
      }

      toast({ description: 'Videos uploaded successfully!' });
      setCaption('');
      setVideoFiles([]);
      setIsSeries(false);
      setSeriesTitle('');
      setSeriesDescription('');
      setUploading(false);
      if (lastInsertedId) {
        navigate(`/studio?highlight=${lastInsertedId}`);
      } else {
        navigate('/studio');
      }
    } catch (error) {
      toast({ description: 'Upload failed', variant: 'destructive' });
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-xl mx-auto px-4 pt-4">
        <button
          className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-semibold mb-2 hover:underline"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>
      </div>

      <div className="max-w-xl mx-auto p-6 pt-0 pb-32">
        <h2 className="text-2xl font-bold mb-4">Upload Video</h2>

        <Input
          type="file"
          accept="video/*"
          multiple
          onChange={e => setVideoFiles(Array.from(e.target.files || []))}
          className="mb-2 bg-white dark:bg-gray-900 text-black dark:text-white border border-gray-300 dark:border-gray-700"
        />

        {/* Video Preview */}
        {videoFiles.length > 0 && (
          <div className="mb-4 space-y-4">
            {videoFiles.map((file, index) => (
              <video
                key={index}
                src={URL.createObjectURL(file)}
                controls
                className="w-full rounded-lg border"
              />
            ))}
          </div>
        )}


        <Input
          type="text"
          placeholder="Caption"
          value={caption}
          onChange={e => setCaption(e.target.value)}
          className="mb-2"
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

        <div className="mb-4">
          <label className="flex items-center gap-2 text-sm font-medium mb-2">
            <input
              type="checkbox"
              checked={isSeries}
              onChange={e => setIsSeries(e.target.checked)}
              className="accent-purple-600"
            />
            <span>Mark as Subscription Series</span>
          </label>

          {isSeries && (
            <div className="space-y-2 border rounded-lg p-3 bg-purple-50 dark:bg-gray-900">
              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-gray-200">Series Title</label>
                <Input
                  type="text"
                  value={seriesTitle}
                  onChange={e => setSeriesTitle(e.target.value)}
                  className="w-full bg-white dark:bg-gray-900 text-black dark:text-white border border-gray-300 dark:border-gray-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-gray-200">Series Description</label>
                <Input
                  type="text"
                  value={seriesDescription}
                  onChange={e => setSeriesDescription(e.target.value)}
                  className="w-full bg-white dark:bg-gray-900 text-black dark:text-white border border-gray-300 dark:border-gray-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-gray-200">Subscription Cycle</label>
                <select
                  value={subscriptionCycle}
                  onChange={e => setSubscriptionCycle(e.target.value)}
                  className="w-full rounded border border-gray-300 dark:border-gray-700 p-2 text-sm bg-white dark:bg-gray-900 text-black dark:text-white"
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              <div className="flex items-center gap-4 mt-2">
                <label className="flex items-center gap-1 text-xs font-semibold text-gray-700 dark:text-gray-200">
                  <input
                    type="radio"
                    name="seriesType"
                    checked={!isPaid}
                    onChange={() => setIsPaid(false)}
                    className="accent-purple-600"
                  />
                  Free
                </label>
                <label className="flex items-center gap-1 text-xs font-semibold text-gray-700 dark:text-gray-200">
                  <input
                    type="radio"
                    name="seriesType"
                    checked={isPaid}
                    onChange={() => setIsPaid(true)}
                    className="accent-purple-600"
                  />
                  Paid
                </label>
              </div>

              {isPaid && (
                <div>
                  <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-gray-200">Subscription Amount (USD)</label>
                  <Input
                    type="number"
                    min="1"
                    value={subscriptionAmount}
                    onChange={e => setSubscriptionAmount(Number(e.target.value))}
                    className="w-full bg-white dark:bg-gray-900 text-black dark:text-white border border-gray-300 dark:border-gray-700"
                  />
                </div>
              )}

              <div className="text-xs text-gray-600 dark:text-gray-300 mt-2">
                You must upload at least 5 videos to start a subscription series.
              </div>
            </div>
          )}
        </div>

        {/* Fixed button container */}
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 flex gap-3 z-50 bg-background/80 backdrop-blur-sm p-4 rounded-lg border shadow-lg">
          <Button
            onClick={handleUploadVideo}
            disabled={
              videoFiles.length < 1 ||
              !caption ||
              (isSeries && videoFiles.length < 5) ||
              (isSeries && (!seriesTitle || !seriesDescription || (isPaid && !subscriptionAmount))) ||
              uploading
            }
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-2 rounded-lg"
          >
            {uploading ? 'Uploading...' : `Upload${isSeries ? ' (≥ 5 videos for series)' : ' (≤ 5 min)'}`}
          </Button>
          <Button variant="outline" onClick={() => navigate('/studio')}>
            Cancel
          </Button>
        </div>
      </div>

      <div className="md:hidden">
        <MobileBottomNav />
      </div>
    </div>
  );
};

export default UploadReels;