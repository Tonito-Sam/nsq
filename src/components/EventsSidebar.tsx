import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { EventCard } from './EventCard';
import { SidebarEventAnalytics } from './SidebarEventAnalytics';
import { SmoothTransition } from './SmoothTransition';
import { useState, useEffect } from 'react';

interface Event {
  id: string;
  content: string;
  event_date: string;
  event_location: string;
  event_banner?: string;
  event_description?: string;
  user: {
    first_name?: string;
    last_name?: string;
    username?: string;
    id?: string;
  };
  user_id?: string;
  responses_count?: number;
}

export const EventsSidebar = () => {
  const { user } = useAuth();
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);

  useEffect(() => {
    fetchUpcomingEvents();
  }, [user]);

  const fetchUpcomingEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id,
          content,
          event_date,
          event_location,
          event_banner,
          event_description,
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
      setUpcomingEvents(data || []);
    } catch (error) {
      console.error('Error fetching upcoming events:', error);
    }
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
      <Card className="dark:bg-[#161616] border-gray-200 dark:border-gray-700">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              Upcoming Events
            </h3>
            <Button variant="ghost" size="sm">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="text-center py-6 text-gray-500">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No upcoming events</p>
          </div>
        </div>
      </Card>
    );
  }

  // Slider/loop for all upcoming events
  const eventToShow = filteredEvents[currentEventIndex] || filteredEvents[0];

  return (
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
            <Button variant="ghost" size="sm">
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
                  title={eventToShow.content}
                  eventDate={eventToShow.event_date}
                  eventLocation={eventToShow.event_location}
                  bannerUrl={eventToShow.event_banner}
                  description={eventToShow.event_description}
                  onResponseUpdate={handleResponseUpdate}
                  isAuthor={!!(user && (eventToShow.user_id === user.id || eventToShow.user?.id === user.id))}
                  eventUrl={`${window.location.origin}/events/settings/${eventToShow.id}`}
                />
                <SidebarEventAnalytics eventId={eventToShow.id} />
              </>
            </SmoothTransition>
          )}
        </div>
      </div>
    </Card>
  );
};
