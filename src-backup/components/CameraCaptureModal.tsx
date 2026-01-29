import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RotateCw, X, Camera as CameraIcon } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File) => void;
}

const CameraCaptureModal: React.FC<Props> = ({ open, onOpenChange, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  useEffect(() => {
    const start = async () => {
      if (!open) return;
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false });
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        console.warn('Camera access denied or unavailable', e);
      }
    };
    start();
    return () => {
      try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch (e) {}
      streamRef.current = null;
      if (videoRef.current) { try { videoRef.current.pause(); } catch (e) {} }
    };
  }, [open, facingMode]);

  const handleCapture = async () => {
    try {
      const video = videoRef.current;
      if (!video) return;
      const w = video.videoWidth || 1280;
      const h = video.videoHeight || 720;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(b => res(b), 'image/jpeg', 0.92));
      if (!blob) return;
      const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
      onCapture(file);
      onOpenChange(false);
    } catch (e) {
      console.warn('Capture failed', e);
    }
  };

  const switchCamera = () => setFacingMode(m => (m === 'user' ? 'environment' : 'user'));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Capture Photo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="w-full bg-black rounded-md overflow-hidden">
            <video ref={videoRef} className="w-full h-64 object-cover" playsInline muted />
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="icon" variant="outline" onClick={switchCamera} title="Switch camera" aria-label="Switch camera">
              <RotateCw className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => onOpenChange(false)} title="Cancel" aria-label="Cancel capture">
              <X className="h-4 w-4" />
            </Button>
            <Button size="icon" onClick={handleCapture} title="Capture photo" aria-label="Capture photo" className="bg-white dark:bg-white/10">
              <CameraIcon className="h-5 w-5 text-black dark:text-white" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CameraCaptureModal;
