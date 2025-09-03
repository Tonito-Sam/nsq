import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { UserPlus, UserCheck, ArrowLeft, Eye, Heart, Play, TrendingUp, DollarSign, Calendar, CreditCard, Menu } from 'lucide-react';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { VideoEngagementSidebar } from '../components/VideoEngagementSidebar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../components/ui/sheet';
import { useMediaQuery } from '../hooks/useMediaQuery';
import ReactPlayer from 'react-player';

const ChannelPage: React.FC = () => {
  const { channelId } = useParams<{ channelId: string }>();
  const navigate = useNavigate();
  const [channel, setChannel] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [editVideo, setEditVideo] = useState<any>(null);
  const [editForm, setEditForm] = useState<{ caption: string; description: string }>({ caption: '', description: '' });
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);
  // Fetch current user
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    fetchUser();
  }, []);
  const [videos, setVideos] = useState<any[]>([]);
  const [streamVideos, setStreamVideos] = useState<any[]>([]);
  const [subscribed, setSubscribed] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userLikes, setUserLikes] = useState<Set<string>>(new Set());

  // Owner insights sidebar (desktop only)
  const [insights, setInsights] = useState<any>(null);
  const [donations, setDonations] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [revenue, setRevenue] = useState({ total: 0, donations: 0, subscriptions: 0 });

  useEffect(() => {
    const fetchInsights = async () => {
      if (!channelId) return;
      // Total views, likes, and uploads for each segment
      const [{ data: allVideos }, { data: allStreams }] = await Promise.all([
        supabase.from('studio_videos').select('*').eq('channel_id', channelId),
        supabase.from('studio_videos').select('*').eq('channel_id', channelId).eq('is_stream', true),
      ]);
      const totalViews = (allVideos || []).reduce((sum, v) => sum + (v.views || 0), 0);
      const totalLikes = (allVideos || []).reduce((sum, v) => sum + (v.likes || 0), 0);
      const totalUploads = (allVideos || []).length;
      const totalStreams = (allStreams || []).length;
      setInsights({ totalViews, totalLikes, totalUploads, totalStreams });
    };
    fetchInsights();
  }, [channelId]);

  // Edit video handlers
  const openEditModal = (video: any) => {
    setEditVideo(video);
    setEditForm({ caption: video.caption || '', description: video.series_description || '' });
  };

  useEffect(() => {
    const fetchMonetizationData = async () => {
      if (!channelId) return;
      
      // Fetch donations
      const { data: donationsData } = await supabase
        .from('studio_donations')
        .select('*')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false });
      
      // Fetch subscriptions
      const { data: subscriptionsData } = await supabase
        .from('studio_subscriptions')
        .select('*')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false });

      setDonations(donationsData || []);
      setSubscriptions(subscriptionsData || []);

      // Calculate revenue
      const donationTotal = (donationsData || []).reduce((sum, d) => sum + (d.amount || 0), 0);
      const subscriptionTotal = (subscriptionsData || []).reduce((sum, s) => sum + (s.amount || 0), 0);
      setRevenue({
        total: donationTotal + subscriptionTotal,
        donations: donationTotal,
        subscriptions: subscriptionTotal
      });
    };
    fetchMonetizationData();
  }, [channelId]);

  useEffect(() => {
    const fetchChannel = async () => {
      setLoading(true);
      const { data: channelData } = await supabase.from('studio_channels').select('*').eq('id', channelId).single();
      setChannel(channelData);
      const { data: videoData } = await supabase.from('studio_videos').select('*').eq('channel_id', channelId).order('created_at', { ascending: false });
      // Only show public videos to non-owners
      const visibleVideos = isOwner ? videoData : (videoData || []).filter((v: any) => v.visibility === 'public');
  setVideos(visibleVideos || []);
  // Fetch stream videos from studio_streams table
  const { data: streamData } = await supabase.from('studio_streams').select('*').eq('channel_id', channelId).order('created_at', { ascending: false });
  setStreamVideos(streamData || []);
      const { count } = await supabase.from('studio_channel_subscribers').select('id', { count: 'exact', head: true }).eq('channel_id', channelId);
      setSubscriberCount(count || 0);
      // Fetch user likes for these videos
      const { data: likesData } = await supabase.from('studio_video_likes').select('video_id').in('video_id', (videoData || []).map((v:any) => v.id));
      setUserLikes(new Set((likesData || []).map((l:any) => l.video_id)));
      setLoading(false);
    };
    if (channelId) fetchChannel();
  }, [channelId]);
  // Check if current user is channel owner
  const isOwner = currentUserId && channel && channel.owner_id === currentUserId;

  // Toggle video visibility (publish/unpublish)
  const handleToggleVisibility = async (videoId: string, currentVisibility: string) => {
    const newVisibility = currentVisibility === 'public' ? 'private' : 'public';

    const { error } = await supabase
      .from('studio_videos')
      .update({ visibility: newVisibility })
      .eq('id', videoId);

    if (error) {
      console.error('Error updating visibility:', error);
      return;
    }

    // Refresh videos
    const { data: updatedVideos, error: fetchError } = await supabase
      .from('studio_videos')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching updated videos:', fetchError);
      return;
    }

    const visibleVideos = isOwner
      ? updatedVideos
      : (updatedVideos || []).filter((v: any) => v.visibility === 'public');

    setVideos(visibleVideos);
  };

  const closeEditModal = () => {
    setEditVideo(null);
  };
  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editVideo) return;
    await supabase.from('studio_videos').update({ caption: editForm.caption, series_description: editForm.description }).eq('id', editVideo.id);
    // Refresh videos
    const { data: updatedVideos } = await supabase.from('studio_videos').select('*').eq('channel_id', channelId).order('created_at', { ascending: false });
    // Only show public videos to non-owners
    const visibleVideos = isOwner ? updatedVideos : (updatedVideos || []).filter((v: any) => v.visibility === 'public');
    setVideos(visibleVideos);
    closeEditModal();
  };

  // Delete video handlers
  const confirmDeleteVideo = (videoId: string) => setDeletingVideoId(videoId);
  const cancelDelete = () => setDeletingVideoId(null);
  const handleDelete = async () => {
    if (!deletingVideoId) return;
    await supabase.from('studio_videos').delete().eq('id', deletingVideoId);
    // Refresh videos
    const { data: updatedVideos } = await supabase.from('studio_videos').select('*').eq('channel_id', channelId).order('created_at', { ascending: false });
    // Only show public videos to non-owners
    const visibleVideos = isOwner ? updatedVideos : (updatedVideos || []).filter((v: any) => v.visibility === 'public');
    setVideos(visibleVideos);
    setDeletingVideoId(null);
  };

  const handleSubscribe = async () => {
    if (!subscribed) {
      await supabase.from('studio_channel_subscribers').insert({ channel_id: channelId });
      setSubscribed(true);
      setSubscriberCount(c => c + 1);
    } else {
      await supabase.from('studio_channel_subscribers').delete().eq('channel_id', channelId);
      setSubscribed(false);
      setSubscriberCount(c => Math.max(0, c - 1));
    }
  };

  const handleLike = async (videoId: string) => {
    const isLiked = userLikes.has(videoId);
    let newLikes = new Set(userLikes);
    if (isLiked) {
      await supabase.from('studio_video_likes').delete().eq('video_id', videoId);
      newLikes.delete(videoId);
    } else {
      await supabase.from('studio_video_likes').insert({ video_id: videoId });
      newLikes.add(videoId);
    }
    setUserLikes(newLikes);
    // Refetch videos to sync counts
    const { data: updatedVideos } = await supabase.from('studio_videos').select('*').eq('channel_id', channelId).order('created_at', { ascending: false });
    // Only show public videos to non-owners
    const visibleVideos = isOwner ? updatedVideos : (updatedVideos || []).filter((v: any) => v.visibility === 'public');
    setVideos(visibleVideos);
  };

  // Split videos into categories
  const reelsVideos = videos.filter(v => !v.is_series && !v.is_stream);
  const seriesVideos = videos.filter(v => v.is_series);
  // streamVideos now comes from video_streams table

  const isDesktop = useMediaQuery('(min-width: 768px)');

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!channel) return <div className="p-8 text-center">Channel not found.</div>;

  // Sidebar Content Component
  const SidebarContent = () => (
    <div className="space-y-6">
      {/* Channel Insights */}
      <div className="p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800" style={{ backgroundColor: 'rgb(22, 22, 22)' }}>
        <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-500" />
          Channel Insights
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Eye className="h-4 w-4 text-purple-500" />
              Total Views
            </span>
            <span className="font-bold text-purple-600 dark:text-purple-400">{insights?.totalViews || 0}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Heart className="h-4 w-4 text-pink-500" />
              Total Likes
            </span>
            <span className="font-bold text-pink-600 dark:text-pink-400">{insights?.totalLikes || 0}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Play className="h-4 w-4 text-green-500" />
              Uploads
            </span>
            <span className="font-bold text-gray-900 dark:text-white">{insights?.totalUploads || 0}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-red-500" />
              Streams
            </span>
            <span className="font-bold text-gray-900 dark:text-white">{insights?.totalStreams || 0}</span>
          </div>
        </div>
      </div>

      {/* Revenue Card */}
      <div className="p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800" style={{ backgroundColor: 'rgb(22, 22, 22)' }}>
        <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-500" />
          Revenue
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-700 dark:text-gray-300">Total Revenue</span>
            <span className="font-bold text-green-600 dark:text-green-400 text-lg">${revenue.total.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-700 dark:text-gray-300">From Donations</span>
            <span className="font-bold text-blue-600 dark:text-blue-400">${revenue.donations.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-700 dark:text-gray-300">From Subscriptions</span>
            <span className="font-bold text-purple-600 dark:text-purple-400">${revenue.subscriptions.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Donations Report */}
      <div className="p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800" style={{ backgroundColor: 'rgb(22, 22, 22)' }}>
        <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
          <Heart className="h-5 w-5 text-red-500" />
          Recent Donations
        </h3>
        <div className="space-y-3 max-h-40 overflow-y-auto">
          {donations.length === 0 ? (
            <div className="text-center text-gray-400">No donations yet.</div>
          ) : (
            donations.slice(0, 5).map((donation) => (
              <div key={donation.id} className="flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">${donation.amount}</div>
                  <div className="text-xs text-gray-500">{new Date(donation.created_at).toLocaleDateString()}</div>
                </div>
                <div className="text-xs text-gray-400">{donation.donor_name || 'Anonymous'}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Subscriptions Report */}
      <div className="p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800" style={{ backgroundColor: 'rgb(22, 22, 22)' }}>
        <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-blue-500" />
          Recent Subscriptions
        </h3>
        <div className="space-y-3 max-h-40 overflow-y-auto">
          {subscriptions.length === 0 ? (
            <div className="text-center text-gray-400">No subscriptions yet.</div>
          ) : (
            subscriptions.slice(0, 5).map((subscription) => (
              <div key={subscription.id} className="flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">${subscription.amount}</div>
                  <div className="text-xs text-gray-500">{new Date(subscription.created_at).toLocaleDateString()}</div>
                </div>
                <div className="text-xs text-gray-400">{subscription.subscriber_name || 'User'}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-4 pb-20 relative flex flex-col md:flex-row gap-8">
      <div className="flex-1">
        {/* Mobile Header with Back Arrow and Hamburger Menu */}
        <div className="flex items-center justify-between mb-4 md:hidden">
          <button
            className="flex items-center text-gray-600 dark:text-gray-200 bg-white/80 dark:bg-black/60 rounded-full p-2 shadow-md"
            onClick={() => navigate('/studio')}
            aria-label="Back to Studio"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          
          <Sheet>
            <SheetTrigger asChild>
              <button
                className="flex items-center text-gray-600 dark:text-gray-200 bg-white/80 dark:bg-black/60 rounded-full p-2 shadow-md"
                aria-label="Open Menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full p-6 overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Channel Analytics</SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <SidebarContent />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Channel Info */}
        <div className="flex items-center gap-4 mb-6 mt-4 md:mt-0">
          <div className="flex-1">
            <h1 className="text-2xl font-bold mb-1">{channel.name}</h1>
            <div className="text-gray-400 mb-2">{channel.description}</div>
            <Badge>{subscriberCount} Subscribers</Badge>
          </div>
          <Button onClick={handleSubscribe} variant={subscribed ? 'default' : 'outline'}>
            {subscribed ? <UserCheck className="h-4 w-4 mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />}
            {subscribed ? 'Subscribed' : 'Subscribe'}
          </Button>
        </div>
        
        {/* Modern Tabs/Desktop, Horizontal Scroll/Mobile */}
        <div className="w-full">
          {isDesktop ? (
            <Tabs defaultValue="reels" className="w-full">
              <TabsList className="w-full flex justify-center gap-2 bg-transparent mb-4">
                <TabsTrigger value="reels">Reels & Videos</TabsTrigger>
                <TabsTrigger value="series">Series</TabsTrigger>
                <TabsTrigger value="streams">Streams</TabsTrigger>
              </TabsList>
              <TabsContent value="reels">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {reelsVideos.length === 0 ? (
                    <div className="col-span-2 text-center text-gray-400">No videos yet.</div>
                  ) : (
                    reelsVideos.map(video => (
                      <Card key={video.id} className="overflow-hidden relative">
                        <div className="relative">
                          <video src={video.video_url} controls className="w-full h-64 object-cover bg-black" poster={video.thumbnail_url || undefined} />
                          <VideoEngagementSidebar video={video} isLiked={userLikes.has(video.id)} onLike={handleLike} />
                          {isOwner && (
                            <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
                              <Button size="sm" variant="outline" onClick={() => openEditModal(video)}>Edit</Button>
                              <Button size="sm" variant="secondary" onClick={() => handleToggleVisibility(video.id, video.visibility)}>
                                {video.visibility === 'public' ? 'Unpublish' : 'Publish'}
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => confirmDeleteVideo(video.id)}>Delete</Button>
                            </div>
                          )}
                          {isOwner && (
                            <Badge variant="outline" className="absolute bottom-2 right-2 bg-white/80 text-xs">
                              {video.visibility === 'private' ? 'Private' : 'Public'}
                            </Badge>
                          )}
                        </div>
                        <div className="p-3">
                          <div className="font-semibold mb-1">{video.caption}</div>
                          <div className="text-xs text-gray-400 mb-2">{new Date(video.created_at).toLocaleString()}</div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>
              <TabsContent value="series">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {seriesVideos.length === 0 ? (
                    <div className="col-span-2 text-center text-gray-400">No series yet.</div>
                  ) : (
                    seriesVideos.map(video => (
                      <Card key={video.id} className="overflow-hidden relative">
                        <div className="relative">
                          <video src={video.video_url} controls className="w-full h-64 object-cover bg-black" poster={video.thumbnail_url || undefined} />
                          <VideoEngagementSidebar video={video} isLiked={userLikes.has(video.id)} onLike={handleLike} />
                          {isOwner && (
                            <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
                              <Button size="sm" variant="outline" onClick={() => openEditModal(video)}>Edit</Button>
                              <Button size="sm" variant="secondary" onClick={() => handleToggleVisibility(video.id, video.visibility)}>
                                {video.visibility === 'public' ? 'Unpublish' : 'Publish'}
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => confirmDeleteVideo(video.id)}>Delete</Button>
                            </div>
                          )}
                          {isOwner && (
                            <Badge variant="outline" className="absolute bottom-2 right-2 bg-white/80 text-xs">
                              {video.visibility === 'private' ? 'Private' : 'Public'}
                            </Badge>
                          )}
                        </div>
                        <div className="p-3">
                          <div className="font-semibold mb-1">{video.series_title || video.caption}</div>
                          <div className="text-xs text-gray-400 mb-2">{video.series_description}</div>
                          <div className="text-xs text-purple-500 font-semibold">Subscription: ${video.subscription_amount} / {video.subscription_cycle}</div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>
              <TabsContent value="streams">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {streamVideos.length === 0 ? (
                    <div className="col-span-2 text-center text-gray-400">No streams yet.</div>
                  ) : (
                    streamVideos.map(video => (
                      <Card key={video.id} className="overflow-hidden relative">
                        <div className="relative">
                          <ReactPlayer url={video.video_url} controls width="100%" height="256px" light={video.thumbnail_url || undefined} />
                          <VideoEngagementSidebar video={video} isLiked={userLikes.has(video.id)} onLike={handleLike} />
                          {isOwner && (
                            <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
                              <Button size="sm" variant="outline" onClick={() => openEditModal(video)}>Edit</Button>
                              <Button size="sm" variant="secondary" onClick={() => handleToggleVisibility(video.id, video.visibility)}>
                                {video.visibility === 'public' ? 'Unpublish' : 'Publish'}
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => confirmDeleteVideo(video.id)}>Delete</Button>
                            </div>
                          )}
                          {isOwner && (
                            <Badge variant="outline" className="absolute bottom-2 right-2 bg-white/80 text-xs">
                              {video.visibility === 'private' ? 'Private' : 'Public'}
                            </Badge>
                          )}
                        </div>
                        <div className="p-3">
                          <div className="font-semibold mb-1">{video.caption}</div>
                          <div className="text-xs text-gray-400 mb-2">{new Date(video.created_at).toLocaleString()}</div>
                          <div className="text-xs text-blue-500 font-semibold">Stream</div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="space-y-8">
              <div>
                <h4 className="text-lg font-bold mb-2">Reels & Videos</h4>
                <div className="flex gap-4 overflow-x-auto pb-2 snap-x">
                  {reelsVideos.length === 0 ? (
                    <div className="text-center text-gray-400">No videos yet.</div>
                  ) : (
                    reelsVideos.map(video => (
                      <div key={video.id} className="min-w-[220px] snap-center">
                        <Card className="overflow-hidden relative">
                          <div className="relative">
                            <video src={video.video_url} controls className="w-full h-48 object-cover bg-black" poster={video.thumbnail_url || undefined} />
                            <VideoEngagementSidebar video={video} isLiked={userLikes.has(video.id)} onLike={handleLike} />
                          </div>
                          <div className="p-3">
                            <div className="font-semibold mb-1">{video.caption}</div>
                            <div className="text-xs text-gray-400 mb-2">{new Date(video.created_at).toLocaleString()}</div>
                          </div>
                        </Card>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div>
                <h4 className="text-lg font-bold mb-2">Series</h4>
                <div className="flex gap-4 overflow-x-auto pb-2 snap-x">
                  {seriesVideos.length === 0 ? (
                    <div className="text-center text-gray-400">No series yet.</div>
                  ) : (
                    seriesVideos.map(video => (
                      <div key={video.id} className="min-w-[220px] snap-center">
                        <Card className="overflow-hidden relative">
                          <div className="relative">
                            <video src={video.video_url} controls className="w-full h-48 object-cover bg-black" poster={video.thumbnail_url || undefined} />
                            <VideoEngagementSidebar video={video} isLiked={userLikes.has(video.id)} onLike={handleLike} />
                          </div>
                          <div className="p-3">
                            <div className="font-semibold mb-1">{video.series_title || video.caption}</div>
                            <div className="text-xs text-gray-400 mb-2">{video.series_description}</div>
                            <div className="text-xs text-purple-500 font-semibold">Subscription: ${video.subscription_amount} / {video.subscription_cycle}</div>
                          </div>
                        </Card>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div>
                <h4 className="text-lg font-bold mb-2">Streams</h4>
                <div className="flex gap-4 overflow-x-auto pb-2 snap-x">
                  {streamVideos.length === 0 ? (
                    <div className="text-center text-gray-400">No streams yet.</div>
                  ) : (
                    streamVideos.map(video => (
                      <div key={video.id} className="min-w-[220px] snap-center">
                        <Card className="overflow-hidden relative">
                          <div className="relative">
                            <video src={video.video_url} controls className="w-full h-48 object-cover bg-black" poster={video.thumbnail_url || undefined} />
                            <VideoEngagementSidebar video={video} isLiked={userLikes.has(video.id)} onLike={handleLike} />
                          </div>
                          <div className="p-3">
                            <div className="font-semibold mb-1">{video.caption}</div>
                            <div className="text-xs text-gray-400 mb-2">{new Date(video.created_at).toLocaleString()}</div>
                            <div className="text-xs text-blue-500 font-semibold">Stream</div>
                          </div>
                        </Card>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Mobile Bottom Nav */}
        <div className="md:hidden"><MobileBottomNav /></div>
      </div>
      
      {/* Desktop Sidebar */}
      {insights && (
        <aside className="hidden md:block w-80 h-fit sticky top-24">
          <SidebarContent />
        </aside>
      )}

      {/* Edit Video Modal */}
      {editVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Edit Video</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Caption</label>
                <input
                  type="text"
                  name="caption"
                  value={editForm.caption}
                  onChange={handleEditChange}
                  className="w-full border rounded px-3 py-2 bg-gray-100 dark:bg-gray-800"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  name="description"
                  value={editForm.description}
                  onChange={handleEditChange}
                  className="w-full border rounded px-3 py-2 bg-gray-100 dark:bg-gray-800"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeEditModal}>Cancel</Button>
                <Button type="submit" variant="default">Save</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingVideoId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-4">Delete Video</h2>
            <p className="mb-4">Are you sure you want to delete this video? This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={cancelDelete}>Cancel</Button>
              <Button type="button" variant="destructive" onClick={handleDelete}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChannelPage;