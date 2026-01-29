
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Grid3X3, Plus, Video } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { NotificationDropdown } from '@/components/NotificationDropdown';
import { CreatePostModal } from '@/components/CreatePostModal';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { MessagesDropdown } from '@/components/MessagesDropdown';

export const HeaderNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let channel: any;
    
    const fetchUnreadCount = async () => {
      console.log('Fetching unread count for user via RPC:', user?.id);
      if (!user) {
        setUnreadCount(0);
        return;
      }

      try {
        // Prefer RPC: get_unread_count_for_user
        const { data, error } = await supabase.rpc('get_unread_count_for_user', { p_user_id: user.id });
        if (error) {
          console.error('Error calling get_unread_count_for_user:', error);
          setUnreadCount(0);
          return;
        }
        // RPC returns a single bigint value
        const count = (data as any) || 0;
        console.log('Unread message count (RPC):', count);
        setUnreadCount(Number(count) || 0);
      } catch (error) {
        console.error('Unexpected error fetching unread count via RPC:', error);
        setUnreadCount(0);
      }
    };

    fetchUnreadCount();

    // Subscribe to changes in messages table for real-time unread count
    if (user) {
      channel = supabase.channel('header-unread-messages')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'messages' 
        }, (payload) => {
          console.log('Message table change detected:', payload);
          // Add a small delay to ensure the database has been updated
          setTimeout(fetchUnreadCount, 100);
        })
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'conversations' 
        }, (payload) => {
          console.log('Conversation table change detected:', payload);
          setTimeout(fetchUnreadCount, 100);
        })
        .subscribe();
    }

    // Set up global refresh function for manual triggers
    (window as any).refreshHeaderUnreadCount = fetchUnreadCount;

    // Listen for custom events that might indicate messages were read
    const handleMessageRead = () => {
      console.log('Message read event triggered');
      setTimeout(fetchUnreadCount, 100);
    };

    window.addEventListener('messagesRead', handleMessageRead);

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      window.removeEventListener('messagesRead', handleMessageRead);
    };
  }, [user, location.pathname]);

  // Additional effect to refresh count when navigating away from messages
  useEffect(() => {
    if (location.pathname !== '/messages' && !location.pathname.startsWith('/messages/')) {
      // If we're navigating away from messages, refresh the count after a delay
      const timer = setTimeout(() => {
        if ((window as any).refreshHeaderUnreadCount) {
          (window as any).refreshHeaderUnreadCount();
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [location.pathname]);

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <div className="flex items-center space-x-3">
        {/* Create Post Button - Desktop Only */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowCreateModal(true)}
          className="hidden md:flex text-gray-700 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400"
        >
          <Plus className="h-4 w-4" />
        </Button>

        {/* Square Navigation - Desktop Only */}
        <Button
          variant={isActive('/square') ? "default" : "ghost"}
          size="sm"
          onClick={() => navigate('/square')}
          className={`hidden md:flex ${
            isActive('/square') 
              ? 'bg-purple-600 hover:bg-purple-700 text-white' 
              : 'text-gray-700 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400'
          }`}
        >
          <Grid3X3 className="h-4 w-4" />
        </Button>

        {/* Studio Navigation (immediately after Square, desktop only) */}
        <Button
          variant={isActive('/studio') ? "default" : "ghost"}
          size="sm"
          onClick={() => navigate('/studio')}
          className={`hidden md:flex ${
            isActive('/studio') 
              ? 'bg-purple-600 hover:bg-purple-700 text-white' 
              : 'text-gray-700 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400'
          }`}
          aria-label="Studio"
        >
          <Video className="h-4 w-4" />
        </Button>

        {/* Messages Dropdown */}
        <MessagesDropdown />

        {/* Notifications */}
        <NotificationDropdown />
      </div>

      <CreatePostModal 
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
      />
    </>
  );
};
