import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const ReelViewPage = () => {
  const { id } = useParams();
  const [video, setVideo] = useState<any>(null);
  const [author, setAuthor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVideo = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('studio_videos')
        .select('*')
        .eq('id', id)
        .single();
      setVideo(data);
      // Fetch author if user_id exists
      if (data && data.user_id) {
        const { data: user } = await supabase
          .from('users')
          .select('username, avatar_url')
          .eq('id', data.user_id)
          .single();
        setAuthor(user);
      }
      setLoading(false);
    };
    fetchVideo();
  }, [id]);

  if (loading) return <div className="flex justify-center items-center h-96"><Skeleton className="w-16 h-16" /></div>;
  if (!video) return <div className="text-center py-12">Reel not found.</div>;

  // Show login/create account prompt for unauthenticated users
  const isLoggedIn = !!localStorage.getItem('supabase.auth.token');

  // Find the first available video/media
  const videoUrl = video.video_url || video.media_url || video.url || (Array.isArray(video.media) && video.media.length > 0 ? video.media[0] : null);
  const posterUrl = video.thumbnail_url || video.poster_url || undefined;
  const username = author?.username || 'Unknown';
  const avatarUrl = author?.avatar_url;

  return (
    <Card className="max-w-2xl mx-auto mt-8 p-6">
      <div className="flex justify-center mb-2">
        <img src="/uploads/3a993d3c-2671-42a3-9e99-587f4e3a7462.png" alt="Nexsq Logo" className="w-16 h-auto" />
      </div>
      <div className="flex flex-col items-center mb-4">
        <div className="flex items-center">
          {avatarUrl && <img src={avatarUrl} alt={username} className="w-8 h-8 rounded-full mr-2" />}
          <span className="font-semibold text-lg">{username}'s reel on Nexsq</span>
        </div>
      </div>
      {videoUrl && (
        <video src={videoUrl} controls className="w-full rounded-lg mb-4" poster={posterUrl} playsInline webkit-playsinline />
      )}
      {/* Show post content/description/body if available */}
      {video.content && (
        <div className="mb-4 text-gray-800 dark:text-gray-200 whitespace-pre-line">{video.content}</div>
      )}
      {video.body && !video.content && (
        <div className="mb-4 text-gray-800 dark:text-gray-200 whitespace-pre-line">{video.body}</div>
      )}
      {!isLoggedIn && (
        <div className="mt-8 text-center">
          <div className="mb-2 text-gray-700 dark:text-gray-300">Want to see more reels?</div>
          <a href="/auth" className="inline-block px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 font-semibold">Create Account or Login</a>
        </div>
      )}
    </Card>
  );
};

export default ReelViewPage;
