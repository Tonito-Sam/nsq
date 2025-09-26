import React from 'react';

interface TopCreatorsProps {
  topCreators: any[];
}

const TopCreators: React.FC<TopCreatorsProps> = ({ topCreators }) => (
  <div className="mb-8 bg-white dark:bg-card rounded-lg p-4 border border-gray-200 dark:border-gray-800">
    <h3 className="text-xl font-bold text-black dark:text-white mb-4">Top Creators</h3>
    {topCreators.length === 0 ? (
      <div className="text-gray-600 dark:text-gray-400 text-sm">No creators yet.</div>
    ) : (
      <div className="space-y-3">
        {topCreators.map((creator, index) => (
          <div key={creator.id} className="flex items-center space-x-3 text-black dark:text-white">
            <span className="text-purple-600 dark:text-purple-400 font-semibold">#{index + 1}</span>
            <div className="text-sm font-medium truncate">{creator.name || 'Unnamed'}</div>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default TopCreators;
