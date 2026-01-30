import React from 'react';
import SkeletonAvatar from './SkeletonAvatar';
import SkeletonLine from './SkeletonLine';
import SkeletonMedia from './SkeletonMedia';

export const SkeletonCard: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  return (
    <div role="status" aria-busy={true} className="p-4 rounded-lg bg-white dark:bg-[#0b0b0b] border border-gray-100 dark:border-gray-800 shadow-sm">
      <div className="flex items-center space-x-4 mb-3">
        <SkeletonAvatar size={48} />
        <div className="flex-1">
          <SkeletonLine width="40%" />
          <div className="mt-2 flex space-x-2">
            <SkeletonLine width="20%" className="h-3" />
            <SkeletonLine width="20%" className="h-3" />
          </div>
        </div>
      </div>
      {!compact && <SkeletonMedia className="rounded-md" />}
      <div className="mt-3">
        <SkeletonLine width="80%" />
        <div className="mt-2 flex space-x-2">
          <SkeletonLine width="30%" />
          <SkeletonLine width="20%" />
        </div>
      </div>
    </div>
  );
};

export default SkeletonCard;
