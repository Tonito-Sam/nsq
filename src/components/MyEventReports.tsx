import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import {
  downloadEventRegistrationsCsv,
  type EventRegistrationExportRow,
} from '@/lib/eventRegistrationCsv';

interface EventReport {
  id: string;
  content: string | null;
  event_date: string | null;
  event_location: string | null;
  event_registration_fields: unknown;
}

interface EventRegistration extends EventRegistrationExportRow {
  id: string;
  post_id: string;
  user_id: string | null;
}

const getStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

interface MyEventReportsProps {
  userId: string;
}

const MyEventReports = ({ userId }: MyEventReportsProps) => {
  const [events, setEvents] = useState<EventReport[]>([]);
  const [registrationsByEvent, setRegistrationsByEvent] = useState<Record<string, EventRegistration[]>>({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;

    const loadReports = async () => {
      setLoading(true);
      setErrorMessage('');
      try {
        const { data: eventRows, error: eventError } = await supabase
          .from('posts')
          .select('id, content, event_date, event_location, event_registration_fields')
          .eq('user_id', userId)
          .eq('post_type', 'event')
          .gte('event_date', new Date().toISOString())
          .order('event_date', { ascending: true });
        if (eventError) throw eventError;

        const upcomingEvents: EventReport[] = eventRows || [];
        const eventIds = upcomingEvents.map((event) => event.id);
        let grouped: Record<string, EventRegistration[]> = {};

        if (eventIds.length > 0) {
          const { data: registrations, error: registrationError } = await supabase
            .from('event_registrations')
            .select('*')
            .in('post_id', eventIds)
            .order('created_at', { ascending: false });
          if (registrationError) throw registrationError;

          grouped = (registrations || []).reduce<Record<string, EventRegistration[]>>((result, registration) => {
            const eventRegistrations = result[registration.post_id] || [];
            eventRegistrations.push(registration);
            result[registration.post_id] = eventRegistrations;
            return result;
          }, {});
        }

        if (active) {
          setEvents(upcomingEvents);
          setRegistrationsByEvent(grouped);
        }
      } catch (error) {
        console.error('Failed to load upcoming event reports:', error);
        if (active) setErrorMessage('Could not load event registrations. Please try again later.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadReports();
    return () => {
      active = false;
    };
  }, [userId]);

  return (
    <Card className="border-gray-200 p-4 shadow-sm dark:border-gray-800 dark:bg-[#161616]">
      <div className="mb-3 flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
        <h3 className="font-semibold">Upcoming event reports</h3>
      </div>
      {loading ? (
        <p className="py-2 text-sm text-muted-foreground">Loading event registrations...</p>
      ) : errorMessage ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{errorMessage}</p>
      ) : events.length === 0 ? (
        <p className="rounded-md bg-gray-50 px-3 py-3 text-sm text-gray-500 dark:bg-gray-900/50 dark:text-gray-400">
          You have no upcoming events.
        </p>
      ) : (
        <div className="space-y-4">
          {events.map((event) => {
            const registrations = registrationsByEvent[event.id] || [];
            const questions = getStringArray(event.event_registration_fields);
            return (
              <section key={event.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0 dark:border-gray-800">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="truncate font-medium">{event.content || 'Untitled event'}</h4>
                    <p className="text-xs text-muted-foreground">
                      {event.event_date ? new Date(event.event_date).toLocaleString() : 'Date not set'}
                      {event.event_location ? ` · ${event.event_location}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                    {registrations.length} registered
                  </span>
                </div>

                {registrations.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {registrations.slice(0, 4).map((registration) => (
                      <li key={registration.id} className="truncate text-sm text-gray-700 dark:text-gray-300">
                        <span className="font-medium">{registration.full_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {registration.username ? ` · @${registration.username}` : ' · Guest registration'}
                        </span>
                      </li>
                    ))}
                    {registrations.length > 4 && (
                      <li className="text-xs text-muted-foreground">and {registrations.length - 4} more</li>
                    )}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">No one has registered yet.</p>
                )}

                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={registrations.length === 0}
                    onClick={() => downloadEventRegistrationsCsv(event.content || 'event', event.id, questions, registrations)}
                  >
                    <Download className="mr-1 h-4 w-4" />
                    Download CSV
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <Link to={`/events/settings/${event.id}`}>Manage</Link>
                  </Button>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </Card>
  );
};

export default MyEventReports;
