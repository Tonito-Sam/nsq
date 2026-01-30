import React from 'react';
import Skeleton from '@/components/ui/skeleton';
import SkeletonAvatar from './SkeletonAvatar';
import SkeletonLine from './SkeletonLine';
import SkeletonMedia from './SkeletonMedia';

interface FeedSkeletonProps {
  count?: number;
}

const FeedSkeleton: React.FC<FeedSkeletonProps> = ({ count = 3 }) => {
  return (
    <div className="space-y-6 max-w-2xl mx-auto px-2 sm:px-0">
      {/* Create Post */}
      <div className="rounded-lg overflow-hidden p-4 bg-white border border-gray-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full">
            <SkeletonAvatar />
          </div>
          <div className="flex-1">
            <div className="h-10 w-full rounded-full">
              <SkeletonLine />
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md">
                <Skeleton />
              </div>
              <div className="h-3 w-16 rounded-full">
                <SkeletonLine />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md">
                <Skeleton />
              </div>
              <div className="h-3 w-16 rounded-full">
                <SkeletonLine />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md">
                <Skeleton />
              </div>
              <div className="h-3 w-16 rounded-full">
                <SkeletonLine />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feed Posts */}
      <div className="space-y-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="rounded-lg overflow-hidden bg-white border border-gray-200 shadow-sm">
            {/* Post Header */}
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full">
                    <SkeletonAvatar />
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 w-36 rounded-full">
                      <SkeletonLine />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-24 rounded-full">
                        <SkeletonLine />
                      </div>
                      <div className="h-1 w-1 rounded-full bg-gray-300" />
                      <div className="h-3 w-16 rounded-full">
                        <SkeletonLine />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="h-6 w-6 rounded-md">
                  <Skeleton />
                </div>
              </div>
            </div>

            {/* Post Content */}
            <div className="px-4 pb-3">
              <div className="space-y-3">
                <div className="h-3 w-full rounded-full">
                  <SkeletonLine />
                </div>
                <div className="h-3 w-5/6 rounded-full">
                  <SkeletonLine />
                </div>
                <div className="h-3 w-4/6 rounded-full">
                  <SkeletonLine />
                </div>
              </div>
            </div>

            {/* Post Media */}
            <div className="p-4 pt-0">
              <div className="h-60 w-full rounded-md">
                <SkeletonMedia />
              </div>
            </div>

            {/* Post Stats */}
            <div className="px-4 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex items-center -space-x-2">
                    <div className="h-6 w-6 rounded-full">
                      <SkeletonAvatar />
                    </div>
                    <div className="h-6 w-6 rounded-full">
                      <SkeletonAvatar />
                    </div>
                    <div className="h-6 w-6 rounded-full">
                      <SkeletonAvatar />
                    </div>
                  </div>
                  <div className="h-3 w-20 rounded-full">
                    <SkeletonLine />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-3 w-24 rounded-full">
                    <SkeletonLine />
                  </div>
                  <div className="h-3 w-16 rounded-full">
                    <SkeletonLine />
                  </div>
                </div>
              </div>
            </div>

            {/* Post Actions */}
            <div className="px-4 py-2 border-t border-gray-100">
              <div className="grid grid-cols-4 gap-1">
                {['Like', 'Comment', 'Share', 'Send'].map((action, idx) => (
                  <div key={idx} className="flex flex-col items-center p-2 rounded-md hover:bg-gray-50 transition-colors">
                    <div className="h-5 w-5 rounded-sm mb-1">
                      <Skeleton />
                    </div>
                    <div className="h-2 w-12 rounded-full">
                      <SkeletonLine />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Trending Section */}
      <div className="rounded-lg overflow-hidden bg-white border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-100">
          <div className="h-5 w-40 rounded-full">
            <SkeletonLine />
          </div>
        </div>
        <div className="p-4 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-md bg-gray-50 flex items-center justify-center">
                <div className="h-6 w-6 rounded-sm">
                  <Skeleton />
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 rounded-full">
                  <SkeletonLine />
                </div>
                <div className="h-2 w-24 rounded-full">
                  <SkeletonLine />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Who to Follow */}
      <div className="rounded-lg overflow-hidden bg-white border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-100">
          <div className="h-5 w-48 rounded-full">
            <SkeletonLine />
          </div>
        </div>
        <div className="p-4 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full">
                  <SkeletonAvatar />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-28 rounded-full">
                    <SkeletonLine />
                  </div>
                  <div className="h-2 w-20 rounded-full">
                    <SkeletonLine />
                  </div>
                </div>
              </div>
              <div className="h-8 w-20 rounded-full">
                <Skeleton />
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-gray-100">
          <div className="h-4 w-full rounded-full">
            <SkeletonLine />
          </div>
        </div>
      </div>

      {/* LinkedIn News */}
      <div className="rounded-lg overflow-hidden bg-white border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="h-5 w-32 rounded-full">
              <SkeletonLine />
            </div>
            <div className="h-5 w-5 rounded-sm">
              <Skeleton />
            </div>
          </div>
        </div>
        <div className="p-4 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-5/6 rounded-full">
                <SkeletonLine />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-16 rounded-full">
                  <SkeletonLine />
                </div>
                <div className="h-1 w-1 rounded-full bg-gray-300" />
                <div className="h-2 w-12 rounded-full">
                  <SkeletonLine />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Loading Indicator */}
      <div className="flex items-center justify-center py-6">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-gray-300 animate-pulse" />
          <div className="h-2 w-2 rounded-full bg-gray-300 animate-pulse delay-75" />
          <div className="h-2 w-2 rounded-full bg-gray-300 animate-pulse delay-150" />
        </div>
      </div>
    </div>
  );
};

export default FeedSkeleton;