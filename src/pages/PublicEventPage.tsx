import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { Header } from '@/components/Header';
import { Card } from '@/components/ui/card';
import { EventCard } from '@/components/EventCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Database } from '@/integrations/supabase/types';

type EventPost = Pick<
  Database['public']['Tables']['posts']['Row'],
  | 'id'
  | 'user_id'
  | 'content'
  | 'event_slug'
  | 'event_date'
  | 'event_location'
  | 'event_banner'
  | 'event_logo'
  | 'event_description'
  | 'event_organizer_phone'
  | 'event_organizer_website'
  | 'event_registration_fields'
>;

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const PublicEventPage = () => {
  const { eventSlug = '' } = useParams();
  const { user } = useAuth();
  const [event, setEvent] = useState<EventPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;
    const loadEvent = async () => {
      setLoading(true);
      setErrorMessage('');
      try {
        const request = supabase
          .from('posts')
          .select('id, user_id, content, event_slug, event_date, event_location, event_banner, event_logo, event_description, event_organizer_phone, event_organizer_website, event_registration_fields')
          .eq('post_type', 'event')
          .eq('privacy', 'public');
        const { data, error } = isUuid(eventSlug)
          ? await request.eq('id', eventSlug).maybeSingle()
          : await request.eq('event_slug', eventSlug).maybeSingle();
        if (error) throw error;

        if (active) {
          if (data) {
            setEvent(data);
          } else {
            setEvent(null);
            setErrorMessage("This event isn't public or could not be found.");
          }
        }
      } catch (error) {
        console.error('Failed to load public event:', error);
        if (active) {
          setEvent(null);
          setErrorMessage('Could not load this event. Please try again later.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadEvent();
    return () => {
      active = false;
    };
  }, [eventSlug]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a]">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8">
        {loading ? (
          <Card className="p-8 text-center text-muted-foreground">Loading event...</Card>
        ) : event ? (
          <EventCard
            postId={event.id}
            title={event.content || 'Untitled event'}
            eventDate={event.event_date || ''}
            eventLocation={event.event_location || ''}
            bannerUrl={event.event_banner}
            eventLogoUrl={event.event_logo}
            description={event.event_description}
            organizerPhone={event.event_organizer_phone || ''}
            organizerWebsite={event.event_organizer_website || ''}
            registrationFields={Array.isArray(event.event_registration_fields)
              ? event.event_registration_fields.filter((field): field is string => typeof field === 'string')
              : []}
            eventUrl={`${window.location.origin}/event/${event.event_slug || event.id}`}
            isAuthor={Boolean(user && user.id === event.user_id)}
          />
        ) : (
          <Card className="p-8 text-center">
            <CalendarDays className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h1 className="text-xl font-semibold">Event unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {errorMessage || "This event isn't public or could not be found."}
            </p>
          </Card>
        )}
      </main>
    </div>
  );
};

export default PublicEventPage;
