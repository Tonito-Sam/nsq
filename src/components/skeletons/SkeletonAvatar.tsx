import React from 'react';

export const SkeletonAvatar: React.FC<{ size?: number; className?: string }> = ({ size = 40, className = '' }) => {
  return (
    <div role="status" aria-busy={true} className={`rounded-full bg-gray-200 dark:bg-gray-800 animate-pulse ${className}`} style={{ width: size, height: size }} />
  );
};

export default SkeletonAvatar;
