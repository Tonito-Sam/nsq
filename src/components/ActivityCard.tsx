
import React from 'react';
import { Card } from '@/components/ui/card';
import { TrendingUp, Users, MessageCircle, Heart } from 'lucide-react';

export const ActivityCard = () => {
  return (
    <Card className="mb-6 dark:bg-[#161616] bg-white dark:border-gray-700">
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Activity Overview</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-full">
              <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Trending</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Your posts are gaining traction!</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="p-2 bg-green-100 dark:bg-green-800 rounded-full">
              <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Engagement</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">People are connecting with you</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <div className="p-2 bg-purple-100 dark:bg-purple-800 rounded-full">
              <MessageCircle className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Comments</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Active discussions</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="p-2 bg-red-100 dark:bg-red-800 rounded-full">
              <Heart className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Reactions</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Spreading positivity</p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
