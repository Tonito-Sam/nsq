import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { VoicePlayer } from './VoicePlayer';
import { Calendar, MapPin, ArrowLeft, ArrowRight } from 'lucide-react';

interface PostContentProps {
  content: string;
  media_url?: string;
  media_urls?: string[];
  postType: string;
  voiceNoteUrl?: string;
  voiceDuration?: number;
  eventDate?: string;
  eventLocation?: string;
  location?: string;
  feeling?: string;
}

const AspectRatioBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="relative w-full" style={{ paddingTop: '75%' }}>
    <div className="absolute inset-0">{children}</div>
  </div>
);

export const PostContent: React.FC<PostContentProps> = ({
  content,
  media_url,
  media_urls,
  postType,
  voiceNoteUrl,
  voiceDuration = 0,
  eventDate,
  eventLocation,
  location,
  feeling,
}) => {
  // Detect iOS for specific video handling
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  // Autoplay and unmute videos when in viewport
  useEffect(() => {
    const videos = document.querySelectorAll("video");
    const observer = new window.IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          const video = entry.target as HTMLVideoElement;
          if (entry.isIntersecting) {
            video.muted = false;
            video.play().catch(() => {});
          } else {
            video.pause();
            video.muted = true;
          }
        });
      },
      { threshold: 0.6 }
    );
    videos.forEach(video => observer.observe(video));
    return () => videos.forEach(video => observer.unobserve(video));
  }, []);

  // Modal logic extended for carousel!
  const [modalImageIndex, setModalImageIndex] = useState<number | null>(null);
  // Track aspect ratio for each image (shared for all images in this post)
  const [imgDims, setImgDims] = useState<{[k:number]: {w:number, h:number}}>({});
  // State for single media aspect ratio
  const [singleMediaDims, setSingleMediaDims] = useState<{w:number, h:number} | null>(null);

  // Identify images only (needed for modal nav)
  const imageUrls = (media_urls && media_urls.length > 0)
    ? media_urls.filter(url => isImage(url))
    : media_url && isImage(media_url)
      ? [media_url]
      : [];

  // Used for modal navigation keys
  useEffect(() => {
    if (modalImageIndex !== null) {
      const handleKey = (e: KeyboardEvent) => {
        if ((e.key === "ArrowLeft" || e.key === "a") && imageUrls.length > 1) {
          goPrev();
        }
        if ((e.key === "ArrowRight" || e.key === "d") && imageUrls.length > 1) {
          goNext();
        }
        if (e.key === "Escape") {
          setModalImageIndex(null);
        }
      };
      window.addEventListener("keydown", handleKey);
      return () => window.removeEventListener("keydown", handleKey);
    }
  // eslint-disable-next-line
  }, [modalImageIndex, imageUrls.length]);

  // Utility functions
  function isVideo(url: string): boolean {
    if (!url) return false;
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi'];
    return videoExtensions.some(ext => url.toLowerCase().includes(ext)) || 
           url.includes('video') || 
           url.includes('.mp4');
  }
  
  function isImage(url: string): boolean {
    if (!url) return false;
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    return imageExtensions.some(ext => url.toLowerCase().includes(ext)) || 
           (!isVideo(url) && (url.includes('image') || url.includes('photo')));
  }

  // Helper to determine if landscape
  function isLandscape(w: number, h: number) {
    return w > h;
  }

  // Helper to get iOS-specific video props
  const getIOSVideoProps = () => ({
    playsInline: true,
    'webkit-playsinline': true,
    'x-webkit-airplay': 'allow',
    style: {
      WebkitPlaysinline: true,
      position: 'relative' as const,
      zIndex: 1,
    } as React.CSSProperties,
  });

  // Instagram/LinkedIn-style grid logic (unchanged)
  const getGridLayout = (count: number) => {
    if (count === 1) return "grid-cols-1";
    if (count === 2) return "grid-cols-2";
    if (count === 3) return "grid-cols-2 grid-rows-2";
    if (count === 4) return "grid-cols-2 grid-rows-2";
    return "grid-cols-3 grid-rows-2"; // For 5 or more
  };
  
  const getImageClass = (index: number, total: number) => {
    if (total === 1) return "col-span-1 row-span-1 h-72 sm:h-96";
    if (total === 2) return "col-span-1 row-span-1 h-64";
    if (total === 3) {
      if (index === 0) return "col-span-2 row-span-2 h-64 sm:h-72";
      return "col-span-1 row-span-1 h-32 sm:h-36";
    }
    if (total === 4) return "col-span-1 row-span-1 h-40 sm:h-48";
    if (total >= 5) {
      if (index === 0) return "col-span-2 row-span-2 h-64 sm:h-72";
      return "col-span-1 row-span-1 h-32 sm:h-36";
    }
    return "col-span-1 row-span-1 h-32";
  };

  // Helper to determine object-fit for single media
  function getSingleMediaFitClass() {
    if (!singleMediaDims) return 'object-cover';
    const { w, h } = singleMediaDims;
    if (h >= w) return 'object-cover';
    return 'object-cover';
  }

  // Grid display: update click to open modal at given image
  const renderImageGrid = (urls: string[]) => {
    const displayUrls = urls.slice(0, 5);
    const remainingCount = urls.length - 5;
    return (
      <div
        className={
          `mt-3 grid overflow-hidden rounded-lg gap-1 bg-gray-100 dark:bg-gray-800 ` +
          getGridLayout(displayUrls.length)
        }
        style={{
          minHeight:
            displayUrls.length === 1
              ? "18rem"
              : displayUrls.length === 2
              ? "16rem"
              : displayUrls.length >= 3
              ? "15rem"
              : undefined,
        }}
      >
        {displayUrls.map((url, idx) => (
          <div
            key={idx}
            className={
              "relative group overflow-hidden rounded-lg cursor-pointer transition-all duration-200 bg-gray-200 dark:bg-gray-700 " +
              getImageClass(idx, displayUrls.length)
            }
            style={{
              gridRow:
                displayUrls.length === 3 && idx === 0
                  ? "1 / span 2"
                  : undefined,
              gridColumn:
                displayUrls.length === 3 && idx === 0
                  ? "1 / span 2"
                  : undefined,
            }}
            onClick={() => setModalImageIndex(idx)}
          >
            <img
              src={url}
              alt={`Post media ${idx + 1}`}
              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105 rounded-lg"
              draggable={false}
              loading="lazy"
            />
            {idx === 4 && remainingCount > 0 && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-lg">
                <span className="text-white text-2xl font-bold drop-shadow-lg">
                  +{remainingCount}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Media display with iOS support
  const renderMedia = () => {
    // Multiple images: grid (modal uses index)
    if (media_urls && media_urls.length > 1) {
      const imgs = media_urls.filter(url => isImage(url));
      const vids = media_urls.filter(url => isVideo(url));
      return (
        <div className="space-y-3">
          {imgs.length > 0 && renderImageGrid(imgs)}
          {vids.map((url, idx) => (
            <div 
              key={idx} 
              className="relative mt-3 rounded-lg overflow-hidden bg-black"
              style={{ 
                position: 'relative',
                zIndex: 1,
                isolation: 'isolate'
              }}
            >
              <video
                src={url}
                className="w-full h-48 sm:h-64 md:h-80 object-cover"
                preload="metadata"
                controls
                muted
                playsInline
                webkit-playsinline="true"
                x5-playsinline="true"
                disablePictureInPicture
              >
                <source src={url} type="video/mp4" />
                <source src={url} type="video/webm" />
                Your browser does not support the video tag.
              </video>
            </div>
          ))}
        </div>
      );
    }
    
    // Only one in array:
    if (media_urls && media_urls.length === 1) {
      const url = media_urls[0];
      if (isVideo(url)) return (
        singleMediaDims && isLandscape(singleMediaDims.w, singleMediaDims.h) ? (
          <AspectRatioBox>
            <video
              src={url}
              className="w-full h-full object-contain rounded-lg shadow-sm cursor-pointer"
              preload="metadata"
              controls
              muted
              playsInline
              webkit-playsinline="true"
              x5-playsinline="true"
              disablePictureInPicture
              onLoadedMetadata={e => {
                const video = e.currentTarget;
                setSingleMediaDims({ w: video.videoWidth, h: video.videoHeight });
              }}
            >
              <source src={url} type="video/mp4" />
              <source src={url} type="video/webm" />
              Your browser does not support the video tag.
            </video>
          </AspectRatioBox>
        ) : (
          <div 
            className="relative mt-3 rounded-lg overflow-hidden bg-black flex items-center justify-center" 
            style={{ 
              aspectRatio: '4/5', 
              maxHeight: '500px', 
              width: '100%',
              position: 'relative',
              zIndex: 1,
              isolation: 'isolate'
            }}
          >
            <video
              src={url}
              className="w-full h-full object-cover rounded-lg shadow-sm cursor-pointer"
              style={{ maxHeight: '500px', aspectRatio: '4/5' }}
              preload="metadata"
              controls
              muted
              playsInline
              webkit-playsinline="true"
              x5-playsinline="true"
              disablePictureInPicture
              onLoadedMetadata={e => {
                const video = e.currentTarget;
                setSingleMediaDims({ w: video.videoWidth, h: video.videoHeight });
              }}
            >
              <source src={url} type="video/mp4" />
              <source src={url} type="video/webm" />
              Your browser does not support the video tag.
            </video>
          </div>
        )
      );
      if (isImage(url)) return (
        singleMediaDims && isLandscape(singleMediaDims.w, singleMediaDims.h) ? (
          <AspectRatioBox>
            <img
              src={url}
              alt="Post media"
              className="w-full h-full object-contain rounded-lg shadow-sm cursor-pointer"
              onClick={() => setModalImageIndex(0)}
              onLoad={e => {
                const img = e.currentTarget;
                setSingleMediaDims({ w: img.naturalWidth, h: img.naturalHeight });
              }}
            />
          </AspectRatioBox>
        ) : (
          <div className="relative mt-3 rounded-lg overflow-hidden bg-black flex items-center justify-center" style={{ aspectRatio: '4/5', maxHeight: '500px', width: '100%' }}>
            <img
              src={url}
              alt="Post media"
              className="w-full h-full object-cover rounded-lg shadow-sm cursor-pointer"
              style={{ maxHeight: '500px', aspectRatio: '4/5' }}
              onClick={() => setModalImageIndex(0)}
              onLoad={e => {
                const img = e.currentTarget;
                setSingleMediaDims({ w: img.naturalWidth, h: img.naturalHeight });
              }}
            />
          </div>
        )
      );
    }
    
    // Fallback to single media_url
    if (!media_url) return null;

    if (isVideo(media_url)) {
      return (
        singleMediaDims && isLandscape(singleMediaDims.w, singleMediaDims.h) ? (
          <AspectRatioBox>
            <video
              src={media_url}
              className="w-full h-full object-contain rounded-lg shadow-sm cursor-pointer"
              preload="metadata"
              controls
              muted
              playsInline
              webkit-playsinline="true"
              x5-playsinline="true"
              disablePictureInPicture
              onLoadedMetadata={e => {
                const video = e.currentTarget;
                setSingleMediaDims({ w: video.videoWidth, h: video.videoHeight });
              }}
            >
              <source src={media_url} type="video/mp4" />
              <source src={media_url} type="video/webm" />
              Your browser does not support the video tag.
            </video>
          </AspectRatioBox>
        ) : (
          <div 
            className="relative mt-3 rounded-lg overflow-hidden bg-black flex items-center justify-center" 
            style={{ 
              aspectRatio: '4/5', 
              maxHeight: '500px', 
              width: '100%',
              position: 'relative',
              zIndex: 1,
              isolation: 'isolate'
            }}
          >
            <video
              src={media_url}
              className="w-full h-full object-cover rounded-lg shadow-sm cursor-pointer"
              style={{ maxHeight: '500px', aspectRatio: '4/5' }}
              preload="metadata"
              controls
              muted
              playsInline
              webkit-playsinline="true"
              x5-playsinline="true"
              disablePictureInPicture
              onLoadedMetadata={e => {
                const video = e.currentTarget;
                setSingleMediaDims({ w: video.videoWidth, h: video.videoHeight });
              }}
            >
              <source src={media_url} type="video/mp4" />
              <source src={media_url} type="video/webm" />
              Your browser does not support the video tag.
            </video>
          </div>
        )
      );
    }
    
    if (isImage(media_url)) {
      return (
        singleMediaDims && isLandscape(singleMediaDims.w, singleMediaDims.h) ? (
          <AspectRatioBox>
            <img
              src={media_url}
              alt="Post media"
              className="w-full h-full object-contain rounded-lg shadow-sm cursor-pointer"
              onClick={() => setModalImageIndex(0)}
              onLoad={e => {
                const img = e.currentTarget;
                setSingleMediaDims({ w: img.naturalWidth, h: img.naturalHeight });
              }}
            />
          </AspectRatioBox>
        ) : (
          <div className="relative mt-3 rounded-lg overflow-hidden bg-black flex items-center justify-center" style={{ aspectRatio: '4/5', maxHeight: '500px', width: '100%' }}>
            <img
              src={media_url}
              alt="Post media"
              className="w-full h-full object-cover rounded-lg shadow-sm cursor-pointer"
              style={{ maxHeight: '500px', aspectRatio: '4/5' }}
              onClick={() => setModalImageIndex(0)}
              onLoad={e => {
                const img = e.currentTarget;
                setSingleMediaDims({ w: img.naturalWidth, h: img.naturalHeight });
              }}
            />
          </div>
        )
      );
    }
    return null;
  };

  // Modal navigation for multiple images
  const goPrev = () => {
    if (modalImageIndex === null || imageUrls.length === 0) return;
    setModalImageIndex((prev) => {
      if (prev === null) return null;
      return (prev - 1 + imageUrls.length) % imageUrls.length;
    });
  };
  
  const goNext = () => {
    if (modalImageIndex === null || imageUrls.length === 0) return;
    setModalImageIndex((prev) => {
      if (prev === null) return null;
      return (prev + 1) % imageUrls.length;
    });
  };

  const renderEventDetails = () => {
    if (postType !== 'event') return null;
    return (
      <div className="mt-3 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
        <div className="flex items-center space-x-2 mb-2">
          <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
            Event
          </Badge>
        </div>
        {eventDate && (
          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300 mb-1">
            <Calendar className="h-4 w-4" />
            <span>{new Date(eventDate).toLocaleDateString()}</span>
          </div>
        )}
        {eventLocation && (
          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
            <MapPin className="h-4 w-4" />
            <span>{eventLocation}</span>
          </div>
        )}
      </div>
    );
  };

  const renderVoiceNote = () => {
    if (postType !== 'voice' || !voiceNoteUrl) return null;
    return (
      <div className="mt-3">
        <VoicePlayer 
          audioUrl={voiceNoteUrl}
          duration={voiceDuration || 0}
        />
      </div>
    );
  };

  return (
    <div>
      {content && (
        <p className="text-gray-900 dark:text-gray-100 leading-relaxed whitespace-pre-wrap">
          {content}
        </p>
      )}
      {/* Location and Feeling */}
      {(location || feeling) && (
        <div className="flex flex-wrap gap-4 mt-2">
          {location && (
            <span className="flex items-center text-sm text-purple-700 dark:text-purple-300">
              <span className="mr-1">📍</span> {location}
            </span>
          )}
          {feeling && (
            <span className="flex items-center text-sm text-pink-700 dark:text-pink-300">
              <span className="mr-1">😃</span> {feeling}
            </span>
          )}
        </div>
      )}
      {renderMedia()}
      {renderEventDetails()}
      {renderVoiceNote()}
      {modalImageIndex !== null && imageUrls[modalImageIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setModalImageIndex(null)}
        >
          <div className="relative max-w-4xl max-h-full flex flex-col items-center w-full">
            <img
              src={imageUrls[modalImageIndex]}
              alt="Full size"
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl select-none"
              onClick={e => e.stopPropagation()}
              draggable={false}
              loading="lazy"
            />
            {/* Navigation arrows, show if >1 image */}
            {imageUrls.length > 1 && (
              <>
                <button
                  className="absolute left-2 sm:left-8 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/85 text-white p-2 rounded-full flex items-center justify-center focus:outline-none"
                  onClick={e => { e.stopPropagation(); goPrev(); }}
                  aria-label="Previous image"
                >
                  <ArrowLeft className="h-6 w-6" /> 
                </button>
                <button
                  className="absolute right-2 sm:right-8 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/85 text-white p-2 rounded-full flex items-center justify-center focus:outline-none"
                  onClick={e => { e.stopPropagation(); goNext(); }}
                  aria-label="Next image"
                >
                  <ArrowRight className="h-6 w-6" />
                </button>
                {/* Indicator dots */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                  {imageUrls.map((_, idx) => (
                    <span
                      key={idx}
                      className={`w-2 h-2 rounded-full bg-white transition-opacity duration-200 ${idx === modalImageIndex ? 'opacity-90' : 'opacity-40'}`}
                    />
                  ))}
                </div>
              </>
            )}
            {/* Close button */}
            <button
              className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/70 transition-colors"
              onClick={e => {e.stopPropagation(); setModalImageIndex(null);}}
              aria-label="Close"
            >✕</button>
          </div>
        </div>
      )}
    </div>
  );
};
