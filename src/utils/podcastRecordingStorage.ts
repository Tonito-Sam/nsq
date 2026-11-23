import { supabase } from '@/integrations/supabase/client';

export type PodcastRecordingStoragePaths = {
  original: string;
  latest: string;
};

export const PODCAST_RECORDING_STORAGE_BUCKET = 'creator-podcast-drafts';

export function getPodcastRecordingStoragePaths(
  userId: string,
  sessionId: string,
): PodcastRecordingStoragePaths {
  if (!/^[\w-]+$/.test(userId) || !/^[\w-]+$/.test(sessionId)) {
    throw new Error('The podcast recording session has an invalid storage key.');
  }

  const basePath = `${userId}/teleprompter-autosaves/${sessionId}`;
  return {
    original: `${basePath}/original.webm`,
    latest: `${basePath}/latest.webm`,
  };
}

export async function uploadPodcastRecordingBackup(path: string, blob: Blob): Promise<void> {
  const recording = new Blob([blob], { type: 'video/webm' });
  const { error } = await supabase.storage
    .from(PODCAST_RECORDING_STORAGE_BUCKET)
    .upload(path, recording, {
      cacheControl: '3600',
      contentType: 'video/webm',
      upsert: true,
    });

  if (error) throw error;
}

export async function downloadPodcastRecordingBackup(path: string): Promise<Blob | null> {
  const { data, error } = await supabase.storage
    .from(PODCAST_RECORDING_STORAGE_BUCKET)
    .download(path);
  if (error) {
    if ('statusCode' in error && error.statusCode === '404') return null;
    throw error;
  }
  return data;
}

export async function deletePodcastRecordingBackups(paths: PodcastRecordingStoragePaths): Promise<void> {
  const { error } = await supabase.storage
    .from(PODCAST_RECORDING_STORAGE_BUCKET)
    .remove([paths.original, paths.latest]);
  if (error) throw error;
}

export async function deletePodcastRecordingBackup(path: string): Promise<void> {
  const { error } = await supabase.storage
    .from(PODCAST_RECORDING_STORAGE_BUCKET)
    .remove([path]);
  if (error) throw error;
}
