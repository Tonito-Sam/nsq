import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Users } from 'lucide-react';
import { useShowContext } from '@/contexts/ShowContext';
import { useLiveChatMessages } from '@/hooks/useLiveChatMessages';

interface MobileOverlayBarProps {
  onLike: () => void;
  onCommentClick: () => void;
}

export const MobileOverlayBar: React.FC<MobileOverlayBarProps> = ({
  onLike,
  onCommentClick
}) => {
  const { currentShow, viewerCount, likeCount, setLikeCount } = useShowContext();

  // Hook gives you real-time messages for the current show
  const showId = currentShow?.id;
  const { messages } = useLiveChatMessages(showId);

  const handleLike = () => {
    setLikeCount(likeCount + 1);
    onLike();
  };

  return (
    <Card className="sm:hidden bg-white/95 dark:bg-black/80 border border-gray-200 dark:border-gray-700 flex justify-around items-center py-2 px-4 rounded-b-xl mx-2 shadow-md">
      {/* Viewer count */}
      <div className="flex flex-col items-center text-red-500">
        <Users className="w-5 h-5" />
        <span className="text-xs font-medium">{viewerCount.toLocaleString()}</span>
      </div>

      {/* Like button */}
      <Button
        variant="ghost"
        size="icon"
        className="flex flex-col items-center text-pink-500"
        onClick={handleLike}
      >
        <Heart className="w-5 h-5 fill-current" />
        <span className="text-xs font-medium">{likeCount}</span>
      </Button>

      {/* Comment (chat) button */}
      <Button
        variant="ghost"
        size="icon"
        className="flex flex-col items-center text-blue-500"
        onClick={onCommentClick}
      >
        <MessageCircle className="w-5 h-5" />
        <span className="text-xs font-medium">{messages.length}</span>
      </Button>
    </Card>
  );
};
