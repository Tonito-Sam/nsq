import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { 
  UserCheck, 
  Eye, 
  Video, 
  Share2, 
  MessageCircle, 
  Heart, 
  ArrowLeft,
  Calendar,
  Globe,
  Link as LinkIcon,
  Users,
  Grid3x3,
  ListVideo,
  MapPin,
  Mail,
  ExternalLink,
  Play,
  MoreVertical,
  Bell,
  Check,
  UserPlus,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { cn } from '@/lib/utils';

const ChannelPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  const [channel, setChannel] = useState<any>(null);
  const [creator, setCreator] = useState<any>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('videos');
  const [totalViews, setTotalViews] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);
  const [totalComments, setTotalComments] = useState(0);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  // Play/pause videos in the grid when they become visible (autoplay muted)
  useEffect(() => {
    if (!videos || videos.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const el = entry.target as HTMLVideoElement;
          const id = el.getAttribute('data-video-id') || '';
          const vid = videoRefs.current.get(id) || el;
          if (!vid) return;

          if (entry.intersectionRatio >= 0.5) {
            try {
              vid.muted = true;
              const p = vid.play();
              if (p && (p as Promise<any>).catch) (p as Promise<any>).catch(() => {});
            } catch (e) {
              // ignore play failures
            }
          } else {
            try {
              vid.pause();
            } catch (e) {}
          }
        });
      },
      { threshold: [0.5] }
    );

    // Observe current video elements
    videoRefs.current.forEach((el) => {
      try {
        observer.observe(el);
      } catch (e) {}
    });

    return () => {
      try {
        observer.disconnect();
      } catch (e) {}
    };
  }, [videos]);

  useEffect(() => {
    fetchChannelData();
    fetchVideos();
    checkSubscription();
    fetchSubscriberCount();
  }, [id]);

  const fetchChannelData = async () => {
    try {
      // Try to fetch by channel ID first
      const { data: channelData, error: channelError } = await supabase
        .from('studio_channels')
        .select('*')
        .eq('id', id)
        .single();

      if (channelError) {
        // If not found, try to fetch by user ID
        const { data: userChannel } = await supabase
          .from('studio_channels')
          .select('*')
          .eq('user_id', id)
          .single();
        
        if (userChannel) {
          setChannel(userChannel);
          // Fetch creator info
          fetchCreatorInfo(userChannel.user_id);
        }
      } else {
        setChannel(channelData);
        // Fetch creator info
        fetchCreatorInfo(channelData.user_id);
      }
    } catch (error) {
      console.error('Error fetching channel:', error);
    }
  };

  const fetchCreatorInfo = async (userId: string) => {
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('username, avatar_url, email')
        .eq('id', userId)
        .single();
      
      setCreator(userData);
    } catch (error) {
      console.error('Error fetching creator info:', error);
    }
  };

  const fetchVideos = async () => {
    try {
      const { data: videosData } = await supabase
        .from('studio_videos')
        .select('*')
        .eq('channel_id', id)
        .order('created_at', { ascending: false });

      if (videosData) {
        setVideos(videosData);
        
        // Calculate totals - need to fetch comment counts separately
        const views = videosData.reduce((sum, video) => sum + (video.views || 0), 0);
        const likes = videosData.reduce((sum, video) => sum + (video.likes || 0), 0);
        
        // Fetch comment counts for all videos
        let totalCommentsCount = 0;
        for (const video of videosData) {
          const { count } = await supabase
            .from('studio_video_comments')
            .select('*', { count: 'exact', head: true })
            .eq('video_id', video.id);
          totalCommentsCount += count || 0;
        }
        
        setTotalViews(views);
        setTotalLikes(likes);
        setTotalComments(totalCommentsCount);
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkSubscription = async () => {
    if (!user) return;
    
    try {
      const { data: subscription } = await supabase
        .from('studio_channel_subscribers')
        .select('*')
        .eq('user_id', user.id)
        .eq('channel_id', id)
        .single();

      setIsSubscribed(!!subscription);
    } catch (error) {
      setIsSubscribed(false);
    }
  };

  const fetchSubscriberCount = async () => {
    try {
      const { count } = await supabase
        .from('studio_channel_subscribers')
        .select('*', { count: 'exact', head: true })
        .eq('channel_id', id);

      setSubscriberCount(count || 0);
    } catch (error) {
      console.error('Error fetching subscriber count:', error);
    }
  };

  const handleSubscribe = async () => {
    if (!user) {
      toast({ description: 'Please login to subscribe' });
      return;
    }

    try {
      if (isSubscribed) {
        // Unsubscribe
        await supabase
          .from('studio_channel_subscribers')
          .delete()
          .eq('user_id', user.id)
          .eq('channel_id', id);
        
        setIsSubscribed(false);
        setSubscriberCount(prev => Math.max(0, prev - 1));
        toast({ description: 'Unsubscribed successfully' });
      } else {
        // Subscribe
        await supabase
          .from('studio_channel_subscribers')
          .insert({
            user_id: user.id,
            channel_id: id,
          });
        
        setIsSubscribed(true);
        setSubscriberCount(prev => prev + 1);
        toast({ description: 'Subscribed successfully' });
      }
    } catch (error) {
      console.error('Error updating subscription:', error);
      toast({ description: 'Failed to update subscription', variant: 'destructive' });
    }
  };

  const handleShareChannel = async () => {
    const url = `${window.location.origin}/studio/channel/${id}`;
    await navigator.clipboard.writeText(url);
    toast({ description: 'Channel link copied to clipboard!' });
  };

  const handlePlayVideo = (videoId: string) => {
    // Studio expects a "highlight" query param to reorder and highlight the selected video.
    navigate(`/studio?highlight=${videoId}&autoplay=true`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-black pb-28 md:pb-0">
        {/* Skeleton loader */}
        <div className="max-w-6xl mx-auto">
          <div className="p-4">
            <div className="flex items-start gap-4 mb-6">
              <Skeleton className="h-20 w-20 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
                <div className="flex gap-2 mt-3">
                  <Skeleton className="h-9 w-24" />
                  <Skeleton className="h-9 w-9 rounded-full" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center pb-28 md:pb-0">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Channel not found</h2>
          <Button onClick={() => navigate('/studio')}>Back to Studio</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white pb-28 md:pb-0">
      {/* Header - Simplified for mobile */}
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-black/95 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            <div className="text-center">
              <h1 className="text-base font-semibold line-clamp-1">{channel.name}</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">{subscriberCount.toLocaleString()} subs</p>
            </div>
            
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 h-9 w-9"
                onClick={handleShareChannel}
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Channel Info - Optimized mobile layout */}
      <div className="px-4 py-4">
        {/* Avatar and Info in single row */}
        <div className="flex items-start gap-4 mb-6">
          {/* Avatar - Smaller on mobile */}
          <div className="flex-shrink-0">
            <Avatar className="h-20 w-20 border-3 border-purple-600/40 shadow-lg">
              <AvatarImage src={creator?.avatar_url} alt={channel.name} />
              <AvatarFallback className="text-xl bg-gradient-to-br from-purple-600 to-pink-600">
                {channel.name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Info Section - Takes remaining space */}
          <div className="flex-1 min-w-0">
            {/* Channel name and badge */}
            <div className="mb-2">
              <h2 className="text-lg font-bold line-clamp-1">{channel.name}</h2>
              {creator?.username && (
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-gray-600 dark:text-gray-400">@{creator.username}</span>
                  {channel.verified && (
                    <Badge className="bg-blue-500/20 text-blue-400 text-[10px] px-1 py-0 border-0">
                      ✓
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Stats row - compact */}
            <div className="flex items-center gap-4 mb-3">
              <div className="text-center">
                <div className="text-sm font-bold">{videos.length}</div>
                <div className="text-[10px] text-gray-600 dark:text-gray-400">Videos</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold">{subscriberCount.toLocaleString()}</div>
                <div className="text-[10px] text-gray-600 dark:text-gray-400">Subs</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold">{totalViews.toLocaleString()}</div>
                <div className="text-[10px] text-gray-600 dark:text-gray-400">Views</div>
              </div>
            </div>

            {/* Action Buttons - Compact row */}
            <div className="flex items-center gap-2">
              <Button
                onClick={handleSubscribe}
                size="sm"
                className={`flex-1 ${isSubscribed ? 'bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700' : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'}`}
              >
                {isSubscribed ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1.5" />
                    <span className="text-xs">Subscribed</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                    <span className="text-xs">Subscribe</span>
                  </>
                )}
              </Button>
              
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={handleShareChannel}
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Description - Full width below */}
        {channel.description && (
          <div className="mb-6">
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{channel.description}</p>
          </div>
        )}

        {/* Channel Details - Compact */}
        {(channel.website || channel.location || channel.email) && (
          <div className="mb-6 space-y-3 p-3 bg-gray-100/50 dark:bg-gray-900/30 rounded-lg">
            {channel.website && (
              <div className="flex items-center gap-3 text-sm">
                <div className="flex-shrink-0">
                  <Globe className="h-4 w-4 text-gray-400" />
                </div>
                <a 
                  href={channel.website.startsWith('http') ? channel.website : `https://${channel.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:underline flex-1 truncate text-sm"
                >
                  {channel.website.replace(/^https?:\/\//, '')}
                </a>
                <ExternalLink className="h-3 w-3 text-gray-500 flex-shrink-0" />
              </div>
            )}
            {channel.location && (
                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                <MapPin className="h-4 w-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                <span className="flex-1 truncate">{channel.location}</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
              <Calendar className="h-4 w-4 flex-shrink-0" />
              <span>Joined {new Date(channel.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
            </div>
          </div>
        )}

        {/* Quick Stats Cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-gray-100/60 dark:bg-gray-900/40 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="bg-purple-600/20 p-2 rounded-lg">
                <Heart className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <div className="text-lg font-bold">{totalLikes.toLocaleString()}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Likes</div>
              </div>
            </div>
          </div>
          <div className="bg-gray-100/60 dark:bg-gray-900/40 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600/20 p-2 rounded-lg">
                <MessageCircle className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <div className="text-lg font-bold">{totalComments.toLocaleString()}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Comments</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs - Mobile optimized */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="bg-gray-100/60 dark:bg-gray-900/50 p-1 rounded-lg w-full grid grid-cols-3">
            <TabsTrigger value="videos" className="text-xs py-2">
              <Grid3x3 className="h-3.5 w-3.5 mr-1.5" />
              Videos
            </TabsTrigger>
            <TabsTrigger value="about" className="text-xs py-2">
              <UserCheck className="h-3.5 w-3.5 mr-1.5" />
              About
            </TabsTrigger>
            <TabsTrigger value="stats" className="text-xs py-2">
              <ListVideo className="h-3.5 w-3.5 mr-1.5" />
              Stats
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="videos" className="mt-4">
            {videos.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
                  <Video className="h-8 w-8 text-gray-600 dark:text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No videos yet</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">This channel hasn't uploaded any videos</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {videos.map((video) => (
                  <div
                    key={video.id}
                    className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900 cursor-pointer group"
                    onClick={() => handlePlayVideo(video.id)}
                  >
                    {/* Video element (autoplay muted when visible) */}
                    <div className="absolute inset-0">
                      <video
                        data-video-id={video.id}
                        ref={(el) => {
                          if (el) {
                            videoRefs.current.set(String(video.id), el);
                          } else {
                            videoRefs.current.delete(String(video.id));
                          }
                        }}
                        src={video.video_url}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                        loop
                        preload="metadata"
                        poster={video.thumbnail_url || ''}
                      />
                    </div>

                    {/* Stats overlay */}
                      <div className="absolute bottom-1 left-1 right-1">
                      <div className="flex items-center justify-between text-gray-900 dark:text-white text-[10px]">
                        <div className="flex items-center gap-1 bg-black/70 px-1.5 py-0.5 rounded text-white">
                          <Eye className="h-2.5 w-2.5" />
                          <span>{formatNumber(video.views || 0)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Duration badge */}
                    <div className="absolute top-1 right-1 bg-black/90 text-white text-[9px] px-1.5 py-0.5 rounded">
                      {video.duration ? formatDuration(video.duration) : '0:00'}
                    </div>

                    {/* Hover play button */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play className="h-6 w-6 text-white" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="about" className="mt-4">
            <div className="space-y-4">
              {/* Channel Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-100/60 dark:bg-gray-900/30 p-4 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-600/20 p-2 rounded-lg">
                      <Video className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                      <div className="font-bold">{videos.length}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Videos</div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-100/60 dark:bg-gray-900/30 p-4 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="bg-pink-600/20 p-2 rounded-lg">
                      <Eye className="h-5 w-5 text-pink-400" />
                    </div>
                    <div>
                      <div className="font-bold">{formatNumber(totalViews)}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Views</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Engagement Metrics */}
              <div className="bg-gray-100/60 dark:bg-gray-900/30 rounded-xl p-4">
                <h4 className="font-semibold mb-3">Engagement</h4>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Like Rate</span>
                      <span>{videos.length > 0 && totalViews > 0 ? Math.round((totalLikes / totalViews) * 100) : 0}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-600 to-pink-600" 
                        style={{ width: `${videos.length > 0 && totalViews > 0 ? Math.round((totalLikes / totalViews) * 100) : 0}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Comment Rate</span>
                      <span>{videos.length > 0 && totalViews > 0 ? Math.round((totalComments / totalViews) * 100) : 0}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-600 to-cyan-600" 
                        style={{ width: `${videos.length > 0 && totalViews > 0 ? Math.round((totalComments / totalViews) * 100) : 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="stats" className="mt-4">
            <div className="space-y-4">
              {/* Main Stats */}
              <div className="bg-gray-100/60 dark:bg-gray-900/30 rounded-xl p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-bold">{subscriberCount.toLocaleString()}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Subscribers</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{formatNumber(totalViews)}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Total Views</div>
                  </div>
                </div>
              </div>

              {/* Performance */}
              <div className="bg-gray-100/60 dark:bg-gray-900/30 rounded-xl p-4">
                <h4 className="font-semibold mb-3">Performance</h4>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Avg. Views per Video</span>
                      <span>{videos.length > 0 ? formatNumber(Math.round(totalViews / videos.length)) : 0}</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-green-600" style={{ width: '65%' }}></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Watch Time</span>
                      <span>{Math.round(totalViews * 0.75).toLocaleString()} min</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600" style={{ width: '45%' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Mobile Bottom Nav */}
      {isMobile && <MobileBottomNav />}
    </div>
  );
};

const formatDuration = (seconds: number) => {
  if (!isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatNumber = (num: number) => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};

export default ChannelPage;