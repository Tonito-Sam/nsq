import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  X,
  Copy,
  Check,
  DownloadCloud,
  Share2,
  MessageSquare,
  Twitter,
  Facebook,
  Linkedin,
  Link as LinkIcon,
  Sparkles,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface VideoShareModalProps {
  show: boolean;
  onClose: () => void;
  videoUrl: string;
  videoId?: string | number;
  title?: string;
  creatorName?: string;
  creatorAvatarUrl?: string;
  creatorUrl?: string;
  initialDownloadCount?: number;
  onDownloadCountChange?: (count: number) => void;
}

// ─── Share targets config ─────────────────────────────────────────────────────

const SHARE_TARGETS = [
  {
    key: 'copy',
    label: 'Copy Link',
    icon: LinkIcon,
    handler: 'copy',
    accent: 'from-slate-500 to-slate-600',
  },
  {
    key: 'native',
    label: 'Share',
    icon: Share2,
    handler: 'native',
    accent: 'from-purple-500 to-fuchsia-500',
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    icon: MessageSquare,
    handler: 'whatsapp',
    accent: 'from-emerald-500 to-green-500',
  },
  {
    key: 'x',
    label: 'X',
    icon: Twitter,
    handler: 'x',
    accent: 'from-gray-800 to-gray-900',
  },
  {
    key: 'facebook',
    label: 'Facebook',
    icon: Facebook,
    handler: 'facebook',
    accent: 'from-blue-600 to-blue-500',
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    icon: Linkedin,
    handler: 'linkedin',
    accent: 'from-sky-600 to-blue-500',
  },
] as const;

// ─── Share pill button ────────────────────────────────────────────────────────

const SharePill = ({
  icon: Icon,
  label,
  accent,
  onClick,
  disabled,
}: {
  icon: React.ElementType;
  label: string;
  accent: string;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'group relative flex items-center gap-2.5 rounded-xl border border-border/60 bg-card',
      'px-3 py-2.5 text-left text-xs font-medium transition-all duration-200',
      'hover:border-border hover:bg-accent/40 hover:shadow-sm active:scale-[0.98]',
      'disabled:opacity-50 disabled:pointer-events-none',
    )}
  >
    <span
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm',
        'transition-transform duration-200 group-hover:scale-105',
        accent,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
    <span className="truncate">{label}</span>
  </button>
);

// ─── Main component ───────────────────────────────────────────────────────────

