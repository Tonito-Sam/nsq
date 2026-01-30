import React from 'react';

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  width?: string;
  height?: string;
  className?: string;
}

export const SkeletonBox: React.FC<Props> = ({ width = '100%', height = '1rem', className = '', ...rest }) => {
  return (
    <div
      role="status"
      aria-busy={true}
      className={`bg-gray-200 dark:bg-gray-800 animate-pulse rounded ${className}`}
      style={{ width, height }}
      {...rest}
    />
  );
};

export default SkeletonBox;
