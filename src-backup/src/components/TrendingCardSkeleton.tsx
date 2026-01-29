import { Card } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

interface TrendingCardSkeletonProps {
  className?: string;
}

export const TrendingCardSkeleton = ({ className = "" }: TrendingCardSkeletonProps) => {
  return (
    <Card className={`
      p-6 max-h-96 overflow-hidden
      bg-gradient-to-br from-white via-purple-50/30 to-pink-50/20
      dark:from-gray-900 dark:via-purple-950/20 dark:to-pink-950/10
      border-0 shadow-xl
      ${className}
    `}>
      {/* Header skeleton */}
      <div className="flex items-center mb-6">
        <TrendingUp className="h-6 w-6 text-purple-300 dark:text-purple-600 mr-2" />
        <div className="h-6 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-lg w-40 animate-pulse" />
      </div>

      {/* Items skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-white/30 dark:bg-gray-800/20">
            <div className="flex items-center space-x-3 flex-1">
              {/* Rank skeleton */}
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-700 animate-pulse" />
              
              {/* Content skeleton */}
              <div className="flex items-center space-x-2 flex-1">
                <div className="w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
                <div className="flex-1">
                  <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded w-24 mb-1 animate-pulse" />
                  <div className="h-3 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded w-16 animate-pulse" />
                </div>
              </div>
            </div>
            
            {/* Growth skeleton */}
            <div className="w-12 h-6 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-full animate-pulse" />
          </div>
        ))}
      </div>
    </Card>
  );
};
