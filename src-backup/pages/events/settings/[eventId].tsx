 import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Header } from '@/components/Header';
import { EventsSidebar } from '@/components/EventsSidebar';
import { MobileOffcanvas } from '@/components/MobileOffcanvas';
import { useAuth } from '@/hooks/useAuth';
import { uploadFile, getMediaUrl } from '@/utils/mediaUtils';

const EventSettingsPage = () => {
  const { eventId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState<any[]>([]);
  const [attendeesMap, setAttendeesMap] = useState<{[key: string]: any[]}>({});
  const [viewsMap, setViewsMap] = useState<{[key: string]: number}>({});
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [inviteUser, setInviteUser] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [showMobileOffcanvas, setShowMobileOffcanvas] = useState(false);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

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
    const { data } = await supabase
      .from('event_attendees')
      .select('user_id, users (username, first_name, last_name, avatar_url)')
      .eq('event_id', eventId);
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
      description: ev.description || ev.event_description || ''
    });
  };
  const handleCancel = () => {
    setEditEventId(null);
    setEditForm({});
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
  const handleSave = async (id: string) => {
    let eventBannerUrl = editForm.event_banner;
    if (bannerFile) {
      eventBannerUrl = await uploadFile(bannerFile, 'posts', 'event-banners/', user.id);
    }
    const { error } = await supabase
      .from('posts')
      .update({
        title: editForm.title,
        content: editForm.title,
        description: editForm.description,
        event_description: editForm.description,
        date: editForm.date,
        event_date: editForm.date,
        location: editForm.location,
        event_location: editForm.location,
        event_banner: eventBannerUrl
      })
      .eq('id', id)
      .eq('post_type', 'event');
    if (error) {
      toast({ description: error.message, variant: 'destructive' });
    } else {
      toast({ description: 'Event updated!' });
      setEditEventId(null);
      setEditForm({});
      setBannerFile(null);
      setBannerPreview(null);
      fetchOwnerEvents();
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
    navigator.clipboard.writeText(`${window.location.origin}/events/settings/${id}`);
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
              {events.map(ev => (
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
                    <h4 className="font-semibold mb-2">Attendees</h4>
                    <div className="flex flex-wrap gap-2">
                      {(attendeesMap[ev.id] || []).map(a => (
                        <div key={a.user_id} className="flex items-center gap-2 bg-muted rounded px-2 py-1">
                          <Avatar className="w-6 h-6">
                            <AvatarImage src={a.users?.avatar_url} />
                            <AvatarFallback>{a.users?.first_name?.[0] || a.users?.username?.[0] || 'U'}</AvatarFallback>
                          </Avatar>
                          <span>{a.users?.first_name || ''} {a.users?.last_name || ''} (@{a.users?.username})</span>
                        </div>
                      ))}
                    </div>
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
                      <Input name="title" value={editForm.title} onChange={handleEditChange} placeholder="Title" />
                      <Input name="date" value={editForm.date} onChange={handleEditChange} placeholder="Date" />
                      <Input name="location" value={editForm.location} onChange={handleEditChange} placeholder="Location" />
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
              ))}
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
