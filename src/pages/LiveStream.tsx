import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaHeart, FaGift, FaCommentDots, FaEye, FaStop } from "react-icons/fa";
import { Video } from "lucide-react";
import { Header } from "@/components/Header";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { StreamPreview } from "@/components/StreamPreview";
import { LiveStreamChat } from "@/components/LiveStreamChat";
import { AnimatedHearts } from "@/components/AnimatedHearts";
import { GiftModal } from "@/components/GiftModal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import webrtcBridge, { BASE as WEBRTC_BASE, API_ROOT as WEBRTC_API_ROOT } from '@/services/webrtcBridge';
import { useAuth } from '@/hooks/useAuth';

type StreamInfo = {
  playbackId: string;
  streamId: string;
  streamKey?: string;
  rtmpIngestUrl?: string;
};

type Comment = {
  id: string;
  text: string;
  from: string;
  userId?: string;
  avatarUrl?: string;
};

const LiveStream = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // User and channel state
  const [userData, setUserData] = useState<any>(null);
  const [channel, setChannel] = useState<any>(null);
  
  // Stream state
  const [streamRowId, setStreamRowId] = useState<string | null>(null);
  const [likeCount, setLikeCount] = useState(0);
  const [giftList, setGiftList] = useState<any[]>([]);
  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
  const [streamName, setStreamName] = useState("");
  const [streamDescription, setStreamDescription] = useState("");
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [hearts, setHearts] = useState<number[]>([]);
  const [showGifts, setShowGifts] = useState(false);
  const [viewerCount, setViewerCount] = useState(1);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [currentCamera, setCurrentCamera] = useState<"user" | "environment">("user");
  const [streamDuration, setStreamDuration] = useState(0);
  const [streamStartTime, setStreamStartTime] = useState<Date | null>(null);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [showStreamInfo, setShowStreamInfo] = useState(false);
  const [debugMode] = useState(true);

  const previewRef = useRef<HTMLVideoElement>(null);
  const playbackRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const heartId = useRef(0);
  const durationInterval = useRef<NodeJS.Timeout | null>(null);

  // Fetch user data and channel info
  useEffect(() => {
    const fetchUserAndChannelData = async () => {
      if (!user) {
        console.log('No user found');
        return;
      }

      try {
        console.log('Fetching user data for user ID:', user.id);
        
        // Fetch user data
        const { data: userDataResult, error: userError } = await supabase
          .from('users')
          .select('id, username, avatar_url')
          .eq('id', user.id)
          .single();

        if (userError) {
          console.error('Error fetching user data:', userError);
        } else if (userDataResult) {
          console.log('User data fetched:', userDataResult);
          setUserData(userDataResult);
        }

        // Fetch user's channel
        const { data: channelData, error: channelError } = await supabase
          .from('studio_channels')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (channelError) {
          console.error('Error fetching channel data:', channelError);
        } else if (channelData) {
          console.log('Channel data fetched:', channelData);
          setChannel(channelData);
        }
      } catch (error) {
        console.error('Error in fetchUserAndChannelData:', error);
      }
    };

    fetchUserAndChannelData();
  }, [user]);

  useEffect(() => {
    if (previewStream && previewRef.current && !isBroadcasting) {
      previewRef.current.srcObject = previewStream;
      previewRef.current.muted = true;
      previewRef.current.play().catch(() => {});
    }
    return () => {};
  }, [previewStream, isBroadcasting]);

  useEffect(() => {
    const videoEl = playbackRef.current;

    if (!isBroadcasting || !videoEl || !previewStream) return;

    videoEl.srcObject = previewStream;
    videoEl.muted = false;
    videoEl.play().catch(() => {});

    return () => {
      if (videoEl) {
        videoEl.pause();
        videoEl.srcObject = null;
      }
    };
  }, [isBroadcasting, previewStream]);

  useEffect(() => {
    if (isBroadcasting && streamStartTime) {
      durationInterval.current = setInterval(() => {
        const now = new Date();
        const duration = Math.floor((now.getTime() - streamStartTime.getTime()) / 1000);
        setStreamDuration(duration);
      }, 1000);
    } else {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }
    }

    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
    };
  }, [isBroadcasting, streamStartTime]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // WebRTC Streaming Function
  const startWebRTCStreaming = async () => {
    if (!previewStream || !streamInfo) {
      setError("No camera access or stream info");
      return;
    }

    try {
  setLoading(true);
  const { pc, sessionId } = await webrtcBridge.startPublish(streamInfo.streamId, previewStream);
  peerConnectionRef.current = pc;
  sessionIdRef.current = sessionId;

      pc.onconnectionstatechange = () => {
        console.log('WebRTC connection state:', pc.connectionState);
        switch (pc.connectionState) {
          case 'connected':
            console.log('🎉 WebRTC connected successfully! Stream is now live!');
            setIsBroadcasting(true);
            setStreamStartTime(new Date());
            setError("");
            break;
          case 'disconnected':
          case 'failed':
            console.error('WebRTC connection failed');
            setError("Stream connection lost. Please try again.");
            setIsBroadcasting(false);
            break;
          case 'connecting':
            console.log('WebRTC connecting...');
            break;
        }
      };

      setTimeout(() => {
        if (pc.connectionState !== 'connected') {
          console.warn('WebRTC connection taking longer than expected...');
        }
      }, 5000);
    } catch (error: any) {
      console.error('❌ WebRTC streaming failed:', error);
      setError(error.message || 'Failed to start WebRTC streaming.');
      setIsBroadcasting(false);
      // Clean up
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    } finally {
      setLoading(false);
    }
  };

  const stopWebRTCStreaming = async () => {
    try {
      await webrtcBridge.stopPublish(peerConnectionRef.current, sessionIdRef.current);
    } catch (err) {
      console.warn('Failed to stop publish', err);
    }
    try {
      peerConnectionRef.current = null;
      sessionIdRef.current = null;
      setIsBroadcasting(false);
      setStreamStartTime(null);
    } catch (e) {}
  };

  const startCameraPreview = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: currentCamera },
        audio: true,
      });
      setPreviewStream(stream);
      setPermissionsGranted(true);
    } catch (err: any) {
      setError(err?.message || "Camera access denied");
    }
  };

  const flipCamera = async () => {
    const newCamera = currentCamera === "user" ? "environment" : "user";
    setCurrentCamera(newCamera);

    if (!permissionsGranted) return;

    try {
      if (previewStream) {
        previewStream.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newCamera },
        audio: true,
      });
      setPreviewStream(stream);
    } catch {
      setError("Unable to switch camera on this device.");
    }
  };

  const handleCreateStream = async () => {
    if (!streamName.trim()) {
      setError("Please enter a stream title");
      return;
    }
    setShowCountdown(true);
    setCountdown(3);

    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c === 1) {
          clearInterval(interval);
          setShowCountdown(false);
          actuallyCreateStream();
        }
        return c - 1;
      });
    }, 1000);
  };

  const actuallyCreateStream = async () => {
    setLoading(true);
    setError("");
    try {
      console.log('Creating stream with user data:', userData, 'and channel:', channel);
      
      if (!user || !userData || !channel) {
        const missingItems = [];
        if (!user) missingItems.push('user');
        if (!userData) missingItems.push('user data');
        if (!channel) missingItems.push('channel');
        
        const errorMsg = `Missing required information: ${missingItems.join(', ')}. Please ensure you're logged in and have created a channel.`;
        console.error(errorMsg);
        setError(errorMsg);
        setLoading(false);
        return;
      }

      // Create stream via your backend
      const response = await fetch('https://nsq-98et.onrender.com/api/livepeer/create-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: streamName.trim() }),
      });

      const livepeerData = await response.json();

      if (!response.ok) {
        throw new Error(livepeerData.error || 'Failed to create stream');
      }

      console.log('Livepeer stream created:', livepeerData);

      // Store stream in Supabase
      const playbackUrl = livepeerData.playbackId
        ? `https://playback.livepeer.studio/hls/${livepeerData.playbackId}/index.m3u8`
        : '';

      const { data, error } = await supabase
        .from('studio_streams')
        .insert([
          {
            user_id: user.id,
            username: userData.username,
            channel_id: channel.id,
            channel_name: channel.name,
            avatar_url: userData.avatar_url,
            title: streamName,
            description: streamDescription,
            video_url: playbackUrl,
            thumbnail_url: '',
            is_live: true,
            chat_enabled: true,
            likes: 0,
            gifts: [],
            stream_type: 'webrtc',
            playbackid: livepeerData.playbackId,
            stream_id: livepeerData.id,
            streamkey: livepeerData.streamKey,
            rtmpingesturl: livepeerData.rtmpIngestUrl,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Stream created successfully:', data);
      setStreamRowId(data.id);
      setLikeCount(0);
      setGiftList([]);
      setStreamInfo({
        playbackId: livepeerData.playbackId,
        streamId: livepeerData.id,
        streamKey: livepeerData.streamKey,
        rtmpIngestUrl: livepeerData.rtmpIngestUrl,
      });

      // Start WebRTC streaming immediately
      await startWebRTCStreaming();
      
    } catch (err: any) {
      console.error('Error creating stream:', err);
      setError(err.message || 'Failed to create stream');
      setIsBroadcasting(false);
    } finally {
      setLoading(false);
    }
  };

  const stopStream = async () => {
    // Ensure any publish session is stopped cleanly
    try {
      await stopWebRTCStreaming();
    } catch (e) {
      // ignore - stopWebRTCStreaming already logs warnings
    }

    setIsBroadcasting(false);
    setStreamStartTime(null);
    setStreamDuration(0);

    if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }

    // Stop all media tracks
    if (previewStream) {
      previewStream.getTracks().forEach(track => track.stop());
    }

    // Redirect to the user's channel page
    if (channel && channel.id) {
      navigate(`/studio/${channel.id}`);
    } else {
      navigate('/studio');
    }
  };

  const resetStream = () => {
    setStreamInfo(null);
    setStreamName("");
    setPermissionsGranted(false);
    setIsBroadcasting(false);
    setStreamStartTime(null);
    setStreamDuration(0);
    setShowStreamInfo(false);
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }
    if (previewStream) {
      previewStream.getTracks().forEach((t) => t.stop());
    }
    setPreviewStream(null);
    setError("");
    setComments([]);
    setHearts([]);
    setViewerCount(1);
    
    if (playbackRef.current) {
      playbackRef.current.pause();
      playbackRef.current.srcObject = null;
      playbackRef.current.removeAttribute("src");
      playbackRef.current.load();
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
  };

  const sendComment = () => {
    if (!commentText.trim()) return;
    const newComment: Comment = {
      id: String(Date.now()),
      text: commentText.trim(),
      from: userData?.username || "Anonymous",
      userId: user?.id,
      avatarUrl: userData?.avatar_url || undefined,
    };
    setComments((prev) => [newComment, ...prev].slice(0, 50));
    setCommentText("");
  };

  const sendHeart = async () => {
    const id = heartId.current++;
    setHearts((prev) => [...prev, id]);
    setTimeout(() => setHearts((prev) => prev.filter((x) => x !== id)), 2200);
    setLikeCount((prev) => prev + 1);
    
    if (streamRowId) {
      await supabase.from('studio_streams').update({ likes: likeCount + 1 }).eq('id', streamRowId);
    }
  };

  const sendGift = async (giftName: string) => {
    const giftComment: Comment = {
      id: String(Date.now()),
      text: `🎁 ${giftName}`,
      from: userData?.username || "Anonymous",
    };
    setComments((prev) => [giftComment, ...prev]);
    setShowGifts(false);
    setViewerCount((prev) => prev + Math.floor(Math.random() * 3) + 1);
    const newGift = { name: giftName, at: new Date().toISOString() };
    setGiftList((prev) => [...prev, newGift]);
    
    if (streamRowId) {
      await supabase.from('studio_streams').update({ gifts: [...giftList, newGift] }).eq('id', streamRowId);
    }
  };

  useEffect(() => {
    if (isBroadcasting) {
      const timer = setInterval(() => {
        setViewerCount((prev) => prev + Math.floor(Math.random() * 2));
      }, 3000);
      return () => clearInterval(timer);
    }
  }, [isBroadcasting]);

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 pb-20 md:pb-4">
        <div className="w-full max-w-6xl mx-auto p-2 md:p-4">
          {/* Top bar with user info */}
          <div className="flex items-center justify-between mb-2 md:mb-4 px-2">
            <div className="flex items-center gap-2 md:gap-4">
              {/* User Avatar and Username */}
              <div className="flex items-center gap-2">
                <Avatar className="w-8 h-8">
                  {userData?.avatar_url ? (
                    <AvatarImage src={userData.avatar_url} alt={userData.username} />
                  ) : (
                    <AvatarFallback>{userData?.username?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                  )}
                </Avatar>
                <span className="text-white font-semibold text-sm">{userData?.username || 'Loading...'}</span>
              </div>

              {/* Channel Badge */}
              {channel && (
                <div className="flex items-center gap-2 px-2 py-1 rounded-full text-xs text-white font-semibold backdrop-blur-md"
                     style={{ background: 'linear-gradient(90deg, #6836beff 0%, #241258ff 100%)' }}>
                  <Video className="h-3 w-3" />
                  <span>{channel.name}</span>
                </div>
              )}

              {/* Viewer count when live */}
              {isBroadcasting && (
                <div className="flex items-center gap-2 text-white">
                  <FaEye className="text-pink-400" size={16} />
                  <span className="font-semibold text-sm md:text-base">
                    {viewerCount.toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* OBS Setup Button */}
            {streamInfo && !isBroadcasting && (
              <button
                onClick={() => setShowStreamInfo(true)}
                className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
              >
                OBS Setup
              </button>
            )}
          </div>

          {/* Main streaming area */}
          <div className="relative bg-black rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl">
            {!streamInfo ? (
              <StreamPreview
                permissionsGranted={permissionsGranted}
                previewStream={previewStream}
                previewRef={previewRef}
                streamName={streamName}
                setStreamName={setStreamName}
                streamDescription={streamDescription}
                setStreamDescription={setStreamDescription}
                startCameraPreview={startCameraPreview}
                flipCamera={flipCamera}
                handleCreateStream={handleCreateStream}
                loading={loading}
                error={error}
                setPermissionsGranted={setPermissionsGranted}
                setPreviewStream={setPreviewStream}
                resetStream={resetStream}
              />
            ) : (
              <div className="relative w-full h-[75vh] md:h-[80vh]">
                <ErrorBoundary>
                  {isBroadcasting ? (
                    <video
                      ref={playbackRef}
                      className="w-full h-full object-cover bg-black"
                      muted={false}
                      playsInline
                      autoPlay
                      controls={false}
                      style={{ transform: currentCamera === "user" ? "scaleX(-1)" : "none" }}
                    />
                  ) : (
                    previewStream && (
                      <video
                        ref={previewRef}
                        className="w-full h-full object-cover bg-black"
                        muted
                        playsInline
                        autoPlay
                        style={{ transform: currentCamera === "user" ? "scaleX(-1)" : "none" }}
                      />
                    )
                  )}

                  {isBroadcasting && (
                    <div className="absolute top-4 left-4 bg-red-500 text-white text-xs px-3 py-1 rounded-full flex items-center gap-2 shadow-lg z-30">
                      <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      <span className="font-mono text-xs">
                        LIVE {streamDuration > 0 && `• ${formatDuration(streamDuration)}`}
                      </span>
                    </div>
                  )}

                  {isBroadcasting && (
                    <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm text-white text-xs md:text-sm px-3 py-1 rounded-full flex items-center gap-2 z-30">
                      <FaEye className="text-pink-400" size={14} />
                      <span className="text-xs">{viewerCount.toLocaleString()}</span>
                    </div>
                  )}

                  {isBroadcasting && (
                    <div className="absolute bottom-16 right-6 z-40">
                      <button
                        onClick={stopStream}
                        className="p-3 md:p-4 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg transition-colors duration-200 flex items-center gap-2 md:gap-3"
                        title="Stop Stream"
                        style={{ minWidth: 56 }}
                      >
                        <FaStop size={18} />
                        <span className="hidden md:inline text-sm md:text-base font-medium">Stop</span>
                      </button>
                    </div>
                  )}

                  {!isBroadcasting && streamInfo && (
                    <div className="absolute top-16 left-4 z-30">
                      <button
                        onClick={() => {
                          setIsBroadcasting(true);
                          setStreamStartTime(new Date());
                          setStreamDuration(0);
                        }}
                        className="p-2 md:p-3 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg transition-colors duration-200 flex items-center gap-1 md:gap-2"
                        title="Resume Stream"
                      >
                        <span className="text-xs md:text-sm font-medium">Go Live</span>
                      </button>
                    </div>
                  )}
                </ErrorBoundary>
              </div>
            )}

            {isBroadcasting && <AnimatedHearts hearts={hearts} />}

            {isBroadcasting && (
              <>
                <div className="hidden md:block absolute top-20 right-4 w-80 max-h-[50vh] z-40 pointer-events-auto">
                  <LiveStreamChat comments={comments} />
                </div>

                {/* Mobile chat popup */}
                <div className="block md:hidden fixed left-0 right-0 bottom-0 z-50">
                  {showMobileChat && (
                    <div className="bg-black/90 rounded-t-2xl p-2 max-h-[40vh] overflow-y-auto">
                      <LiveStreamChat comments={comments} />
                    </div>
                  )}
                </div>
              </>
            )}

            {isBroadcasting && (
              <>
                <div className="absolute left-4 bottom-28 md:bottom-26 flex flex-col gap-3 z-40">
                  <button
                    onClick={sendHeart}
                    className="p-2 rounded-full bg-gradient-to-r from-pink-500 to-red-500 text-white shadow-lg hover:scale-105 transition-transform duration-200"
                    title="Send Heart"
                  >
                    <FaHeart size={16} />
                  </button>

                  <button
                    onClick={() => setShowGifts(true)}
                    className="p-2 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-lg hover:scale-105 transition-transform duration-200"
                    title="Send Gift"
                  >
                    <FaGift size={16} />
                  </button>
                </div>

                <div className="absolute left-4 bottom-16 z-40">
                  <button
                    onClick={() => {
                      if (window.innerWidth < 768) {
                        setShowMobileChat((prev) => !prev);
                      } else {
                        const el = document.getElementById("livestream-comment-input") as HTMLInputElement | null;
                        if (el) el.focus();
                      }
                    }}
                    className="relative p-2 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg hover:scale-105 transition-transform duration-200"
                    title="Comments"
                  >
                    <FaCommentDots size={16} />
                    {comments.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {comments.length > 99 ? "99+" : comments.length}
                      </span>
                    )}
                  </button>
                </div>
              </>
            )}

            {isBroadcasting && (
              <div
                // make fixed to viewport and very high z-index so nothing overlaps it
                style={{
                  position: 'fixed',
                  left: 0,
                  right: 0,
                  bottom: 'calc(env(safe-area-inset-bottom, 0px) + 64px)',
                  zIndex: 999999,
                  paddingLeft: '1rem',
                  paddingRight: '1rem',
                  pointerEvents: 'auto'
                }}
              >
                <div className="mx-auto max-w-6xl">
                  <div className="bg-black/80 p-3 flex items-center gap-2 rounded-full shadow-lg">
                    <FaCommentDots className="text-purple-400" size={20} />
                    <input
                      id="livestream-comment-input"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendComment()}
                      placeholder="Say something nice..."
                      className="flex-1 bg-transparent text-white placeholder-white/60 outline-none"
                    />
                    <button
                      onClick={sendComment}
                      disabled={!commentText.trim()}
                      className="px-4 py-1.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold disabled:opacity-50"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="h-4" />
        </div>

        {isBroadcasting && (
          <GiftModal showGifts={showGifts} setShowGifts={setShowGifts} sendGift={sendGift} />
        )}

        {/* OBS Setup Modal */}
        {showStreamInfo && streamInfo && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold mb-4">OBS Studio Setup</h3>
              <p className="text-gray-600 mb-4">
                WebRTC streaming is not available. Please use OBS Studio to broadcast:
              </p>
              
              <div className="space-y-3 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Server URL:
                  </label>
                  <input 
                    type="text" 
                    value={streamInfo.rtmpIngestUrl || 'rtmp://rtmp.livepeer.com/live'} 
                    readOnly 
                    className="w-full p-2 border border-gray-300 rounded bg-gray-50 text-sm"
                    onFocus={(e) => e.target.select()}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stream Key:
                  </label>
                  <input 
                    type="text" 
                    value={streamInfo.streamKey || ''} 
                    readOnly 
                    className="w-full p-2 border border-gray-300 rounded bg-gray-50 text-sm font-mono"
                    onFocus={(e) => e.target.select()}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowStreamInfo(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setIsBroadcasting(true);
                    setStreamStartTime(new Date());
                    setShowStreamInfo(false);
                  }}
                  className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                >
                  Start Stream Anyway
                </button>
              </div>
            </div>
          </div>
        )}

        {error && !showStreamInfo && (
          <div className="fixed top-4 left-2 right-2 md:left-4 md:right-4 z-50 flex justify-center">
            <div className="bg-red-500/90 backdrop-blur-sm text-white px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl shadow-lg max-w-md text-sm md:text-base">
              {error}
            </div>
          </div>
        )}

        {showCountdown && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="text-4xl md:text-6xl font-bold text-white animate-pulse">{countdown}</div>
          </div>
        )}
      </div>

      <MobileBottomNav />
      {debugMode && (
        <div className="fixed top-20 left-4 z-50 bg-white/80 text-black text-xs p-2 rounded shadow-lg max-w-xs">
          <div className="font-semibold">webrtc debug</div>
          <div>BASE: <code className="break-words">{WEBRTC_BASE}</code></div>
          <div>API_ROOT: <code className="break-words">{WEBRTC_API_ROOT || '(same origin)'}</code></div>
          <div>sessionId: <code>{sessionIdRef.current || '-'}</code></div>
          <div>pc state: <code>{peerConnectionRef.current?.connectionState || '-'}</code></div>
          <div>error: <code className="break-words">{error || '-'}</code></div>
        </div>
      )}
    </>
  );
};

export default LiveStream;