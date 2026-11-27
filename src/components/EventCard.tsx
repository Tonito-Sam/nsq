import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Check, CircleHelp, Download, MapPin, Phone, Share2, Ticket, UserPlus, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ShareWithFriendModal } from '@/components/ShareWithFriendModal';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  clearPendingGuestEventSignup,
  getGuestEventTicketReference,
  saveGuestEventTicketReference,
  savePendingGuestEventSignup,
} from '@/lib/guestEventRegistration';

interface EventCardProps {
  postId: string;
  title: string;
  eventDate: string;
  eventLocation: string;
  bannerUrl?: string | null;
  eventLogoUrl?: string | null;
  description?: string | null;
  organizerPhone?: string;
  organizerWebsite?: string;
  eventUrl?: string;
  isAuthor?: boolean;
  compact?: boolean;
  location?: string;
  feeling?: string;
  registrationFields?: string[];
  onResponseUpdate?: () => void;
}

interface EventRegistrationRecord {
  id: string;
  full_name: string;
  username: string | null;
  email: string;
  phone: string | null;
  custom_answers: unknown;
  created_at: string;
}

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return 'Could not complete your registration. Please try again.';
};

const getStringAnswers = (answers: unknown): string[] =>
  Array.isArray(answers) ? answers.map((answer) => typeof answer === 'string' ? answer : '') : [];

