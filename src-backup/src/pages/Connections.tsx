import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Header } from '@/components/Header';
import { useNavigate } from 'react-router-dom';

const Connections = () => {
  const { user } = useAuth();
  const [connections, setConnections] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMutualConnections = async () => {
      if (!user) return;
      // Get users the current user is following
      const { data: following } = await supabase
        .from('followers')
        .select('following_id')
        .eq('follower_id', user.id);
      const followingIds = (following || []).map(f => f.following_id);
      if (followingIds.length === 0) return setConnections([]);
      // Get users who follow the current user and are also followed by the user (mutuals)
      const { data: followers } = await supabase
        .from('followers')
        .select('follower_id')
        .eq('following_id', user.id);
      const followerIds = (followers || []).map(f => f.follower_id);
      const mutualIds = followingIds.filter(id => followerIds.includes(id));
      if (mutualIds.length === 0) return setConnections([]);
      // Fetch user details for mutual connections
      const { data: usersData } = await supabase
        .from('users')
        .select('id, first_name, last_name, username, avatar_url, heading')
        .in('id', mutualIds);
      setConnections(usersData || []);
    };
    fetchMutualConnections();
  }, [user]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a] transition-colors">
      <Header />
      <div className="max-w-2xl mx-auto py-10 px-4">
        <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Your Connections</h1>
        {connections.length === 0 ? (
          <Card className="p-8 text-center dark:bg-[#161616]">
            <p className="text-gray-500 dark:text-gray-400">No mutual connections yet.</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {connections.map((connection) => (
              <Card key={connection.id} className="flex items-center p-4 dark:bg-[#161616]">
                <Avatar className="h-14 w-14 mr-4">
                  <AvatarImage src={connection.avatar_url || '/placeholder.svg'} />
                  <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                    {connection.first_name?.[0]}{connection.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">{connection.first_name} {connection.last_name}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">@{connection.username}</div>
                  <div className="text-xs text-blue-600 dark:text-blue-400">{connection.heading}</div>
                </div>
              </Card>
            ))}
          </div>
        )}
        <button className="mt-8 text-blue-600 dark:text-blue-400 underline" onClick={() => navigate(-1)}>
          Back to Profile
        </button>
      </div>
    </div>
  );
};

export default Connections;
