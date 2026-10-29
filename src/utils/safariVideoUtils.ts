// Safari and iOS video compatibility utilities

export const isSafariOrIOS = () => {
  const ua = navigator.userAgent;
  // Improved detection: true Safari (not Chrome pretending to be Safari)
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isSafari = (
    /Safari/.test(ua) &&
    !/Chrome/.test(ua) &&
    !/Chromium/.test(ua) &&
    !/Android/.test(ua)
  );
  const result = isIOS || isSafari;
  console.log('[SafariCompatibleVideo] User agent:', ua);
  console.log('[SafariCompatibleVideo] isIOS:', isIOS, 'isSafari:', isSafari, 'result:', result);
  return result;
};

export const getSafariCompatibleMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return '';

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  if (isIOS || isSafari) {
    const safariTypes = [
      'video/mp4',
      'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
      'video/mp4;codecs="avc1.42E01E"',
    ];
    return safariTypes.find((type) => MediaRecorder.isTypeSupported(type)) || '';
  }

  // Fallback for other browsers
  const browserTypes = ['video/webm;codecs="vp9,opus"', 'video/webm', 'video/mp4'];
  return browserTypes.find((type) => MediaRecorder.isTypeSupported(type)) || '';
};

export const getFileExtensionFromMimeType = (mimeType: string): string => {
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('webm')) return 'webm';
  return 'mp4'; // Default fallback
};

export const createSafariCompatibleVideoBlob = (chunks: Blob[], mimeType: string): Blob => {
  if (isSafariOrIOS() && !mimeType.includes('mp4')) {
    const recordedType = chunks.find((chunk) => chunk.type)?.type || mimeType;
    return new Blob(chunks, { type: recordedType });
  }
  return new Blob(chunks, { type: mimeType });
};

export const getSafariVideoAttributes = () => {
  return {
    playsInline: true,
    'webkit-playsinline': 'true',
    'x-webkit-airplay': 'allow',
    preload: 'metadata',
    controls: true,
    muted: false // Allow audio for playback
  };
};

export const createOptimizedVideoURL = (blob: Blob): string => {
  // Create object URL with proper handling for Safari
  const url = URL.createObjectURL(blob);
  
  // For Safari, we might need to add cache-busting
  if (isSafariOrIOS()) {
    return `${url}#t=0.001`; // This helps Safari load the video properly
  }
  
  return url;
};

export const cleanupVideoURL = (url: string) => {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
};