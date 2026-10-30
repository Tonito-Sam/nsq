import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { VoicePlayer } from './VoicePlayer';
import { Calendar, MapPin, ArrowLeft, ArrowRight, Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { specialBackgrounds } from './moment/specialBackgrounds';
import ReactCountryFlag from 'react-country-flag';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel';
import type { PlatformCelebrationSlide } from '@/lib/platformCelebrationGroups';

interface PostContentProps {
  content: string;
  media_url?: string;
  media_urls?: string[];
  postType: string;
  voiceNoteUrl?: string;
  voiceDuration?: number;
  backgroundAudioUrl?: string;
  audioMixMeta?: any | null;
  backgroundAudioMeta?: any | null;
  originalVoiceUsername?: string;
  eventDate?: string;
  eventLocation?: string;
  location?: string;
  feeling?: string;
  // Moment-specific props to allow postcard rendering in the feed
  momentBg?: string | null;
  momentFont?: string | null;
  momentFontSize?: number | null;
  momentType?: string | null;
  momentSpecialMessage?: string | null;
  momentSpecialIcon?: string | null;
  momentSpecialName?: string | null;
  isCustomSpecialDay?: boolean | null;
  momentSpecialId?: string | null;
  specialDayEvents?: PlatformCelebrationSlide[];
}

const AspectRatioBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="relative w-full" style={{ paddingTop: '75%' }}>
    <div className="absolute inset-0">{children}</div>
  </div>
);

const visibleFeedVideos = new Map<HTMLVideoElement, number>();
let activeFeedVideo: HTMLVideoElement | null = null;
let feedVideoObserver: IntersectionObserver | null = null;

function setActiveFeedVideo(video: HTMLVideoElement | null) {
  if (video === activeFeedVideo) return;

  if (activeFeedVideo) {
    activeFeedVideo.pause();
    activeFeedVideo.muted = true;
  }
  for (const otherVideo of visibleFeedVideos.keys()) {
    if (otherVideo !== video) {
      otherVideo.pause();
      otherVideo.muted = true;
    }
  }

  activeFeedVideo = video;
  if (video) {
    video.muted = true;
    void video.play().then(() => {
      if (activeFeedVideo !== video) video.pause();
    }).catch(() => {});
  }
}

function activateFeedVideo(video: HTMLVideoElement) {
  setActiveFeedVideo(video);
}

function getFeedVideoObserver() {
  if (feedVideoObserver) return feedVideoObserver;

  feedVideoObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const video = entry.target as HTMLVideoElement;
      if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
        visibleFeedVideos.set(video, entry.intersectionRatio);
      } else {
        visibleFeedVideos.delete(video);
      }
    });

    const nextVideo = [...visibleFeedVideos.entries()]
      .sort((first, second) => second[1] - first[1])[0]?.[0] || null;
    setActiveFeedVideo(nextVideo);
  }, { threshold: [0, 0.55, 0.75, 1] });

  return feedVideoObserver;
}

