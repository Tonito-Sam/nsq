import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Eye, UserCheck, Edit3, Tag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MobileBottomNav } from '@/components/MobileBottomNav';

// MonetizationCard copied from Studio.tsx
const MonetizationCard = ({ channel, totalChannelViews, subscriberCounts, handleToggleMonetization }: any) => {
  const minViews = 10000;
  const minSubscribers = 2000;
  const viewsOk = totalChannelViews >= minViews;
  const subsOk = (subscriberCounts[channel.id] ?? 0) >= minSubscribers;
  const monetizationEnabled = viewsOk && subsOk;
  return (
    <div className="bg-card bg-white/90 dark:bg-card rounded-lg p-4 text-black dark:text-white border border-gray-200 dark:border-gray-800 mb-6">
      <h3 className="text-lg font-bold mb-3">Monetization</h3>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span>Enable Donations (Live)</span>
          <Switch
            checked={channel?.donation_enabled || false}
            onCheckedChange={checked => handleToggleMonetization('donation', checked)}
            disabled={!monetizationEnabled}
          />
        </div>
        <div className="flex items-center justify-between">
          <span>Enable Subscriptions (Series)</span>
          <Switch
            checked={channel?.subscription_enabled || false}
            onCheckedChange={checked => handleToggleMonetization('subscription', checked)}
            disabled={!monetizationEnabled}
          />
        </div>
        {!monetizationEnabled && (
          <div className="text-xs text-gray-400 mt-2">
            Get <b>10,000 views</b> & <b>2,000 subscribers</b> to enable monetization features.
          </div>
        )}
      </div>
    </div>
  );
};

