import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const PostViewPage = () => {
  const { id } = useParams();
  const [post, setPost] = useState<any>(null);
  const [author, setAuthor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPost = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('posts')
        .select('*')
        .eq('id', id)
        .single();
      setPost(data);
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
    fetchPost();
  }, [id]);

  if (loading) return <div className="flex justify-center items-center h-96"><Skeleton className="w-16 h-16" /></div>;
  if (!post) return <div className="text-center py-12">Post not found.</div>;

  // Show login/create account prompt for unauthenticated users
  // (Assume useAuth is available, otherwise show generic prompt)
  // You can replace this logic with your actual auth hook
  const isLoggedIn = !!localStorage.getItem('supabase.auth.token');

  // Find the first available media (image or video)
  const mediaUrl = post.media_url || post.image_url || post.video_url || (Array.isArray(post.media) && post.media.length > 0 ? post.media[0] : null);
  const isVideo = mediaUrl && (mediaUrl.endsWith('.mp4') || mediaUrl.endsWith('.webm') || mediaUrl.endsWith('.ogg'));
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
          <span className="font-semibold text-lg">{username}'s post on Nexsq</span>
        </div>
      </div>
      {mediaUrl && (
        isVideo ? (
          <video src={mediaUrl} controls className="w-full rounded-lg mb-4" playsInline webkit-playsinline />
        ) : (
          <img src={mediaUrl} alt="Post media" className="w-full rounded-lg mb-4" />
        )
      )}
      {/* Show post content/body/description if available */}
      {post.content && (
        <div className="mb-4 text-gray-800 dark:text-gray-200 whitespace-pre-line">{post.content}</div>
      )}
      {post.body && !post.content && (
        <div className="mb-4 text-gray-800 dark:text-gray-200 whitespace-pre-line">{post.body}</div>
      )}
      {post.description && !post.content && !post.body && (
        <div className="mb-4 text-gray-800 dark:text-gray-200 whitespace-pre-line">{post.description}</div>
      )}
      {!isLoggedIn && (
        <div className="mt-8 text-center">
          <div className="mb-2 text-gray-700 dark:text-gray-300">Want to join the conversation?</div>
          <Link to="/auth" className="inline-block px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 font-semibold">Create Account or Login</Link>
        </div>
      )}
    </Card>
  );
};

export default PostViewPage;