export const EventCard: React.FC<EventCardProps> = ({
  postId,
  title,
  eventDate,
  eventLocation,
  bannerUrl,
  eventLogoUrl,
  description,
  organizerPhone,
  organizerWebsite,
  eventUrl,
  isAuthor = false,
  compact = false,
  location,
  feeling,
  registrationFields = [],
  onResponseUpdate
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [userResponse, setUserResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [responses, setResponses] = useState({
    going: 0,
    maybe: 0,
    not_going: 0
  });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);
  const [shareWithFriendOpen, setShareWithFriendOpen] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [registrationSubmitting, setRegistrationSubmitting] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [registrationRecord, setRegistrationRecord] = useState<EventRegistrationRecord | null>(null);
  const [passOpen, setPassOpen] = useState(false);
  const [passDownloading, setPassDownloading] = useState(false);
  const [registrationForm, setRegistrationForm] = useState({
    fullName: '',
    username: '',
    email: '',
    phone: '',
    answers: [] as string[],
  });

  const checkUserResponse = useCallback(async () => {
    if (!user || !postId) {
      setUserResponse(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('event_responses')
        .select('response')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setUserResponse(data?.response || null);
    } catch (error) {
      console.error('Error checking user response:', error);
    }
  }, [postId, user]);

  const checkUserRegistration = useCallback(async () => {
    if (!postId) {
      setIsRegistered(false);
      setRegistrationRecord(null);
      return;
    }

    try {
      let registration: EventRegistrationRecord | null = null;
      if (user) {
        const { data, error } = await supabase
          .from('event_registrations')
          .select('id, full_name, username, email, phone, custom_answers, created_at')
          .eq('post_id', postId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;
        registration = data;
      }

      if (!registration) {
        const guestReference = getGuestEventTicketReference(postId);
        if (guestReference) {
          const { data, error } = await supabase.rpc('get_guest_event_registration', {
            p_registration_id: guestReference.registrationId,
            p_email: guestReference.email,
          });
          if (error) throw error;
          registration = Array.isArray(data) ? data[0] || null : data;
          if (registration && user?.email?.toLowerCase() === registration.email.toLowerCase()) {
            const { data: claimedData, error: claimError } = await supabase.rpc('claim_guest_event_registration', {
              p_registration_id: registration.id,
            });
            if (claimError) {
              console.error('Could not link the guest registration to the signed-in account:', claimError);
            } else {
              registration = Array.isArray(claimedData) ? claimedData[0] || registration : claimedData;
              try {
                clearPendingGuestEventSignup();
              } catch (storageError) {
                console.error('Could not clear the pending guest signup details:', storageError);
              }
            }
          } else if (registration && user && user.email?.toLowerCase() !== registration.email.toLowerCase()) {
            console.info('The guest pass email does not match the signed-in account; leaving it as a guest registration.');
          }
        }
      }

      setIsRegistered(Boolean(registration));
      setRegistrationRecord(registration);
      if (registration) setUserResponse('going');
    } catch (error) {
      console.error('Error checking event registration:', error);
    }
  }, [postId, user]);

  const fetchResponses = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('event_responses')
        .select('response')
        .eq('post_id', postId);
      if (error) throw error;

      const counts = {
        going: data?.filter(r => r.response === 'going').length || 0,
        maybe: data?.filter(r => r.response === 'maybe').length || 0,
        not_going: data?.filter(r => r.response === 'not_going').length || 0
      };

      setResponses(counts);
    } catch (error) {
      console.error('Error fetching responses:', error);
    }
  }, [postId]);

  useEffect(() => {
    void checkUserResponse();
    void checkUserRegistration();
    void fetchResponses();
  }, [checkUserResponse, checkUserRegistration, fetchResponses]);

  const saveEventResponse = async (response: string) => {
    if (!user) throw new Error('You must be signed in to respond to an event.');
    const { data: existingResponse, error: lookupError } = await supabase
      .from('event_responses')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (lookupError) throw lookupError;

    if (existingResponse) {
      const { error } = await supabase
        .from('event_responses')
        .update({ response })
        .eq('post_id', postId)
        .eq('user_id', user.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('event_responses')
        .insert({ post_id: postId, user_id: user.id, response });
      if (error) throw error;
    }
  };

  const openRegistrationForm = async () => {
    if (!user) {
      setRegistrationForm({
        fullName: '',
        username: '',
        email: '',
        phone: '',
        answers: registrationFields.map(() => ''),
      });
      setRegistrationOpen(true);
      return;
    }

    setRegistrationLoading(true);
    try {
      const [{ data: profile, error: profileError }, { data: existing, error: registrationError }] = await Promise.all([
        supabase
          .from('users')
          .select('first_name, last_name, username')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('event_registrations')
          .select('id, full_name, username, email, phone, custom_answers, created_at')
          .eq('post_id', postId)
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      if (profileError) throw profileError;
      if (registrationError) throw registrationError;

      const metadata = user.user_metadata || {};
      const answers = Array.isArray(existing?.custom_answers)
        ? existing.custom_answers.map((answer) => typeof answer === 'string' ? answer : '')
        : [];
      setRegistrationRecord(existing);
      setIsRegistered(Boolean(existing));
      if (existing) setUserResponse('going');
      setRegistrationForm({
        fullName: existing?.full_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || metadata.full_name || metadata.name || '',
        username: existing?.username || profile?.username || metadata.username || '',
        email: existing?.email || user.email || '',
        phone: existing?.phone || metadata.phone || '',
        answers: registrationFields.map((_, index) => answers[index] || ''),
      });
      setRegistrationOpen(true);
    } catch (error) {
      console.error('Error preparing event registration:', error);
      toast({
        description: 'Could not load the registration form. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setRegistrationLoading(false);
    }
  };

  const handleRegistrationSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (registrationSubmitting) return;

    setRegistrationSubmitting(true);
    try {
      let savedRegistration: EventRegistrationRecord;
      if (user) {
        const { data, error: registrationError } = await supabase
          .from('event_registrations')
          .upsert({
            post_id: postId,
            user_id: user.id,
            full_name: registrationForm.fullName.trim(),
            username: registrationForm.username.trim(),
            email: registrationForm.email.trim(),
            phone: registrationForm.phone.trim() || null,
            custom_answers: registrationForm.answers,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'post_id,user_id' })
          .select('id, full_name, username, email, phone, custom_answers, created_at')
          .single();
        if (registrationError) throw registrationError;
        savedRegistration = data;
      } else {
        const { data, error: registrationError } = await supabase.rpc('register_guest_event', {
          p_post_id: postId,
          p_full_name: registrationForm.fullName.trim(),
          p_email: registrationForm.email.trim(),
          p_phone: registrationForm.phone.trim() || null,
          p_custom_answers: registrationForm.answers,
        });
        if (registrationError) throw registrationError;
        const guestRegistration = Array.isArray(data) ? data[0] : data;
        if (!guestRegistration) throw new Error('The event registration could not be confirmed.');
        savedRegistration = guestRegistration;
        try {
          saveGuestEventTicketReference(postId, {
            registrationId: savedRegistration.id,
            email: savedRegistration.email,
          });
        } catch (storageError) {
          console.error('The guest registration was saved, but its pass could not be saved for later:', storageError);
          toast({
            description: 'You are registered. Download your PDF pass now so you can keep it.',
            variant: 'destructive',
          });
        }
      }

      setRegistrationRecord(savedRegistration);
      setIsRegistered(true);
      setUserResponse('going');
      setRegistrationOpen(false);
      setPassOpen(true);

      if (user) {
        try {
          await saveEventResponse('going');
        } catch (responseError) {
          console.error('Registration saved, but the event response could not be updated:', responseError);
          toast({
            description: 'Your registration was saved, but your attendance response could not be updated.',
            variant: 'destructive',
          });
          setPassOpen(true);
          await fetchResponses();
          return;
        }
      }

      await fetchResponses();
      toast({ description: 'You are registered for this event.' });
      onResponseUpdate?.();
    } catch (error) {
      console.error('Error submitting event registration:', error);
      toast({
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setRegistrationSubmitting(false);
    }
  };

  const handleResponse = async (response: string) => {
    if (response === 'going') {
      if (isRegistered) {
        setPassOpen(true);
        return;
      }
      await openRegistrationForm();
      return;
    }
    if (!user || loading) {
      if (!user) toast({ description: 'Please log in to respond to an event.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      if (isRegistered) {
        const { error: deleteError } = await supabase
          .from('event_registrations')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
        if (deleteError) throw deleteError;
        setIsRegistered(false);
        setRegistrationRecord(null);
      }

      await saveEventResponse(response);
      setUserResponse(response);
      await fetchResponses();
      toast({ description: 'Response updated successfully!' });
      onResponseUpdate?.();
    } catch (error) {
      console.error('Error updating response:', error);
      toast({
        description: 'Failed to update response. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string, short = false) => {
    if (!dateString) return 'Date to be announced';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-US', short
      ? { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }
      : { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const organizerWebsiteUrl = (() => {
    if (!organizerWebsite) return '';
    try {
      const candidate = /^https?:\/\//i.test(organizerWebsite)
        ? organizerWebsite
        : `https://${organizerWebsite}`;
      const parsed = new URL(candidate);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : '';
    } catch {
      return '';
    }
  })();
  const organizerPhoneHref = organizerPhone?.replace(/[^\d+]/g, '') || '';
  const [eventName, ...eventSubtitleParts] = title.split('#');
  const passEventName = eventName.trim() || title;
  const passEventSubtitle = eventSubtitleParts
    .join(' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const passQrUrl = organizerWebsiteUrl || 'https://nexsq.com';
  const passQrCaption = organizerWebsiteUrl ? 'Scan for event website' : 'Scan to visit NexSq.com';
  const passAnswers = getStringAnswers(registrationRecord?.custom_answers);
  const publicEventUrl = eventUrl || `${window.location.origin}/event/${postId}`;
  const publicEventPath = (() => {
    try {
      return new URL(publicEventUrl, window.location.origin).pathname;
    } catch {
      return `/event/${postId}`;
    }
  })();
  const prepareGuestSignup = () => {
    if (!registrationRecord || registrationRecord.username !== null) return;
    savePendingGuestEventSignup({
      registrationId: registrationRecord.id,
      email: registrationRecord.email,
      fullName: registrationRecord.full_name,
      returnTo: publicEventPath,
    });
  };
  const downloadPass = async () => {
    const passElement = document.getElementById('event-registration-pass');
    if (!passElement) {
      toast({ variant: 'destructive', description: 'Could not prepare the event pass for download.' });
      return;
    }

    setPassDownloading(true);
    let passCopy: HTMLElement | null = null;
    let exportHost: HTMLDivElement | null = null;
    try {
      const [{ toPng }, { jsPDF }] = await Promise.all([
        import('html-to-image'),
        import('jspdf'),
      ]);

      passCopy = passElement.cloneNode(true) as HTMLElement;
      passCopy.removeAttribute('id');
      exportHost = document.createElement('div');
      Object.assign(exportHost.style, {
        position: 'fixed',
        left: '-10000px',
        top: '0',
        width: '100mm',
        height: '150mm',
        overflow: 'hidden',
      });
      Object.assign(passCopy.style, {
        position: 'relative',
        left: '0',
        top: '0',
        width: '100mm',
        maxWidth: '100mm',
        height: '150mm',
        minHeight: '150mm',
        boxSizing: 'border-box',
        overflow: 'hidden',
      });
      exportHost.appendChild(passCopy);
      document.body.appendChild(exportHost);

      const imageLoadFailures = await Promise.all(
        Array.from(passCopy.querySelectorAll('img')).map((image) =>
          image.decode().then(
            () => false,
            (error: unknown) => {
              console.error('Could not load an image for the event pass PDF:', error);
              return true;
            },
          ),
        ),
      );
      if (imageLoadFailures.some(Boolean)) {
        throw new Error('An event logo could not be loaded.');
      }
      if (passCopy.scrollHeight > passCopy.clientHeight + 1) {
        throw new Error('The pass has more details than fit on a 100 × 150 mm card.');
      }

      const passImage = await toPng(passCopy, {
        backgroundColor: '#ffffff',
        cacheBust: true,
        pixelRatio: 3,
      });
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [100, 150],
        compress: true,
      });
      pdf.addImage(passImage, 'PNG', 0, 0, 100, 150);
      const filename = `${passEventName}-${registrationRecord?.full_name || 'attendee'}-pass`
        .replace(/[^a-z0-9-]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();
      pdf.save(`${filename || 'event'}-pass.pdf`);
      toast({ description: 'Your 100 × 150 mm event pass PDF has been downloaded.' });
    } catch (error) {
      console.error('Could not generate the event pass PDF:', error);
      toast({
        variant: 'destructive',
        description: error instanceof Error ? error.message : 'Could not create the event pass PDF. Please try again.',
      });
    } finally {
      exportHost?.remove();
      setPassDownloading(false);
    }
  };

  return (
    <Card className={`${compact ? 'p-4' : 'p-6'} border border-gray-200 bg-gradient-to-br from-purple-100/80 to-pink-100/80 shadow-lg dark:border-gray-700 dark:from-purple-900/40 dark:to-pink-900/40`}>
      <div className={bannerUrl && !compact ? 'grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(180px,40%)]' : ''}>
        <div className="min-w-0">
          <div className="mb-4">
            <h3 className={`mb-2 font-bold text-gray-900 dark:text-gray-100 ${compact ? 'text-lg' : 'text-2xl'}`}>{title}</h3>
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-1">
              <Calendar className="h-4 w-4 mr-2" />
              {formatDate(eventDate, compact)}
            </div>
            {!compact && (
              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                <MapPin className="mr-2 h-4 w-4" />
                {eventLocation}
                {location && <span className="ml-2 text-purple-700 dark:text-purple-300">| {location}</span>}
              </div>
            )}
            {feeling && !compact && (
              <div className="flex items-center text-sm text-pink-700 dark:text-pink-300 mt-1">
                <span className="mr-2">Feeling:</span> {feeling}
              </div>
            )}
          </div>
        </div>
        {bannerUrl && !compact && (
          <img
            src={bannerUrl}
            alt={`${title || 'Event'} poster`}
            className="h-48 w-full rounded-lg border-2 border-purple-300 bg-black/5 object-contain dark:border-purple-700 dark:bg-black/20 md:h-full md:min-h-[240px]"
          />
        )}
      </div>
      <div className={`${compact ? 'mt-4' : 'mt-4 rounded-2xl border border-purple-200 bg-white/80 p-3 shadow-sm dark:border-purple-800 dark:bg-gray-950/40'}`}>
        <div className="mb-3 flex items-center justify-between">
          <div className="font-semibold text-base text-gray-900 dark:text-gray-100">Attending?</div>
          {userResponse && (
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
              Response saved
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleResponse('going')}
            disabled={loading || registrationLoading || registrationSubmitting}
            aria-pressed={userResponse === 'going' || isRegistered}
            className={`h-10 min-w-0 rounded-xl px-2 text-xs font-semibold shadow-sm transition-colors ${userResponse === 'going' || isRegistered ? 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700' : 'border-emerald-200 bg-white text-emerald-800 hover:border-emerald-400 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-gray-900 dark:text-emerald-300 dark:hover:bg-emerald-950/40'}`}
          >
            <Check className="mr-1 h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Yes</span>
            {isAuthor && !compact && <span className="ml-1 text-[10px] opacity-80">({responses.going})</span>}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleResponse('maybe')}
            disabled={loading || registrationLoading || registrationSubmitting}
            aria-pressed={userResponse === 'maybe'}
            className={`h-10 min-w-0 rounded-xl px-2 text-xs font-semibold shadow-sm transition-colors ${userResponse === 'maybe' ? 'border-amber-500 bg-amber-500 text-white hover:bg-amber-600' : 'border-amber-200 bg-white text-amber-800 hover:border-amber-400 hover:bg-amber-50 dark:border-amber-800 dark:bg-gray-900 dark:text-amber-300 dark:hover:bg-amber-950/30'}`}
          >
            <CircleHelp className="mr-1 h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Not Sure</span>
            {isAuthor && !compact && <span className="ml-1 text-[10px] opacity-80">({responses.maybe})</span>}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleResponse('not_going')}
            disabled={loading || registrationLoading || registrationSubmitting}
            aria-pressed={userResponse === 'not_going'}
            className={`h-10 min-w-0 rounded-xl px-2 text-xs font-semibold shadow-sm transition-colors ${userResponse === 'not_going' ? 'border-slate-600 bg-slate-600 text-white hover:bg-slate-700' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-gray-900 dark:text-slate-300 dark:hover:bg-slate-800'}`}
          >
            <X className="mr-1 h-3.5 w-3.5 shrink-0" />
            <span className="truncate">No</span>
            {isAuthor && !compact && <span className="ml-1 text-[10px] opacity-80">({responses.not_going})</span>}
          </Button>
        </div>
        {userResponse === 'going' && (
          <Button
            type="button"
            onClick={() => handleResponse('going')}
            disabled={loading || registrationLoading || registrationSubmitting}
            className="mt-3 h-10 w-full rounded-xl bg-gradient-to-r from-purple-700 to-fuchsia-600 font-semibold text-white shadow-sm hover:from-purple-800 hover:to-fuchsia-700"
          >
            <Ticket className="mr-2 h-4 w-4" />
            {isRegistered ? 'Get ticket' : 'Complete registration to get ticket'}
          </Button>
        )}
      </div>
      {description && !compact && (
        <div className="mb-4 mt-4 rounded border border-purple-200 bg-purple-50/60 p-3 text-base text-purple-900 shadow-sm dark:border-purple-800 dark:bg-purple-900/30 dark:text-purple-100">
          {description}
        </div>
      )}
      {!compact && (
        <div className="mb-4 mt-4 flex flex-wrap gap-2">
          {eventUrl && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-full border-purple-200 bg-white/80 px-4 font-medium text-purple-800 shadow-sm hover:bg-purple-50 dark:border-purple-800 dark:bg-gray-900 dark:text-purple-300 dark:hover:bg-purple-950/40"
              onClick={async () => {
                await navigator.clipboard.writeText(eventUrl);
                toast({ description: 'Event link copied!' });
              }}
            >
              <Share2 className="mr-2 h-4 w-4" />
              Share Event
            </Button>
          )}
          {eventUrl && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-full border-purple-200 bg-white/80 px-4 font-medium text-purple-800 shadow-sm hover:bg-purple-50 dark:border-purple-800 dark:bg-gray-900 dark:text-purple-300 dark:hover:bg-purple-950/40"
              onClick={() => setInviteOpen(true)}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Invite
            </Button>
          )}
        </div>
      )}
      {/* Invite Modal */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogTitle>Invite to Event</DialogTitle>
          <div className="mb-4">
            <p className="mb-2">Share this link to invite others:</p>
            <div className="flex gap-2 items-center mb-4">
              <Input value={eventUrl || ''} readOnly className="flex-1" />
              <Button
                size="sm"
                onClick={async () => {
                  if (eventUrl) {
                    await navigator.clipboard.writeText(eventUrl);
                    setInviteLinkCopied(true);
                    setTimeout(() => setInviteLinkCopied(false), 1500);
                  }
                }}
              >
                {inviteLinkCopied ? 'Copied!' : 'Copy Link'}
              </Button>
            </div>
            <Button variant="secondary" onClick={() => setShareWithFriendOpen(true)}>
              Invite Friends Directly
            </Button>
          </div>
          <Button variant="ghost" onClick={() => setInviteOpen(false)}>
            Close
          </Button>
        </DialogContent>
      </Dialog>
      {/* Friend Selector Modal */}
      <ShareWithFriendModal
        postId={postId}
        open={shareWithFriendOpen}
        onClose={() => setShareWithFriendOpen(false)}
      />
      <Dialog open={registrationOpen} onOpenChange={setRegistrationOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogTitle>Register for {title}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {user
          ? "Confirm your details and answer the organizer's questions to register."
          : "Register as a guest with your name and email. Creating a NexSq account is optional."}
          </p>
          <form onSubmit={handleRegistrationSubmit} className="space-y-4">
            <label className="block space-y-1 text-sm font-medium">
              Full name
              <Input
                required
                value={registrationForm.fullName}
                onChange={(event) => setRegistrationForm((form) => ({ ...form, fullName: event.target.value }))}
                autoComplete="name"
              />
            </label>
            {user && (
              <label className="block space-y-1 text-sm font-medium">
                Username
                <Input
                  required
                  value={registrationForm.username}
                  onChange={(event) => setRegistrationForm((form) => ({ ...form, username: event.target.value }))}
                  autoComplete="username"
                />
              </label>
            )}
            <label className="block space-y-1 text-sm font-medium">
              Email
              <Input
                required
                type="email"
                value={registrationForm.email}
                onChange={(event) => setRegistrationForm((form) => ({ ...form, email: event.target.value }))}
                autoComplete="email"
              />
            </label>
            <label className="block space-y-1 text-sm font-medium">
              Phone (optional)
              <Input
                type="tel"
                value={registrationForm.phone}
                onChange={(event) => setRegistrationForm((form) => ({ ...form, phone: event.target.value }))}
                autoComplete="tel"
              />
            </label>
            {registrationFields.map((field, index) => (
              <label key={`${field}-${index}`} className="block space-y-1 text-sm font-medium">
                {field}
                <Input
                  required
                  value={registrationForm.answers[index] || ''}
                  onChange={(event) => {
                    const value = event.target.value;
                    setRegistrationForm((form) => ({
                      ...form,
                      answers: form.answers.map((answer, answerIndex) => answerIndex === index ? value : answer),
                    }));
                  }}
                />
              </label>
            ))}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setRegistrationOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={registrationSubmitting}>
                {registrationSubmitting ? 'Registering...' : 'Complete registration'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={passOpen} onOpenChange={setPassOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogTitle className="sr-only">Event entry pass for {title}</DialogTitle>
          <div id="event-registration-pass" className="event-pass-card mx-auto w-full max-w-sm overflow-hidden rounded-3xl border border-gray-200 bg-white text-gray-900 shadow-sm">
            <div className="h-2 bg-gradient-to-r from-violet-700 via-purple-600 to-fuchsia-500" />
            <div className="px-5 pb-4">
              <div className="mx-auto mt-3 h-2 w-14 rounded-full border border-gray-300 bg-gray-100" aria-hidden="true" />

              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  {eventLogoUrl ? (
                    <img src={eventLogoUrl} alt={`${title} event logo`} className="h-10 w-10 shrink-0 rounded-lg border border-gray-200 bg-white object-contain p-1" />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
                      <Ticket className="h-5 w-5" />
                    </div>
                  )}
                  <p className="truncate text-xs font-bold uppercase tracking-[0.16em] text-violet-800">Event access</p>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                  Registered
                </span>
              </div>

              <section className="mt-4 border-b border-gray-200 pb-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-600">Attendee</p>
                <h2 className="mt-1 break-words text-2xl font-extrabold leading-tight tracking-tight text-gray-900">
                  {registrationRecord?.full_name}
                </h2>
                <div className="mt-1 space-y-0.5 text-xs text-gray-700">
                  <p className="break-all">{registrationRecord?.email}</p>
                  {registrationRecord?.phone && <p>{registrationRecord.phone}</p>}
                </div>
              </section>

              <section className="border-b border-gray-200 py-3">
                <h3 className="break-words text-3xl font-black uppercase leading-[0.95] tracking-tight text-gray-900">{passEventName}</h3>
                {passEventSubtitle && (
                  <p className="mt-1 break-words text-sm font-semibold tracking-wide text-violet-800">{passEventSubtitle}</p>
                )}
                <div className="mt-2 space-y-2 text-xs">
                  <div className="flex items-start gap-2">
                    <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-700" />
                    <div>
                      <p className="font-semibold text-gray-600">Date &amp; time</p>
                      <p className="font-medium text-gray-900">{formatDate(eventDate)}</p>
                    </div>
                  </div>
                  {eventLocation && (
                    <div className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-700" />
                      <div>
                        <p className="font-semibold text-gray-600">Location</p>
                        <p className="font-medium text-gray-900">{eventLocation}</p>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {registrationFields.length > 0 && (
                <section className="border-b border-gray-200 py-3">
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-violet-800">Registration details</p>
                  <div className="space-y-1.5">
                    {registrationFields.map((question, index) => (
                      <div key={`${question}-${index}`}>
                        <p className="text-[10px] text-gray-600">{question}</p>
                        <p className="text-xs font-semibold text-gray-900">{passAnswers[index] || '—'}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {organizerPhone && organizerPhoneHref && (
                <section className="border-b border-gray-200 py-3">
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-600">Organizer contact</p>
                  <div className="space-y-1 text-xs">
                    <a href={`tel:${organizerPhoneHref}`} className="flex items-center gap-2 font-medium text-gray-800">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-violet-700" />
                      {organizerPhone}
                    </a>
                  </div>
                </section>
              )}

              <div className="flex items-center justify-between gap-3 pt-3">
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-gray-600">Pass reference</p>
                  <p className="break-all font-mono text-[10px] font-bold text-gray-900">{registrationRecord?.id.toUpperCase()}</p>
                  <p className="mt-1 text-[9px] font-medium text-gray-600">Show this pass at the entrance.</p>
                </div>
                <QRCodeSVG
                  value={passQrUrl}
                  size={54}
                  level="M"
                  includeMargin
                  title={passQrCaption}
                />
              </div>

              <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
                <p className="text-[9px] font-semibold text-gray-600">{passQrCaption}</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-gray-600">Sponsored by</span>
                  <img
                    src="/nexsq-logo-dark-removebg-preview.png"
                    alt="NexSq"
                    className="h-5 w-[76px] object-contain"
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="event-pass-actions flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setPassOpen(false)}>Close</Button>
            <Button onClick={downloadPass} disabled={passDownloading}>
              <Download className="mr-2 h-4 w-4" />
              {passDownloading ? 'Creating PDF...' : 'Download pass PDF'}
            </Button>
            {registrationRecord?.username === null && !user && (
              <Button asChild variant="outline">
                <Link to="/auth?flow=guest-event" onClick={prepareGuestSignup}>
                  Create NexSq account
                </Link>
              </Button>
            )}
          </div>
          {registrationRecord?.username === null && !user && (
            <p className="text-center text-xs text-muted-foreground">
              Download your pass as a PDF, or optionally finish creating a NexSq account.
            </p>
          )}
          {registrationRecord?.username === null && user && (
            <p className="text-center text-xs text-muted-foreground">
              This pass is still a guest registration. Sign in with its email address and confirm that email to attach it to your account.
            </p>
          )}
        </DialogContent>
      </Dialog>
      {/* Author Event Summary Panel */}
      {isAuthor && !compact && (
        <>
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              className="w-full mb-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700"
              onClick={() => {
                window.location.href = `/events/settings/${postId}`;
              }}
            >
              Manage Event
            </Button>
          </div>
        </>
      )}
    </Card>
  );
};
