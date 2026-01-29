import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Users, MessageCircle, Calendar, Settings, Plus, Upload } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface GroupSidebarProps {
  group: {
    id: string;
    name: string;
    description?: string;
    avatar_url?: string;
    cover_url?: string;
    isCreator?: boolean;
    isMember?: boolean;
  };
  stats?: {
    members?: number;
    posts?: number;
    events?: number;
  };
  onJoin?: () => void;
  onLeave?: () => void;
  isMember?: boolean;
}

export const GroupSidebar: React.FC<GroupSidebarProps> = ({ group, stats, onJoin, onLeave, isMember }) => {
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(group.avatar_url);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // Upload to Supabase Storage (bucket: 'posts', folder: 'group-avatars/')
      const fileExt = file.name.split('.').pop();
      const fileName = `${group.id}/avatar.${fileExt}`;
      const { data, error } = await supabase.storage
        .from('posts')
        .upload(`group-avatars/${fileName}`, file, { upsert: true });
      if (error) throw error;
      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('posts')
        .getPublicUrl(`group-avatars/${fileName}`);
      const publicUrl = publicUrlData.publicUrl;
      // Update group in DB
      await supabase.from('groups').update({ avatar_url: publicUrl }).eq('id', group.id);
      setAvatarUrl(publicUrl);
      window.location.reload(); // Ensure UI refresh everywhere
    } catch (err) {
      alert('Failed to upload avatar');
    } finally {
      setUploading(false);
    }
  };

  return (
    <aside className="w-72 p-0 space-y-6">
      {/* Group Info Card */}
      <Card className="p-4 dark:bg-[#161616] bg-white dark:border-gray-700 flex flex-col items-center text-center">
        <div className="relative">
          <Avatar className="h-20 w-20 mb-2">
            <AvatarImage src={avatarUrl || '/placeholder.svg'} />
            <AvatarFallback>{group.name?.charAt(0)?.toUpperCase() || '?'}</AvatarFallback>
          </Avatar>
          {group.isCreator && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute bottom-2 right-2 bg-white/90 hover:bg-white shadow-md rounded-full h-8 w-8 p-0"
              disabled={uploading}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (event) => handleAvatarChange(event as any);
                input.click();
              }}
            >
              {uploading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div> : <Upload className="h-4 w-4" />}
            </Button>
          )}
        </div>
        <h2 className="text-xl font-bold mt-2 mb-1">{group.name}</h2>
        <p className="text-gray-500 text-sm mb-2">{group.description}</p>
        {group.cover_url && (
          <img
            src={group.cover_url}
            alt="Group Cover"
            className="w-full h-24 object-cover rounded mb-2"
          />
        )}
        <div className="flex flex-wrap justify-center gap-4 mt-2 mb-2">
          <div>
            <span className="font-semibold text-lg">{stats?.members ?? 0}</span>
            <div className="text-xs text-gray-400">Members</div>
          </div>
          <div>
            <span className="font-semibold text-lg">{stats?.posts ?? 0}</span>
            <div className="text-xs text-gray-400">Posts</div>
          </div>
          <div>
            <span className="font-semibold text-lg">{stats?.events ?? 0}</span>
            <div className="text-xs text-gray-400">Events</div>
          </div>
        </div>
        {group.isMember ? (
          <Button variant="outline" className="w-full mt-2" onClick={onLeave}>Leave Group</Button>
        ) : (
          <Button variant="default" className="w-full mt-2" onClick={onJoin}>Join Group</Button>
        )}
      </Card>

      {/* Group Navigation */}
      <Card className="p-4 dark:bg-[#161616] bg-white dark:border-gray-700">
        <nav className="flex flex-col gap-2">
          <Button variant="ghost" className="justify-start w-full" asChild>
            <a href={`/groups/${group.id}`}><Users className="h-4 w-4 mr-2" /> Group Feed</a>
          </Button>
          <Button variant="ghost" className="justify-start w-full" asChild>
            <a href={`/groups/${group.id}/members`}><MessageCircle className="h-4 w-4 mr-2" /> Members</a>
          </Button>
          <Button variant="ghost" className="justify-start w-full" asChild>
            <a href={`/groups/${group.id}/events`}><Calendar className="h-4 w-4 mr-2" /> Events</a>
          </Button>
          {group.isCreator && (
            <Button variant="ghost" className="justify-start w-full" asChild>
              <a href={`/groups/${group.id}/settings`}><Settings className="h-4 w-4 mr-2" /> Group Settings</a>
            </Button>
          )}
        </nav>
      </Card>

      {/* Create Post in Group */}
      {group.isMember && (
        <Card className="p-4 dark:bg-[#161616] bg-white dark:border-gray-700 flex items-center gap-2">
          <Plus className="h-5 w-5 text-purple-600" />
          <span className="font-medium text-gray-900 dark:text-gray-100">Create a post in this group</span>
        </Card>
      )}
    </aside>
  );
};
