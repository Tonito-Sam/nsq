import React, { useEffect, useRef } from 'react';
import { getSafariVideoAttributes, isSafariOrIOS } from '../utils/safariVideoUtils';

interface SafariCompatibleVideoProps {
  src: string;
  poster?: string;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
  disablePictureInPicture?: boolean;
  crossOrigin?: "anonymous" | "use-credentials" | "";
  onClick?: () => void;
  onError?: (error: any) => void;
  onLoadStart?: () => void;
  onCanPlay?: () => void;
  onTimeUpdate?: () => void;
  onLoadedMetadata?: () => void;
  onEnded?: () => void;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export const SafariCompatibleVideo = React.forwardRef<HTMLVideoElement, SafariCompatibleVideoProps>(({
  src,
  poster,
  className = '',
  autoPlay = false,
  muted = false,
  loop = false,
  controls = false,
  disablePictureInPicture = false,
  crossOrigin = "anonymous",
  onClick,
  onError,
  onLoadStart,
  onCanPlay,
  onTimeUpdate,
  onLoadedMetadata,
  onEnded,
  style,
  children,
}, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const safariAttributes = getSafariVideoAttributes();

  // Use forwarded ref or internal ref
  const actualRef = ref || videoRef;

  useEffect(() => {
    const video = typeof actualRef === 'object' && actualRef?.current ? actualRef.current : null;
    if (!video) return;

    if (isSafariOrIOS()) {
      video.load();
      let retryCount = 0;
      const MAX_RETRIES = 3;
      let retryTimeout: NodeJS.Timeout | null = null;

      const handleLoadStart = () => onLoadStart?.();
      const handleCanPlay = () => { 
        onCanPlay?.(); 
        retryCount = 0; 
      };
      const handleError = (e: Event) => {
        onError?.(e);
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          retryTimeout = setTimeout(() => {
            if (video && !video.error) video.load();
          }, 500);
        }
      };
      const handleStalled = () => {
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          video.load();
        }
      };

      video.addEventListener('loadstart', handleLoadStart);
      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('error', handleError);
      video.addEventListener('stalled', handleStalled);

      return () => {
        video.removeEventListener('loadstart', handleLoadStart);
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('error', handleError);
        video.removeEventListener('stalled', handleStalled);
        if (retryTimeout) clearTimeout(retryTimeout);
      };
    }
  }, [src, onError, onLoadStart, onCanPlay, actualRef]);

  return (
    <video
      ref={actualRef}
      src={src}
      poster={poster}
      className={className}
      style={style}
      autoPlay={autoPlay}
      muted={muted}
      loop={loop}
      controls={controls}
      disablePictureInPicture={disablePictureInPicture}
      crossOrigin={crossOrigin}
      onClick={onClick}
      onTimeUpdate={onTimeUpdate}
      onLoadedMetadata={onLoadedMetadata}
      onEnded={onEnded}
      {...safariAttributes}
      onLoadStart={() => {
        if (typeof actualRef === 'object' && actualRef?.current) {
          actualRef.current.setAttribute('type', 'video/mp4');
        }
        onLoadStart?.();
      }}
    >
      <source src={src} type="video/mp4" />
      <source src={src} type="video/webm" />
      {children || 'Your browser does not support the video tag.'}
    </video>
  );
});

SafariCompatibleVideo.displayName = 'SafariCompatibleVideo';
