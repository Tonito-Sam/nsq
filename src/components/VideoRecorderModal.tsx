import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RotateCw, X, Play, Square } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecord: (file: File, duration: number) => void;
  maxDuration?: number; // seconds
}

const VideoRecorderModal: React.FC<Props> = ({ open, onOpenChange, onRecord, maxDuration = 60 }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const start = async () => {
      if (!open) return;
      try {
        // stop previous tracks if any
        try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch (e) {}
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: true });
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        console.warn('Camera/mic access denied or unavailable', e);
      }
    };
    start();
    return () => {
      try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch (e) {}
      streamRef.current = null;
      if (videoRef.current) { try { videoRef.current.pause(); } catch (e) {} }
    };
  }, [open, facingMode]);

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    try {
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm';
      const mr = new MediaRecorder(streamRef.current, { mimeType: mime } as any);
      recorderRef.current = mr;
      mr.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'video/webm' });
        const file = new File([blob], `video-${Date.now()}.webm`, { type: blob.type });
        onRecord(file, elapsed);
        setElapsed(0);
        setRecording(false);
        try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch (e) {}
        onOpenChange(false);
      };
      try { mr.start(); setRecording(true); } catch (e) { console.warn('Recorder start failed', e); }
      intervalRef.current = window.setInterval(() => {
        setElapsed(prev => {
          const next = prev + 1;
          if (next >= maxDuration) {
            stopRecording();
            return maxDuration;
          }
          return next;
        });
      }, 1000) as unknown as number;
    } catch (e) {
      console.warn('Could not start recorder', e);
    }
  };

  const stopRecording = () => {
    try {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    } catch (e) {}
    try { if (intervalRef.current) { clearInterval(intervalRef.current as any); intervalRef.current = null; } } catch (e) {}
  };

  const switchCamera = () => setFacingMode(m => (m === 'user' ? 'environment' : 'user'));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Record Video</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="w-full bg-black rounded-md overflow-hidden">
            <video ref={videoRef} className="w-full h-64 object-cover" playsInline muted />
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">{recording ? `Recording: ${elapsed}s` : 'Ready to record'}</div>
            <div className="flex gap-2 items-center">
              <Button size="icon" variant="outline" onClick={switchCamera} title="Switch camera" aria-label="Switch camera" disabled={recording}>
                <RotateCw className="h-4 w-4" />
              </Button>
              {!recording ? (
                <Button size="icon" onClick={startRecording} title="Start recording" aria-label="Start recording">
                  <Play className="h-4 w-4" />
                </Button>
              ) : (
                <Button size="icon" variant="destructive" onClick={stopRecording} title="Stop recording" aria-label="Stop recording">
                  <Square className="h-4 w-4" />
                </Button>
              )}
              <Button size="icon" variant="ghost" onClick={() => { try { if (recording) stopRecording(); streamRef.current?.getTracks().forEach(t => t.stop()); } catch (e) {} onOpenChange(false); }} title="Cancel" aria-label="Cancel recording">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VideoRecorderModal;
