import { Card } from '@/components/ui/card';
import { TrendingUp, Hash, Sparkles, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { TrendingCardSkeleton } from './TrendingCardSkeleton';
import { TrendingTopicItem } from './TrendingTopicItem';

interface TrendingTopic {
  id: string | number;
  tag: string;
  posts_count?: number;
  growth_percent?: number;
  created_at?: string;
}

interface TrendingCardProps {
  useRouterNavigate?: boolean;
  className?: string;
  limit?: number;
}

const fetchTrendingTopics = async (limit = 10): Promise<TrendingTopic[]> => {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('trending_hashtags')
    .select('*')
    .gte('created_at', since)
    .order('posts_count', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching trending topics:', error);
    throw error;
  }

  return data || [];
};

export const TrendingCard = ({ 
  useRouterNavigate = false, 
  className = "",
  limit = 10 
}: TrendingCardProps) => {
  const navigate = useRouterNavigate ? useNavigate() : null;

  const { 
    data: trendingTopics = [], 
    isLoading, 
    error,
    refetch 
  } = useQuery({
    queryKey: ['trending-topics', limit],
    queryFn: () => fetchTrendingTopics(limit),
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    staleTime: 2 * 60 * 1000, // Consider data stale after 2 minutes
  });

  const handleTopicClick = (topic: TrendingTopic) => {
    const tag = topic.tag.replace('#', '');
    if (useRouterNavigate && navigate) {
      navigate(`/hashtag/${tag}`);
    } else {
      window.location.href = `/hashtag/${tag}`;
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent, topic: TrendingTopic) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleTopicClick(topic);
    }
  };

  if (isLoading) {
    return <TrendingCardSkeleton className={className} />;
  }

  return (
    <Card className={`
      group relative overflow-hidden
      bg-gradient-to-br from-white via-purple-50/30 to-pink-50/20
      dark:from-gray-900 dark:via-purple-950/20 dark:to-pink-950/10
      border-0 shadow-xl hover:shadow-2xl
      transition-all duration-500 ease-out
      hover:scale-[1.02] hover:-translate-y-1
      ${className}
    `}>
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-pink-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      
      {/* Content */}
      <div className="relative p-6 max-h-96 overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-xl md:text-2xl bg-gradient-to-r from-gray-900 via-purple-800 to-pink-800 dark:from-gray-100 dark:via-purple-300 dark:to-pink-300 bg-clip-text text-transparent flex items-center gap-2">
            <div className="relative">
              <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              <Sparkles className="absolute -top-1 -right-1 h-3 w-3 text-pink-500 animate-pulse" />
            </div>
            What's Trending
          </h3>
          
          {error && (
            <button
              onClick={() => refetch()}
              className="text-xs text-gray-500 hover:text-purple-600 transition-colors flex items-center gap-1"
              aria-label="Retry loading trending topics"
            >
              Retry
              <ArrowUpRight className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="space-y-2">
          {error ? (
            <div className="text-center py-8">
              <div className="text-gray-500 dark:text-gray-400 text-sm mb-2">
                Failed to load trending topics
              </div>
              <button
                onClick={() => refetch()}
                className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 text-sm font-medium transition-colors"
              >
                Try again
              </button>
            </div>
          ) : trendingTopics.length === 0 ? (
            <div className="text-center py-8">
              <Hash className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No trending hashtags this week
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Check back later for updates
              </p>
            </div>
          ) : (
            trendingTopics.map((topic, index) => (
              <TrendingTopicItem
                key={topic.id}
                topic={topic}
                rank={index + 1}
                onClick={() => handleTopicClick(topic)}
                onKeyDown={(e) => handleKeyDown(e, topic)}
              />
            ))
          )}
        </div>
      </div>
    </Card>
  );
};
