import React, { useEffect, useMemo, useRef, useState } from "react";
import { SafariCompatibleVideo } from "./SafariCompatibleVideo";
import { Volume2, VolumeX, Video, UserCheck, Heart, Eye, MessageCircle, Radio, Settings as SettingsIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

/** --- Types --------------------------------------------------------------- */
export interface ReelVideo {
  id: string;
  video_url: string;
  thumbnail_url?: string | null;
  caption?: string | null;
  views?: number;
  views_count?: number;
  likes?: number;
  likes_count?: number;
  comments_count?: number;
  channel_id: string;
  channel_name?: string;
  user_id: string;
  is_series?: boolean;
  series_title?: string;
  subscription_amount?: number;
}

interface ReelCardProps {
  video: ReelVideo;
  onLike: (id: string) => void;
  onView: (id: string) => void; // fired once per mount when view threshold hit
  userLikes: Set<string>;
  onSubscribe: (channelId: string, subscribed: boolean) => void;
  isSubscribed: boolean;
  subscriberCount: number;
  mobile?: boolean;
  /** Set of “owned” series titles (or channel ids if you prefer). */
  ownedSeries?: Set<string>;
  onBuySeries?: (seriesTitle: string, authorId: string, price: number) => void;
  userData?: any;
  creatorData?: { username?: string } | any;
  isDesktop: boolean;
  isActive?: boolean;
}

/** --- Component ----------------------------------------------------------- */
const ReelCard: React.FC<ReelCardProps> = ({
  video,
  onLike,
  onView,
  userLikes,
  onSubscribe,
  isSubscribed,
  subscriberCount,
  mobile,
  ownedSeries,
  onBuySeries,
  userData,
  creatorData,
  isDesktop,
  isActive,
}) => {
  const navigate = useNavigate();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const outroAudioRef = useRef<HTMLAudioElement | null>(null);

  const [isMuted, setIsMuted] = useState<boolean>(() => isDesktop);
  const [showBuyPrompt, setShowBuyPrompt] = useState(false);
  const [showOutro, setShowOutro] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  // const [duration, setDuration] = useState(0); // unused
  const [viewSent, setViewSent] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const isOwnedSeries = useMemo(() => {
    if (!video.is_series) return true;
    if (!ownedSeries || !video.series_title) return false;
    return ownedSeries.has(video.series_title);
  }, [ownedSeries, video.is_series, video.series_title]);

  /** Ensure muted state reflects isDesktop on video swap */
  useEffect(() => {
    setIsMuted(isDesktop);
    if (videoRef.current) {
      videoRef.current.muted = isDesktop;
    }
  }, [isDesktop, video.id]);

  /** Keep DOM video’s mute in sync with React state */
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = isMuted;
  }, [isMuted]);

  /** Attach timeupdate + loadedmetadata + ended handlers */
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    // Allow inline on iOS/Safari
    el.setAttribute("playsinline", "true");
    el.setAttribute("webkit-playsinline", "true");
    el.setAttribute("x5-playsinline", "true");

    const handleTime = () => {
  const dur = el.duration || 1;
  setProgress(el.currentTime / dur);

      // Fire a view once when 3s or 20% (whichever first) is reached
      if (!viewSent && (el.currentTime >= 3 || el.currentTime / dur >= 0.2)) {
        setViewSent(true);
        onView(video.id);
      }

      // Series trial: stop at 60s if not owned
      if (video.is_series && !isOwnedSeries && el.currentTime >= 60) {
        el.pause();
        setShowBuyPrompt(true);
      }
    };

    const handleEnded = () => {
      // mobile outro cue
      if (mobile) {
        setShowOutro(true);
        if (outroAudioRef.current) {
          try {
            void outroAudioRef.current.play();
          } catch {
            /* ignore autoplay block */
          }
        }
        // hide outro after a moment
        setTimeout(() => setShowOutro(false), 1400);
      }
    };

    el.addEventListener("timeupdate", handleTime);
    el.addEventListener("loadedmetadata", handleTime);
    el.addEventListener("ended", handleEnded);

    return () => {
      el.removeEventListener("timeupdate", handleTime);
      el.removeEventListener("loadedmetadata", handleTime);
      el.removeEventListener("ended", handleEnded);
    };
  }, [video.id, video.is_series, isOwnedSeries, mobile, onView, viewSent]);

  /** Mobile: intersection-based autoplay/unmute, pause off-screen */
  useEffect(() => {
    if (!mobile || !videoRef.current) return;
    const el = videoRef.current;
    if (isActive) {
      el.muted = false;
      setIsMuted(false);
      if (el.paused) void el.play().catch(() => undefined);
    } else {
      el.pause();
      el.muted = true;
      setIsMuted(true);
    }
  }, [mobile, video.id, isActive]);

  /** Click-to-play/pause */
  const handleVideoClick = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play();
    } else {
      el.pause();
    }
  };

  /** Values for counters with fallbacks */
  const likeCount = video.likes ?? video.likes_count ?? 0;
  const viewCount = video.views ?? video.views_count ?? 0;

  /** --- UI ---------------------------------------------------------------- */
  return (
    <div
      className={`relative w-full ${
        mobile
          ? "h-[100dvh] min-h-[100dvh] max-h-[100dvh] flex items-center justify-center bg-black"
          : "flex justify-center items-center py-4 md:py-6 bg-black"
      }`}
    >
      {/* Outro overlay (mobile) */}
      {mobile && showOutro && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-50">
          <div className="flex flex-col items-center">
            <div className="relative mb-4">
              <div className="w-20 h-20 rounded-2xl border-4 border-white shadow-xl bg-purple-600/90 flex items-center justify-center">
                <img
                  src="/favicon.ico"
                  alt="Brand Logo"
                  className="w-16 h-16 rounded-xl object-cover"
                />
              </div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-black/80 px-2 py-0.5 rounded-full text-xs text-white font-semibold border border-white">
                @{creatorData?.username || "author"}
              </div>
            </div>
          </div>
        </div>
      )}
      {mobile && <audio ref={outroAudioRef} src="/whistle.mp3" preload="auto" />}

      {/* Video container */}
      <div className={mobile ? "w-full h-full flex items-center justify-center" : "w-full flex justify-center items-center"}>
        <div className="w-full relative" style={{ minHeight: mobile ? "calc(100dvh - 60px)" : undefined }}>
          {/* SafariCompatibleVideo replaces native <video> for playback */}
          {/* Use SafariCompatibleVideo with forwardRef */}
          <div onClick={handleVideoClick}>
            {!videoError ? (
              <SafariCompatibleVideo
                src={video.video_url}
                className={
                  mobile
                    ? "w-full h-full min-h-[100dvh] max-h-[100dvh] min-w-[100vw] max-w-[100vw] object-cover object-center aspect-[9/16] bg-black"
                    : "w-full max-w-xs md:max-w-lg lg:max-w-xl xl:max-w-2xl max-h-[60vh] rounded-3xl object-contain bg-black aspect-video shadow-2xl border border-gray-800"
                }
                autoPlay={!isDesktop}
                muted={isMuted}
                loop={isOwnedSeries && !mobile}
                crossOrigin="anonymous"
                onError={() => setVideoError(true)}
                style={mobile ? { minHeight: "100dvh" } : undefined}
                // @ts-ignore
                ref={videoRef}
              />
            ) : (
              <div className="flex flex-col items-center justify-center w-full h-full text-center text-red-500 bg-black rounded-3xl" style={{minHeight: mobile ? "100dvh" : undefined}}>
                <span>Video failed to load.<br/>This may be a CORS or file issue.</span>
              </div>
            )}
          </div>

          {/* Hidden preloader keeps buffering snappy on swipe */}
          <video ref={previewVideoRef} src={video.video_url} style={{ display: "none" }} preload="auto" />

          {/* Bottom progress bar (purple) */}
          <div className={`${mobile ? "absolute bottom-[18px] left-4 right-4" : "absolute -bottom-1 left-2 right-2"} h-1 bg-white/10 rounded-full overflow-hidden`}>
            <div className="h-full bg-purple-600" style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }} />
          </div>
        </div>
      </div>

      {/* Left quick actions */}
      <div className="absolute top-1/2 left-4 flex flex-col items-center gap-4 -translate-y-1/2 z-20">
        <button
          className="bg-gray-900/70 p-2 rounded-full hover:bg-purple-600 transition text-white shadow-lg backdrop-blur-md"
          onClick={() => navigate("/studio/upload")}
          aria-label="Upload"
        >
          <Plus className="h-5 w-5" />
        </button>
        <button
          className="bg-gray-900/70 p-2 rounded-full hover:bg-purple-600 transition text-white shadow-lg backdrop-blur-md"
          onClick={() => navigate("/studio/record")}
          aria-label="Record"
        >
          <Video className="h-5 w-5" />
        </button>
        <button
          className="bg-gray-900/70 p-2 rounded-full hover:bg-purple-600 transition text-white shadow-lg backdrop-blur-md"
          onClick={() => navigate("/studio/live")}
          aria-label="Go live"
        >
          <Radio className="h-5 w-5" />
        </button>
        <button
          className="bg-gray-900/70 p-2 rounded-full hover:bg-purple-600 transition text-white shadow-lg backdrop-blur-md"
          onClick={() => navigate("/studio/settings")}
          aria-label="Settings"
        >
          <SettingsIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Mute/unmute */}
      {isDesktop ? (
        <button
          className="absolute right-6 top-4 bg-black/60 rounded-full p-2 z-30 hover:bg-black/80"
          onClick={() => setIsMuted((m) => !m)}
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <VolumeX className="h-6 w-6 text-white" /> : <Volume2 className="h-6 w-6 text-white" />}
        </button>
      ) : (
        <button
          className="absolute right-4 bg-black/60 rounded-full p-2 z-30 hover:bg-black/80"
          style={{ top: 96 }}
          onClick={() => setIsMuted((m) => !m)}
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <VolumeX className="h-6 w-6 text-white" /> : <Volume2 className="h-6 w-6 text-white" />}
        </button>
      )}

      {/* Right engagement stack */}
      <div className="absolute top-1/2 right-2 flex flex-col items-center gap-5 -translate-y-1/2 z-20">
        <button
          className={`bg-gray-900/70 p-1.5 rounded-full transition text-white shadow-lg flex flex-col items-center ${
            userLikes.has(video.id) ? "bg-pink-600 hover:bg-pink-700" : "hover:bg-pink-600"
          }`}
          style={{ marginBottom: 2 }}
          onClick={() => onLike(video.id)}
          aria-label="Like"
        >
          <Heart className={`h-4 w-4 ${userLikes.has(video.id) ? "fill-current" : ""}`} />
          <span className="text-[10px] mt-0.5">{likeCount}</span>
        </button>

        <div className="bg-gray-900/70 p-1.5 rounded-full text-white shadow-lg flex flex-col items-center" style={{ marginBottom: 2 }}>
          <Eye className="h-4 w-4" />
          <span className="text-[10px] mt-0.5">{viewCount}</span>
        </div>

        <button
          className="bg-gray-900/70 p-1.5 rounded-full text-white shadow-lg flex flex-col items-center hover:bg-blue-600 transition"
          style={{ marginBottom: 2 }}
          aria-label="Comments"
        >
          <MessageCircle className="h-4 w-4" />
          <span className="text-[10px] mt-0.5">{video.comments_count ?? 0}</span>
        </button>
      </div>

      {/* Channel badge + subscribe */}
      {video.channel_name && (
        <div className="absolute left-4 right-4 bottom-24 z-30 flex flex-col items-start gap-2">
          <div className="flex items-center gap-2">
            <span className="bg-gray-900/80 px-2 py-1 rounded-full text-xs text-white font-semibold flex items-center gap-2 backdrop-blur-md">
              <Video className="h-4 w-4" />
              <span>{video.channel_name}</span>
            </span>

            <button
              className={`px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-2 backdrop-blur-md transition-colors ${
                isSubscribed ? "bg-gray-900/80 text-white hover:bg-gray-800/90" : "bg-green-600 text-white hover:bg-green-700"
              }`}
              disabled={isSubscribed}
              onClick={() => {
                if (!isSubscribed && userData) onSubscribe(video.channel_id, isSubscribed);
              }}
              style={{ cursor: isSubscribed ? "default" : "pointer", minWidth: 60 }}
              aria-label={isSubscribed ? "Subscribed" : "Subscribe"}
            >
              <UserCheck className="h-3 w-3" />
              <span className="text-xs">{subscriberCount}</span>
              {!isSubscribed && <span className="ml-1 text-[10px] font-normal">Subscribe</span>}
            </button>
          </div>
        </div>
      )}

      {/* Series paywall prompt (after 60s preview) */}
      {video.is_series && !isOwnedSeries && showBuyPrompt && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-50">
          <div className="text-white text-lg font-bold mb-2">Preview ended</div>
          <div className="text-white mb-4">
            Subscribe to access the full <span className="font-semibold">{video.series_title}</span> series.
          </div>
          <Button
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-2 rounded-full"
            onClick={() => {
              if (onBuySeries && video.series_title && video.subscription_amount != null) {
                onBuySeries(video.series_title, video.user_id, Number(video.subscription_amount));
              }
            }}
          >
            Buy Full Series (${Number(video.subscription_amount ?? 0)})
          </Button>
        </div>
      )}
    </div>
  );
};

export default ReelCard;
