import React, { useState } from 'react';
import { Eye, Flame, MessageCircle, MoreHorizontal, Play, Share2 } from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';

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
  aspect_ratio?: 'portrait' | 'landscape' | 'square';
  thumbnail_url?: string;
  duration?: number;
  music?: string;
}

interface Props {
  trendingReels: Reel[];
  getPublicUrl: (path: string) => string;
  onReelClick?: (reel: Reel) => void;
  className?: string;
}

const LeftTrending: React.FC<Props> = ({ trendingReels, getPublicUrl, onReelClick, className = '' }) => {
  const [unavailableThumbnails, setUnavailableThumbnails] = useState<Set<string>>(() => new Set());
  const handleClick = (reel: Reel) => onReelClick?.(reel);

  const getTone = (type?: string) => {
    switch (type) {
      case 'views':
        return 'bg-violet-500/10 text-violet-200';
      case 'comments':
        return 'bg-sky-500/10 text-sky-200';
      case 'shares':
        return 'bg-emerald-500/10 text-emerald-200';
      default:
        return 'bg-amber-500/10 text-amber-200';
    }
  };

  return (
    <div className={cn('rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_12px_28px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-zinc-950/80 dark:shadow-[0_12px_28px_rgba(0,0,0,0.18)]', className)}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-500/15 text-orange-300">
            <Flame className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Trending now</h3>
            <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500">Pulse</p>
          </div>
        </div>

        <button className="rounded-md border border-gray-200 p-1.5 text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-900 dark:border-white/10 dark:text-zinc-400 dark:hover:border-white/20 dark:hover:text-white" aria-label="More trending">
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>

      {trendingReels.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-xs text-gray-600 dark:border-white/10 dark:bg-white/[0.02] dark:text-zinc-400">
          Nothing is trending yet.
        </div>
      ) : (
        <div className="space-y-2.5">
          {trendingReels.slice(0, 3).map((reel, index) => {
            const tone = getTone(reel.trending_type);
            const thumbnailPath = reel.thumbnail_url?.trim() || '';
            const thumbnailUrl = thumbnailPath ? getPublicUrl(thumbnailPath) : '';
            const showThumbnail = thumbnailUrl && !unavailableThumbnails.has(reel.id);
            const creatorAvatarUrl = reel.creator_avatar ? getPublicUrl(reel.creator_avatar) : '';

            return (
              <button
                key={reel.id}
                onClick={() => handleClick(reel)}
                className="group flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-2 text-left transition-all hover:border-gray-300 hover:bg-gray-100 dark:border-white/8 dark:bg-white/[0.02] dark:hover:border-white/15 dark:hover:bg-white/[0.04]"
                type="button"
              >
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-white/10">
                  {showThumbnail ? (
                    <img
                      src={thumbnailUrl}
                      alt={reel.caption || 'Trending reel'}
                      className="h-full w-full object-cover"
                      onError={() => setUnavailableThumbnails(current => new Set(current).add(reel.id))}
                    />
                  ) : creatorAvatarUrl ? (
                    <img src={creatorAvatarUrl} alt={`${reel.creator_name || 'Creator'} profile`} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-700 to-fuchsia-800 text-lg font-semibold text-white">
                      {(reel.creator_name || 'C').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                  <div className="absolute inset-x-0 bottom-1 flex justify-center">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white">
                      <Play className="h-2.5 w-2.5 fill-current" />
                    </div>
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-medium text-gray-900 dark:text-white">{reel.caption || 'Untitled reel'}</p>
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-medium', tone)}>
                      #{index + 1}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-gray-600 dark:text-zinc-400">
                    <span className="truncate">{reel.creator_name || 'Creator'}</span>
                    <span>•</span>
                    <span>{formatNumber(reel.views || 0)}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-3 text-[10px] text-gray-600 dark:border-white/10 dark:text-zinc-400">
        <span className="inline-flex items-center gap-1.5"><Eye className="h-3 w-3 text-violet-300" />{formatNumber(trendingReels.reduce((sum, item) => sum + (item.views || 0), 0))}</span>
        <span className="inline-flex items-center gap-1.5"><MessageCircle className="h-3 w-3 text-sky-300" />{formatNumber(trendingReels.reduce((sum, item) => sum + (item.comments_count || item.comments || 0), 0))}</span>
        <span className="inline-flex items-center gap-1.5"><Share2 className="h-3 w-3 text-emerald-300" />{formatNumber(trendingReels.reduce((sum, item) => sum + (item.shares_count || item.shares || 0), 0))}</span>
      </div>
    </div>
  );
};

export default LeftTrending;
