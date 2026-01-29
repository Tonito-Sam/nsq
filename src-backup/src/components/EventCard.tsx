import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ShareWithFriendModal } from '@/components/ShareWithFriendModal';

interface EventCardProps {
  postId: string;
  title: string;
  eventDate: string;
  eventLocation: string;
  bannerUrl?: string;
  description?: string;
  eventUrl?: string;
  isAuthor?: boolean;
  location?: string;
  feeling?: string;
  onResponseUpdate?: () => void;
}

export const EventCard: React.FC<EventCardProps> = ({
  postId,
  title,
  eventDate,
  eventLocation,
  bannerUrl,
  description,
  eventUrl,
  isAuthor = false,
  location,
  feeling,
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

  useEffect(() => {
    checkUserResponse();
    fetchResponses();
  }, [postId, user]);

  const checkUserResponse = async () => {
    if (!user || !postId) return;

    try {
      const { data } = await supabase
        .from('event_responses')
        .select('response')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setUserResponse(data.response);
      }
    } catch (error) {
      console.error('Error checking user response:', error);
    }
  };

  const fetchResponses = async () => {
    try {
      const { data } = await supabase
        .from('event_responses')
        .select('response')
        .eq('post_id', postId);

      const counts = {
        going: data?.filter(r => r.response === 'going').length || 0,
        maybe: data?.filter(r => r.response === 'maybe').length || 0,
        not_going: data?.filter(r => r.response === 'not_going').length || 0
      };

      setResponses(counts);
    } catch (error) {
      console.error('Error fetching responses:', error);
    }
  };

  const handleResponse = async (response: string) => {
    if (!user || loading) return;

    setLoading(true);
    try {
      // Check if user has already responded
      const { data: existingResponse } = await supabase
        .from('event_responses')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingResponse) {
        // Update existing response
        const { error } = await supabase
          .from('event_responses')
          .update({ response })
          .eq('post_id', postId)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Insert new response
        const { error } = await supabase
          .from('event_responses')
          .insert({
            post_id: postId,
            user_id: user.id,
            response
          });

        if (error) throw error;
      }

      setUserResponse(response);
      fetchResponses();
      
      toast({
        description: "Response updated successfully!",
      });

      if (onResponseUpdate) onResponseUpdate();
    } catch (error) {
      console.error('Error updating response:', error);
      toast({
        description: "Failed to update response. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-purple-100/80 to-pink-100/80 dark:from-purple-900/40 dark:to-pink-900/40 border border-gray-200 dark:border-gray-700 shadow-lg">
      {/* Event Banner */}
      {bannerUrl && (
        <img src={bannerUrl} alt="Event banner" className="w-full h-48 object-cover rounded-lg mb-4 border-2 border-purple-300 dark:border-purple-700" />
      )}
      {/* Event Title & Date */}
      <div className="mb-4">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-1">
          <Calendar className="h-4 w-4 mr-2" />
          {formatDate(eventDate)}
        </div>
        {/* Event Location */}
        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
          <MapPin className="h-4 w-4 mr-2" />
          {eventLocation}
          {location && (
            <span className="ml-2 text-purple-700 dark:text-purple-300">| {location}</span>
          )}
        </div>
        {/* Feeling */}
        {feeling && (
          <div className="flex items-center text-sm text-pink-700 dark:text-pink-300 mt-1">
            <span className="mr-2">Feeling:</span> {feeling}
          </div>
        )}
      </div>
      {/* Event Description */}
      {description && (
        <div className="mb-4 text-base text-purple-900 dark:text-purple-100 bg-purple-50/60 dark:bg-purple-900/30 rounded p-3 border border-purple-200 dark:border-purple-800 shadow-sm">
          {description}
        </div>
      )}
      {/* Share & Invite Buttons */}
      <div className="flex gap-2 mb-4">
        {eventUrl && (
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await navigator.clipboard.writeText(eventUrl);
              toast({ description: 'Event link copied!' });
            }}
          >
            Share Event
          </Button>
        )}
        {eventUrl && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setInviteOpen(true)}
          >
            Invite
          </Button>
        )}
      </div>
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
      {/* Attending? Section - Visible to all users */}
      <div className="my-6">
        <div className="font-semibold mb-1 text-base md:text-lg text-gray-900 dark:text-gray-100">Attending?</div>
        <div className="flex flex-row gap-1 flex-nowrap">
          <Button
            variant={userResponse === 'going' ? 'default' : 'outline'}
            size="icon"
            onClick={() => handleResponse('going')}
            disabled={loading}
            className={
              (userResponse === 'going' ? 'bg-green-600 hover:bg-green-700 text-white ' : 'border-green-600 text-green-700 dark:text-green-400 ') +
              'px-2 py-1 text-xs h-7 min-w-[60px] rounded'
            }
          >
            Yes{isAuthor && <span className="ml-1">({responses.going})</span>}
          </Button>
          <Button
            variant={userResponse === 'maybe' ? 'default' : 'outline'}
            size="icon"
            onClick={() => handleResponse('maybe')}
            disabled={loading}
            className={
              (userResponse === 'maybe' ? 'bg-yellow-500 hover:bg-yellow-600 text-white ' : 'border-yellow-500 text-yellow-700 dark:text-yellow-300 ') +
              'px-2 py-1 text-xs h-7 min-w-[80px] rounded'
            }
          >
            Not Sure{isAuthor && <span className="ml-1">({responses.maybe})</span>}
          </Button>
          <Button
            variant={userResponse === 'not_going' ? 'default' : 'outline'}
            size="icon"
            onClick={() => handleResponse('not_going')}
            disabled={loading}
            className={
              (userResponse === 'not_going' ? 'bg-red-600 hover:bg-red-700 text-white ' : 'border-red-600 text-red-700 dark:text-red-400 ') +
              'px-2 py-1 text-xs h-7 min-w-[60px] rounded'
            }
          >
            No{isAuthor && <span className="ml-1">({responses.not_going})</span>}
          </Button>
        </div>
        {userResponse && (
          <p className="text-xs mt-1 text-blue-600 dark:text-blue-400">
            You responded: {userResponse === 'going' ? 'Yes' : userResponse === 'maybe' ? 'Not Sure' : 'No'}
          </p>
        )}
      </div>
      {/* End Attending? Section */}
      {/* Author Event Summary Panel */}
      {isAuthor && (
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
