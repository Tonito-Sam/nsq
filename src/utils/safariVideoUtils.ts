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
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  
  if (isIOS || isSafari) {
    // Safari/iOS prefers MP4 with H.264 codec
    if (MediaRecorder.isTypeSupported('video/mp4; codecs="avc1.42E01E,mp4a.40.2"')) {
      return 'video/mp4; codecs="avc1.42E01E,mp4a.40.2"';
    }
    if (MediaRecorder.isTypeSupported('video/mp4; codecs="avc1.42E01E"')) {
      return 'video/mp4; codecs="avc1.42E01E"';
    }
    if (MediaRecorder.isTypeSupported('video/mp4')) {
      return 'video/mp4';
    }
  }
  
  // Fallback for other browsers
  if (MediaRecorder.isTypeSupported('video/webm; codecs="vp9,opus"')) {
    return 'video/webm; codecs="vp9,opus"';
  }
  if (MediaRecorder.isTypeSupported('video/webm')) {
    return 'video/webm';
  }
  
  return 'video/mp4'; // Final fallback
};

export const getFileExtensionFromMimeType = (mimeType: string): string => {
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('webm')) return 'webm';
  return 'mp4'; // Default fallback
};

export const createSafariCompatibleVideoBlob = (chunks: Blob[], mimeType: string): Blob => {
  // For Safari, ensure we create a proper MP4 blob
  if (isSafariOrIOS() && !mimeType.includes('mp4')) {
    // If we don't have MP4, try to use it anyway for Safari compatibility
    return new Blob(chunks, { type: 'video/mp4' });
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