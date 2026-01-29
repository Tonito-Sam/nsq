import React from 'react';
import { Eye } from 'lucide-react';

interface Props {
  mostViewed: any[];
  getPublicUrl: (path: string) => string;
}

const LeftMostViewed: React.FC<Props> = ({ mostViewed, getPublicUrl }) => {
  return (
    <div className="bg-white dark:bg-card rounded-lg p-4 border border-gray-200 dark:border-gray-800">
      <h3 className="text-xl font-bold text-black dark:text-white mb-4">Most Viewed</h3>
      {mostViewed.length === 0 ? (
        <div className="text-gray-600 dark:text-gray-400 text-sm">No videos yet.</div>
      ) : (
        <div className="max-h-44 overflow-y-auto pr-1 nsq-scrollbar">
          <div className="grid grid-cols-2 gap-2">
            {mostViewed.map((reel) => (
              <div key={reel.id} className="relative rounded-md overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center h-20">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  <img src={reel.creator_avatar || getPublicUrl(reel.video_url || reel.url || '')} alt={reel.caption || 'avatar'} className="w-full h-full object-cover" />
                </div>
                <div className="absolute left-2 bottom-2 bg-black/60 text-white text-xs rounded-md px-2 py-0.5 flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  <span>{reel.views || 0}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LeftMostViewed;
