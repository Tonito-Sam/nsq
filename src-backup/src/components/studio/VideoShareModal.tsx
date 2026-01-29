import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X, Copy, DownloadCloud, Share2, MessageSquare, Twitter, Facebook, Linkedin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VideoShareModalProps {
  show: boolean;
  onClose: () => void;
  videoUrl: string;
  videoId?: string | number;
  title?: string;
}

export default function VideoShareModal({ show, onClose, videoUrl, videoId, title }: VideoShareModalProps) {
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);

  if (!show) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/studio/video/${videoId || ''}`);
      toast({ description: 'Video URL copied to clipboard.' });
    } catch (e) {
      toast({ description: 'Failed to copy link', variant: 'destructive' });
    }
  };

  const handleShareToWhatsApp = () => {
    const text = `${title ? title + ' - ' : ''}Check out this video: ${window.location.origin}/studio/video/${videoId}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleShareToX = () => {
    const text = `${title ? title + ' - ' : ''}`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.origin + '/studio/video/' + videoId)}`;
    window.open(twitterUrl, '_blank');
  };

  const handleShareToFacebook = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.origin + '/studio/video/' + videoId)}`;
    window.open(facebookUrl, '_blank');
  };

  const handleShareToLinkedIn = () => {
    const linkedin = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.origin + '/studio/video/' + videoId)}`;
    window.open(linkedin, '_blank');
  };

  const handleNativeShare = async () => {
    if ((navigator as any).share) {
      try {
        await (navigator as any).share({
          title: title || 'Video',
          text: title || 'Check out this video',
          url: `${window.location.origin}/studio/video/${videoId}`,
        });
      } catch (e) {
        // user cancelled or error
      }
    } else {
      toast({ description: 'Native share is not supported on this browser.' });
    }
  };

  // Attempt to download video concatenated with the outro audio (/whistle.mp3)
  const handleDownloadWithOutro = async () => {
    setProcessing(true);
    try {
      // Basic capability checks
      const supportsMediaRecorder = typeof (window as any).MediaRecorder !== 'undefined';
      const supportsCaptureStream = typeof HTMLCanvasElement !== 'undefined' && !!(HTMLCanvasElement.prototype as any).captureStream;
      const supportsAudioContext = !!(window.AudioContext || (window as any).webkitAudioContext);
      if (!supportsMediaRecorder || !supportsCaptureStream || !supportsAudioContext) {
        toast({ description: 'Your browser does not support client-side video composition for download.', variant: 'destructive' });
        setProcessing(false);
        return;
      }
      // Fetch the video blob
      const videoResp = await fetch(videoUrl);
      if (!videoResp.ok) throw new Error('Failed to fetch video');
      const videoBlob = await videoResp.blob();

      // Create elements
      const videoEl = document.createElement('video');
      videoEl.crossOrigin = 'anonymous';
      const videoObjectUrl = URL.createObjectURL(videoBlob);
      videoEl.src = videoObjectUrl;
      videoEl.muted = true; // allow autoplay in many browsers

      // Outro audio
      const outroAudio = document.createElement('audio');
      outroAudio.crossOrigin = 'anonymous';
      outroAudio.src = '/whistle.mp3';

      // Wait for metadata to load to get dimensions
      await new Promise<void>((resolve, reject) => {
        const onloaded = () => { resolve(); cleanup(); };
        const onerr = (e: any) => { reject(e); cleanup(); };
        function cleanup() { videoEl.removeEventListener('loadedmetadata', onloaded); videoEl.removeEventListener('error', onerr); }
        videoEl.addEventListener('loadedmetadata', onloaded);
        videoEl.addEventListener('error', onerr);
      });

      const width = videoEl.videoWidth || 640;
      const height = videoEl.videoHeight || 360;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not create canvas context');

      // Capture canvas stream
      const canvasStream = (canvas as any).captureStream(30);

      // Setup audio mixing via AudioContext
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const dest = audioCtx.createMediaStreamDestination();
      const videoSource = audioCtx.createMediaElementSource(videoEl);
      videoSource.connect(dest);
      videoSource.connect(audioCtx.destination);
      const outroSource = audioCtx.createMediaElementSource(outroAudio);
      outroSource.connect(dest);
      outroSource.connect(audioCtx.destination);

      // Combine tracks
      const combinedStream = new MediaStream();
  canvasStream.getVideoTracks().forEach((t: MediaStreamTrack) => combinedStream.addTrack(t));
  dest.stream.getAudioTracks().forEach((t: MediaStreamTrack) => combinedStream.addTrack(t));

      // MediaRecorder
      const mime = 'video/webm;codecs=vp8,opus';
      const recordedChunks: Blob[] = [];
      const recorder = new MediaRecorder(combinedStream, { mimeType: mime });
      recorder.ondataavailable = (e: BlobEvent) => {
        try {
          const chunkSize = e.data ? e.data.size : 0;
          console.log('[VideoShareModal] MediaRecorder dataavailable — chunk size:', chunkSize, 'recorder.mimeType:', (recorder as any)?.mimeType || mime);
          if (e.data && e.data.size) {
            recordedChunks.push(e.data);
          } else {
            console.warn('[VideoShareModal] Received empty MediaRecorder chunk');
          }
        } catch (err) {
          console.error('[VideoShareModal] Error in ondataavailable handler:', err);
        }
      };
      recorder.onstop = () => {
        try {
          const totalBytes = recordedChunks.reduce((s, c) => s + (c.size || 0), 0);
          console.log('[VideoShareModal] MediaRecorder stopped — total chunks:', recordedChunks.length, 'total bytes:', totalBytes, 'mime:', (recorder as any)?.mimeType || mime);
        } catch (err) {
          console.error('[VideoShareModal] Error in recorder.onstop:', err);
        }
      };

      // Draw frames from video to canvas
      let rafId = 0;
      const render = () => {
        if (videoEl.ended) return;
        ctx.drawImage(videoEl, 0, 0, width, height);
        rafId = requestAnimationFrame(render);
      };

      // Start recording when playing
      recorder.start();
      videoEl.play().catch(() => {});
      // Start rendering
      render();

      // Wait for video to end, then play outro and record until outro ends
      await new Promise<void>((resolve) => {
        videoEl.addEventListener('ended', async () => {
          // stop rendering frames from video
          cancelAnimationFrame(rafId);

          // Play outro (audio only) with a frozen last video frame
          // draw last frame once
          ctx.drawImage(videoEl, 0, 0, width, height);

          // Start outro
          outroAudio.play().catch(() => {});

          outroAudio.addEventListener('ended', () => {
            resolve();
          });
        });
      });

      // Small delay to ensure last audio samples captured
      await new Promise(r => setTimeout(r, 250));

      recorder.stop();

  const totalBytes = recordedChunks.reduce((s, c) => s + (c.size || 0), 0);
  console.log('[VideoShareModal] Creating blob from recorded chunks — count:', recordedChunks.length, 'bytes:', totalBytes, 'mime:', mime);
  const blob = new Blob(recordedChunks, { type: mime });
  console.log('[VideoShareModal] Created blob — size:', blob.size, 'type:', blob.type);
  const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${title ? title.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'video'}_${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      // Cleanup
      URL.revokeObjectURL(videoObjectUrl);
      URL.revokeObjectURL(downloadUrl);
      audioCtx.close().catch(() => {});
      videoEl.remove();
      outroAudio.remove();

  toast({ description: `Download started. recordedChunks=${recordedChunks.length}, size=${blob.size} bytes.` });
    } catch (e) {
      console.error('Download with outro failed:', e);
      // Fallback: attempt direct download of original video so user still gets a playable file
      try {
        console.log('[VideoShareModal] Attempting fallback: download original video file');
        const resp = await fetch(videoUrl);
        if (!resp.ok) throw new Error('Failed to fetch original video for fallback');
        const fallbackBlob = await resp.blob();
        console.log('[VideoShareModal] Fallback blob type:', fallbackBlob.type, 'size:', fallbackBlob.size);
        const url = URL.createObjectURL(fallbackBlob);
        const a = document.createElement('a');
        a.href = url;
        // keep original extension if possible
        const ext = fallbackBlob.type && fallbackBlob.type.includes('webm') ? 'webm' : fallbackBlob.type && fallbackBlob.type.includes('mp4') ? 'mp4' : 'mp4';
        a.download = `${title ? title.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'video'}_orig_${Date.now()}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast({ description: `Original video downloaded as a fallback (size=${fallbackBlob.size} bytes, type=${fallbackBlob.type}).` });
      } catch (fallbackErr) {
        console.error('[VideoShareModal] Fallback download also failed:', fallbackErr);
        toast({ description: 'Failed to prepare download with outro and fallback', variant: 'destructive' });
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60 p-4">
      <Card className="w-full max-w-md p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Share Video</h3>
          <Button variant="ghost" size="icon" onClick={onClose}><X /></Button>
        </div>

        {/* Grid of compact share actions */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Button onClick={handleCopyLink} className="w-full flex flex-col items-center justify-center gap-1 py-3">
            <Copy className="w-5 h-5" />
            <span className="text-xs">Copy</span>
          </Button>
          <Button onClick={handleNativeShare} className="w-full flex flex-col items-center justify-center gap-1 py-3">
            <Share2 className="w-5 h-5" />
            <span className="text-xs">Native</span>
          </Button>
          <Button onClick={handleShareToWhatsApp} className="w-full flex flex-col items-center justify-center gap-1 py-3">
            <MessageSquare className="w-5 h-5" />
            <span className="text-xs">WhatsApp</span>
          </Button>
          <Button onClick={handleShareToX} className="w-full flex flex-col items-center justify-center gap-1 py-3">
            <Twitter className="w-5 h-5" />
            <span className="text-xs">X</span>
          </Button>
          <Button onClick={handleShareToFacebook} className="w-full flex flex-col items-center justify-center gap-1 py-3">
            <Facebook className="w-5 h-5" />
            <span className="text-xs">Facebook</span>
          </Button>
          <Button onClick={handleShareToLinkedIn} className="w-full flex flex-col items-center justify-center gap-1 py-3">
            <Linkedin className="w-5 h-5" />
            <span className="text-xs">LinkedIn</span>
          </Button>
        </div>

        {/* Full-width primary action for download */}
        <div>
          <Button onClick={handleDownloadWithOutro} className="w-full flex items-center justify-center gap-3" disabled={processing}>
            {processing ? (
              <><DownloadCloud className="w-4 h-4 animate-pulse"/> Preparing...</>
            ) : (
              <><DownloadCloud className="w-4 h-4"/> Download with Outro</>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
