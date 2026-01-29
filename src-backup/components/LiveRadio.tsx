
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Radio, Play, Pause, Volume2 } from 'lucide-react';

export const LiveRadio = () => {
  const [isPlaying, setIsPlaying] = React.useState(false);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  return (
    <Card className="p-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center">
          <Radio className="h-5 w-5 mr-2" />
          Live Radio
        </h3>
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          <span className="text-xs">LIVE</span>
        </div>
      </div>
      
      <div className="space-y-2">
        <p className="text-sm opacity-90">1Voice Radio - Inspirational Music</p>
        <div className="flex items-center justify-between">
          <Button 
            size="sm" 
            variant="secondary" 
            onClick={togglePlay}
            className="bg-white/20 hover:bg-white/30 text-white border-white/30"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <div className="flex items-center space-x-2">
            <Volume2 className="h-4 w-4" />
            <div className="w-16 h-1 bg-white/30 rounded-full">
              <div className="w-2/3 h-full bg-white rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
