import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ShareWithFriendModalProps {
  postId: string;
  open: boolean;
  onClose: () => void;
}

export const ShareWithFriendModal: React.FC<ShareWithFriendModalProps> = ({ postId, open, onClose }) => {
  const { user } = useAuth();
  const [friends, setFriends] = useState<any[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchFriends = async () => {
      // Assume a 'friends' table with user_id and friend_id
      const { data, error } = await supabase
        .from('friends')
        .select('friend:users(id, username, first_name, last_name, avatar_url)')
        .eq('user_id', user.id);
      if (error) setError('Failed to fetch friends.');
      else setFriends((data || []).map((f: any) => f.friend));
    };
    fetchFriends();
  }, [user]);

  const handleShare = async () => {
    if (selectedFriends.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      // Send a notification to each selected friend
      for (const friendId of selectedFriends) {
        await supabase.from('notifications').insert({
          user_id: friendId,
          type: 'shared_post',
          data: { postId, from: user?.id, message },
          read: false
        });
        // Optionally, insert into a DMs/messages table here
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to share with friends.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md p-6 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">Share with Friends</h2>
        {error && <div className="text-red-500 dark:text-red-400 mb-2">{error}</div>}
        <div className="mb-4">
          <label className="block mb-1 font-medium text-gray-800 dark:text-gray-200">Select Friends</label>
          <select
            className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
            multiple
            value={selectedFriends}
            onChange={e => setSelectedFriends(Array.from(e.target.selectedOptions, option => option.value))}
          >
            {friends.map(friend => (
              <option key={friend.id} value={friend.id} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                {friend.first_name || ''} {friend.last_name || ''} (@{friend.username})
              </option>
            ))}
          </select>
        </div>
        <div className="mb-4">
          <label className="block mb-1 font-medium text-gray-800 dark:text-gray-200">Add a message (optional)</label>
          <Textarea
            rows={3}
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Add your message..."
            className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleShare} disabled={loading || selectedFriends.length === 0}>
            {loading ? 'Sharing...' : 'Share'}
          </Button>
        </div>
      </Card>
    </div>
  );
};