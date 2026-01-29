import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { uploadFile } from '@/utils/mediaUtils';

interface CreateEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateEventModal = ({ open, onOpenChange }: CreateEventModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventBanner, setEventBanner] = useState<File | null>(null);
  const [eventBannerUrl, setEventBannerUrl] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  const handleEventBannerSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setEventBanner(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setEventBannerUrl(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setEventBannerUrl('');
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!title.trim()) {
      toast({ description: 'Event title is required', variant: 'destructive' });
      return;
    }
    setIsPosting(true);
    try {
      let bannerUrl = '';
      if (eventBanner) {
        bannerUrl = await uploadFile(eventBanner, 'event-banners', '', user.id);
      }
      const postData: any = {
        user_id: user.id,
        post_type: 'event',
        title: title.trim(),
        event_date: eventDate || null,
        event_location: eventLocation || null,
        event_banner: bannerUrl || null,
        event_description: eventDescription || null,
      };
      const { error: postError } = await supabase.from('posts').insert(postData);
      if (postError) throw postError;
      toast({ description: 'Event created successfully!' });
      setTitle('');
      setEventDate('');
      setEventLocation('');
      setEventBanner(null);
      setEventBannerUrl('');
      setEventDescription('');
      onOpenChange(false);
    } catch (error: any) {
      toast({ description: error.message || 'Failed to create event', variant: 'destructive' });
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user?.user_metadata?.avatar_url} />
              <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                {user?.user_metadata?.first_name?.[0] || user?.email?.[0] || 'U'}
              </AvatarFallback>
            </Avatar>
            <span>Create Event</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            type="text"
            placeholder="Event Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="mb-2"
            disabled={isPosting}
          />
          <Input
            type="date"
            placeholder="Event Date"
            value={eventDate}
            onChange={e => setEventDate(e.target.value)}
            className="mb-2"
            disabled={isPosting}
          />
          <Input
            type="text"
            placeholder="Event Location"
            value={eventLocation}
            onChange={e => setEventLocation(e.target.value)}
            className="mb-2"
            disabled={isPosting}
          />
          <Input
            type="file"
            accept="image/*"
            onChange={handleEventBannerSelect}
            className="mb-2"
            disabled={isPosting}
          />
          {eventBannerUrl && (
            <img src={eventBannerUrl} alt="Event Banner Preview" className="w-full h-32 object-cover rounded mb-2" />
          )}
          <Textarea
            placeholder="Event Description"
            value={eventDescription}
            onChange={e => setEventDescription(e.target.value)}
            className="mb-2"
            disabled={isPosting}
          />
          <Button onClick={handleSubmit} className="w-full bg-gradient-to-r from-purple-600 to-pink-600" disabled={isPosting}>
            {isPosting ? 'Creating...' : 'Create Event'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
