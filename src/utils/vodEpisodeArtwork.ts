export interface VodEpisodeArtworkSources {
  is_podcast?: boolean;
  podcast_cover_url?: string;
  thumbnail_url?: string;
  show_thumbnail?: string;
}

export const getVodEpisodeArtwork = (episode: VodEpisodeArtworkSources): string | null => {
  if (episode.is_podcast) return episode.podcast_cover_url || null;
  return episode.thumbnail_url || episode.show_thumbnail || null;
};
