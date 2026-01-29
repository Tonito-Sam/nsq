import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PostCard } from '@/components/PostCard';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';

interface Post {
  id: string;
  content: string;
  created_at: string;
  user: any;
  user_id?: string;
  post_type?: string;
  media_url?: string;
  media_urls?: string[];
  // ...other fields as needed
}

export default function HashtagPage() {
  const { tag } = useParams<{ tag: string }>();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (!tag) return;
    const fetchPosts = async () => {
      setLoading(true);
      // Simple search for posts containing the hashtag in content
      const { data, error } = await supabase
        .from('posts')
        .select('*, user:users(id,first_name,last_name,username,avatar_url,verified,heading)')
        .ilike('content', `%#${tag}%`)
        .order('created_at', { ascending: false });
      if (!error && data) setPosts(data);
      setLoading(false);
    };
    fetchPosts();
  }, [tag]);

  return (
    <Layout>
      <div className="max-w-2xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Trending: #{tag}</h1>
        {loading ? (
          <div>Loading...</div>
        ) : posts.length === 0 ? (
          <div>No posts found for this hashtag.</div>
        ) : (
          posts.map(post => (
            <div key={post.id} className="mb-4 cursor-pointer" onClick={() => navigate(`/post/${post.id}`)}>
              <PostCard post={{
                ...post,
                user_id: post.user_id || post.user?.id || '',
                post_type: post.post_type || 'text',
                user: post.user
              }} currentUser={user} />
            </div>
          ))
        )}
      </div>
    </Layout>
  );
}
