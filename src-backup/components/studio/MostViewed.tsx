import React from 'react';

interface MostViewedProps {
  mostViewed: any[];
}

const MostViewed: React.FC<MostViewedProps> = ({ mostViewed }) => (
  <div className="bg-white dark:bg-card rounded-lg p-4 border border-gray-200 dark:border-gray-800">
    <h3 className="text-xl font-bold text-black dark:text-white mb-4">Most Viewed</h3>
    {mostViewed.length === 0 ? (
      <div className="text-gray-600 dark:text-gray-400 text-sm">No videos yet.</div>
    ) : (
      <div className="space-y-3">
        {mostViewed.map((reel, index) => (
          <div key={reel.id} className="flex items-center space-x-3 text-black dark:text-white">
            <span className="text-purple-600 dark:text-purple-400 font-semibold">#{index + 1}</span>
            <div>
              <div className="text-sm font-medium truncate">{reel.caption || 'Untitled'}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">{reel.views} views</div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default MostViewed;
