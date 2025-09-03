import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PostCard } from '@/components/PostCard';
import { Header } from '@/components/Header';
import { GroupSidebar } from '@/components/GroupSidebar';
import { ActivityInsights } from '@/components/ActivityInsights';
import { CreatePost } from '@/components/CreatePost';
import { useAuth } from '@/hooks/useAuth';
import { MobileBottomNav } from '@/components/MobileBottomNav';

interface Group {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
  // Add more fields as needed
}

// Update Post interface to match Feed/PostCard and avoid duplicate fields
interface Post {
  id: string;
  content: string;
  created_at: string;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  reposts_count: number;
  post_type: string;
  media_url?: string;
  video_url?: string;
  voice_note_url?: string;
  voice_duration?: number;
  poll_options?: any;
  event_date?: string;
  event_location?: string;
  user_id: string;
  user?: {
    first_name?: string;
    last_name?: string;
    username?: string;
    avatar_url?: string;
    verified?: boolean;
    heading?: string;
  };
  original_post?: {
    id: string;
    content: string;
    media_url?: string;
    user?: {
      first_name?: string;
      last_name?: string;
      username?: string;
      avatar_url?: string;
    };
  };
}

interface Member {
  user_id: string;
  role: string;
  users: {
    username: string;
    avatar_url?: string;
  };
}

