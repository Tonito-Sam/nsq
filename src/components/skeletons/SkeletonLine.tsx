import React from 'react';

export const SkeletonLine: React.FC<{ width?: string; height?: string; className?: string }> = ({ width = '100%', height = '0.75rem', className = '' }) => {
  return (
    <div role="status" aria-busy={true} className={`bg-gray-200 dark:bg-gray-800 animate-pulse rounded ${className}`} style={{ width, height }} />
  );
};

export default SkeletonLine;
