const durationRequests = new Map<string, Promise<number>>();

export function getVideoDurationSeconds(source: string | Blob): Promise<number> {
  const cacheKey = typeof source === 'string' ? source : null;
  const cachedRequest = cacheKey ? durationRequests.get(cacheKey) : undefined;
  if (cachedRequest) return cachedRequest;

  const request = new Promise<number>((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Video duration can only be read in a browser.'));
      return;
    }

    const video = document.createElement('video');
    const objectUrl = source instanceof Blob ? URL.createObjectURL(source) : null;
    const timeoutId = window.setTimeout(() => {
      finish(new Error('Timed out while reading the video duration.'));
    }, 15_000);
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('error', handleError);
      video.pause();
      video.removeAttribute('src');
      video.load();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    const finish = (error?: Error, duration?: number) => {
      cleanup();
      if (error) reject(error);
      else if (duration && Number.isFinite(duration) && duration > 0) resolve(duration);
      else reject(new Error('Could not determine the video duration.'));
    };
    const handleLoadedMetadata = () => finish(undefined, video.duration);
    const handleError = () => finish(new Error('Could not read the video duration.'));

    video.preload = 'metadata';
    video.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
    video.addEventListener('error', handleError, { once: true });
    video.src = objectUrl || (typeof source === 'string' ? source : '');
    video.load();
  });

  if (!cacheKey) return request;
  durationRequests.set(cacheKey, request);
  void request.catch(() => durationRequests.delete(cacheKey));
  return request;
}
