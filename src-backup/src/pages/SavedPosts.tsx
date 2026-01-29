import React, { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { PostCard } from '@/components/PostCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const SavedPostsPage = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from('saved_posts')
      .select('post_id, posts(*)')
      .eq('user_id', user.id)
      .then(({ data }) => {
        setPosts((data || []).map((row: any) => row.posts));
        setLoading(false);
      });
  }, [user]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#101014]">
      <Header />
      <div className="flex max-w-7xl mx-auto pt-6">
        <Sidebar />
        <main className="flex-1 px-4 md:px-8">
          <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Saved Posts</h1>
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-12 text-lg">You have no saved posts yet.</div>
          ) : (
            <div className="space-y-6">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} currentUser={user} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default SavedPostsPage;
