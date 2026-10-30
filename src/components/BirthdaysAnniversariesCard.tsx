
import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar, ImagePlus, Loader2, Pencil, Plus, Search, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { uploadFile } from '@/utils/mediaUtils';
import { toast } from '@/hooks/use-toast';

export interface EventItem {
  id: string;
  title: string;
  date: string;
  type: 'birthday' | 'anniversary';
  relationship?: string;
  person_name?: string;
  person_user_id?: string;
  photo_urls?: string[];
}

interface ProfileMatch {
  id: string;
  first_name: string | null;
  last_name: string | null;
  username: string;
  avatar_url: string | null;
}

interface BirthdayAnniversaryCardProps {
  events?: EventItem[];
  isAddingEvent?: boolean;
  newEvent?: Omit<EventItem, 'id'>;
  onAddEvent?: () => void;
  onRemoveEvent?: (id: string) => void;
  onNewEventChange?: (field: keyof Omit<EventItem, 'id'>, value: string | string[]) => void;
  onEditEvent?: (event: EventItem) => void;
  onCancelEventEdit?: () => void;
  setIsAddingEvent?: (val: boolean) => void;
  autoShareSpecialDays?: boolean;
  onAutoShareSpecialDaysChange?: (enabled: boolean) => void;
  isEditingEvent?: boolean;
}

const relationshipOptions = [
  'Self', 'Spouse/Partner', 'Child', 'Parent', 'Sibling',
  'Friend', 'Extended Family', 'Colleague', 'Other'
];