export default function VideoShareModal({
  show,
  onClose,
  videoUrl,
  videoId,
  title,
  creatorName,
  creatorAvatarUrl,
  creatorUrl,
  initialDownloadCount = 0,
  onDownloadCountChange,
}: VideoShareModalProps) {
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStage, setDownloadStage] = useState('');
  const [downloadCount, setDownloadCount] = useState(Number(initialDownloadCount) || 0);
  const [copied, setCopied] = useState(false);

  // ── Download count subscription ───────────────────────────────────────────

  useEffect(() => {
    if (!show || !videoId) return;
    let active = true;
    const client = supabase as any;
    const updateCount = (value: unknown) => {
      const count = Number(value) || 0;
      if (!active) return;
      setDownloadCount(count);
      onDownloadCountChange?.(count);
    };
    const loadCount = async () => {
      const { data, error } = await client
        .from('studio_videos')
        .select('download_count')
        .eq('id', String(videoId))
        .maybeSingle();
      if (!error) updateCount(data?.download_count);
    };
    void loadCount();
    const channel = client
      .channel(`studio-video-downloads-${videoId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'studio_videos',
          filter: `id=eq.${videoId}`,
        },
        (payload: any) => {
          updateCount(payload.new?.download_count);
        },
      )
      .subscribe();

    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, [show, videoId, onDownloadCountChange]);

  useEffect(() => {
    setDownloadCount(Number(initialDownloadCount) || 0);
  }, [videoId, initialDownloadCount]);

  // ── Escape key + body scroll lock ─────────────────────────────────────────

  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !processing) onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [show, processing, onClose]);

  if (!show) return null;

  // ── Share handlers ────────────────────────────────────────────────────────

  const shareUrl = `${window.location.origin}/studio/video/${videoId ?? ''}`;
  const shareTitle = title ? `${title} - ` : '';

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({ description: 'Video URL copied to clipboard.' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ description: 'Failed to copy link', variant: 'destructive' });
    }
  };

  const handleNativeShare = async () => {
    if ((navigator as any).share) {
      try {
        await (navigator as any).share({
          title: title || 'Video',
          text: title || 'Check out this video',
          url: shareUrl,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      toast({ description: 'Native share is not supported on this browser.' });
    }
  };

  const handleShareToWhatsApp = () => {
    const text = `${shareTitle}Check out this video: ${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleShareToX = () => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTitle)}&url=${encodeURIComponent(shareUrl)}`,
      '_blank',
    );
  };

  const handleShareToFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      '_blank',
    );
  };

  const handleShareToLinkedIn = () => {
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
      '_blank',
    );
  };

  const handleShareAction = (handler: string) => {
    switch (handler) {
      case 'copy':
        return handleCopyLink();
      case 'native':
        return handleNativeShare();
      case 'whatsapp':
        return handleShareToWhatsApp();
      case 'x':
        return handleShareToX();
      case 'facebook':
        return handleShareToFacebook();
      case 'linkedin':
        return handleShareToLinkedIn();
    }
  };

  // ── Download handler (unchanged logic, preserved verbatim) ────────────────

  const handleDownload = async () => {
    setProcessing(true);
    setDownloadProgress(0);
    setDownloadStage('Downloading video');
    let videoObjectUrl = '';
    let downloadUrl = '';
    let videoElement: HTMLVideoElement | null = null;
    let outroAudio: HTMLAudioElement | null = null;
    let audioContext: AudioContext | null = null;
    let canvasStream: MediaStream | null = null;
    let combinedStream: MediaStream | null = null;
    let animationFrame = 0;
    try {
      const supportsMediaRecorder = typeof (window as any).MediaRecorder !== 'undefined';
      const supportsCaptureStream =
        typeof HTMLCanvasElement !== 'undefined' &&
        !!(HTMLCanvasElement.prototype as any).captureStream;
      const supportsAudioContext = !!(window.AudioContext || (window as any).webkitAudioContext);
      if (!supportsMediaRecorder || !supportsCaptureStream || !supportsAudioContext) {
        throw new Error('This browser does not support video downloads here.');
      }

      const videoResp = await fetch(videoUrl);
      if (!videoResp.ok) throw new Error('Failed to fetch video');
      const contentLength = Number(videoResp.headers.get('content-length'));
      const reader = videoResp.body?.getReader();
      let videoBlob: Blob;
      if (reader && contentLength > 0) {
        const chunks: BlobPart[] = [];
        let bytesLoaded = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            bytesLoaded += value.byteLength;
            setDownloadProgress(Math.min(10, Math.round((bytesLoaded / contentLength) * 10)));
          }
        }
        videoBlob = new Blob(chunks, {
          type: videoResp.headers.get('content-type') || 'video/mp4',
        });
      } else {
        videoBlob = await videoResp.blob();
        setDownloadProgress(10);
      }

      setDownloadStage('Preparing video');
      videoElement = document.createElement('video');
      videoElement.preload = 'auto';
      videoElement.muted = false;
      videoObjectUrl = URL.createObjectURL(videoBlob);

      const metadataLoaded = new Promise<void>((resolve, reject) => {
        const onLoaded = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          reject(new Error('The video could not be decoded.'));
        };
        const cleanup = () => {
          videoElement?.removeEventListener('loadedmetadata', onLoaded);
          videoElement?.removeEventListener('error', onError);
        };
        videoElement?.addEventListener('loadedmetadata', onLoaded, { once: true });
        videoElement?.addEventListener('error', onError, { once: true });
      });
      videoElement.src = videoObjectUrl;
      await metadataLoaded;

      const width = videoElement.videoWidth || 640;
      const height = videoElement.videoHeight || 360;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not create video canvas.');

      const brandLogo = new Image();
      brandLogo.src = '/nezsq-logo-white-removebg-preview.png';
      await new Promise<void>((resolve, reject) => {
        brandLogo.onload = () => resolve();
        brandLogo.onerror = () => reject(new Error('The download logo could not be loaded.'));
      });

      let creatorAvatar: HTMLImageElement | null = null;
      if (creatorAvatarUrl) {
        creatorAvatar = new Image();
        creatorAvatar.crossOrigin = 'anonymous';
        creatorAvatar.src = creatorAvatarUrl;
        await new Promise<void>((resolve) => {
          const timeout = window.setTimeout(() => resolve(), 4000);
          creatorAvatar?.addEventListener(
            'load',
            () => {
              window.clearTimeout(timeout);
              resolve();
            },
            { once: true },
          );
          creatorAvatar?.addEventListener(
            'error',
            () => {
              window.clearTimeout(timeout);
              resolve();
            },
            { once: true },
          );
        });
        if (!creatorAvatar.complete || !creatorAvatar.naturalWidth) creatorAvatar = null;
      }

      const drawFrame = () => {
        if (!videoElement || videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
        context.drawImage(videoElement, 0, 0, width, height);
        const unit = Math.min(width, height);
        const margin = Math.max(10, Math.round(unit * 0.035));
        const padding = Math.max(6, Math.round(unit * 0.018));
        const avatarSize = Math.min(
          Math.max(38, Math.round(unit * 0.13)),
          104,
          Math.round(height * 0.19),
        );
        const handleFontSize = Math.max(10, Math.round(unit * 0.026));
        const handle = `@${(creatorName || 'creator').replace(/^@/, '').trim()}`;
        context.save();
        context.font = `600 ${handleFontSize}px sans-serif`;
        const handleWidth = context.measureText(handle).width;
        const logoMaxWidth = avatarSize * 0.88;
        const logoMaxHeight = Math.max(14, Math.round(unit * 0.06));
        const logoScale = Math.min(logoMaxWidth / brandLogo.width, logoMaxHeight / brandLogo.height);
        const logoWidth = brandLogo.width * logoScale;
        const logoHeight = brandLogo.height * logoScale;
        const panelWidth = Math.max(avatarSize, handleWidth, logoWidth) + padding * 2;
        const panelHeight = avatarSize + handleFontSize * 1.6 + logoHeight + padding * 3;
        const panelX = Math.max(margin, width - panelWidth - margin);
        const panelY = Math.max(
          margin,
          Math.min((height - panelHeight) / 2, height - panelHeight - margin),
        );

        context.fillStyle = 'rgba(0, 0, 0, 0.48)';
        context.fillRect(panelX, panelY, panelWidth, panelHeight);

        const avatarX = panelX + (panelWidth - avatarSize) / 2;
        const avatarY = panelY + padding;
        if (creatorAvatar) {
          context.drawImage(creatorAvatar, avatarX, avatarY, avatarSize, avatarSize);
        } else {
          context.fillStyle = '#8b35d1';
          context.fillRect(avatarX, avatarY, avatarSize, avatarSize);
          context.fillStyle = '#ffffff';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.font = `700 ${Math.round(avatarSize * 0.48)}px sans-serif`;
          context.fillText(
            (creatorName || 'N').replace(/^@/, '').trim().slice(0, 1).toUpperCase(),
            avatarX + avatarSize / 2,
            avatarY + avatarSize / 2,
          );
        }

        context.fillStyle = '#ffffff';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.font = `600 ${handleFontSize}px sans-serif`;
        context.fillText(
          handle,
          panelX + panelWidth / 2,
          avatarY + avatarSize + handleFontSize,
          panelWidth - padding,
        );
        context.drawImage(
          brandLogo,
          panelX + (panelWidth - logoWidth) / 2,
          avatarY + avatarSize + handleFontSize * 1.8,
          logoWidth,
          logoHeight,
        );
        context.restore();
      };

      const drawCreatorEndCard = () => {
        const background = context.createLinearGradient(0, 0, width, height);
        background.addColorStop(0, '#100b2a');
        background.addColorStop(0.55, '#24105d');
        background.addColorStop(1, '#080812');
        context.fillStyle = background;
        context.fillRect(0, 0, width, height);

        const centerX = width / 2;
        const avatarSize = Math.min(width * 0.27, height * 0.2);
        const avatarY = height * 0.23;
        context.save();
        context.beginPath();
        context.arc(centerX, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        context.clip();
        if (creatorAvatar) {
          context.drawImage(creatorAvatar, centerX - avatarSize / 2, avatarY, avatarSize, avatarSize);
        } else {
          context.fillStyle = '#8b35d1';
          context.fillRect(centerX - avatarSize / 2, avatarY, avatarSize, avatarSize);
          context.fillStyle = '#ffffff';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.font = `700 ${Math.round(avatarSize * 0.48)}px sans-serif`;
          context.fillText(
            (creatorName || 'N').trim().slice(0, 1).toUpperCase(),
            centerX,
            avatarY + avatarSize / 2,
          );
        }
        context.restore();

        const safeName = (creatorName || 'NexSq creator').trim().slice(0, 64);
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = '#ffffff';
        context.font = `700 ${Math.max(20, Math.round(height * 0.045))}px sans-serif`;
        context.fillText(safeName, centerX, avatarY + avatarSize + height * 0.08, width * 0.82);
        context.fillStyle = 'rgba(255,255,255,0.78)';
        context.font = `500 ${Math.max(14, Math.round(height * 0.026))}px sans-serif`;
        context.fillText(
          'Find and follow this creator on NexSq',
          centerX,
          avatarY + avatarSize + height * 0.15,
          width * 0.86,
        );

        const discoveryUrl = new URL(creatorUrl || '/studio', window.location.origin).toString();
        context.fillStyle = 'rgba(255,255,255,0.62)';
        context.font = `400 ${Math.max(11, Math.round(height * 0.018))}px sans-serif`;
        context.fillText(
          discoveryUrl,
          centerX,
          avatarY + avatarSize + height * 0.205,
          width * 0.9,
        );

        const logoMaxWidth = width * 0.36;
        const logoMaxHeight = height * 0.09;
        const logoScale = Math.min(logoMaxWidth / brandLogo.width, logoMaxHeight / brandLogo.height);
        const logoWidth = brandLogo.width * logoScale;
        const logoHeight = brandLogo.height * logoScale;
        context.drawImage(brandLogo, centerX - logoWidth / 2, height * 0.82, logoWidth, logoHeight);
      };

      canvasStream = (canvas as any).captureStream(30);
      if (!canvasStream) throw new Error('Could not capture the branded video stream.');
      const AudioContextConstructor = window.AudioContext || (window as any).webkitAudioContext;
      audioContext = new AudioContextConstructor();
      const destination = audioContext.createMediaStreamDestination();
      const videoSource = audioContext.createMediaElementSource(videoElement);
      videoSource.connect(destination);
      outroAudio = document.createElement('audio');
      outroAudio.preload = 'auto';
      outroAudio.src = '/whistle.mp3';
      const outroSource = audioContext.createMediaElementSource(outroAudio);
      outroSource.connect(destination);
      combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...destination.stream.getAudioTracks(),
      ]);

      const mimeCandidates = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
      ];
      const mime = mimeCandidates.find((type) => MediaRecorder.isTypeSupported(type));
      const recordedChunks: Blob[] = [];
      const recorder = mime
        ? new MediaRecorder(combinedStream, { mimeType: mime })
        : new MediaRecorder(combinedStream);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunks.push(event.data);
      };

      const playbackFinished = new Promise<void>((resolve, reject) => {
        videoElement?.addEventListener('ended', () => resolve(), { once: true });
        videoElement?.addEventListener(
          'error',
          () => reject(new Error('Video playback failed during export.')),
          { once: true },
        );
      });
      const updateProgress = () => {
        if (!videoElement || !Number.isFinite(videoElement.duration) || videoElement.duration <= 0)
          return;
        const ratio = videoElement.currentTime / videoElement.duration;
        setDownloadProgress(Math.min(95, 10 + Math.round(ratio * 85)));
      };
      videoElement.addEventListener('timeupdate', updateProgress);
      const render = () => {
        if (!videoElement || videoElement.ended) return;
        drawFrame();
        animationFrame = requestAnimationFrame(render);
      };

      recorder.start(1000);
      setDownloadStage('Encoding video');
      render();
      await audioContext.resume();
      await videoElement.play();
      await playbackFinished;
      cancelAnimationFrame(animationFrame);
      setDownloadStage('Adding creator outro');
      const endCardDuration = Math.max(
        3000,
        Number.isFinite(outroAudio.duration) ? outroAudio.duration * 1000 : 3000,
      );
      const endCardStartedAt = performance.now();
      const endCardRendered = new Promise<void>((resolve) => {
        const renderEndCard = (now: number) => {
          drawCreatorEndCard();
          const progress = Math.min(1, (now - endCardStartedAt) / endCardDuration);
          setDownloadProgress(Math.min(96, 92 + Math.round(progress * 4)));
          if (progress >= 1) resolve();
          else animationFrame = requestAnimationFrame(renderEndCard);
        };
        animationFrame = requestAnimationFrame(renderEndCard);
      });
      const outroFinished = new Promise<void>((resolve) => {
        if (!outroAudio) return resolve();
        const timeout = window.setTimeout(() => resolve(), 15000);
        outroAudio.addEventListener(
          'ended',
          () => {
            window.clearTimeout(timeout);
            resolve();
          },
          { once: true },
        );
        outroAudio.addEventListener(
          'error',
          () => {
            window.clearTimeout(timeout);
            resolve();
          },
          { once: true },
        );
        void outroAudio.play().catch(() => {
          window.clearTimeout(timeout);
          resolve();
        });
      });
      await Promise.all([endCardRendered, outroFinished]);
      videoElement.removeEventListener('timeupdate', updateProgress);
      setDownloadStage('Finalizing download');
      setDownloadProgress(97);

      const recordingStopped = new Promise<void>((resolve) => {
        recorder.addEventListener('stop', () => resolve(), { once: true });
      });
      recorder.stop();
      await recordingStopped;

      const outputType = recorder.mimeType || mime || 'video/webm';
      const blob = new Blob(recordedChunks, { type: outputType });
      if (!blob.size) throw new Error('The video export was empty.');
      downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const extension = outputType.includes('mp4') ? 'mp4' : 'webm';
      a.download = `${
        title ? title.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'video'
      }_${Date.now()}.${extension}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (videoId) {
        const { data: updatedCount, error: countError } = await (supabase as any).rpc(
          'increment_studio_video_downloads',
          { p_video_id: String(videoId) },
        );
        if (countError) {
          console.error('Could not record video download:', countError);
        } else {
          const count = Number(updatedCount || 0);
          setDownloadCount(count);
          onDownloadCountChange?.(count);
        }
      }
      setDownloadProgress(100);
      setDownloadStage('Download started');
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 60000);
      toast({ description: 'Download started with creator details and NexSq branding.' });
    } catch (e) {
      console.error('Video download failed:', e);
      toast({
        description: e instanceof Error ? e.message : 'Could not prepare the download.',
        variant: 'destructive',
      });
    } finally {
      cancelAnimationFrame(animationFrame);
      canvasStream?.getTracks().forEach((track) => track.stop());
      combinedStream?.getTracks().forEach((track) => track.stop());
      if (audioContext && audioContext.state !== 'closed')
        await audioContext.close().catch(() => {});
      if (videoElement) {
        videoElement.pause();
        videoElement.removeAttribute('src');
        videoElement.load();
        videoElement.remove();
      }
      if (outroAudio) {
        outroAudio.pause();
        outroAudio.removeAttribute('src');
        outroAudio.load();
        outroAudio.remove();
      }
      if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl);
      setProcessing(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/70 backdrop-blur-sm p-0 sm:items-center sm:p-4 animate-in fade-in duration-200"
      onClick={() => !processing && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Share video"
    >
      <Card
        className={cn(
          'relative w-full max-w-md overflow-hidden border-border/60 bg-card shadow-2xl',
          'rounded-t-3xl sm:rounded-2xl',
          'max-h-[calc(100dvh-1rem)] overflow-y-auto',
          'animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-2 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-2 sm:pt-5">
          <div className="min-w-0">
            <h3 className="text-base font-semibold leading-tight">Share Video</h3>
            {title && (
              <p className="text-xs text-muted-foreground mt-1 truncate max-w-[280px]">{title}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={processing}
            aria-label="Close share dialog"
            className="h-8 w-8 shrink-0 rounded-full hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Share grid */}
        <div className="px-5 py-3">
          <div className="mb-2.5 flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Share via
            </span>
            <div className="h-px flex-1 bg-border/60" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {SHARE_TARGETS.map((target) => (
              <SharePill
                key={target.key}
                icon={target.key === 'copy' && copied ? Check : target.icon}
                label={target.key === 'copy' && copied ? 'Copied!' : target.label}
                accent={target.accent}
                onClick={() => handleShareAction(target.handler)}
                disabled={processing}
              />
            ))}
          </div>
        </div>

        {/* Download section */}
        <div className="px-5 pb-5 pt-2">
          <div className="mb-2.5 flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Download
            </span>
            <div className="h-px flex-1 bg-border/60" />
          </div>

          <button
            type="button"
            onClick={handleDownload}
            disabled={processing}
            className={cn(
              'group relative flex w-full items-center gap-3 overflow-hidden rounded-xl',
              'bg-gradient-to-r from-purple-600 to-fuchsia-500 p-3.5 text-white',
              'transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/25 active:scale-[0.99]',
              'disabled:opacity-80 disabled:pointer-events-none',
            )}
          >
            {/* Animated progress fill behind content */}
            {processing && (
              <div
                className="absolute inset-y-0 left-0 bg-white/15 transition-[width] duration-300 ease-out"
                style={{ width: `${downloadProgress}%` }}
              />
            )}
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
              <DownloadCloud className={cn('h-4.5 w-4.5', processing && 'animate-pulse')} />
            </span>
            <div className="relative flex-1 min-w-0 text-left">
              <div className="text-sm font-semibold leading-tight">
                {processing ? downloadStage || 'Preparing…' : 'Download Video'}
              </div>
              <div className="text-[11px] text-white/75 leading-tight mt-0.5">
                {processing
                  ? `${downloadProgress}% · Branded with creator details`
                  : 'With creator credits & NexSq branding'}
              </div>
            </div>
            {!processing && <Sparkles className="relative h-4 w-4 text-white/70 shrink-0" />}
          </button>

          {/* Progress detail row */}
          {processing && (
            <div className="mt-2.5 space-y-1.5" aria-live="polite">
              <div
                role="progressbar"
                aria-label="Download preparation progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={downloadProgress}
                className="h-1 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-500 transition-[width] duration-300 ease-out"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Download count */}
          <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <DownloadCloud className="h-3 w-3" />
            <span className="tabular-nums">{downloadCount.toLocaleString()}</span>
            <span>downloads</span>
          </div>
        </div>
      </Card>
    </div>
  );
}