const StudioSettings = () => {
  const { user } = useAuth();
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [settingsLoading] = useState(false); // Remove setSettingsLoading
  const [channel, setChannel] = useState<any>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [subscriberCounts, setSubscriberCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Calculate total views for the current channel from videos
  const totalChannelViews = videos
    .filter((v) => v.channel_id === channel?.id)
    .reduce((sum, v) => sum + (v.views || 0), 0);

  // Handle monetization toggle
  const handleToggleMonetization = async (type: 'donation' | 'subscription', enabled: boolean) => {
    if (!channel) return;
    try {
      const { error } = await supabase
        .from('studio_channels')
        .update({ [`${type}_enabled`]: enabled })
        .eq('id', channel.id);
      if (error) throw error;
      setChannel((prev: any) => ({ ...prev, [`${type}_enabled`]: enabled }));
      toast({ description: `Monetization setting updated!` });
    } catch (err) {
      toast({ description: 'Failed to update monetization', variant: 'destructive' });
    }
  };

  useEffect(() => {
    const fetchChannel = async () => {
      if (!user) return;
      setLoading(true);
      const { data: channelData } = await supabase
        .from('studio_channels')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (channelData) {
        setChannel(channelData);
        setEditName(channelData.name || '');
        setEditDescription(channelData.description || '');
        setEditCategory(channelData.category || '');
        // Fetch videos for this channel
        const { data: vids } = await supabase
          .from('studio_videos')
          .select('*')
          .eq('channel_id', channelData.id);
        setVideos(vids || []);
        // Fetch subscriber count for this channel
        const { count } = await supabase
          .from('studio_channel_subscribers')
          .select('*', { count: 'exact', head: true })
          .eq('channel_id', channelData.id);
        setSubscriberCounts({ [channelData.id]: count || 0 });
      }
      setLoading(false);
    };
    fetchChannel();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Header />
        <div className="text-lg text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      {/* Back Arrow */}
      <div className="max-w-xl mx-auto px-4 pt-4">
        <button
          className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-semibold mb-2 hover:underline"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>
      </div>
      <div className="max-w-xl mx-auto p-6 pt-0">
        <h2 className="text-2xl font-bold mb-4">Channel Settings</h2>
        {/* Right sidebar cards from Studio page (Your Studio, Invite Friends, Monetization) */}
        {channel && (
          <div className="space-y-6 mb-8">
            {/* Your Studio Card */}
            <div className="bg-card bg-white/90 dark:bg-card rounded-lg p-4 text-black dark:text-white border border-gray-200 dark:border-gray-800 mb-6">
              <h3 className="text-xl font-bold mb-3">Your Studio</h3>
              <div className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">{channel.name}</div>
              <div className="text-base text-gray-800 dark:text-gray-200 mb-3 font-medium">{channel.description}</div>
              <div className="text-xs text-purple-700 dark:text-purple-300 mb-2 font-semibold">
                Link: <a href={`/studio/${channel.id}`} className="underline text-purple-600 dark:text-purple-400">/studio/{channel.id}</a>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-4 h-4 text-purple-500" />
                <span className="text-base text-gray-900 dark:text-white font-semibold">Total Views: <span className="font-bold">{totalChannelViews}</span></span>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <UserCheck className="w-4 h-4 text-purple-500" />
                <span className="text-base text-gray-900 dark:text-white font-semibold">Subscribers: <span className="font-bold">{subscriberCounts[channel.id] ?? 0}</span></span>
              </div>
            </div>
            {/* Invite Friends Card */}
            <div className="bg-card bg-white/90 dark:bg-card rounded-lg p-4 text-black dark:text-white border border-gray-200 dark:border-gray-800 mb-6">
              <h3 className="text-lg font-bold mb-3">Invite Friends</h3>
              <div className="text-sm mb-3">Share your channel link to invite friends to subscribe!</div>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={`https://nexsq.com/studio/${channel.id}`}
                  className="flex-1 bg-gray-800 text-white border-none focus:ring-0 focus:outline-none text-xs px-2 py-1 rounded"
                  style={{ minWidth: 0 }}
                />
                <Button
                  size="sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(`https://nexsq.com/studio/${channel.id}`);
                    toast({ description: 'Link copied to clipboard!' });
                  }}
                  className="text-xs"
                >
                  Copy Link
                </Button>
              </div>
            </div>
            {/* Monetization Card */}
            <MonetizationCard channel={channel} totalChannelViews={totalChannelViews} subscriberCounts={subscriberCounts} handleToggleMonetization={handleToggleMonetization} />
          </div>
        )}
        <form className="w-full space-y-4 mb-8">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <Edit3 className="h-4 w-4" />Channel Name
            </label>
            <Input
              value={editName}
              disabled
              className="mt-1 bg-gray-900/40 text-gray-200 cursor-not-allowed font-bold text-lg border border-purple-500"
              required
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <Edit3 className="h-4 w-4" />Description
            </label>
            <Input
              value={editDescription}
              onChange={e => setEditDescription(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <Tag className="h-4 w-4" />Category
            </label>
            <select
              value={editCategory}
              onChange={e => setEditCategory(e.target.value)}
              className="mt-1 w-full rounded border border-gray-700 bg-gray-900 text-white p-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            >
              <option value="">Select a category</option>
              <option value="News">News</option>
              <option value="Religion">Religion</option>
              <option value="Sports">Sports</option>
              <option value="Music">Music</option>
              <option value="Comedy">Comedy</option>
              <option value="Education">Education</option>
              <option value="Business">Business</option>
              <option value="Technology">Technology</option>
              <option value="Health">Health</option>
              <option value="Society">Society & Culture</option>
              <option value="Kids">Kids & Family</option>
              <option value="True Crime">True Crime</option>
              <option value="History">History</option>
              <option value="Science">Science</option>
              <option value="Fiction">Fiction</option>
              <option value="TV & Film">TV & Film</option>
              <option value="Kickstart">Kickstart</option>
              <option value="Arts">Arts</option>
              <option value="Leisure">Leisure</option>
              <option value="Government">Government</option>
              <option value="Spirituality">Spirituality</option>
              <option value="Personal Journals">Personal Journals</option>
              <option value="Documentary">Documentary</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <Button
            type="submit"
            disabled={settingsLoading}
            className="w-full"
          >
            {settingsLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
        <Button variant="ghost" className="mt-4 w-full" onClick={() => navigate(-1)}>
          Cancel
        </Button>
      </div>
      {/* Mobile Bottom Navigation */}
      <div className="md:hidden">
        <MobileBottomNav />
      </div>
    </div>
  );
};

export default StudioSettings;