const BirthdayAnniversaryCard: React.FC<BirthdayAnniversaryCardProps> = ({
  events = [],
  isAddingEvent = false,
  newEvent = { title: '', date: '', type: 'birthday', relationship: '' },
  onAddEvent = () => {},
  onRemoveEvent = () => {},
  onNewEventChange = () => {},
  onEditEvent = () => {},
  onCancelEventEdit = () => {},
  setIsAddingEvent = () => {},
  autoShareSpecialDays = false,
  onAutoShareSpecialDaysChange = () => {},
  isEditingEvent = false,
}) => {
  const [personSearch, setPersonSearch] = useState(newEvent.person_name || '');
  const [profileMatches, setProfileMatches] = useState<ProfileMatch[]>([]);
  const [searchingProfiles, setSearchingProfiles] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    setPersonSearch(newEvent.person_name || '');
  }, [newEvent.person_name]);

  useEffect(() => {
    const query = personSearch.trim().replace(/^@/, '').replace(/[%_]/g, '');
    if (
      !isAddingEvent ||
      newEvent.type !== 'anniversary' ||
      newEvent.relationship === 'Self' ||
      query.length < 2 ||
      (newEvent.person_user_id && query === newEvent.person_name?.trim())
    ) {
      setProfileMatches([]);
      setSearchingProfiles(false);
      return;
    }

    let active = true;
    const timeout = window.setTimeout(async () => {
      setSearchingProfiles(true);
      try {
        const pattern = `%${query}%`;
        const results = await Promise.all([
          supabase.from('users').select('id, first_name, last_name, username, avatar_url').ilike('username', pattern).limit(5),
          supabase.from('users').select('id, first_name, last_name, username, avatar_url').ilike('first_name', pattern).limit(5),
          supabase.from('users').select('id, first_name, last_name, username, avatar_url').ilike('last_name', pattern).limit(5),
        ]);
        if (!active) return;
        const profiles = results.flatMap((result) => result.data || []) as ProfileMatch[];
        setProfileMatches(Array.from(new Map(profiles.map((profile) => [profile.id, profile])).values()).slice(0, 8));
      } catch (error) {
        console.error('Could not search NexSq profiles for anniversary:', error);
        if (active) setProfileMatches([]);
      } finally {
        if (active) setSearchingProfiles(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [isAddingEvent, newEvent.person_name, newEvent.person_user_id, newEvent.relationship, newEvent.type, personSearch]);

  const updateRelationship = (value: string) => {
    onNewEventChange('relationship', value);
    if (value === 'Self') {
      onNewEventChange('person_name', '');
      onNewEventChange('person_user_id', '');
      setPersonSearch('');
    }
  };

  const selectProfile = (profile: ProfileMatch) => {
    const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() || profile.username;
    onNewEventChange('person_name', fullName);
    onNewEventChange('person_user_id', profile.id);
    setPersonSearch(fullName);
    setProfileMatches([]);
  };

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || !user) return;
    const existingPhotos = newEvent.photo_urls || [];
    const selectedFiles = Array.from(files)
      .filter((file) => file.type.startsWith('image/'))
      .slice(0, Math.max(0, 6 - existingPhotos.length));
    if (selectedFiles.length === 0) {
      toast({ title: 'Photo limit reached', description: 'Add up to 6 photos to each anniversary.' });
      return;
    }

    setUploadingPhotos(true);
    try {
      const uploadedPhotos = await Promise.all(
        selectedFiles.map((file) => uploadFile(file, 'posts', 'anniversary-photos/', user.id)),
      );
      onNewEventChange('photo_urls', [...existingPhotos, ...uploadedPhotos]);
    } catch (error) {
      console.error('Could not upload anniversary photos:', error);
      toast({ title: 'Photo upload failed', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setUploadingPhotos(false);
    }
  };

  return (
    <Card className="p-6 dark:bg-[#161616] bg-white border border-gray-200 dark:border-gray-800">
      <div className="flex items-center mb-6">
        <Calendar className="h-5 w-5 mr-3 text-blue-500" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Birthdays & Anniversaries
        </h2>
      </div>

      <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <div>
          <Label htmlFor="auto-share-special-days" className="font-medium text-gray-900 dark:text-gray-100">
            Automatically share my celebrations
          </Label>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            When enabled, NexSq publicly creates a birthday or anniversary card on the saved date and shares it to Moments and the feed.
          </p>
        </div>
        <Switch
          id="auto-share-special-days"
          checked={autoShareSpecialDays}
          onCheckedChange={onAutoShareSpecialDaysChange}
          aria-label="Automatically share birthday and anniversary celebrations"
        />
      </div>

      {/* Add Event Form */}
      {isAddingEvent && (
        <div className="mb-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <Label htmlFor="event-type" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Event Type
              </Label>
              <Select
                value={newEvent.type}
                onValueChange={(value: 'birthday' | 'anniversary') => 
                  onNewEventChange('type', value)
                }
              >
                <SelectTrigger className="h-10 bg-gray-900 dark:bg-gray-900 border-gray-600 text-white">
                  <SelectValue placeholder="Birthday" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-600">
                  <SelectItem value="birthday" className="text-white hover:bg-gray-800">Birthday</SelectItem>
                  <SelectItem value="anniversary" className="text-white hover:bg-gray-800">Anniversary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="relationship" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Relationship
              </Label>
              <Select
                value={newEvent.relationship || ''}
                onValueChange={updateRelationship}
              >
                <SelectTrigger className="h-10 bg-gray-900 dark:bg-gray-900 border-gray-600 text-white">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-600">
                  {relationshipOptions.map((option) => (
                    <SelectItem 
                      key={option} 
                      value={option}
                      className="text-white hover:bg-gray-800"
                    >
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {newEvent.type === 'anniversary' && newEvent.relationship !== 'Self' && (
            <div className="relative mb-4">
              <Label htmlFor="anniversary-person-name" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Other person’s full name
              </Label>
              <div className="relative">
                <Input
                  id="anniversary-person-name"
                  value={personSearch}
                  onChange={(event) => {
                    const value = event.target.value;
                    setPersonSearch(value);
                    onNewEventChange('person_name', value);
                    onNewEventChange('person_user_id', '');
                  }}
                  placeholder="Enter a name or search NexSq members"
                  required
                  className="h-10 bg-gray-900 dark:bg-gray-900 border-gray-600 pr-9 text-white placeholder:text-gray-400"
                />
                {searchingProfiles ? (
                  <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-gray-400" />
                ) : (
                  <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Search by first name, last name, or username, or enter any full name.
              </p>
              {profileMatches.length > 0 && (
                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-gray-700 bg-gray-950 shadow-xl">
                  {profileMatches.map((profile) => {
                    const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
                    return (
                      <button
                        key={profile.id}
                        type="button"
                        onClick={() => selectProfile(profile)}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-white hover:bg-gray-800"
                      >
                        {profile.avatar_url ? (
                          <img src={profile.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <span className="grid h-8 w-8 place-items-center rounded-full bg-gray-700 font-semibold">
                            {(fullName || profile.username).slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{fullName || profile.username}</span>
                          <span className="block truncate text-xs text-gray-400">@{profile.username}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              {newEvent.person_user_id && (
                <p className="mt-1 text-xs text-emerald-500">Linked to a NexSq profile</p>
              )}
            </div>
          )}

          <div className="mb-4">
            <Label htmlFor="event-title" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Title/Caption
            </Label>
            <Input
              id="event-title"
              value={newEvent.title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onNewEventChange('title', e.target.value)}
              placeholder="John's Birthday"
              className="h-10 bg-gray-900 dark:bg-gray-900 border-gray-600 text-white placeholder:text-gray-400"
            />
          </div>

          <div className="mb-4">
            <Label htmlFor="event-date" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Date
            </Label>
            <Input
              id="event-date"
              type="date"
              value={newEvent.date}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onNewEventChange('date', e.target.value)}
              placeholder="yyyy/mm/dd"
              className="h-10 bg-gray-900 dark:bg-gray-900 border-gray-600 text-white placeholder:text-gray-400"
            />
          </div>

          {newEvent.type === 'anniversary' && (
            <div className="mb-5">
              <Label htmlFor="anniversary-photos" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Celebration photos
              </Label>
              <label htmlFor="anniversary-photos" className="flex min-h-20 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-600 hover:border-rose-400 hover:bg-rose-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
                {uploadingPhotos ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                {uploadingPhotos ? 'Uploading photos...' : 'Choose up to 6 photos'}
                <input
                  id="anniversary-photos"
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={uploadingPhotos || (newEvent.photo_urls?.length || 0) >= 6}
                  className="sr-only"
                  onChange={(event) => {
                    void handlePhotoUpload(event.currentTarget.files);
                    event.currentTarget.value = '';
                  }}
                />
              </label>
              {(newEvent.photo_urls || []).length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {newEvent.photo_urls?.map((url, index) => (
                    <div key={url} className="group relative aspect-square overflow-hidden rounded-md">
                      <img src={url} alt={`Anniversary photo ${index + 1}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => onNewEventChange('photo_urls', (newEvent.photo_urls || []).filter((photo) => photo !== url))}
                        aria-label={`Remove anniversary photo ${index + 1}`}
                        className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              onClick={onAddEvent}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md"
            >
              {isEditingEvent ? 'Update Event' : 'Save Event'}
            </Button>
            <Button
              type="button"
              variant="outline" 
              onClick={() => { setIsAddingEvent(false); onCancelEventEdit(); }}
              className="border-gray-600 text-gray-300 hover:bg-gray-800 px-6 py-2 rounded-md"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Events List */}
      <div className="space-y-3">
        {events.length === 0 && !isAddingEvent && (
          <p className="text-gray-500 dark:text-gray-400 text-sm py-4">
            No events added yet. Keep track of important dates for you and your loved ones.
          </p>
        )}

        {events.map((event) => (
          <div key={event.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-blue-500" />
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">{event.title || 'Anniversary'}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {new Date(`${event.date}T00:00:00`).toLocaleDateString()} • {event.relationship || event.person_name || 'Personal celebration'}
                </p>
                {event.photo_urls?.length ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{event.photo_urls.length} celebration photo{event.photo_urls.length === 1 ? '' : 's'}</p> : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center">
              <Button type="button" variant="ghost" size="sm" onClick={() => onEditEvent(event)} aria-label={`Edit ${event.title || 'anniversary'}`} className="text-gray-500 hover:text-gray-900 dark:hover:text-white">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => onRemoveEvent(event.id)} aria-label={`Remove ${event.title || 'event'}`} className="text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Button */}
      {!isAddingEvent && (
        <Button
          variant="outline"
          onClick={() => setIsAddingEvent(true)}
          className="w-full mt-4 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Birthday or Anniversary
        </Button>
      )}
    </Card>
  );
};

export default BirthdayAnniversaryCard;
