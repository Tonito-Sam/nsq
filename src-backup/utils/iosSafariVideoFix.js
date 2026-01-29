// Essential iOS Safari video compatibility fixes
// You can copy these functions into your existing RecordReel.tsx

export const isSafariOrIOS = () => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  return isIOS || isSafari;
};

export const getSafariOptimizedMimeType = () => {
  if (isSafariOrIOS()) {
    // Safari/iOS works best with MP4 and H.264 codec
    if (MediaRecorder.isTypeSupported('video/mp4; codecs="avc1.42E01E,mp4a.40.2"')) {
      return 'video/mp4; codecs="avc1.42E01E,mp4a.40.2"';
    }
    if (MediaRecorder.isTypeSupported('video/mp4')) {
      return 'video/mp4';
    }
  }
  return 'video/mp4'; // Safe fallback
};

export const createSafariOptimizedBlob = (chunks, mimeType) => {
  // For Safari, always use MP4 container
  if (isSafariOrIOS()) {
    return new Blob(chunks, { type: 'video/mp4' });
  }
  return new Blob(chunks, { type: mimeType });
};

export const createSafariOptimizedURL = (blob) => {
  const url = URL.createObjectURL(blob);
  // Add timestamp parameter to help Safari load the video
  if (isSafariOrIOS()) {
    return `${url}#t=0.001`;
  }
  return url;
};

// Key changes needed in your RecordReel.tsx:

/*
1. In your MediaRecorder setup, use smaller time slices for Safari:
   recorder.start(isSafariOrIOS() ? 100 : 250);

2. In your recorder.onstop event:
   const blob = createSafariOptimizedBlob(recordedChunks, mimeType);
   const url = createSafariOptimizedURL(blob);
   setVideoUrl(url);

3. Update your video element attributes for better Safari support:
   <video
     src={videoUrl}
     controls
     playsInline
     webkit-playsinline="true"
     x-webkit-airplay="allow"
     preload="metadata"
     crossOrigin="anonymous"
     muted={false}
     onLoadStart={() => {
       // Force Safari to recognize video format
       if (videoRef.current) {
         videoRef.current.setAttribute('type', 'video/mp4');
       }
     }}
     onError={(e) => {
       console.error('Safari video error:', e);
       // Retry loading once
       setTimeout(() => {
         if (videoRef.current && !videoRef.current.error) {
           videoRef.current.load();
         }
       }, 100);
     }}
   />

4. When uploading, ensure consistent file extension:
   const file = new File([blob], `reel-${Date.now()}.mp4`, { 
     type: 'video/mp4' 
   });

5. For ReelCard/Studio display, use these video attributes:
   <video
     src={videoUrl}
     controls
     playsInline
     webkit-playsinline="true"
     preload="metadata"
     muted={false}
     crossOrigin="anonymous"
     onError={(e) => {
       console.error('Safari playback error:', e);
       // Try reloading the video
       e.target.load();
     }}
   />
*/