const GroupDetails: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMember, setIsMember] = useState(false);
  const { user: currentUser } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [canMembersPost, setCanMembersPost] = useState(true);
  const [canMembersShare, setCanMembersShare] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [groupStats, setGroupStats] = useState({ members: 0, posts: 0, views: 0, likes: 0 });
  const [suggestedGroups, setSuggestedGroups] = useState<Group[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchGroup = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('groups')
        .select('id, name, description, created_at')
        .eq('id', groupId)
        .single();
      if (error) {
        setError('Group not found.');
        setGroup(null);
      } else {
        setGroup(data);
        setError(null);
      }
      setLoading(false);
    };
    if (groupId) fetchGroup();
  }, [groupId]);

  // Fetch group members
  useEffect(() => {
    if (!groupId) return;
    const fetchMembers = async () => {
      const { data, error } = await supabase
        .from('group_memberships')
        .select('user_id, role, users (username, avatar_url)')
        .eq('group_id', groupId);
      if (!error && data) setMembers(data as Member[]);
      else setMembers([]);
    };
    fetchMembers();
  }, [groupId]);

  // Fetch group posts
  const fetchPosts = async () => {
    setPostsLoading(true);
    try {
      // Use 'any' for the result and select string to avoid type instantiation error
      const { data, error } = (await (supabase
        .from('posts')
        .select(`*, user:users (id, username, first_name, last_name, avatar_url, verified, heading)`)
        .eq('group_id', groupId) as any));
      if (!error && Array.isArray(data)) setPosts(data as Post[]);
      else setPosts([]);
    } catch (err) {
      setError('Failed to load posts.');
      setPosts([]);
    } finally {
      setPostsLoading(false);
    }
  };

  useEffect(() => {
    if (!groupId) return;
    fetchPosts();
  }, [groupId]);

  // Check if current user is a member
  useEffect(() => {
    if (!groupId || !currentUser) return;
    const checkMembership = async () => {
      const { data } = await supabase
        .from('group_memberships')
        .select('id, role')
        .eq('group_id', groupId)
        .eq('user_id', currentUser.id)
        .single();
      setIsMember(!!data);
      setIsAdmin(data?.role === 'admin');
    };
    checkMembership();
  }, [groupId, currentUser]);

  // Fetch group stats
  useEffect(() => {
    if (!groupId) return;
    const fetchStats = async () => {
      // Members
      const { count: membersCount } = await supabase
        .from('group_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('group_id', groupId);
      // Posts
      const { count: postsCount } = await supabase
        .from('posts')
        .select('id', { count: 'exact', head: true });
      // Likes (sum likes on group posts)
      const { data: groupPosts } = await supabase
        .from('posts')
        .select('id');
      let likesCount = 0;
      if (groupPosts && groupPosts.length > 0) {
        const postIds = groupPosts.map((p: any) => p.id);
        if (postIds.length > 0) {
          const { count: likes } = await supabase
            .from('likes')
            .select('id', { count: 'exact', head: true })
            .in('post_id', postIds);
          likesCount = likes || 0;
        }
      }
      setGroupStats({
        members: membersCount || 0,
        posts: postsCount || 0,
        views: 0,
        likes: likesCount,
      });
    };
    fetchStats();
  }, [groupId]);

  // Fetch suggested groups
  useEffect(() => {
    const fetchSuggested = async () => {
      const { data } = await supabase
        .from('groups')
        .select('id, name, description, created_at')
        .neq('id', groupId)
        .limit(5);
      setSuggestedGroups((data || []) as Group[]);
    };
    fetchSuggested();
  }, [groupId]);

  const handleJoin = async () => {
    if (!currentUser) {
      toast({ title: 'Login required', description: 'Please log in to join the group.' });
      return;
    }
    const { error } = await supabase
      .from('group_memberships')
      .insert({ group_id: groupId, user_id: currentUser.id, role: 'member' });
    if (error) {
      toast({ title: 'Error', description: 'Failed to join group.' });
    } else {
      setIsMember(true);
      toast({ title: 'Joined', description: 'You have joined the group.' });
    }
  };

  const handleLeave = async () => {
    if (!currentUser) return;
    const { error } = await supabase
      .from('group_memberships')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', currentUser.id);
    if (error) {
      toast({ title: 'Error', description: 'Failed to leave group.' });
    } else {
      setIsMember(false);
      toast({ title: 'Left', description: 'You have left the group.' });
    }
  };

  const handleSettingsSave = async () => {
    setShowSettings(false);
    toast({ title: 'Settings updated', description: 'Group settings updated (UI only).' });
  };

  if (loading) return <div className="p-8 text-center">Loading group...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
  if (!group) return <div className="p-8 text-center">No group found.</div>;

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-900/95 dark:bg-black/95 transition-colors">
        <div className="flex flex-col md:flex-row max-w-7xl mx-auto p-2 md:p-4 gap-2 md:gap-6 w-full">
          {/* Modern, mobile-friendly sidebar: collapses to top bar on mobile, sticky on desktop */}
          <aside className="w-full md:w-1/3 lg:w-1/4 flex-shrink-0 mb-4 md:mb-0 md:sticky md:top-4 z-10">
            <div className="block md:hidden mb-2">
              {/* Collapsible/Drawer for mobile sidebar */}
              <details className="bg-white dark:bg-[#161616] rounded shadow-md">
                <summary className="p-3 font-semibold cursor-pointer flex items-center gap-2">
                  <span>Group Menu</span>
                  <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </summary>
                <div className="p-2">
                  <GroupSidebar
                    group={{
                      id: group.id,
                      name: group.name,
                      description: group.description,
                      avatar_url: undefined, // Add avatar if available
                      cover_url: undefined, // Add cover if available
                      isCreator: isAdmin,
                      isMember: isMember,
                    }}
                    stats={groupStats}
                    onJoin={handleJoin}
                    onLeave={handleLeave}
                    isMember={isMember}
                  />
                </div>
              </details>
            </div>
            <div className="hidden md:block">
              <GroupSidebar
                group={{
                  id: group.id,
                  name: group.name,
                  description: group.description,
                  avatar_url: undefined, // Add avatar if available
                  cover_url: undefined, // Add cover if available
                  isCreator: isAdmin,
                  isMember: isMember,
                }}
                stats={groupStats}
                onJoin={handleJoin}
                onLeave={handleLeave}
                isMember={isMember}
              />
            </div>
          </aside>
          <main className="flex-1 w-full max-w-full">
            <Card className="mb-4 md:mb-6 p-4 md:p-6">
              <h1 className="text-2xl md:text-3xl font-bold mb-2">{group.name}</h1>
              <p className="mb-2 text-gray-600">{group.description}</p>
              <div className="text-xs text-gray-400 mb-4">Created: {group.created_at}</div>
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                {isMember ? (
                  <Button variant="outline" onClick={handleLeave}>Leave Group</Button>
                ) : (
                  <Button onClick={handleJoin}>Join Group</Button>
                )}
                <Button variant="secondary" onClick={() => navigate('/groups')}>Back to Groups</Button>
                {isAdmin && (
                  <Button variant="ghost" onClick={() => setShowSettings(true)}>Group Settings</Button>
                )}
              </div>
            </Card>
            {showSettings && isAdmin && (
              <Card className="mb-4 md:mb-6 p-4 md:p-6">
                <h2 className="text-lg md:text-xl font-semibold mb-4">Group Settings</h2>
                <div className="mb-4">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={canMembersPost} onChange={e => setCanMembersPost(e.target.checked)} />
                    Allow members to post
                  </label>
                  <label className="flex items-center gap-2 mt-2">
                    <input type="checkbox" checked={canMembersShare} onChange={e => setCanMembersShare(e.target.checked)} />
                    Allow members to share
                  </label>
                </div>
                <Button onClick={handleSettingsSave}>Save Settings</Button>
                <Button variant="ghost" onClick={() => setShowSettings(false)} className="ml-2">Cancel</Button>
              </Card>
            )}
            {(isAdmin || canMembersPost) && isMember && (
              <CreatePost onPostCreated={fetchPosts} groupId={groupId} />
            )}
            <div>
              <h2 className="text-lg md:text-xl font-semibold mb-4">Group Posts</h2>
              {postsLoading ? (
                <div className="text-gray-500">Loading posts...</div>
              ) : posts.length === 0 ? (
                <div className="text-gray-500">No posts in this group yet.</div>
              ) : (
                <div className="space-y-4 pb-24">
                  {posts.map((post) => (
                    <PostCard key={post.id} post={post} currentUser={currentUser} />
                  ))}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
      {/* Mobile Bottom Navigation */}
      <div className="md:hidden">
        <MobileBottomNav />
      </div>
    </>
  );
};

export default GroupDetails;
