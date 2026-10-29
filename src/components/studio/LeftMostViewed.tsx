import React from 'react';
import { Eye, PlayCircle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  mostViewed: any[];
  getPublicUrl: (path: string) => string;
  className?: string;
}

const LeftMostViewed: React.FC<Props> = ({ mostViewed, getPublicUrl, className = '' }) => {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900/90 via-gray-800/90 to-blue-900/50 p-5 shadow-[0_18px_40px_rgba(22,22,30,0.35)] backdrop-blur-xl',
        className
      )}
    >
      <div className="absolute -bottom-20 -left-12 h-32 w-32 rounded-full bg-blue-500/15 blur-3xl" />
      <div className="relative z-10">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/25">
              <Eye className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Most Viewed</h3>
              <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400">Top traffic</p>
            </div>
          </div>
          <Sparkles className="h-4 w-4 text-blue-300" />
        </div>

        {mostViewed.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-4 text-center text-sm text-gray-400">
            No videos yet. Your top performers will appear here.
          </div>
        ) : (
          <div className="space-y-3">
            {mostViewed.slice(0, 4).map((reel) => (
              <div
                key={reel.id}
                className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2.5 transition-all duration-300 hover:border-blue-400/30 hover:bg-white/10"
              >
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-800 ring-1 ring-white/10">
                  <img
                    src={reel.creator_avatar || getPublicUrl(reel.video_url || reel.url || '')}
                    alt={reel.caption || 'video'}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-center pb-1.5">
                    <PlayCircle className="h-4 w-4 text-white" />
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {reel.caption || 'Untitled reel'}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-400">
                    <span>{(reel.views || 0).toLocaleString()} views</span>
                  </div>
                </div>

                <div className="rounded-full bg-blue-500/10 px-2 py-1 text-[10px] font-semibold text-blue-300">
                  {reel.views ? Math.min(99, Math.round((reel.views / Math.max(1, mostViewed[0]?.views || 1)) * 100)) : 0}%
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeftMostViewed;
