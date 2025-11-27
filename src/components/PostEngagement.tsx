import React from 'react';
import { MessageCircle, Share2, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReactionPicker } from './ReactionPicker';

interface PostEngagementProps {
  selectedReaction: string | null;
  reactionCounts?: { [key: string]: number };
  currentLikes: number;
  currentComments: number;
  currentReposts: number;
  shares: number;
  reposted: boolean;
  postId?: string;
  showReactions: boolean;
  onToggleReactions: () => void;
  onReaction: (reactionType: string) => void;
  onToggleComments: () => void;
  onRepost: () => void;
  onShare: () => void;
}

export const PostEngagement: React.FC<PostEngagementProps> = ({
  selectedReaction,
  reactionCounts = {},
  currentLikes,
  currentComments,
  currentReposts,
  shares,
  reposted,
  postId,
  showReactions,
  onToggleReactions,
  onReaction,
  onToggleComments,
  onRepost,
  onShare
}) => {
  const [viewsCount, setViewsCount] = React.useState<number | null>(null);
  const [viewersOpen, setViewersOpen] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    if (!postId) return;
    const fetchCount = async () => {
      try {
        const resp = await fetch(`/api/post-views?post_id=${encodeURIComponent(postId)}`);
        if (!resp.ok) return;
        const json = await resp.json();
        if (mounted && json && typeof json.count === 'number') setViewsCount(json.count ?? 0);
      } catch (err) {
        // ignore
      }
    };
    fetchCount();

    // Listen for local post-view events to update the count in real-time
    const onViewed = (e: any) => {
      try {
        if (!e || !e.detail) return;
        if (e.detail.postId === postId) {
          setViewsCount((v) => (typeof v === 'number' ? v + 1 : 1));
        }
      } catch (er) {
        // ignore
      }
    };
    window.addEventListener('post-viewed', onViewed as EventListener);

    return () => {
      mounted = false;
      window.removeEventListener('post-viewed', onViewed as EventListener);
    };
  }, [postId]);
  return (
    <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
      <div className="flex items-center space-x-4">
        <ReactionPicker
          onReact={onReaction}
          currentReaction={selectedReaction ?? undefined}
          reactionCounts={reactionCounts}
          totalReactions={Object.values(reactionCounts).reduce((a, b) => a + b, 0)}
        />

        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleComments}
          className="flex items-center space-x-1.5 text-gray-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded-lg transition-all duration-200 hover:scale-105"
        >
          <MessageCircle className="h-4 w-4" />
          <span className="text-sm font-medium">{currentComments}</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onRepost}
          className={`flex items-center space-x-1.5 px-2 py-1 rounded-lg transition-all duration-200 hover:scale-105 ${
            reposted ? 'text-green-600 bg-green-50 dark:bg-green-900/20' : 'text-gray-500 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'
          }`}
        >
          <Repeat className="h-4 w-4" />
          <span className="text-sm font-medium">{currentReposts}</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onShare}
          className="flex items-center space-x-1.5 text-gray-500 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 px-2 py-1 rounded-lg transition-all duration-200 hover:scale-105"
        >
          <Share2 className="h-4 w-4" />
          <span className="text-sm font-medium">{shares}</span>
        </Button>

  {/* Views */}
  <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center space-x-1.5 text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg transition-all duration-200"
              onClick={() => setViewersOpen(true)}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>
              <span className="text-sm font-medium">{viewsCount !== null ? viewsCount : 0}</span>
            </Button>
            {postId && (
              // PostViewersModal lazy import to avoid circular deps
              React.createElement(require('./PostViewersModal').PostViewersModal, {
                open: viewersOpen,
                onOpenChange: setViewersOpen,
                postId
              })
            )}
        </div>
      </div>
    </div>
  );
};
