 import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Header } from '@/components/Header';
import { EventsSidebar } from '@/components/EventsSidebar';
import { MobileOffcanvas } from '@/components/MobileOffcanvas';
import { useAuth } from '@/hooks/useAuth';
import { uploadFile, getMediaUrl } from '@/utils/mediaUtils';
import { Download } from 'lucide-react';
import {
  downloadEventRegistrationsCsv,
  type EventRegistrationExportRow,
} from '@/lib/eventRegistrationCsv';

interface EventRegistration extends EventRegistrationExportRow {
  id: string;
  post_id: string;
  user_id: string | null;
}

const getStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const getAnswers = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((answer) => typeof answer === 'string' ? answer : '') : [];

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return 'Failed to update event.';
};

const EventSettingsPage = () => {
  const { eventId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [events, setEvents] = useState<any[]>([]);
  const [attendeesMap, setAttendeesMap] = useState<Record<string, EventRegistration[]>>({});
  const [viewsMap, setViewsMap] = useState<{[key: string]: number}>({});
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [inviteUser, setInviteUser] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [showMobileOffcanvas, setShowMobileOffcanvas] = useState(false);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [eventLogoFile, setEventLogoFile] = useState<File | null>(null);
  const [eventLogoPreview, setEventLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.id) {
      fetchOwnerEvents();
    }
  }, [user]);

  const fetchOwnerEvents = async () => {
    if (!user || !user.id) return;
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', user.id)
      .eq('post_type', 'event')
      .order('created_at', { ascending: false });
    if (data) {
      setEvents(data);
      // Fetch analytics for all events
      data.forEach(ev => {
        fetchAttendees(ev.id);
        fetchViews(ev.id);
      });
    }
    if (error) toast({ description: error.message, variant: 'destructive' });
  };

  const fetchAttendees = async (eventId: string) => {
    const { data, error } = await supabase
      .from('event_registrations')
      .select('*')
      .eq('post_id', eventId)
      .order('created_at', { ascending: false });
    if (error) {
      toast({ description: error.message, variant: 'destructive' });
      setAttendeesMap(prev => ({ ...prev, [eventId]: [] }));
      return;
    }
    setAttendeesMap(prev => ({ ...prev, [eventId]: data || [] }));
  };

  const fetchViews = async (eventId: string) => {
    const { count } = await supabase
      .from('event_views')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId);
    setViewsMap(prev => ({ ...prev, [eventId]: count || 0 }));
  };

  const handleEdit = (ev: any) => {
    setEditEventId(ev.id);
    setEditForm({
      title: ev.title || ev.content || '',
      date: ev.date || ev.event_date || '',
      location: ev.location || ev.event_location || '',
      event_banner: ev.event_banner || '',
      event_logo: ev.event_logo || '',
      event_organizer_website: ev.event_organizer_website || '',
      description: ev.description || ev.event_description || ''
    });
  };
  const handleCancel = () => {
    setEditEventId(null);
    setEditForm({});
    setBannerFile(null);
    setBannerPreview(null);
    setEventLogoFile(null);
    setEventLogoPreview(null);
  };
  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };
  const handleBannerFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBannerFile(file);
      setBannerPreview(URL.createObjectURL(file));
    }
  };
  const handleEventLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEventLogoFile(file);
      setEventLogoPreview(URL.createObjectURL(file));
    }
  };
  const handleSave = async (id: string) => {
    if (!user) {
      toast({ description: 'You must be signed in to edit this event.', variant: 'destructive' });
      return;
    }

    try {
      let eventBannerUrl = editForm.event_banner;
      let eventLogoUrl = editForm.event_logo;
      if (bannerFile) {
        eventBannerUrl = await uploadFile(bannerFile, 'event-banners', '', user.id);
      }
      if (eventLogoFile) {
        eventLogoUrl = await uploadFile(eventLogoFile, 'event-banners', 'logos/', user.id);
      }

      const { error } = await supabase
        .from('posts')
        .update({
          content: editForm.title,
          event_description: editForm.description,
          event_date: editForm.date,
          event_location: editForm.location,
          event_banner: eventBannerUrl,
          event_logo: eventLogoUrl,
          event_organizer_website: editForm.event_organizer_website.trim() || null
        })
        .eq('id', id)
        .eq('post_type', 'event');
      if (error) throw error;

      toast({ description: 'Event updated!' });
      setEditEventId(null);
      setEditForm({});
      setBannerFile(null);
      setBannerPreview(null);
      setEventLogoFile(null);
      setEventLogoPreview(null);
      fetchOwnerEvents();
      await queryClient.invalidateQueries({ queryKey: ['posts'], refetchType: 'all' });
      window.dispatchEvent(new Event('event-post-updated'));
    } catch (error) {
      console.error('Error updating event:', error);
      toast({
        description: getErrorMessage(error),
        variant: 'destructive'
      });
    }
  };
  const handleInvite = async () => {
    setIsInviting(true);
    setTimeout(() => {
      toast({ description: `Invite sent to ${inviteUser}` });
      setInviteUser('');
      setIsInviting(false);
    }, 1000);
  };
  const handleCopyLink = (id: string) => {
    const event = events.find((item) => item.id === id);
    navigator.clipboard.writeText(`${window.location.origin}/event/${event?.event_slug || id}`);
    toast({ description: 'Event link copied!' });
  };

  if (!user) {
    return <div className="min-h-screen bg-background"><Header /><div className="container mx-auto pt-10 text-center text-muted-foreground">Please log in to view your events.</div></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto flex flex-col md:flex-row gap-6 pt-6">
        {/* Sidebar for desktop */}
        <aside className="hidden md:block w-80 flex-shrink-0">
          <EventsSidebar />
        </aside>
        {/* Main content */}
        <main className="flex-1">
          <div className="max-w-3xl mx-auto p-4">
            <h2 className="text-2xl font-bold mb-4">Your Events</h2>
            {events.length === 0 && (
              <div className="text-muted-foreground">You have not created any events yet.</div>
            )}
            <div className="space-y-8">
              {events.map(ev => {
                const registrations = attendeesMap[ev.id] || [];
                const questions = getStringArray(ev.event_registration_fields);
                return (
                <div key={ev.id} className="bg-card rounded-lg p-4 shadow mb-6">
                  {/* Event Banner */}
                  {ev.event_banner && (
                    <img src={ev.event_banner} alt="Event Banner" className="w-full h-40 object-cover rounded mb-4 border border-purple-200 dark:border-purple-700" />
                  )}
                  <div className="flex items-center gap-4 mb-4">
                    {/* Remove duplicate small banner here */}
                    <div>
                      <h3 className="text-xl font-semibold">{ev.title || ev.content}</h3>
                      <div className="text-muted-foreground">{ev.date || ev.event_date} • {ev.location || ev.event_location}</div>
                    </div>
                  </div>
                  <div className="mb-2 text-base text-foreground/80">{ev.description || ev.event_description}</div>
                  {/* Analytics */}
                  <div className="flex gap-6 mb-4">
                    <div className="flex flex-col items-center">
                      <span className="text-lg font-bold text-purple-600 dark:text-purple-400">{attendeesMap[ev.id]?.length ?? 0}</span>
                      <span className="text-xs text-muted-foreground">Attendees</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-lg font-bold text-pink-600 dark:text-pink-400">{viewsMap[ev.id] ?? 0}</span>
                      <span className="text-xs text-muted-foreground">Views</span>
                    </div>
                  </div>
                  {/* Invite/Share */}
                  <div className="flex flex-col md:flex-row gap-2 mb-4">
                    <Button size="sm" onClick={() => handleCopyLink(ev.id)} className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">Copy Link</Button>
                    <Input
                      placeholder="Invite by username/email"
                      value={inviteUser}
                      onChange={e => setInviteUser(e.target.value)}
                      className="w-48"
                    />
                    <Button size="sm" onClick={handleInvite} disabled={!inviteUser || isInviting} className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                      {isInviting ? 'Inviting...' : 'Invite'}
                    </Button>
                  </div>
                  {/* Attendees List */}
                  <div className="mb-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h4 className="font-semibold">Registrations ({registrations.length})</h4>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={registrations.length === 0}
                        onClick={() => downloadEventRegistrationsCsv(ev.content || 'event', ev.id, questions, registrations)}
                      >
                        <Download className="mr-1 h-4 w-4" />
                        Download CSV
                      </Button>
                    </div>
                    {registrations.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No one has registered for this event yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {registrations.map((registration) => (
                          <article key={registration.id} className="rounded-md bg-muted/50 p-3 text-sm">
                            <p className="font-medium">
                              {registration.full_name}{' '}
                              <span className="font-normal text-muted-foreground">
                                {registration.username ? `(@${registration.username})` : '(Guest registration)'}
                              </span>
                            </p>
                            <p className="text-muted-foreground">{registration.email}{registration.phone ? ` · ${registration.phone}` : ''}</p>
                            {questions.map((question, index) => (
                              <p key={`${registration.id}-${index}`} className="mt-1">
                                <span className="font-medium">{question}:</span> {getAnswers(registration.custom_answers)[index] || '—'}
                              </p>
                            ))}
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Edit Event */}
                  {editEventId === ev.id ? (
                    <div className="space-y-2">
                      {/* Banner preview and upload */}
                      <div>
                        {bannerPreview ? (
                          <img src={bannerPreview} alt="Banner Preview" className="w-48 h-24 object-cover rounded mb-2" />
                        ) : ev.event_banner ? (
                          <img src={ev.event_banner} alt="Current Banner" className="w-48 h-24 object-cover rounded mb-2" />
                        ) : null}
                        <input type="file" accept="image/*" onChange={handleBannerFileChange} />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-medium" htmlFor={`event-logo-${ev.id}`}>Event logo</label>
                        {eventLogoPreview ? (
                          <img src={eventLogoPreview} alt="Event logo preview" className="h-20 w-20 rounded-lg border bg-white object-contain p-1" />
                        ) : editForm.event_logo ? (
                          <img src={editForm.event_logo} alt="Current event logo" className="h-20 w-20 rounded-lg border bg-white object-contain p-1" />
                        ) : null}
                        <Input
                          id={`event-logo-${ev.id}`}
                          type="file"
                          accept="image/*"
                          onChange={handleEventLogoFileChange}
                        />
                      </div>
                      <Input name="title" value={editForm.title} onChange={handleEditChange} placeholder="Title" />
                      <Input name="date" value={editForm.date} onChange={handleEditChange} placeholder="Date" />
                      <Input name="location" value={editForm.location} onChange={handleEditChange} placeholder="Location" />
                      <Input
                        name="event_organizer_website"
                        type="url"
                        value={editForm.event_organizer_website}
                        onChange={handleEditChange}
                        placeholder="Organizer website (https://...)"
                      />
                      <textarea name="description" value={editForm.description} onChange={handleEditChange} placeholder="Description" className="w-full border rounded p-2" />
                      <div className="flex gap-2">
                        <Button onClick={() => handleSave(ev.id)} className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">Save</Button>
                        <Button variant="ghost" onClick={handleCancel}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <Button onClick={() => handleEdit(ev)} className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">Edit Event</Button>
                  )}
                </div>
                );
              })}
            </div>
          </div>
        </main>
      </div>
      {/* Mobile Offcanvas for mobile nav */}
      <MobileOffcanvas open={showMobileOffcanvas} onOpenChange={setShowMobileOffcanvas} />
    </div>
  );
};

export default EventSettingsPage;
