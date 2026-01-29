import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Calendar, MapPin, Users, Plus, Search } from 'lucide-react';
import { EventCard } from '@/components/EventCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { CreateEventModal } from '@/components/CreateEventModal';

const Events = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [myEvents, setMyEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      // Fetch all posts of type 'event'
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('post_type', 'event')
        .order('event_date', { ascending: true });
      if (!error && data) {
        // Patch: If title is missing, use content as fallback
        const patched = data.map((e: any) => ({
          ...e,
          title: e.title || e.content || 'Untitled Event',
        }));
        setEvents(patched);
        if (user) {
          setMyEvents(patched.filter((e: any) => e.user_id === user.id));
        }
      }
      setLoading(false);
    };
    fetchEvents();
  }, [user, modalOpen]);

  const filteredEvents = events.filter(e =>
    !search ||
    e.title?.toLowerCase().includes(search.toLowerCase()) ||
    e.event_location?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a]">
      <Header />
      <div className="max-w-7xl mx-auto px-4 py-6 pb-32 lg:pb-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Events</h1>
            <p className="text-gray-600 dark:text-gray-400">Discover and join events in your area</p>
          </div>
          <Button className="bg-gradient-to-r from-purple-600 to-pink-600" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Event
          </Button>
        </div>

        {/* Search and Filter */}
        <Card className="dark:bg-[#161616] p-4 mb-6">
          <div className="flex space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="Search events..." 
                className="pl-10"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline">
              <Calendar className="h-4 w-4 mr-2" />
              Date
            </Button>
            <Button variant="outline">
              <MapPin className="h-4 w-4 mr-2" />
              Location
            </Button>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Events List */}
          <div className="lg:col-span-2">
            <h2 className="text-xl font-semibold mb-4">Upcoming Events</h2>
            <div className="space-y-4">
              {loading ? (
                <div className="text-center text-gray-500 dark:text-gray-400 py-12">Loading events...</div>
              ) : filteredEvents.length === 0 ? (
                <Card className="p-8 text-center dark:bg-[#161616]">
                  <p className="text-gray-500 dark:text-gray-400">No events found</p>
                </Card>
              ) : (
                filteredEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    postId={event.id}
                    title={event.title}
                    eventDate={event.event_date}
                    eventLocation={event.event_location}
                    bannerUrl={event.banner_url}
                    description={event.description}
                    eventUrl={window.location.origin + '/events/' + event.id}
                    isAuthor={!!(user && event.user_id === user.id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div>
            {/* My Events */}
            <Card className="dark:bg-[#161616] mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-500" />
                  My Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {myEvents.length === 0 ? (
                    <div className="text-gray-500 text-sm">You are not hosting any events yet.</div>
                  ) : (
                    myEvents.map((event) => (
                      <div key={event.id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <h4 className="font-medium text-sm">{event.title}</h4>
                        <div className="flex items-center text-xs text-gray-500 mt-1">
                          <Calendar className="h-3 w-3 mr-1" />
                          {event.event_date ? new Date(event.event_date).toLocaleDateString() : ''}
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <Badge variant="outline" className="text-xs">Host</Badge>
                          {/* You can add attendee count if available */}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card className="dark:bg-[#161616]">
              <CardHeader>
                <CardTitle>Event Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {events.length}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Events This Month
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {events.filter(e => e.attending).length}
                      </div>
                      <div className="text-xs text-gray-500">
                        Attending
                      </div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {myEvents.length}
                      </div>
                      <div className="text-xs text-gray-500">
                        Hosting
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <CreateEventModal open={modalOpen} onOpenChange={setModalOpen} />
      <MobileBottomNav />
    </div>
  );
};

export default Events;
