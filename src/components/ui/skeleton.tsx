import React from 'react';
import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

const StudioSkeleton: React.FC = () => (
  <div className="min-h-screen bg-black">
    <div className="max-w-7xl mx-auto pt-16 p-4">
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-44 bg-gray-300 dark:bg-gray-700 rounded" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
          <div className="hidden lg:block space-y-3">
            <div className="h-20 bg-gray-300 dark:bg-gray-700 rounded" />
            <div className="h-20 bg-gray-300 dark:bg-gray-700 rounded" />
          </div>

          <div className="col-span-1 lg:col-span-1 flex justify-center">
            <div className="w-full max-w-3xl h-[60vh] bg-gray-300 dark:bg-gray-700 rounded-2xl" />
          </div>

          <div className="hidden lg:block space-y-3">
            <div className="h-32 bg-gray-300 dark:bg-gray-700 rounded" />
            <div className="h-32 bg-gray-300 dark:bg-gray-700 rounded" />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-300 dark:bg-gray-700 rounded" />
          ))}
        </div>
      </div>
    </div>
  </div>
);

export { Skeleton, StudioSkeleton }
export default StudioSkeleton;
