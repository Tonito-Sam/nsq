
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Users, MessageSquare, Heart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface TrendingPost {
  id: string;
  content: string;
  likes_count: number;
  comments_count: number;
  user: {
    first_name: string;
    last_name: string;
  };
}

export const ActivityInsights = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalPosts: 0,
    totalConnections: 0,
    trendingPosts: [] as TrendingPost[]
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Get user's total posts
        const { count: postsCount } = await supabase
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user?.id);

        // Get total connections (followers + following)
        const { count: connectionsCount } = await supabase
          .from('followers')
          .select('*', { count: 'exact', head: true })
          .or(`follower_id.eq.${user?.id},following_id.eq.${user?.id}`);

        // Get trending posts (most engaged in last 24 hours)
        const { data: trendingPosts } = await supabase
          .from('posts')
          .select(`
            id,
            content,
            likes_count,
            comments_count,
            user:users!posts_user_id_fkey(
              first_name,
              last_name
            )
          `)
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order('likes_count', { ascending: false })
          .limit(3);

        // Normalize returned rows: Supabase may return the related `user` as an array
        const normalized = (trendingPosts || []).map((p: any) => ({
          id: String(p.id),
          content: p.content || '',
          likes_count: Number(p.likes_count || 0),
          comments_count: Number(p.comments_count || 0),
          user: (p.user && Array.isArray(p.user) ? p.user[0] : p.user) || { first_name: '', last_name: '' }
        })) as TrendingPost[];

        setStats({
          totalPosts: postsCount || 0,
          totalConnections: connectionsCount || 0,
          trendingPosts: normalized
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    if (user) {
      fetchStats();
    }
  }, [user]);

  return (
    <Card className="p-6 dark:bg-[#161616]">
      <div className="flex items-center space-x-2 mb-4">
        <TrendingUp className="h-5 w-5 text-blue-600" />
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Activity Insights</h3>
      </div>

      <div className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center justify-center mb-1">
              <MessageSquare className="h-4 w-4 text-blue-600 mr-1" />
              <span className="text-2xl font-bold text-blue-600">{stats.totalPosts}</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Your Posts</p>
          </div>

          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="flex items-center justify-center mb-1">
              <Users className="h-4 w-4 text-green-600 mr-1" />
              <span className="text-2xl font-bold text-green-600">{stats.totalConnections}</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Connections</p>
          </div>
        </div>

        {/* Trending Posts */}
        <div>
          <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-3">Trending Today</h4>
          <div className="space-y-2">
            {stats.trendingPosts.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">No trending posts today</p>
            ) : (
              stats.trendingPosts.map((post, index) => (
                <div key={post.id} className="p-2 bg-gray-50 dark:bg-gray-800 rounded-md">
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant="outline" className="text-xs">
                      #{index + 1} Trending
                    </Badge>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <span className="flex items-center">
                        <Heart className="h-3 w-3 mr-1" />
                        {post.likes_count}
                      </span>
                      <span className="flex items-center">
                        <MessageSquare className="h-3 w-3 mr-1" />
                        {post.comments_count}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-800 dark:text-gray-200 line-clamp-2">
                    {post.content.length > 60 ? `${post.content.substring(0, 60)}...` : post.content}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    by {post.user?.first_name} {post.user?.last_name}
                  </p>
                  <div className="mt-1">
                    <Badge variant="secondary" className="text-xs">
                      High engagement in 24h
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};
