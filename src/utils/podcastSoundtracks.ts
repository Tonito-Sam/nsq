import { supabase } from '@/integrations/supabase/client';
import aerisPureDreamUrl from '../../podcast intro soundtracks/Aeris - Pure Dream (freetouse.com).mp3?url';
import alegendMajesticUrl from '../../podcast intro soundtracks/Alegend - Majestic (freetouse.com).mp3?url';
import lukremboBreadUrl from '../../podcast intro soundtracks/Lukrembo - Bread (freetouse.com).mp3?url';
import lukremboJayUrl from '../../podcast intro soundtracks/Lukrembo - Jay (freetouse.com).mp3?url';
import lukremboRoseUrl from '../../podcast intro soundtracks/Lukrembo - Rose (freetouse.com).mp3?url';
import lukremboSunflowerUrl from '../../podcast intro soundtracks/Lukrembo - Sunflower (freetouse.com).mp3?url';
import lukremboThisIsForYouUrl from '../../podcast intro soundtracks/Lukrembo - This Is For You (freetouse.com).mp3?url';
import pufinoEnliveningUrl from '../../podcast intro soundtracks/Pufino - Enlivening (freetouse.com).mp3?url';
import pufinoVibingUrl from '../../podcast intro soundtracks/Pufino - Vibing (freetouse.com).mp3?url';
import sunovaHeroesUrl from '../../podcast intro soundtracks/Sunova - Heroes (freetouse.com).mp3?url';
import massobeatsHoneyJamUrl from '../../podcast intro soundtracks/massobeats - honey jam (freetouse.com).mp3?url';

const SOUNDTRACK_BUCKET = 'studio-videos';
const EXISTING_SOUNDTRACKS = [
  'Aylex - Born to Win (freetouse.com).mp3',
  'Aylex - Daydreams (freetouse.com).mp3',
  'Aylex - Okay Energy (freetouse.com).mp3',
  'Aylex - Rise Up (freetouse.com).mp3',
  'Aylex - Snap Attack (freetouse.com).mp3',
  'Aylex - Summer Sound (freetouse.com).mp3',
  'Aylex - These Days (freetouse.com).mp3',
  'Calima - Usual Rigmarole (freetouse.com).mp3',
  'Dagored - Urban Timelapse (freetouse.com).mp3',
  'Moavii - Root (freetouse.com).mp3',
  'Nebulite - Andromeda (freetouse.com).mp3',
  'Pufino - Rock Me Now (freetouse.com).mp3',
  'Unheard - Void (freetouse.com).mp3',
  'Waesto - Funky (freetouse.com).mp3',
  'Zambolino - Riding The Wave (freetouse.com).mp3',
];
const existingSoundtracks = EXISTING_SOUNDTRACKS.map((filename) => ({
  name: filename.replace(/\.mp3$/i, ''),
  url: supabase.storage
    .from(SOUNDTRACK_BUCKET)
    .getPublicUrl(`podcast-soundtracks/${filename}`).data.publicUrl,
}));

const addedSoundtracks = [
  { name: 'Aeris - Pure Dream (freetouse.com)', url: aerisPureDreamUrl },
  { name: 'Alegend - Majestic (freetouse.com)', url: alegendMajesticUrl },
  { name: 'Lukrembo - Bread (freetouse.com)', url: lukremboBreadUrl },
  { name: 'Lukrembo - Jay (freetouse.com)', url: lukremboJayUrl },
  { name: 'Lukrembo - Rose (freetouse.com)', url: lukremboRoseUrl },
  { name: 'Lukrembo - Sunflower (freetouse.com)', url: lukremboSunflowerUrl },
  { name: 'Lukrembo - This Is For You (freetouse.com)', url: lukremboThisIsForYouUrl },
  { name: 'Pufino - Enlivening (freetouse.com)', url: pufinoEnliveningUrl },
  { name: 'Pufino - Vibing (freetouse.com)', url: pufinoVibingUrl },
  { name: 'Sunova - Heroes (freetouse.com)', url: sunovaHeroesUrl },
  { name: 'massobeats - honey jam (freetouse.com)', url: massobeatsHoneyJamUrl },
];

export const PODCAST_SOUNDTRACKS = [...existingSoundtracks, ...addedSoundtracks]
  .sort((left, right) => left.name.localeCompare(right.name));
