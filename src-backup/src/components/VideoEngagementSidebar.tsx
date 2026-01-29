import React from 'react';
import { Heart, Eye } from 'lucide-react';

interface VideoEngagementSidebarProps {
  video: any;
  onLike?: (id: string) => void;
  isLiked?: boolean;
}

export const VideoEngagementSidebar: React.FC<VideoEngagementSidebarProps> = ({ video, onLike, isLiked }) => (
  <div className="absolute top-1/2 left-4 flex flex-col items-center gap-4 -translate-y-1/2 z-20">
    <button
      className={`bg-gray-900 bg-opacity-70 p-2 rounded-full transition text-white shadow-lg flex flex-col items-center ${
        isLiked ? 'bg-pink-600 hover:bg-pink-700' : 'hover:bg-pink-600'
      }`}
      onClick={() => onLike && onLike(video.id)}
    >
      <Heart className={`h-5 w-5 ${isLiked ? 'fill-current' : ''}`} />
      <span className="text-xs mt-1">{video.likes ?? video.likes_count ?? 0}</span>
    </button>
    <div className="bg-gray-900 bg-opacity-70 p-2 rounded-full text-white shadow-lg flex flex-col items-center">
      <Eye className="h-5 w-5" />
      <span className="text-xs mt-1">{video.views ?? video.views_count ?? 0}</span>
    </div>
  </div>
);
