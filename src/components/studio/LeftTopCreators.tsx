import React from 'react';
import { 
  UserCheck, 
  Eye, 
  TrendingUp, 
  Video, 
  Trophy, 
  Crown, 
  Star, 
  MoreVertical,
  Check,
  TrendingUp as TrendingIcon
} from 'lucide-react';
import { formatNumber } from '@/lib/utils';

interface Creator {
  id: string;
  name?: string;
  username?: string;
  owner_username?: string;
  owner_avatar?: string;
  avatar_url?: string;
  subscriber_count?: number;
  total_views?: number;
  reel_count?: number;
  total_likes?: number;
  engagement_rate?: number;
  verified?: boolean;
  category?: string;
  is_following?: boolean;
}

interface Props {
  topCreators: Creator[];
  onCreatorClick?: (creator: Creator) => void;
  onFollowClick?: (creatorId: string) => void;
  className?: string;
}

const LeftTopCreators: React.FC<Props> = ({ 
  topCreators, 
  onCreatorClick,
  onFollowClick,
  className = '' 
}) => {
  const handleCreatorClick = (creator: Creator) => {
    onCreatorClick?.(creator);
  };

  const handleFollowClick = (e: React.MouseEvent, creatorId: string) => {
    e.stopPropagation();
    onFollowClick?.(creatorId);
  };

  const getRankBadge = (index: number) => {
    switch(index) {
      case 0:
        return {
          icon: Crown,
          bg: 'bg-gradient-to-r from-amber-500 to-orange-500 dark:from-amber-600 dark:to-orange-600',
          text: 'text-white',
          label: '🥇'
        };
      case 1:
        return {
          icon: Trophy,
          bg: 'bg-gradient-to-r from-slate-400 to-slate-500 dark:from-slate-500 dark:to-slate-600',
          text: 'text-white',
          label: '🥈'
        };
      case 2:
        return {
          icon: Star,
          bg: 'bg-gradient-to-r from-amber-700 to-amber-800 dark:from-amber-800 dark:to-amber-900',
          text: 'text-white',
          label: '🥉'
        };
      default:
        return {
          icon: TrendingIcon,
          bg: 'bg-gradient-to-r from-purple-600 to-purple-700 dark:from-purple-700 dark:to-purple-800',
          text: 'text-white',
          label: `#${index + 1}`
        };
    }
  };

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md dark:hover:shadow-gray-900/30 transition-all duration-300 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-500 dark:from-blue-600 dark:to-purple-600 rounded-xl shadow-md">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Top Creators</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">🏆 Most active creators this month</p>
          </div>
        </div>
        <button 
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          aria-label="More options"
        >
          <MoreVertical className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {topCreators.length === 0 ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="flex items-center gap-3 p-2 rounded-lg animate-pulse">
              <div className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-800" />
              <div className="flex-1">
                <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/2 mb-2" />
                <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {topCreators.map((creator, index) => {
            const rankBadge = getRankBadge(index);
            const BadgeIcon = rankBadge.icon;
            
            return (
              <div
                key={creator.id}
                onClick={() => handleCreatorClick(creator)}
                className="group relative p-3 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-gradient-to-r hover:from-white hover:to-blue-50/50 dark:hover:from-gray-900 dark:hover:to-blue-900/10 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md dark:shadow-gray-900/20"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleCreatorClick(creator)}
              >
                {/* Rank Badge */}
                <div className={`absolute -top-2 -left-2 ${rankBadge.bg} ${rankBadge.text} text-xs font-bold px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1`}>
                  <BadgeIcon className="w-3 h-3" />
                  <span>{rankBadge.label}</span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Creator Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-gradient-to-br from-blue-400 to-purple-400 dark:from-blue-600 dark:to-purple-600 p-0.5 shadow-md">
                      <img
                        src={creator.owner_avatar || creator.avatar_url || '/default-avatar.png'}
                        alt={creator.name || creator.username || creator.owner_username || 'Creator'}
                        className="w-full h-full rounded-lg object-cover bg-white dark:bg-gray-800"
                        loading="lazy"
                      />
                    </div>
                    {creator.verified && (
                      <div className="absolute -bottom-1 -right-1 bg-blue-500 dark:bg-blue-600 text-white p-1 rounded-full shadow-md">
                        <Check className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </div>

                  {/* Creator Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-gray-900 dark:text-white text-sm truncate group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                            {creator.name || creator.username || creator.owner_username || 'Creator'}
                          </h4>
                          {creator.verified && (
                            <Check className="w-3 h-3 text-blue-500 dark:text-blue-400" />
                          )}
                        </div>
                        {creator.category && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {creator.category}
                          </div>
                        )}
                      </div>
                      
                      {/* Follow Button */}
                      <button
                        onClick={(e) => handleFollowClick(e, creator.id)}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all duration-300 whitespace-nowrap ${
                          creator.is_following 
                            ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700' 
                            : 'bg-gradient-to-r from-blue-500 to-purple-500 dark:from-blue-600 dark:to-purple-600 text-white hover:shadow-md hover:scale-105'
                        }`}
                      >
                        {creator.is_following ? 'Following' : 'Follow'}
                      </button>
                    </div>

                    {/* Stats - Focus on Reels Count */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <StatItem
                          icon={Video}
                          value={creator.reel_count || 0}
                          label="Reels"
                          color="text-purple-700 dark:text-purple-400"
                          iconColor="text-purple-500 dark:text-purple-300"
                          bgColor="bg-purple-50 dark:bg-purple-900/20"
                          highlight={true}
                        />
                        <StatItem
                          icon={Eye}
                          value={creator.total_views || 0}
                          label="Views"
                          color="text-blue-700 dark:text-blue-400"
                          iconColor="text-blue-500 dark:text-blue-300"
                          bgColor="bg-blue-50 dark:bg-blue-900/20"
                        />
                        <StatItem
                          icon={UserCheck}
                          value={creator.subscriber_count || 0}
                          label="Followers"
                          color="text-green-700 dark:text-green-400"
                          iconColor="text-green-500 dark:text-green-300"
                          bgColor="bg-green-50 dark:bg-green-900/20"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View All Footer */}
      {topCreators.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800">
          <button 
            className="w-full py-3 px-4 text-sm font-semibold text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors flex items-center justify-center gap-2 group"
            aria-label="View all creators"
          >
            View all top creators
            <Trophy className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      )}
    </div>
  );
};

// Helper Component for Stats
interface StatItemProps {
  icon: React.ElementType;
  value: number;
  label?: string;
  color: string;
  iconColor: string;
  bgColor: string;
  highlight?: boolean;
}

const StatItem: React.FC<StatItemProps> = ({ icon: Icon, value, label, color, iconColor, bgColor, highlight }) => (
  <div className={`flex items-center gap-1.5 ${highlight ? 'scale-110 transform' : ''}`}>
    <div className={`p-1.5 rounded-lg ${bgColor} ${highlight ? 'ring-2 ring-offset-1 ring-opacity-50 ring-current' : ''}`}>
      <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
    </div>
    <div>
      <div className={`text-xs font-semibold ${color}`}>
        {formatNumber(value)}
      </div>
      {label && (
        <div className="text-[10px] text-gray-500 dark:text-gray-400">
          {label}
        </div>
      )}
    </div>
  </div>
);

export default LeftTopCreators;