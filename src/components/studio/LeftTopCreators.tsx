import React from 'react';
import { Check, Eye, MoreHorizontal, Sparkles, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Creator {
  id: string;
  name?: string;
  username?: string;
  owner_username?: string;
  owner_avatar?: string;
  avatar_url?: string;
  subscriber_count?: number;
  total_views?: number;
  verified?: boolean;
  user_id?: string;
}

interface Props {
  topCreators: Creator[];
  currentUserId?: string;
  followingChannelIds?: Set<string>;
  onCreatorClick?: (creator: Creator) => void;
  onFollowClick?: (creatorId: string) => void;
  className?: string;
}

const LeftTopCreators: React.FC<Props> = ({
  topCreators,
  currentUserId,
  followingChannelIds,
  onCreatorClick,
  onFollowClick,
  className = '',
}) => {
  const handleCreatorClick = (creator: Creator) => onCreatorClick?.(creator);

  const handleFollowClick = (e: React.MouseEvent, creatorId: string) => {
    e.stopPropagation();
    onFollowClick?.(creatorId);
  };

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  return (
    <div className={cn('rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_12px_28px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-zinc-950/80 dark:shadow-[0_12px_28px_rgba(0,0,0,0.18)]', className)}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Creators to follow</h3>
            <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500 dark:text-zinc-500">Discover</p>
          </div>
        </div>

        <button className="rounded-md border border-gray-200 p-1.5 text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-900 dark:border-white/10 dark:text-zinc-400 dark:hover:border-white/20 dark:hover:text-white" aria-label="View creators">
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>

      {topCreators.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-xs text-gray-600 dark:border-white/10 dark:bg-white/[0.02] dark:text-zinc-400">
          New creator picks will appear here.
        </div>
      ) : (
        <div className="space-y-2.5">
          {topCreators.slice(0, 4).map((creator) => {
            const isFollowing = !!followingChannelIds?.has(creator.id);
            const isOwnChannel = !!currentUserId && !!creator.user_id && creator.user_id === currentUserId;
            const avatarUrl = creator.avatar_url || creator.owner_avatar;

            return (
              <div
                key={creator.id}
                className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-2 text-left transition-all hover:border-gray-300 hover:bg-gray-100 dark:border-white/8 dark:bg-white/[0.02] dark:hover:border-white/15 dark:hover:bg-white/[0.04]"
              >
                <button
                  type="button"
                  onClick={() => handleCreatorClick(creator)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-zinc-900 ring-1 ring-white/10">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={creator.name || creator.username || 'Creator'} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-white">
                        {getInitials(creator.name || creator.username || 'U')}
                      </div>
                    )}
                    {creator.verified && (
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-[8px] text-white ring-2 ring-white dark:ring-zinc-950">
                        <Check className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-medium text-gray-900 dark:text-white">
                        {creator.name || creator.username || creator.owner_username || 'Creator'}
                      </p>
                    </div>

                    <div className="mt-1 flex items-center gap-3 text-[10px] text-gray-600 dark:text-zinc-400">
                      <span className="inline-flex items-center gap-1"><Users className="h-3 w-3 text-violet-300" />{(creator.subscriber_count || 0).toLocaleString()}</span>
                      <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3 text-sky-300" />{(creator.total_views || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </button>

                {!isOwnChannel && (
                  <button
                    type="button"
                    onClick={(e) => handleFollowClick(e, creator.id)}
                    className={cn(
                      'shrink-0 rounded-full border px-2.5 py-1.5 text-[9px] font-semibold transition-all duration-200',
                      isFollowing
                        ? 'border-purple-700 bg-purple-700 text-white shadow-[0_6px_16px_rgba(109,40,217,0.28)] hover:bg-purple-800 dark:border-purple-500 dark:bg-purple-600 dark:hover:bg-purple-500'
                        : 'border-emerald-700 bg-emerald-600 text-white shadow-[0_6px_16px_rgba(5,150,105,0.24)] hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500'
                    )}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LeftTopCreators;