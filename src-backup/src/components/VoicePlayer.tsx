// components/VoicePlayer.tsx
import React, { useState, useRef } from 'react';
import { Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VoicePlayerProps {
  audioUrl: string;
  duration: number;
}

export const VoicePlayer: React.FC<VoicePlayerProps> = ({ audioUrl, duration }) => {
  console.log('VoicePlayer audioUrl:', audioUrl);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
      <Button
        onClick={togglePlayback}
        size="icon"
        variant="ghost"
        className="rounded-full w-10 h-10 bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      
      <div className="flex-1 ml-3">
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div 
            className="bg-primary h-2 rounded-full" 
            style={{ width: isPlaying ? '100%' : '0%' }}
          />
        </div>
      </div>
      
      <span className="ml-3 text-sm text-gray-600 dark:text-gray-400">
        {formatTime(duration)}
      </span>
      
      <audio
        ref={audioRef}
        src={audioUrl}
        onEnded={() => setIsPlaying(false)}
        onError={e => {
          console.error('Audio playback error:', e);
          alert('Audio failed to load. Check the file URL or permissions.');
        }}
        hidden
      />
    </div>
  );
};