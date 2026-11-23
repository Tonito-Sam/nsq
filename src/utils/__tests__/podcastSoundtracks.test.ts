import { describe, expect, it } from 'vitest';
import { PODCAST_SOUNDTRACKS } from '../podcastSoundtracks';

const addedTrackNames = [
  'Aeris - Pure Dream (freetouse.com)',
  'Alegend - Majestic (freetouse.com)',
  'Lukrembo - Bread (freetouse.com)',
  'Lukrembo - Jay (freetouse.com)',
  'Lukrembo - Rose (freetouse.com)',
  'Lukrembo - Sunflower (freetouse.com)',
  'Lukrembo - This Is For You (freetouse.com)',
  'Pufino - Enlivening (freetouse.com)',
  'Pufino - Vibing (freetouse.com)',
  'Sunova - Heroes (freetouse.com)',
  'massobeats - honey jam (freetouse.com)',
];

describe('podcast soundtracks', () => {
  it('includes the tracks added to the repository soundtrack folder', () => {
    const availableTrackNames = PODCAST_SOUNDTRACKS.map(({ name }) => name);

    expect(availableTrackNames).toEqual(expect.arrayContaining(addedTrackNames));
  });
});
