import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';

interface Viewer {
  id: string;
  user_id: string;
  viewed_at: string;
  users: {
    username?: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
  };
}

interface ViewersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  momentId: string;
  viewsCount: number;
}

export const ViewersModal: React.FC<ViewersModalProps> = ({
  open,
  onOpenChange,
  momentId,
  viewsCount
}) => {
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && momentId) {
      fetchViewers();
    }
  }, [open, momentId]);

  const fetchViewers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('moment_views')
        .select(`
          id,
          user_id,
          viewed_at,
          users (
            username,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .eq('moment_id', momentId)
        .order('viewed_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      // Fix: map users from array to object if needed
      const fixedData = (data || []).map((v: any) => ({
        ...v,
        users: Array.isArray(v.users) ? v.users[0] : v.users
      }));
      setViewers(fixedData);
    } catch (error) {
      console.error('Error fetching viewers:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] dark:bg-[#161616] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-center">
            Viewers ({viewsCount})
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
          ) : viewers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No viewers yet
            </div>
          ) : (
            viewers.map(viewer => (
              <div key={viewer.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={viewer.users?.avatar_url} />
                  <AvatarFallback>
                    {(viewer.users?.first_name?.[0] || viewer.users?.username?.[0] || '?').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {viewer.users?.first_name} {viewer.users?.last_name}
                  </div>
                  {viewer.users?.username && (
                    <div className="text-xs text-gray-500 truncate">
                      @{viewer.users.username}
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-400">
                  {new Date(viewer.viewed_at).toLocaleDateString()}
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
