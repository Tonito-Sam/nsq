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
  showReactions,
  onToggleReactions,
  onReaction,
  onToggleComments,
  onRepost,
  onShare
}) => {
  return (
    <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
      <div className="flex items-center space-x-4">
        <ReactionPicker
          onReact={onReaction}
          currentReaction={selectedReaction}
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
      </div>
    </div>
  );
};
