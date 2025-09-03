
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

interface AgoraLiveProps {
  appId: string;
  channel: string;
  token?: string;
  uid?: string | number;
}

const AgoraLive: React.FC<AgoraLiveProps> = ({ appId, channel, token, uid }) => {
  const [supported, setSupported] = useState(true);
  const [joined, setJoined] = useState(false);
  const [client, setClient] = useState<any>(null);
  const [AgoraRTC, setAgoraRTC] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const localVideoRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      console.error('AgoraLive: Not running in a browser environment.');
      setSupported(false);
      setLoading(false);
      return;
    }

    // More comprehensive WebRTC support check
    const hasRTCPeerConnection = !!(
      window.RTCPeerConnection ||
      (window as any).webkitRTCPeerConnection ||
      (window as any).mozRTCPeerConnection
    );
    
    const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const hasGetUserMedia = !!(
      (navigator as any).getUserMedia ||
      (navigator as any).webkitGetUserMedia ||
      (navigator as any).mozGetUserMedia ||
      (navigator as any).msGetUserMedia ||
      hasMediaDevices
    );

    console.log('[AgoraLive] WebRTC check:', {
      hasRTCPeerConnection,
      hasMediaDevices,
      hasGetUserMedia,
      isSecure: window.isSecureContext,
      location: window.location.href,
      userAgent: navigator.userAgent
    });

    if (!hasRTCPeerConnection || !hasGetUserMedia) {
      console.error('[AgoraLive] WebRTC not supported');
      setSupported(false);
      setLoading(false);
      return;
    }

    setSupported(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!supported || !appId || !channel || loading) return;
    
    let rtcClient: any = null;
    let isMounted = true;

    console.log('[AgoraLive] Attempting to load Agora SDK...');
    
    // Dynamically import AgoraRTC only if supported
    import('agora-rtc-sdk-ng')
      .then((mod) => {
        if (!isMounted) return;
        
        console.log('[AgoraLive] Agora SDK loaded successfully');
        setAgoraRTC(mod.default);
        
        try {
          rtcClient = mod.default.createClient({ mode: 'live', codec: 'vp8' });
          setClient(rtcClient);
          console.log('[AgoraLive] Agora client created successfully');
        } catch (createError) {
          console.error('[AgoraLive] Failed to create Agora client:', createError);
          setError('Failed to initialize live streaming client.');
        }
      })
      .catch((importError) => {
        console.error('[AgoraLive] Failed to import Agora SDK:', importError);
        setError('Failed to load live streaming engine. Please refresh and try again.');
        setSupported(false);
      });

    return () => {
      isMounted = false;
      if (rtcClient?.leave) {
        rtcClient.leave().catch(console.error);
      }
      setJoined(false);
    };
  }, [appId, channel, supported, loading]);

  const joinChannel = async () => {
    if (!client || !AgoraRTC) {
      setError('Live streaming engine not ready. Please wait a moment and try again.');
      return;
    }

    try {
      console.log('[AgoraLive] Joining channel...');
      await client.join(appId, channel, token || null, uid || null);
      
      console.log('[AgoraLive] Creating camera track...');
      const localTrack = await AgoraRTC.createCameraVideoTrack();
      
      console.log('[AgoraLive] Publishing track...');
      await client.publish([localTrack]);
      
      if (localVideoRef.current) {
        localTrack.play(localVideoRef.current);
      }
      
      setJoined(true);
      setError(null);
      console.log('[AgoraLive] Successfully joined channel and started streaming');
    } catch (err: any) {
      console.error('[AgoraLive] Failed to join channel:', err);
      setError(err.message || 'Failed to join channel');
    }
  };

  const leaveChannel = async () => {
    if (client) {
      try {
        await client.leave();
        setJoined(false);
        setError(null);
        console.log('[AgoraLive] Successfully left channel');
      } catch (err: any) {
        console.error('[AgoraLive] Failed to leave channel:', err);
      }
    }
  };

  if (loading) {
    return (
      <div className="w-full flex flex-col items-center">
        <div className="w-full max-w-md h-64 bg-black rounded mb-4 flex items-center justify-center text-white text-center">
          Loading live streaming...
        </div>
      </div>
    );
  }

  if (!supported) {
    return (
      <div className="w-full flex flex-col items-center">
        <div className="w-full max-w-md h-64 bg-black rounded mb-4 flex items-center justify-center text-white text-center p-4">
          <div>
            <div className="mb-2">Live streaming is not supported in this browser or environment.</div>
            <div className="text-sm text-gray-300">
              Please use a modern browser with WebRTC support (Chrome, Edge, Firefox, Safari) 
              and ensure you're using HTTPS or localhost.
            </div>
          </div>
        </div>
        {error && <div className="text-red-500 mt-2 text-center max-w-md">{error}</div>}
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center">
      <div ref={localVideoRef} className="w-full max-w-md h-64 bg-black rounded mb-4" />
      {!joined ? (
        <Button onClick={joinChannel} disabled={!client || !AgoraRTC}>
          {client && AgoraRTC ? 'Go Live' : 'Initializing...'}
        </Button>
      ) : (
        <Button onClick={leaveChannel} variant="destructive">End Live</Button>
      )}
      {error && <div className="text-red-500 mt-2 text-center max-w-md">{error}</div>}
    </div>
  );
};

export default AgoraLive;
