import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

export function PostViewersModal({ open, onOpenChange, postId }: { open: boolean; onOpenChange: (open: boolean) => void; postId: string }) {
  const [viewers, setViewers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !postId) return;
    (async () => {
      setLoading(true);
      try {
        const resp = await fetch(`/api/post-views?post_id=${encodeURIComponent(postId)}&limit=10`);
        if (!resp.ok) {
          setViewers([]);
          return;
        }
        const json = await resp.json();
        // json.viewers is an array of { user_id, users: { id, first_name, last_name, username, avatar_url } }
        const mapped = (json.viewers || []).map((v: any) => v.users).filter(Boolean);
        setViewers(mapped);
      } catch (err) {
        console.error('Failed to fetch viewers', err);
        setViewers([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, postId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Recent viewers</DialogTitle></DialogHeader>
        {loading ? <div>Loading...</div> : (
          viewers.length === 0 ? <div>No viewers yet.</div> : viewers.map(u => (
            <div key={u.id} className="flex items-center space-x-3 p-2">
              <Avatar className="h-8 w-8"><AvatarImage src={u.avatar_url} /><AvatarFallback>{u.first_name?.[0]}{u.last_name?.[0]}</AvatarFallback></Avatar>
              <div>
                <div className="font-medium">{u.first_name} {u.last_name}</div>
                <div className="text-xs text-gray-500">@{u.username}</div>
              </div>
            </div>
          ))
        )}
        <div className="mt-4 text-right">
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PostViewersModal;
