import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { UserPlus, Check } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export function CustomersModal({ open, onOpenChange, userId }: { open: boolean; onOpenChange: (open: boolean) => void; userId: string }) {
  const [customers, setCustomers] = useState<any[]>([]);
  useEffect(() => {
    if (open && userId) {
      supabase
        .from('orders')
        .select('user_id, users:users!orders_user_id_fkey(id, first_name, last_name, username, avatar_url)')
        .eq('store_id', userId)
        .then(({ data }) => setCustomers(data?.map((o: any) => o.users).filter(Boolean) || []));
    }
  }, [open, userId]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Customers</DialogTitle></DialogHeader>
        {customers.length === 0 ? <div>No customers yet.</div> : customers.map(c => (
          <div key={c.id} className="flex items-center space-x-3 p-2">
            <Avatar className="h-8 w-8"><AvatarImage src={c.avatar_url} /><AvatarFallback>{c.first_name?.[0]}{c.last_name?.[0]}</AvatarFallback></Avatar>
            <span>{c.first_name} {c.last_name} (@{c.username})</span>
          </div>
        ))}
      </DialogContent>
    </Dialog>
  );
}

export function ViewsModal({ open, onOpenChange, userId }: { open: boolean; onOpenChange: (open: boolean) => void; userId: string }) {
  const [viewers, setViewers] = useState<any[]>([]);
  useEffect(() => {
    if (open && userId) {
      (async () => {
        // Get all post IDs for this user
        const { data: posts } = await supabase.from('posts').select('id').eq('user_id', userId);
        const postIds = posts?.map((p: any) => p.id) || [];
        if (postIds.length === 0) return setViewers([]);
        // Get all views for these posts, join users
        const { data: views } = await (supabase as any)
          .from('post_views')
          .select('user_id, users:users!post_views_user_id_fkey(id, first_name, last_name, username, avatar_url)')
          .in('post_id', postIds);
        // Group by user_id and count
        const userMap: Record<string, { user: any; count: number }> = {};
        (views || []).forEach((v: any) => {
          if (!v.users) return;
          if (!userMap[v.user_id]) {
            userMap[v.user_id] = { user: v.users, count: 1 };
          } else {
            userMap[v.user_id].count += 1;
          }
        });
        setViewers(Object.values(userMap));
      })();
    }
  }, [open, userId]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Views</DialogTitle></DialogHeader>
        {viewers.length === 0 ? <div>No views yet.</div> : viewers.map(({ user, count }) => (
          <div key={user.id} className="flex items-center space-x-3 p-2">
            <Avatar className="h-8 w-8"><AvatarImage src={user.avatar_url} /><AvatarFallback>{user.first_name?.[0]}{user.last_name?.[0]}</AvatarFallback></Avatar>
            <span>{user.first_name} {user.last_name} (@{user.username})</span>
            {count > 1 && <span className="ml-auto text-xs bg-gray-200 dark:bg-gray-700 rounded-full px-2 py-0.5">{count} views</span>}
          </div>
        ))}
      </DialogContent>
    </Dialog>
  );
}

