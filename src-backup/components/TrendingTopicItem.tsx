import { Hash, TrendingUp, Users } from 'lucide-react';

interface TrendingTopic {
  id: string | number;
  tag: string;
  posts_count?: number;
  growth_percent?: number;
}

interface TrendingTopicItemProps {
  topic: TrendingTopic;
  rank: number;
  onClick: () => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
}

export const TrendingTopicItem = ({ topic, rank, onClick, onKeyDown }: TrendingTopicItemProps) => {
  const isTopThree = rank <= 3;
  const getRankColor = () => {
    switch (rank) {
      case 1: return 'from-yellow-400 to-yellow-600';
      case 2: return 'from-gray-300 to-gray-500';
      case 3: return 'from-amber-400 to-amber-600';
      default: return 'from-purple-400 to-purple-600';
    }
  };

  const formatGrowth = (growth?: number) => {
    if (!growth) return '';
    return growth > 0 ? `+${growth}%` : `${growth}%`;
  };

  const formatPostCount = (count?: number) => {
    if (!count) return '0 posts';
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M posts`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K posts`;
    return `${count} posts`;
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={`
        group/item relative flex items-center justify-between
        p-3 rounded-xl cursor-pointer
        bg-gradient-to-r from-white/50 to-transparent
        dark:from-gray-800/30 dark:to-transparent
        hover:from-purple-100/80 hover:to-pink-100/40
        dark:hover:from-purple-900/30 dark:hover:to-pink-900/20
        border border-transparent hover:border-purple-200/50
        dark:hover:border-purple-700/30
        transition-all duration-300 ease-out
        hover:scale-[1.02] hover:shadow-lg
        focus:outline-none focus:ring-2 focus:ring-purple-500/50
        ${isTopThree ? 'ring-1 ring-purple-200/30 dark:ring-purple-700/30' : ''}
      `}
      onClick={onClick}
      onKeyDown={onKeyDown}
      aria-label={`View hashtag ${topic.tag}, ranked ${rank} with ${topic.posts_count || 0} posts`}
    >
      {/* Rank indicator */}
      <div className="flex items-center space-x-3 flex-1 min-w-0">
        <div className={`
          flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white
          bg-gradient-to-br ${getRankColor()}
          ${isTopThree ? 'ring-2 ring-white/20 shadow-lg' : ''}
          group-hover/item:scale-110 transition-transform duration-200
        `}>
          {rank}
        </div>

        {/* Topic info */}
        <div className="flex items-center space-x-2 min-w-0 flex-1">
          <Hash className="h-4 w-4 text-purple-500 dark:text-purple-400 flex-shrink-0 group-hover/item:text-purple-600 dark:group-hover/item:text-purple-300 transition-colors" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 group-hover/item:text-purple-900 dark:group-hover/item:text-purple-100 transition-colors truncate">
              {topic.tag}
            </div>
            <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              <Users className="h-3 w-3 mr-1 flex-shrink-0" />
              {formatPostCount(topic.posts_count)}
            </div>
          </div>
        </div>
      </div>

      {/* Growth indicator */}
      <div className="flex flex-col items-end space-y-1 ml-2">
        {topic.growth_percent && (
          <div className={`
            flex items-center text-xs font-medium px-2 py-1 rounded-full
            ${topic.growth_percent > 0 
              ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30' 
              : 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
            }
            group-hover/item:scale-105 transition-transform duration-200
          `}>
            <TrendingUp className={`h-3 w-3 mr-1 ${topic.growth_percent < 0 ? 'rotate-180' : ''}`} />
            {formatGrowth(topic.growth_percent)}
          </div>
        )}
      </div>

      {/* Hover indicator */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 transition-all duration-200 translate-x-2 group-hover/item:translate-x-0">
        <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
      </div>
    </div>
  );
};
