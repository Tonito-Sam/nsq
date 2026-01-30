import React from 'react';

export const SkeletonMedia: React.FC<{ aspectRatio?: string; className?: string }> = ({ aspectRatio = '16/9', className = '' }) => {
  // aspectRatio like '16/9' -> padding-top %
  const [w, h] = aspectRatio.split('/').map(Number);
  const paddingTop = h && w ? `${(h / w) * 100}%` : '56.25%';
  return (
    <div role="status" aria-busy={true} className={`w-full bg-gray-200 dark:bg-gray-800 animate-pulse rounded ${className}`} style={{ position: 'relative' }}>
      <div style={{ paddingTop }} />
    </div>
  );
};

export default SkeletonMedia;
