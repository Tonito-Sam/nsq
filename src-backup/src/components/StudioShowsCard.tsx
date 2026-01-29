import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Clock, Eye } from 'lucide-react';

interface StudioShow {
  id: string;
  title: string;
  description?: string;
  video_url?: string;
  thumbnail_url?: string;
  duration?: number;
  scheduled_time?: string;
  end_time?: string;
  is_live: boolean;
  is_active: boolean;
  created_at: string;
}

interface StudioShowsCardProps {
  shows: StudioShow[];
  onShowSelect?: (show: StudioShow) => void;
}

export const StudioShowsCard: React.FC<StudioShowsCardProps> = ({ shows, onShowSelect }) => {
  // Helper function to format duration
  const formatDuration = (duration?: number) => {
    if (!duration) return '0:00';
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Helper function to get time status with Africa/Johannesburg timezone
  const getTimeStatus = (show: StudioShow) => {
    if (show.is_live) return { text: 'LIVE', className: 'bg-red-500 text-white' };
    
    if (show.scheduled_time) {
      try {
        const scheduledTime = new Date(show.scheduled_time);
        const now = new Date();
        
        if (scheduledTime > now) {
          return { 
            text: `Starts ${scheduledTime.toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              timeZone: 'Africa/Johannesburg'
            })}`, 
            className: 'bg-blue-500 text-white' 
          };
        }
      } catch (error) {
        console.error('Date parsing error:', error);
      }
    }
    
    return { text: formatDuration(show.duration), className: 'bg-black/70 text-white' };
  };

  // Sort shows - live shows first, then by scheduled time
  const sortedShows = [...shows].sort((a, b) => {
    if (a.is_live && !b.is_live) return -1;
    if (!a.is_live && b.is_live) return 1;
    if (a.scheduled_time && b.scheduled_time) {
      return new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime();
    }
    return 0;
  });

  if (shows.length === 0) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">All Shows</CardTitle>
          <Badge variant="secondary" className="text-xs">
            {shows.length} {shows.length === 1 ? 'Show' : 'Shows'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {sortedShows.slice(0, 5).map((show) => {
          const timeStatus = getTimeStatus(show);
          
          return (
            <div 
              key={show.id}
              className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
              onClick={() => onShowSelect?.(show)}
            >
              {/* Thumbnail */}
              <div className="relative w-16 h-12 rounded-md overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0">
                {show.thumbnail_url ? (
                  <img
                    src={show.thumbnail_url}
                    alt={show.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/placeholder.svg';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Play className="h-4 w-4 text-gray-400" />
                  </div>
                )}
                
                {/* Live indicator */}
                {show.is_live && (
                  <div className="absolute top-1 left-1">
                    <div className="flex items-center space-x-1">
                      <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                      <Badge className="bg-red-500 text-white text-xs px-1 py-0">LIVE</Badge>
                    </div>
                  </div>
                )}
                
                {/* Status Badge */}
                <div className={`absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-xs font-medium ${timeStatus.className}`}>
                  {show.is_live && <Eye className="inline w-2.5 h-2.5 mr-0.5" />}
                  {!show.is_live && show.scheduled_time && <Clock className="inline w-2.5 h-2.5 mr-0.5" />}
                  {timeStatus.text}
                </div>
              </div>
              
              {/* Show Info */}
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm text-gray-900 dark:text-white truncate">
                  {show.title}
                </h4>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {show.scheduled_time 
                    ? new Date(show.scheduled_time).toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        timeZone: 'Africa/Johannesburg'
                      })
                    : new Date(show.created_at).toLocaleDateString()
                  }
                </div>
                {show.description && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-1">
                    {show.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
        
        {shows.length > 5 && (
          <div className="text-center pt-2">
            <button className="text-xs text-blue-600 hover:underline">
              View all {shows.length} shows
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
