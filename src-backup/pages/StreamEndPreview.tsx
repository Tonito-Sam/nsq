import { useEffect, useState, useRef } from "react";
import { Header } from "@/components/Header";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from '@/hooks/useAuth';
import Hls from 'hls.js';
import { Save, Share2, Trash2, Heart, Users, Gift, MessageCircle, Clock } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

type UserProfile = {
  id: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
};

type Channel = {
  id: string;
  name: string;
  logo_url?: string;
};

type StreamPreviewPageProps = {
  streamId: string;
  videoUrl?: string;
  onSave?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
};

type StreamAnalytics = {
  total_likes: number;
  total_viewers: number;
  total_gifts: number;
  total_comments: number;
  max_watch_time: number;
};

export const StreamEndPreview: React.FC<StreamPreviewPageProps> = ({ streamId, videoUrl, onSave, onShare, onDelete }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dbVideoUrl, setDbVideoUrl] = useState<string>(videoUrl || "");
  const [author, setAuthor] = useState<UserProfile | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [analytics, setAnalytics] = useState<StreamAnalytics>({
    total_likes: 0,
    total_viewers: 0,
    total_gifts: 0,
    total_comments: 0,
    max_watch_time: 0
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Fetch author and channel info
  useEffect(() => {
    const fetchMeta = async () => {
      if (!streamId) return;
      // Get stream row for user_id and channel_id
      const { data: streamData } = await supabase
        .from('studio_streams')
        .select('user_id, channel_id')
        .eq('id', streamId)
        .single();
      let userId = streamData?.user_id;
      // Fetch user profile (stream owner only, from profiles table)
      let userData = null;
      if (userId) {
        const { data } = await supabase
          .from('profiles')
          .select('id, username, first_name, last_name, avatar_url')
          .eq('id', userId)
          .single();
        userData = data;
      }
      setAuthor(userData || null);
      // Fetch channel info
      if (streamData?.channel_id) {
        const { data: channelData } = await supabase
          .from('channels')
          .select('id, name, logo_url')
          .eq('id', streamData.channel_id)
          .single();
        setChannel(channelData || null);
      }
    };
    fetchMeta();
  }, [streamId]);

  useEffect(() => {
    if (!dbVideoUrl && streamId) {
      supabase.from('studio_streams').select('video_url').eq('id', streamId).single().then(({ data, error }) => {
        if (data?.video_url) setDbVideoUrl(data.video_url);
      });
    }
  }, [dbVideoUrl, streamId]);

  useEffect(() => {
    // Fetch stream analytics
    const fetchAnalytics = async () => {
      if (!streamId) return;
      
      // Fetch likes count
      const { count: likesCount } = await supabase
        .from('stream_likes')
        .select('*', { count: 'exact', head: true })
        .eq('stream_id', streamId);

      // Fetch comments count
      const { count: commentsCount } = await supabase
        .from('stream_comments')
        .select('*', { count: 'exact', head: true })
        .eq('stream_id', streamId);

      // Fetch gifts count
      const { count: giftsCount } = await supabase
        .from('stream_gifts')
        .select('*', { count: 'exact', head: true })
        .eq('stream_id', streamId);

      // Fetch viewers count and max watch time
      const { data: viewersData } = await supabase
        .from('stream_viewers')
        .select('watch_time')
        .eq('stream_id', streamId);

      const totalViewers = viewersData?.length || 0;
      const maxWatchTime = viewersData?.reduce((max, viewer) => 
        Math.max(max, viewer.watch_time || 0), 0) || 0;

      setAnalytics({
        total_likes: likesCount || 0,
        total_viewers: totalViewers,
        total_gifts: giftsCount || 0,
        total_comments: commentsCount || 0,
        max_watch_time: maxWatchTime
      });
    };

    fetchAnalytics();
  }, [streamId]);

  useEffect(() => {
    if (dbVideoUrl && videoRef.current) {
      const video = videoRef.current;
      
      if (dbVideoUrl.includes('.m3u8')) {
        // HLS stream
        if (Hls.isSupported()) {
          const hls = new Hls();
          hlsRef.current = hls;
          hls.loadSource(dbVideoUrl);
          hls.attachMedia(video);
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          // Safari native HLS support
          video.src = dbVideoUrl;
        }
      } else {
        // Regular video file
        video.src = dbVideoUrl;
      }
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [dbVideoUrl]);

  const handleSave = async () => {
    setLoading(true);
    setError("");
    try {
      // Mark stream as not live
      await supabase.from('studio_streams').update({ is_live: false }).eq('id', streamId);
      // Fetch the channel_id for this stream
      const { data: streamData, error: streamError } = await supabase
        .from('studio_streams')
        .select('channel_id')
        .eq('id', streamId)
        .single();
      const channelId = streamData?.channel_id;
      if (onSave) onSave();
      if (channelId) {
        navigate(`/studio/${channelId}`);
      } else {
        navigate('/studio/channel'); // fallback
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save stream');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    setLoading(true);
    setError("");
    try {
      await supabase.from('studio_streams').update({ is_live: false }).eq('id', streamId);
      await supabase.from('posts').insert([
        {
          user_id: user?.id,
          type: 'stream',
          stream_id: streamId,
          video_url: videoUrl,
          content: 'Check out my latest livestream!',
        },
      ]);
      if (onShare) onShare();
      navigate('/feed');
    } catch (err: any) {
      setError(err.message || 'Failed to share stream');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    setError("");
    try {
      await supabase.from('studio_streams').delete().eq('id', streamId);
      if (onDelete) onDelete();
      navigate('/studio/channel');
    } catch (err: any) {
      setError(err.message || 'Failed to delete stream');
    } finally {
      setLoading(false);
    }
  };

  const formatWatchTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <>
      <Header />
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 pb-20 md:pb-4 px-4">
        <div className="w-full max-w-4xl space-y-4">
          {/* Author and Channel Row */}
          <div className="flex items-center justify-between w-full mb-2">
            {/* Author badge styled like Studio.tsx */}
            {author && (
              <button
                className="bg-gray-900/80 px-2 py-1 rounded-full text-xs text-white font-semibold flex items-center gap-2 z-30 backdrop-blur-md hover:bg-gray-800/90 transition-colors"
                style={{ position: 'relative', left: 0, top: 0 }}
                type="button"
                tabIndex={-1}
              >
                <img
                  src={author.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${author.username}`}
                  alt={author.username}
                  className="w-4 h-4 rounded-full"
                />
                <span>{author.username}</span>
              </button>
            )}
            {/* Channel badge (keep as before) */}
            {channel && (
              <div className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 px-3 py-1 rounded-full shadow border border-indigo-400/40">
                {channel.logo_url && (
                  <img src={channel.logo_url} alt={channel.name} className="w-7 h-7 rounded-full object-cover" />
                )}
                <span className="text-white font-semibold text-sm">{channel.name}</span>
              </div>
            )}
          </div>

          {/* Video Preview Card */}
          <div className="bg-black rounded-2xl shadow-2xl p-4 flex flex-col items-center">
            <h2 className="text-xl font-bold text-white mb-3">Stream Preview</h2>
            <video 
              ref={videoRef}
              controls 
              className="w-full rounded-xl mb-4 bg-black max-h-64 sm:max-h-96" 
              playsInline
            />
            <div className="flex items-center justify-center gap-6">
              <button 
                onClick={handleSave} 
                disabled={loading} 
                className="p-2 rounded-full bg-green-500 hover:bg-green-600 text-white transition-colors disabled:opacity-50"
                title="Save"
              >
                <Save size={16} />
              </button>
              <button 
                onClick={handleShare} 
                disabled={loading} 
                className="p-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white transition-colors disabled:opacity-50"
                title="Share"
              >
                <Share2 size={16} />
              </button>
              <button 
                onClick={handleDelete} 
                disabled={loading} 
                className="p-2 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50"
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            </div>
            {error && <div className="text-red-400 mt-3 text-sm">{error}</div>}
          </div>

          {/* Analytics Card */}
          <div className="bg-black/80 backdrop-blur-sm rounded-2xl shadow-2xl p-3">
            <h3 className="text-base font-bold text-white mb-3 text-center">Stream Analytics</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <div className="bg-gradient-to-br from-red-500/20 to-pink-500/20 rounded-lg p-2 text-center border border-red-500/30">
                <Heart className="w-3 h-3 mx-auto mb-1 text-red-400" />
                <div className="text-sm font-bold text-white">{analytics.total_likes}</div>
                <div className="text-xs text-gray-300">Likes</div>
              </div>
              
              <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-lg p-2 text-center border border-blue-500/30">
                <Users className="w-3 h-3 mx-auto mb-1 text-blue-400" />
                <div className="text-sm font-bold text-white">{analytics.total_viewers}</div>
                <div className="text-xs text-gray-300">Viewers</div>
              </div>
              
              <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-lg p-2 text-center border border-yellow-500/30">
                <Gift className="w-3 h-3 mx-auto mb-1 text-yellow-400" />
                <div className="text-sm font-bold text-white">{analytics.total_gifts}</div>
                <div className="text-xs text-gray-300">Gifts</div>
              </div>
              
              <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-lg p-2 text-center border border-green-500/30">
                <MessageCircle className="w-3 h-3 mx-auto mb-1 text-green-400" />
                <div className="text-sm font-bold text-white">{analytics.total_comments}</div>
                <div className="text-xs text-gray-300">Comments</div>
              </div>
              
              <div className="bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-lg p-2 text-center border border-purple-500/30 col-span-2 md:col-span-1">
                <Clock className="w-3 h-3 mx-auto mb-1 text-purple-400" />
                <div className="text-sm font-bold text-white">{formatWatchTime(analytics.max_watch_time)}</div>
                <div className="text-xs text-gray-300">Max Watch</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <MobileBottomNav />
    </>
  );
};
