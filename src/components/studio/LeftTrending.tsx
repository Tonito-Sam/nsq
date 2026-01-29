import React, { useState, useEffect } from 'react';
import { 
  Eye, 
  MessageCircle, 
  Heart, 
  Share2, 
  TrendingUp, 
  Clock, 
  MoreVertical, 
  Play,
  Zap,
  Trophy,
  Flame
} from 'lucide-react';
import { formatNumber } from '@/lib/utils';

interface Reel {
  id: string;
  caption: string;
  creator_name: string;
  creator_avatar: string;
  video_url?: string;
  url?: string;
  views?: number;
  likes_count?: number;
  likes?: number;
  comments_count?: number;
  comments?: number;
  shares_count?: number;
  shares?: number;
  created_at?: string;
  category?: string;
  trending_type?: 'views' | 'comments' | 'shares';
  aspect_ratio?: 'portrait' | 'landscape' | 'square'; // Add aspect ratio
  thumbnail_url?: string; // Add thumbnail URL
}

interface Props {
  trendingReels: Reel[];
  getPublicUrl: (path: string) => string;
  onReelClick?: (reel: Reel) => void;
  className?: string;
}

const LeftTrending: React.FC<Props> = ({ 
  trendingReels, 
  getPublicUrl, 
  onReelClick,
  className = '' 
}) => {
  const [aspectRatios, setAspectRatios] = useState<Record<string, string>>({});

  // Function to detect aspect ratio from video URL
  const detectAspectRatio = async (videoUrl: string, reelId: string) => {
    if (aspectRatios[reelId]) return;
    
    try {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      return new Promise<void>((resolve) => {
        video.onloadedmetadata = () => {
          const width = video.videoWidth;
          const height = video.videoHeight;
          const ratio = width / height;
          
          let aspectRatio = 'portrait';
          if (ratio > 1.1) aspectRatio = 'landscape';
          else if (ratio > 0.9 && ratio < 1.1) aspectRatio = 'square';
          
          setAspectRatios(prev => ({
            ...prev,
            [reelId]: aspectRatio
          }));
          resolve();
        };
        
        video.onerror = () => {
          // Default to portrait if detection fails
          setAspectRatios(prev => ({
            ...prev,
            [reelId]: 'portrait'
          }));
          resolve();
        };
        
        video.src = videoUrl;
      });
    } catch (error) {
      console.error('Error detecting aspect ratio:', error);
      setAspectRatios(prev => ({
        ...prev,
        [reelId]: 'portrait'
      }));
    }
  };

  // Detect aspect ratios for all trending reels
  useEffect(() => {
    trendingReels.forEach(reel => {
      const videoUrl = reel.video_url || reel.url;
      if (videoUrl && !aspectRatios[reel.id] && !reel.aspect_ratio) {
        detectAspectRatio(videoUrl, reel.id);
      }
    });
  }, [trendingReels]);

  const handleInteraction = (e: React.MouseEvent, reel: Reel) => {
    e.stopPropagation();
    onReelClick?.(reel);
  };

  const getTrendingBadgeColor = (index: number) => {
    switch(index) {
      case 0: return 'bg-gradient-to-r from-amber-500 to-orange-500 dark:from-amber-600 dark:to-orange-600';
      case 1: return 'bg-gradient-to-r from-slate-400 to-slate-500 dark:from-slate-500 dark:to-slate-600';
      case 2: return 'bg-gradient-to-r from-amber-700 to-amber-800 dark:from-amber-800 dark:to-amber-900';
      default: return 'bg-gradient-to-r from-purple-600 to-purple-700 dark:from-purple-700 dark:to-purple-800';
    }
  };

  const getTrendingTypeIcon = (type?: string) => {
    switch(type) {
      case 'views': return { icon: Eye, color: 'text-purple-500', label: 'Most Viewed' };
      case 'comments': return { icon: MessageCircle, color: 'text-blue-500', label: 'Most Comments' };
      case 'shares': return { icon: Share2, color: 'text-green-500', label: 'Most Shared' };
      default: return { icon: Zap, color: 'text-amber-500', label: 'Trending' };
    }
  };

  // Get thumbnail container class based on aspect ratio
  const getThumbnailClass = (reel: Reel) => {
    const aspectRatio = reel.aspect_ratio || aspectRatios[reel.id] || 'portrait';
    
    switch(aspectRatio) {
      case 'landscape':
        return 'w-20 h-12'; // Wider for landscape
      case 'square':
        return 'w-16 h-16'; // Square
      case 'portrait':
      default:
        return 'w-12 h-16'; // Taller for portrait
    }
  };

  // Get thumbnail image class based on aspect ratio
  const getThumbnailImageClass = (reel: Reel) => {
    const aspectRatio = reel.aspect_ratio || aspectRatios[reel.id] || 'portrait';
    
    switch(aspectRatio) {
      case 'landscape':
        return 'object-contain'; // Show entire landscape video
      case 'square':
        return 'object-cover'; // Cover square area
      case 'portrait':
      default:
        return 'object-cover'; // Cover portrait area
    }
  };

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md dark:hover:shadow-gray-900/30 transition-all duration-300 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 dark:from-purple-600 dark:to-pink-600 rounded-xl shadow-md">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Trending Reels</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">🔥 Most viral content today</p>
          </div>
        </div>
        <button 
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          aria-label="More options"
        >
          <MoreVertical className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {trendingReels.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shadow-inner">
            <Flame className="w-8 h-8 text-gray-400 dark:text-gray-500" />
          </div>
          <h4 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">No trending reels yet</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">Be the first to create viral content!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {trendingReels.map((reel, index) => {
            const trendingType = getTrendingTypeIcon(reel.trending_type);
            const TrendingIcon = trendingType.icon;
            const aspectRatio = reel.aspect_ratio || aspectRatios[reel.id] || 'portrait';
            
            return (
              <div
                key={reel.id}
                onClick={(e) => handleInteraction(e, reel)}
                className="group relative p-4 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-gradient-to-r hover:from-white hover:to-purple-50/50 dark:hover:from-gray-900 dark:hover:to-purple-900/10 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md dark:shadow-gray-900/20"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleInteraction(e as any, reel)}
              >
                {/* Trending Badge */}
                <div className={`absolute -top-2 -left-2 ${getTrendingBadgeColor(index)} text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg`}>
                  #{index + 1}
                </div>

                {/* Trending Type Badge */}
                <div className="absolute -top-2 -right-2 flex items-center gap-1 bg-gray-900 dark:bg-gray-800 text-white text-[10px] px-2 py-1 rounded-lg shadow-md">
                  <TrendingIcon className="w-3 h-3" />
                  <span className="font-medium">{trendingType.label}</span>
                </div>

                <div className="flex items-center gap-4">
                  {/* Reel Thumbnail with dynamic aspect ratio */}
                  <div className="relative flex-shrink-0">
                    <div className={`${getThumbnailClass(reel)} rounded-xl overflow-hidden bg-gradient-to-br from-purple-400 to-pink-400 dark:from-purple-600 dark:to-pink-600 p-0.5 shadow-md`}>
                      <img
                        src={reel.thumbnail_url || getPublicUrl(reel.video_url || reel.url || '')}
                        alt={reel.caption}
                        className={`w-full h-full rounded-lg ${getThumbnailImageClass(reel)} bg-white dark:bg-gray-800`}
                        loading="lazy"
                        onError={(e) => {
                          // Fallback to a placeholder if image fails to load
                          e.currentTarget.src = `https://placehold.co/${aspectRatio === 'landscape' ? '200x120' : aspectRatio === 'square' ? '120x120' : '120x160'}/7e22ce/f3f4f6?text=${encodeURIComponent(reel.caption.substring(0, 20))}`;
                        }}
                      />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 dark:bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="w-6 h-6 text-white" fill="white" />
                    </div>
                    
                    {/* Aspect ratio badge (optional) */}
                    {aspectRatio === 'landscape' && (
                      <div className="absolute -bottom-1 -right-1 bg-amber-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">
                        🖥️
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-2 mb-1 group-hover:text-purple-700 dark:group-hover:text-purple-400 transition-colors">
                          {reel.caption || 'Untitled Reel'}
                        </h4>
                        <div className="flex items-center gap-2 text-xs">
                          <img
                            src={reel.creator_avatar}
                            alt={reel.creator_name}
                            className="w-4 h-4 rounded-full"
                            onError={(e) => {
                              e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(reel.creator_name || 'U')}&background=7e22ce&color=fff`;
                            }}
                          />
                          <span className="font-medium text-gray-800 dark:text-gray-200">
                            {reel.creator_name || 'Unknown Creator'}
                          </span>
                          {reel.created_at && (
                            <>
                              <span className="text-gray-400 dark:text-gray-500">•</span>
                              <Clock className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                              <span className="text-gray-500 dark:text-gray-400">{reel.created_at}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Engagement Metrics */}
                    <div className="flex items-center gap-3">
                      <MetricItem 
                        icon={Eye} 
                        value={reel.views || 0} 
                        color="text-purple-700 dark:text-purple-400"
                        iconColor="text-purple-500 dark:text-purple-300"
                        bgColor="bg-purple-50 dark:bg-purple-900/20"
                        highlight={reel.trending_type === 'views'}
                      />
                      <MetricItem 
                        icon={MessageCircle} 
                        value={(reel.comments_count ?? reel.comments) || 0} 
                        color="text-blue-700 dark:text-blue-400"
                        iconColor="text-blue-500 dark:text-blue-300"
                        bgColor="bg-blue-50 dark:bg-blue-900/20"
                        highlight={reel.trending_type === 'comments'}
                      />
                      <MetricItem 
                        icon={Share2} 
                        value={(reel.shares_count ?? reel.shares) || 0} 
                        color="text-green-700 dark:text-green-400"
                        iconColor="text-green-500 dark:text-green-300"
                        bgColor="bg-green-50 dark:bg-green-900/20"
                        highlight={reel.trending_type === 'shares'}
                      />
                      <MetricItem 
                        icon={Heart} 
                        value={(reel.likes_count ?? reel.likes) || 0} 
                        color="text-pink-700 dark:text-pink-400"
                        iconColor="text-pink-500 dark:text-pink-300"
                        bgColor="bg-pink-50 dark:bg-pink-900/20"
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View All Footer */}
      {trendingReels.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800">
          <button 
            className="w-full py-3 px-4 text-sm font-semibold text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-xl transition-colors flex items-center justify-center gap-2 group"
            aria-label="View all trending reels"
          >
            Explore all trending reels
            <Flame className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      )}
    </div>
  );
};

// Helper Component for Metrics
interface MetricItemProps {
  icon: React.ElementType;
  value: number;
  color: string;
  iconColor: string;
  bgColor: string;
  highlight?: boolean;
}

const MetricItem: React.FC<MetricItemProps> = ({ icon: Icon, value, color, iconColor, bgColor, highlight }) => (
  <div className={`flex items-center gap-1.5 ${highlight ? 'scale-110 transform' : ''}`}>
    <div className={`p-1.5 rounded-lg ${bgColor} ${highlight ? 'ring-2 ring-offset-1 ring-opacity-50 ring-current' : ''}`}>
      <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
    </div>
    <span className={`text-xs font-semibold ${color}`}>
      {formatNumber(value)}
    </span>
  </div>
);

export default LeftTrending;