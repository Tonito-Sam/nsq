import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserCheck, Users } from 'lucide-react';


interface ProfileModalProps {
  creator: {
    name: string;
    avatar_url?: string;
  };
  channelName?: string;
  subscriberCount?: number;
  isFollowing: boolean;
  onFollow: () => void;
  isSubscribed?: boolean;
  onSubscribe?: () => void;
  children: React.ReactNode;
}


export const ProfileModal = ({ 
  creator, 
  channelName, 
  subscriberCount = 0, 
  isFollowing, 
  onFollow, 
  isSubscribed = false,
  onSubscribe,
  children 
}: ProfileModalProps) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-background border border-border">
        <div className="flex flex-col items-center space-y-4 p-6">
          {/* Large Avatar */}
          <Avatar className="h-24 w-24">
            <AvatarImage src={creator.avatar_url} alt={creator.name} />
            <AvatarFallback className="text-2xl font-bold bg-primary text-primary-foreground">
              {creator.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {/* Slim, small username badge closely stacked under avatar */}
          <Badge className="-mt-2 px-3 py-0.9 rounded-full bg-purple-700/90 text-white text-[11px] font-medium shadow border border-purple-400/40">
            @{creator.name.toLowerCase()}
          </Badge>
          {/* Channel badge */}
          {channelName && (
            <Badge variant="secondary" className="text-xs px-3 py-1 rounded-full mb-2 font-medium">
              {channelName}
            </Badge>
          )}
          {/* Channel description placeholder (add real description if available) */}
          {/* <div className="text-center text-xs text-muted-foreground mb-2">Channel description here</div> */}
          {/* Subscriber count and Follow/Following button side by side, slim badges */}
          <div className="flex flex-row items-center gap-2 mt-2 w-full justify-center">
            <Badge variant="outline" className="text-xs px-3 py-1 rounded-full flex items-center gap-1 font-medium">
              <Users className="h-4 w-4 mr-1" />
              {subscriberCount.toLocaleString()}
            </Badge>
            {onSubscribe && !isSubscribed && (
              <button
                onClick={onSubscribe}
                className="px-4 py-1 rounded-full font-medium text-xs transition-all shadow bg-purple-600 text-white hover:bg-purple-700"
              >
                Subscribe
              </button>
            )}
            <button
              onClick={onFollow}
              className={`px-4 py-1 rounded-full font-medium text-xs transition-all shadow ${isFollowing ? 'bg-gray-100 text-gray-700 border border-gray-300' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            >
              {isFollowing ? (
                <>
                  <UserCheck className="h-4 w-4 mr-1 inline" />
                  Following
                </>
              ) : (
                'Follow'
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};