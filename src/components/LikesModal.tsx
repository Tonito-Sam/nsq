import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';

interface Like {
  id: string;
  user_id: string;
  created_at: string;
  users: {
    username?: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
  };
}

interface LikesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  momentId: string;
  likesCount: number;
}

export const LikesModal: React.FC<LikesModalProps> = ({
  open,
  onOpenChange,
  momentId,
  likesCount
}) => {
  const [likes, setLikes] = useState<Like[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && momentId) {
      fetchLikes();
    }
  }, [open, momentId]);

  const fetchLikes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('moment_likes')
        .select(`
          id,
          user_id,
          created_at,
          users (
            username,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .eq('moment_id', momentId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      // Fix: map users from array to object if needed
      const fixedData = (data || []).map((v: any) => ({
        ...v,
        users: Array.isArray(v.users) ? v.users[0] : v.users
      }));
      setLikes(fixedData);
    } catch (error) {
      console.error('Error fetching likes:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] dark:bg-[#161616] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-center">
            Likes ({likesCount})
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-3 max-h-[60vh]">
          {loading ? (
            // Loading skeletons
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-3 p-2">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-3 w-16" />
              </div>
            ))
          ) : likes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No likes yet
            </div>
          ) : (
            likes.map(like => (
              <div key={like.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={like.users?.avatar_url} />
                  <AvatarFallback>
                    {(like.users?.first_name?.[0] || like.users?.username?.[0] || '?').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {like.users?.first_name} {like.users?.last_name}
                  </div>
                  {like.users?.username && (
                    <div className="text-xs text-gray-500 truncate">
                      @{like.users.username}
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-400">
                  {new Date(like.created_at).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
        
        <Button 
          variant="outline" 
          onClick={() => onOpenChange(false)}
          className="w-full mt-4"
        >
          Close
        </Button>
      </DialogContent>
    </Dialog>
  );
};
