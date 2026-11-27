import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { EventCard } from './EventCard';
import { SmoothTransition } from './SmoothTransition';
import { CreatePostModal } from './CreatePostModal';
import { useState, useEffect } from 'react';
import type { Json } from '@/integrations/supabase/types';

interface Event {
  id: string;
  content: string | null;
  event_slug: string | null;
  event_date: string | null;
  event_location: string | null;
  event_banner?: string | null;
  event_logo?: string | null;
  event_description?: string | null;
  event_organizer_phone?: string | null;
  event_organizer_website?: string | null;
  event_registration_fields?: Json | null;
  user: {
    first_name?: string;
    last_name?: string;
    username?: string;
    id?: string;
  };
  user_id?: string | null;
  responses_count?: number;
}

export const EventsSidebar = () => {
  const { user } = useAuth();
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [createPostOpen, setCreatePostOpen] = useState(false);

  useEffect(() => {
    const handleEventUpdated = () => {
      void fetchUpcomingEvents();
    };

    void fetchUpcomingEvents();
    window.addEventListener('event-post-updated', handleEventUpdated);
    return () => window.removeEventListener('event-post-updated', handleEventUpdated);
  }, [user]);

  const fetchUpcomingEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id,
          content,
          event_slug,
          event_date,
          event_location,
          event_banner,
          event_logo,
          event_description,
          event_registration_fields,
          event_organizer_phone,
          event_organizer_website,
          user:users!posts_user_id_fkey(
            first_name,
            last_name,
            username,
            id
          ),
          user_id
        `)
        .eq('post_type', 'event')
        .gte('event_date', new Date().toISOString())
        .order('event_date', { ascending: true })
        .limit(10);

      if (error) throw error;
      setUpcomingEvents((data || []).map((event) => ({
        ...event,
        user: event.user?.[0] || {},
      })));
    } catch (error) {
      console.error('Error fetching upcoming events:', error);
    }
  };

  const handleCreatePostOpenChange = (open: boolean) => {
    setCreatePostOpen(open);
    if (!open) void fetchUpcomingEvents();
  };

  const handleResponseUpdate = () => {
    fetchUpcomingEvents();
  };

  const nextEvent = () => {
    setCurrentEventIndex((prev) => 
      prev >= upcomingEvents.length - 1 ? 0 : prev + 1
    );
  };

  const prevEvent = () => {
    setCurrentEventIndex((prev) => 
      prev <= 0 ? upcomingEvents.length - 1 : prev - 1
    );
  };

  // Only include events with event_date today or in the future
  const now = new Date();
  const filteredEvents = upcomingEvents.filter(event => {
    if (!event.event_date) return false;
    return new Date(event.event_date) >= now;
  });

  // Autoplay: advance event every 15 seconds
  useEffect(() => {
    if (filteredEvents.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentEventIndex(prev => (prev >= filteredEvents.length - 1 ? 0 : prev + 1));
    }, 15000); // 15 seconds
    return () => clearInterval(interval);
  }, [filteredEvents.length]);

  if (filteredEvents.length === 0) {
    return (
      <>
        <Card className="dark:bg-[#161616] border-gray-200 dark:border-gray-700">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                Upcoming Events
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCreatePostOpen(true)}
                title="Create an event post"
                aria-label="Create an event post"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-center py-6 text-gray-500">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No upcoming events</p>
            </div>
          </div>
        </Card>
        <CreatePostModal
          open={createPostOpen}
          onOpenChange={handleCreatePostOpenChange}
          initialPostType="event"
        />
      </>
    );
  }

  // Slider/loop for all upcoming events
  const eventToShow = filteredEvents[currentEventIndex] || filteredEvents[0];

  return (
    <>
      <Card className="dark:bg-[#161616] border-gray-200 dark:border-gray-700">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              Upcoming Events
            </h3>
            <div className="flex items-center gap-2">
              {filteredEvents.length > 1 && (
                <>
                  <Button variant="ghost" size="sm" onClick={prevEvent}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-gray-500">
                    {currentEventIndex + 1}/{filteredEvents.length}
                  </span>
                  <Button variant="ghost" size="sm" onClick={nextEvent}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCreatePostOpen(true)}
                title="Create an event post"
                aria-label="Create an event post"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-3">
            {eventToShow && (
              <SmoothTransition triggerKey={eventToShow.id}>
                <>
                  <EventCard
                    key={eventToShow.id}
                    postId={eventToShow.id}
                    title={eventToShow.content || ''}
                    eventDate={eventToShow.event_date || ''}
                    eventLocation={eventToShow.event_location || ''}
                    bannerUrl={eventToShow.event_banner}
                    eventLogoUrl={eventToShow.event_logo}
                    description={eventToShow.event_description}
                    organizerPhone={eventToShow.event_organizer_phone || ''}
                    organizerWebsite={eventToShow.event_organizer_website || ''}
                    registrationFields={Array.isArray(eventToShow.event_registration_fields)
                      ? eventToShow.event_registration_fields.filter((field): field is string => typeof field === 'string')
                      : []}
                    onResponseUpdate={handleResponseUpdate}
                    isAuthor={!!(user && (eventToShow.user_id === user.id || eventToShow.user?.id === user.id))}
                    eventUrl={`${window.location.origin}/event/${eventToShow.event_slug || eventToShow.id}`}
                    compact
                  />
                </>
              </SmoothTransition>
            )}
          </div>
        </div>
      </Card>
      <CreatePostModal
        open={createPostOpen}
        onOpenChange={handleCreatePostOpenChange}
        initialPostType="event"
      />
    </>
  );
};
