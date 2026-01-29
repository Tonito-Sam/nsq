
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { UserPlus, UserCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface FollowButtonProps {
  userId: string;
  username?: string;
  size?: 'sm' | 'default';
  variant?: 'default' | 'outline';
  isFollowing?: boolean;
  onFollowUpdate?: (userId: string, isFollowing: boolean) => void;
}

export const FollowButton: React.FC<FollowButtonProps> = ({
  userId,
  username,
  size = 'sm',
  variant = 'outline',
  isFollowing: externalIsFollowing,
  onFollowUpdate
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isFollowing, setIsFollowing] = useState(externalIsFollowing || false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (externalIsFollowing !== undefined) {
      setIsFollowing(externalIsFollowing);
    } else {
      checkFollowStatus();
    }
  }, [user, userId, externalIsFollowing]);

  const checkFollowStatus = async () => {
    if (!user || user.id === userId) return;

    try {
      const { data, error } = await supabase
        .from('followers')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking follow status:', error);
        return;
      }

      const followStatus = !!data;
      setIsFollowing(followStatus);
      onFollowUpdate?.(userId, followStatus);
    } catch (error) {
      console.error('Error checking follow status:', error);
    }
  };

  const handleFollow = async () => {
    if (!user || user.id === userId || loading) return;

    setLoading(true);
    try {
      if (isFollowing) {
        // Unfollow
        const { error } = await supabase
          .from('followers')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', userId);

        if (error) {
          console.error('Error unfollowing user:', error);
          toast({
            description: "Failed to unfollow user",
            variant: "destructive",
          });
          return;
        }

        setIsFollowing(false);
        onFollowUpdate?.(userId, false);
        toast({
          description: `You unfollowed ${username || 'this user'}`,
        });
      } else {
        // Follow
        const { error } = await supabase
          .from('followers')
          .insert({
            follower_id: user.id,
            following_id: userId
          });

        if (error) {
          console.error('Error following user:', error);
          toast({
            description: "Failed to follow user",
            variant: "destructive",
          });
          return;
        }

        setIsFollowing(true);
        onFollowUpdate?.(userId, true);
        toast({
          description: `You are now following ${username || 'this user'}`,
        });
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      toast({
        description: "An error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Don't show button for own profile
  if (!user || user.id === userId) return null;

  return (
    <Button
      size={size}
      variant={isFollowing ? 'default' : variant}
      onClick={handleFollow}
      disabled={loading}
      className={`${size === 'sm' ? 'h-8 px-2 sm:px-3' : ''} ${
        isFollowing 
          ? 'bg-green-600 hover:bg-green-700 text-white' 
          : ''
      } transition-all duration-200`}
    >
      {isFollowing ? (
        <>
          <UserCheck className="h-3 w-3 sm:mr-1" />
          <span className="hidden sm:inline">Following</span>
        </>
      ) : (
        <>
          <UserPlus className="h-3 w-3 sm:mr-1" />
          <span className="hidden sm:inline">Follow</span>
        </>
      )}
    </Button>
  );
};