export function LikesModal({ open, onOpenChange, userId }: { open: boolean; onOpenChange: (open: boolean) => void; userId: string }) {
  const { user } = useAuth();
  const [likers, setLikers] = useState<any[]>([]);
  const [followingUsers, setFollowingUsers] = useState<Set<string>>(new Set());
  const [followersOfMe, setFollowersOfMe] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && userId) {
      (async () => {
        try {
          // First get all post IDs for this user
          const { data: posts } = await supabase
            .from('posts')
            .select('id')
            .eq('user_id', userId);
          
          const postIds = posts?.map((p: any) => p.id) || [];
          
          if (postIds.length === 0) {
            setLikers([]);
            return;
          }

          // Then get likes for these posts
          const { data } = await (supabase as any)
            .from('post_likes')
            .select('user_id, users:users!post_likes_user_id_fkey(id, first_name, last_name, username, avatar_url)')
            .in('post_id', postIds);
          
          setLikers(data?.map((l: any) => l.users).filter(Boolean) || []);
        } catch (error) {
          console.error('Error fetching likes:', error);
          setLikers([]);
        }
      })();
    }
  }, [open, userId]);

  useEffect(() => {
    if (!user) return;
    // Fetch users I am following
    supabase
      .from('followers')
      .select('following_id')
      .eq('follower_id', user.id)
      .then(({ data }) => {
        setFollowingUsers(new Set(Array.from((data ?? []) as any[]).map((f: any) => f.following_id)));
      });
    // Fetch users who follow me
    supabase
      .from('followers')
      .select('follower_id')
      .eq('following_id', user.id)
      .then(({ data }) => {
        setFollowersOfMe(new Set(Array.from((data ?? []) as any[]).map((f: any) => f.follower_id)));
      });
  }, [user, open]);

  const handleFollowToggle = async (targetUserId: string) => {
    if (!user) return;
    const isFollowing = followingUsers.has(targetUserId);
    if (isFollowing) {
      await supabase
        .from('followers')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId);
      setFollowingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(targetUserId);
        return newSet;
      });
    } else {
      await supabase
        .from('followers')
        .insert({ follower_id: user.id, following_id: targetUserId });
      setFollowingUsers(prev => new Set([...prev, targetUserId]));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Likes</DialogTitle></DialogHeader>
        {(() => {
          try {
            if (likers.length === 0) return <div>No likes yet.</div>;
            return likers.map(l => {
              if (!l || !l.id || l.id === user?.id) return null;
              const isFollowing = followingUsers.has(l.id);
              const followsMe = followersOfMe.has(l.id);
              let buttonText = 'Follow';
              if (isFollowing && followsMe) buttonText = 'Mutual';
              else if (isFollowing) buttonText = 'Following';
              else if (followsMe) buttonText = 'Follow Back';
              return (
                <div key={l.id} className="flex items-center space-x-3 p-2">
                  <Avatar className="h-8 w-8"><AvatarImage src={l.avatar_url} /><AvatarFallback>{l.first_name?.[0]}{l.last_name?.[0]}</AvatarFallback></Avatar>
                  <span>{l.first_name} {l.last_name} (@{l.username})</span>
                  <Button
                    variant={isFollowing ? 'outline' : 'default'}
                    size="sm"
                    className="ml-auto"
                    onClick={() => handleFollowToggle(l.id)}
                  >
                    {isFollowing ? <Check className="h-4 w-4 mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />}
                    {buttonText}
                  </Button>
                </div>
              );
            });
          } catch (err) {
            return <div className="text-red-500">Error rendering likes modal: {String(err)}</div>;
          }
        })()}
      </DialogContent>
    </Dialog>
  );
}

export function EarningsModal({ open, onOpenChange, userId }: { open: boolean; onOpenChange: (open: boolean) => void; userId: string }) {
  const [earnings, setEarnings] = useState<any[]>([]);
  useEffect(() => {
    if (open && userId) {
      supabase
        .from('orders')
        .select('id, user_id, total_amount, users:users!orders_user_id_fkey(id, first_name, last_name, username, avatar_url)')
        .eq('store_id', userId)
        .eq('status', 'completed')
        .then(({ data }) => setEarnings(data || []));
    }
  }, [open, userId]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Earnings</DialogTitle></DialogHeader>
        {earnings.length === 0 ? <div>No earnings yet.</div> : earnings.map(e => (
          <div key={e.id} className="flex items-center space-x-3 p-2">
            <Avatar className="h-8 w-8"><AvatarImage src={e.users?.avatar_url} /><AvatarFallback>{e.users?.first_name?.[0]}{e.users?.last_name?.[0]}</AvatarFallback></Avatar>
            <span>{e.users?.first_name} {e.users?.last_name} (@{e.users?.username})</span>
            <span className="ml-auto font-semibold">${e.total_amount}</span>
          </div>
        ))}
      </DialogContent>
    </Dialog>
  );
}