export const PostContent: React.FC<PostContentProps> = ({
  content,
  media_url,
  media_urls,
  postType,
  voiceNoteUrl,
  voiceDuration = 0,
  backgroundAudioUrl,
  audioMixMeta,
  backgroundAudioMeta,
  originalVoiceUsername,
  eventDate,
  eventLocation,
  location,
  feeling,
  momentBg,
  momentFont,
  momentFontSize,
  momentType,
  momentSpecialMessage,
  momentSpecialIcon,
  momentSpecialName,
  isCustomSpecialDay,
  momentSpecialId,
  specialDayEvents,
}) => {
  const [celebrationCarouselApi, setCelebrationCarouselApi] = useState<CarouselApi | null>(null);
  const [activeCelebrationIndex, setActiveCelebrationIndex] = useState(0);

  const renderMentions = (value: string) => {
    const parts = value.split(/(@[A-Za-z0-9_.]{2,30})/g);
    return parts.map((part, index) => {
      if (!/^@[A-Za-z0-9_.]{2,30}$/.test(part)) return part;
      const username = part.slice(1);
      return (
        <a
          key={`${username}-${index}`}
          href={`/profile/${encodeURIComponent(username)}`}
          className="font-medium text-primary hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {part}
        </a>
      );
    });
  };

  useEffect(() => {
    if (!celebrationCarouselApi) return;
    const updateSelectedSlide = () => setActiveCelebrationIndex(celebrationCarouselApi.selectedScrollSnap());
    updateSelectedSlide();
    celebrationCarouselApi.on('select', updateSelectedSlide);
    celebrationCarouselApi.on('reInit', updateSelectedSlide);
    return () => {
      celebrationCarouselApi.off('select', updateSelectedSlide);
      celebrationCarouselApi.off('reInit', updateSelectedSlide);
    };
  }, [celebrationCarouselApi]);

  useEffect(() => {
    if (!celebrationCarouselApi || (specialDayEvents?.length || 0) < 2) return;
    const timer = window.setTimeout(() => celebrationCarouselApi.scrollNext(), 20_000);
    return () => window.clearTimeout(timer);
  }, [celebrationCarouselApi, activeCelebrationIndex, specialDayEvents?.length]);

  // Determine whether we should render the postcard-style moment box
  const showMomentPostcard = (
    postType === 'moment' ||
    Boolean(momentBg) ||
    momentType === 'text' ||
    Boolean(momentSpecialMessage)
  ) && (!media_url || momentType === 'text');

  const renderMomentIcon = () => {
    if (!momentSpecialIcon) return null;
    const icon = String(momentSpecialIcon);
    if (/^https?:\/\//i.test(icon) || icon.includes('/')) {
      return (
        <img
          src={icon}
          alt={momentSpecialName || 'icon'}
          style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 6, marginBottom: 6 }}
        />
      );
    }
    return (
      <div style={{ fontSize: 28, marginBottom: 6 }} aria-hidden>
        {icon}
      </div>
    );
  };

  // Determine contrast color for text on top of background
  function getContrastYIQ(bg: string | null | undefined): '#222' | '#fff' {
    const val = String(bg || '');
    if (val.startsWith('linear-gradient') || val.startsWith('radial-gradient')) return '#fff';
    if (val.startsWith('url(')) return '#fff';
    let hex = val;
    if (hex.startsWith('#')) hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
    if (hex.length !== 6) return '#fff';
    const r = parseInt(hex.substr(0,2),16);
    const g = parseInt(hex.substr(2,2),16);
    const b = parseInt(hex.substr(4,2),16);
    const yiq = ((r*299)+(g*587)+(b*114))/1000;
    return yiq >= 180 ? '#222' : '#fff';
  }

  const renderSpecialDayOverlay = () => {
    let icon: string | null = momentSpecialIcon || null;
    let name: string | null = momentSpecialName || null;
    let message: string | null = momentSpecialMessage || null;
    if (isCustomSpecialDay) {
      name = momentSpecialName || null;
    } else if (momentSpecialId) {
      const special = specialBackgrounds.find(bg => bg.id === momentSpecialId);
      if (special) {
        icon = icon || special.icon || null;
        name = name || special.name || null;
        message = message || special.description || null;
      }
    }
    if (!icon && !name && !message) return null;
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 10px',
          marginTop: 12,
          borderRadius: 10,
          background: 'rgba(0,0,0,0.42)',
          backdropFilter: 'blur(6px)',
          pointerEvents: 'none',
        }}
      >
        {icon && (
          <span
            style={{
              flex: '0 0 auto',
              fontSize: 26,
              textShadow: '0 2px 8px #0008',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/^https?:\/\//i.test(String(icon)) || String(icon).includes('/') ? (
              <img src={String(icon)} alt={name || 'Special day icon'} style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 6 }} />
            ) : (
              <span aria-hidden>{icon}</span>
            )}
          </span>
        )}
        <div style={{ minWidth: 0, flex: 1, color: '#fff', textShadow: '0 1px 4px #000' }}>
          {name && <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{name}</div>}
          {message && <div style={{ marginTop: name ? 2 : 0, fontSize: 12, fontWeight: 600, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{message}</div>}
        </div>
      </div>
    );
  };
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // Register only this post's videos with the shared, exclusive feed player.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = getFeedVideoObserver();
    const videos = Array.from(container.querySelectorAll('video'));
    const handlePlay = (event: Event) => activateFeedVideo(event.currentTarget as HTMLVideoElement);

    videos.forEach((video) => {
      video.muted = true;
      video.addEventListener('play', handlePlay);
      observer.observe(video);
    });

    return () => {
      videos.forEach((video) => {
        observer.unobserve(video);
        video.removeEventListener('play', handlePlay);
        visibleFeedVideos.delete(video);
        if (activeFeedVideo === video) {
          const nextVideo = [...visibleFeedVideos.entries()]
            .sort((first, second) => second[1] - first[1])[0]?.[0] || null;
          setActiveFeedVideo(nextVideo);
        }
      });
    };
  }, []);

  // Autoplay background + voice audio for posts (max 30s). No visible controls in feed.
  const bgRef = React.useRef<HTMLAudioElement | null>(null);
  const vRef = React.useRef<HTMLAudioElement | null>(null);
  const startAudioRef = React.useRef<(() => Promise<boolean>) | null>(null);
  const pauseAudioRef = React.useRef<(() => void) | null>(null);
  const [resolvedBgUrl, setResolvedBgUrl] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  useEffect(() => {
    let stopTimer: number | null = null;
    let observer: IntersectionObserver | null = null;

    const setupAudio = () => {
      const src = backgroundAudioUrl || resolvedBgUrl || null;
      if (src) {
        bgRef.current = new Audio(src);
        bgRef.current.crossOrigin = 'anonymous';
        bgRef.current.volume = audioMixMeta?.backgroundVolume ?? 0.6;
        bgRef.current.muted = muted;
        // background soundtrack should loop
        bgRef.current.loop = true;
        // If a mix offset was provided, try to seek to it before playback.
        try {
          const offsetMs = Number(audioMixMeta?.offsetMs || 0);
          if (offsetMs > 0) {
            // If metadata already loaded this will set immediately, otherwise set after loadedmetadata
            try { bgRef.current.currentTime = offsetMs / 1000; } catch (e) {
              bgRef.current.addEventListener('loadedmetadata', function handleMeta() {
                try { bgRef.current && (bgRef.current.currentTime = offsetMs / 1000); } catch (err) {}
                try { bgRef.current && bgRef.current.removeEventListener('loadedmetadata', handleMeta); } catch (e) {}
              });
            }
          }
        } catch (e) {
          // ignore seek errors
        }
        // attach simple event handlers for debugging
        bgRef.current.addEventListener('error', (e) => {
          // eslint-disable-next-line no-console
          console.warn('Background audio error', e, src);
        });
        bgRef.current.addEventListener('playing', () => {
          // eslint-disable-next-line no-console
          console.debug('Background audio started playing', src);
        });
      }
      if (voiceNoteUrl) {
        vRef.current = new Audio(voiceNoteUrl);
        vRef.current.crossOrigin = 'anonymous';
        vRef.current.volume = audioMixMeta?.voiceVolume ?? 1;
        vRef.current.muted = muted;
      }
    };

    const pauseAll = () => {
      try { bgRef.current?.pause(); vRef.current?.pause(); } catch (e) {}
      setAudioPlaying(false);
      if (stopTimer) {
        window.clearTimeout(stopTimer);
        stopTimer = null;
      }
    };

    const startAudio = async () => {
      const audioElements = [bgRef.current, vRef.current].filter(
        (audio): audio is HTMLAudioElement => Boolean(audio)
      );
      if (audioElements.length === 0) return false;

      const results = await Promise.all(audioElements.map(async audio => {
        try {
          await audio.play();
          return true;
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('Post audio play failed', err, audio.src);
          return false;
        }
      }));

      if (results.some(result => !result)) {
        pauseAll();
        setAutoplayBlocked(true);
        return false;
      }

      setAutoplayBlocked(false);
      setAudioPlaying(true);
      if (stopTimer) window.clearTimeout(stopTimer);
      stopTimer = window.setTimeout(pauseAll, 30000);
      return true;
    };

    startAudioRef.current = startAudio;
    pauseAudioRef.current = pauseAll;

    // Only observe if there is audio available
    if ((backgroundAudioUrl || resolvedBgUrl || voiceNoteUrl) && containerRef.current) {
      setupAudio();
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          const ratio = entry.intersectionRatio || 0;
          if (ratio >= 0.6) {
            // play when >=60% visible
            void startAudio();
          } else {
            // pause otherwise
            pauseAll();
          }
        });
      }, { threshold: [0, 0.25, 0.5, 0.6, 0.75, 1] });
      observer.observe(containerRef.current);
    }

    return () => {
      pauseAll();
      if (observer && containerRef.current) observer.unobserve(containerRef.current);
      startAudioRef.current = null;
      pauseAudioRef.current = null;
      bgRef.current = null;
      vRef.current = null;
    };
    // Audio refs are updated directly by the mute control; do not rebuild them.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backgroundAudioUrl, resolvedBgUrl, voiceNoteUrl, audioMixMeta?.backgroundVolume, audioMixMeta?.voiceVolume]);

  // If the post provides a backgroundAudioMeta but not a direct URL, try to
  // resolve the URL by looking up the synced sound bank at /sounds.json.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!backgroundAudioUrl && backgroundAudioMeta?.id) {
          const res = await fetch('/sounds.json');
          if (!res.ok) return;
          const list = await res.json();
          if (!mounted) return;
          const match = Array.isArray(list) ? list.find((s: any) => String(s.id) === String(backgroundAudioMeta.id)) : null;
          if (match && match.url) setResolvedBgUrl(match.url);
        }
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, [backgroundAudioUrl, backgroundAudioMeta?.id]);

  // Modal logic extended for carousel!
  const [modalImageIndex, setModalImageIndex] = useState<number | null>(null);
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

  // Helper to determine object-fit for single media (currently using object-cover by default)

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
                className="block h-auto max-h-[70vh] w-full object-contain"
                preload="metadata"
                controls
                muted
                playsInline
                webkit-playsinline="true"
                x5-playsinline="true"
                disablePictureInPicture
                onLoadedData={handleVideoLoaded}
                onError={e => {
                    console.error('Video failed to load:', url, e);
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                style={{ background: '#222', visibility: 'hidden' }}
              >
                <source src={url} type="video/mp4" />
                <source src={url} type="video/webm" />
                Your browser does not support the video tag.
              </video>
              <div style={{display:'none',position:'absolute',top:0,left:0,right:0,bottom:0,background:'#222',color:'#fff',alignItems:'center',justifyContent:'center',zIndex:2,fontSize:'1rem'}}>
                Video failed to load or play.
              </div>
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
              onLoadedData={handleVideoLoaded}
              style={{ visibility: 'hidden' }}
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
              aspectRatio: singleMediaDims ? `${singleMediaDims.w} / ${singleMediaDims.h}` : '4 / 5',
              maxHeight: '500px', 
              width: '100%',
              position: 'relative',
              zIndex: 1,
              isolation: 'isolate'
            }}
          >
            <video
              src={url}
              className="w-full h-full object-contain rounded-lg shadow-sm cursor-pointer"
              style={{ maxHeight: '500px', aspectRatio: singleMediaDims ? `${singleMediaDims.w} / ${singleMediaDims.h}` : '4 / 5', visibility: 'hidden' }}
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
              onLoadedData={handleVideoLoaded}
            >
              <source src={url} type="video/mp4" />
              <source src={url} type="video/webm" />
              Your browser does not support the video tag.
            </video>
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
                onLoadedData={handleVideoLoaded}
                style={{ visibility: 'hidden' }}
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
              aspectRatio: singleMediaDims ? `${singleMediaDims.w} / ${singleMediaDims.h}` : '4 / 5',
              maxHeight: '500px', 
              width: '100%',
              position: 'relative',
              zIndex: 1,
              isolation: 'isolate'
            }}
          >
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
              onLoadedData={handleVideoLoaded}
              style={{ maxHeight: '500px', aspectRatio: singleMediaDims ? `${singleMediaDims.w} / ${singleMediaDims.h}` : '4 / 5', visibility: 'hidden' }}
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
  
  // Video load handler to ensure we reveal video only after frames are available
  const handleVideoLoaded = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    try {
      const v = e.currentTarget;
      // Log for debugging
      // eslint-disable-next-line no-console
      console.debug('video loaded metadata', v.currentSrc, v.videoWidth, v.videoHeight);
      // Ensure the element is visible (in case we hide until loaded)
      v.style.visibility = 'visible';
      v.style.background = 'none';
    } catch (err) {
      // ignore
    }
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
    // If there's a background audio or voice, render compact inline audio info with mute toggle
    if (backgroundAudioUrl || voiceNoteUrl) {
      const bgTitle = backgroundAudioMeta?.title || (backgroundAudioUrl ? backgroundAudioUrl.split('/').pop() : 'Unknown');
      return (
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              aria-label={audioPlaying ? 'Pause post audio' : 'Play post audio'}
              title={audioPlaying ? 'Pause post audio' : 'Play post audio'}
              onClick={() => {
                if (audioPlaying) pauseAudioRef.current?.();
                else void startAudioRef.current?.();
              }}
              className="p-2 rounded-md bg-gray-800 text-white"
            >
              {audioPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              aria-label={muted ? 'Unmute' : 'Mute'}
              onClick={() => {
                setMuted(prev => !prev);
                try {
                  if (bgRef.current) bgRef.current.muted = !muted;
                  if (vRef.current) vRef.current.muted = !muted;
                } catch (e) {}
              }}
              className="p-2 rounded-md bg-gray-800 text-white"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <div className="text-sm text-gray-400">
              <div>Background: {backgroundAudioUrl ? bgTitle : 'None'}</div>
              <div>Original Voice: {originalVoiceUsername ? `@${originalVoiceUsername}` : 'Unknown'}</div>
            </div>
          </div>
          {autoplayBlocked && !audioPlaying && (
            <div className="text-xs text-gray-500">Tap play to start audio</div>
          )}
        </div>
      );
    }
    if (postType === 'voice' && voiceNoteUrl) {
      return (
        <div className="mt-3">
          <VoicePlayer 
            audioUrl={voiceNoteUrl}
            duration={voiceDuration || 0}
          />
        </div>
      );
    }
    return null;
  };

  return (
  <div ref={containerRef}>
      {/* If this post was created as a moment (or carries moment metadata), render postcard-style */}
      {showMomentPostcard && (
        <div
          className="mt-3 rounded-lg overflow-hidden flex flex-col items-stretch justify-center"
          style={{
            position: 'relative',
            background: momentBg || 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)',
            color: getContrastYIQ(momentBg),
            padding: '1rem',
            textAlign: 'center',
            borderRadius: 12,
          }}
        >
          <div style={{ maxWidth: '100%', width: '100%' }}>
            {specialDayEvents && specialDayEvents.length > 1 ? (
              <div className="overflow-hidden rounded-xl text-left text-white" aria-label="Today's special day celebrations">
                <Carousel
                  setApi={setCelebrationCarouselApi}
                  opts={{ align: 'start', loop: true }}
                  aria-label="Special day celebrations"
                >
                  <CarouselContent className="ml-0">
                    {specialDayEvents.map((event) => (
                      <CarouselItem key={event.id} className="pl-0">
                        <article
                          className="relative flex min-h-56 flex-col justify-end overflow-hidden px-6 pb-8 pt-14 sm:min-h-64"
                          style={{ background: event.background || 'linear-gradient(135deg, #0f766e, #164e63)' }}
                        >
                          <div className="absolute inset-0 bg-black/25" aria-hidden="true" />
                          {event.countryCode && (
                            <div className="absolute right-4 top-4 z-10 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/45 px-3 py-1.5 text-xs font-semibold text-white shadow-sm backdrop-blur-sm">
                              <ReactCountryFlag
                                countryCode={event.countryCode.toUpperCase()}
                                svg
                                aria-label={`${event.countryCode.toUpperCase()} flag`}
                                style={{ width: '1.35em', height: '1.35em', borderRadius: 2 }}
                              />
                              <span>{event.countryCode.toUpperCase()}</span>
                            </div>
                          )}
                          <div className="relative z-10 flex items-start gap-4">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black/25 text-3xl shadow-md">
                              {/^(https?:\/\/|\/)/i.test(event.icon) ? (
                                <img src={event.icon} alt="" className="h-full w-full object-cover" />
                              ) : event.icon}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold uppercase tracking-wide text-white/75">NexSq Special Day</p>
                              <h3 className="mt-1 break-words text-xl font-bold leading-tight sm:text-2xl">{event.name}</h3>
                              {event.description && (
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/90">{event.description}</p>
                              )}
                            </div>
                          </div>
                        </article>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <div className="flex items-center justify-between gap-3 bg-black/80 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <CarouselPrevious
                        className="static h-8 w-8 translate-y-0 border-white/30 bg-white/10 text-white hover:bg-white/20"
                        aria-label="Previous celebration"
                      />
                      <span className="min-w-[4.5rem] text-center text-xs font-medium text-white/75">
                        {activeCelebrationIndex + 1} / {specialDayEvents.length}
                      </span>
                      <CarouselNext
                        className="static h-8 w-8 translate-y-0 border-white/30 bg-white/10 text-white hover:bg-white/20"
                        aria-label="Next celebration"
                      />
                    </div>
                    <div className="flex items-center justify-center gap-2" role="group" aria-label="Choose celebration">
                      {specialDayEvents.map((event, index) => (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => celebrationCarouselApi?.scrollTo(index)}
                          aria-label={`Show celebration ${index + 1}: ${event.name}`}
                          aria-current={activeCelebrationIndex === index ? 'true' : undefined}
                          className={`h-1.5 rounded-full transition-all ${activeCelebrationIndex === index ? 'w-6 bg-white' : 'w-1.5 bg-white/45'}`}
                        />
                      ))}
                    </div>
                    <span className="sr-only">Celebration {activeCelebrationIndex + 1} of {specialDayEvents.length}</span>
                  </div>
                </Carousel>
              </div>
            ) : (
            <>
            {renderMomentIcon()}
            {/* Main text - rendered on the canvas; if there's no content we skip */}
            {content ? (
              <div
                style={{
                  fontFamily: momentFont || 'inherit',
                  fontSize: momentFontSize ? `${momentFontSize}px` : '16px',
                  fontWeight: 600,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  overflowWrap: 'anywhere',
                  lineHeight: 1.25,
                  color: getContrastYIQ(momentBg),
                }}
              >
                {content}
              </div>
            ) : null}

          {/* Special day overlay (icon bottom-left and caption bottom-right) */}
          {renderSpecialDayOverlay()}
          </>
          )}
        </div>
        </div>
      )}

      {/* When the postcard is shown the canvas already contains the text, so avoid duplicating */}
      {!showMomentPostcard && content && (
        <p className="text-gray-900 dark:text-gray-100 leading-relaxed whitespace-pre-wrap">
          {renderMentions(content)}
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
