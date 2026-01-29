import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Radio, Upload, VideoIcon, Users, TrendingUp } from 'lucide-react';

export const StudioSidebar = () => {
  return (
    <div className="space-y-6">
      {/* Studio Actions */}
      <Card className="dark:bg-[#161616] border-gray-200 dark:border-gray-700">
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Radio className="h-4 w-4 text-pink-500" />
            Studio Actions
          </h3>
          <div className="space-y-3">
            <Button variant="outline" className="w-full flex items-center gap-2">
              <Upload className="h-4 w-4 text-purple-500" />
              Upload Reel
            </Button>
            <Button variant="outline" className="w-full flex items-center gap-2">
              <VideoIcon className="h-4 w-4 text-blue-500" />
              Record Video
            </Button>
            <Button variant="outline" className="w-full flex items-center gap-2">
              <Radio className="h-4 w-4 text-red-500" />
              Go Live
            </Button>
          </div>
        </div>
      </Card>
      {/* Trending Creators */}
      <Card className="dark:bg-[#161616] border-gray-200 dark:border-gray-700">
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            Trending Creators
          </h3>
          <div className="space-y-2">
            {/* Placeholder for trending creators */}
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Coming soon...</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
