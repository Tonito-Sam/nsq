
import React from "react";
import { FaSyncAlt, FaVideo, FaStop, FaPlay } from "react-icons/fa";

interface StreamPreviewProps {
  permissionsGranted: boolean;
  previewStream: MediaStream | null;
  previewRef: React.RefObject<HTMLVideoElement>;
  streamName: string;
  setStreamName: (name: string) => void;
  streamDescription: string;
  setStreamDescription: (desc: string) => void;
  startCameraPreview: () => void;
  flipCamera: () => void;
  handleCreateStream: () => void;
  loading: boolean;
  error: string;
  setPermissionsGranted: (granted: boolean) => void;
  setPreviewStream: (stream: MediaStream | null) => void;
  resetStream: () => void;
}

export const StreamPreview: React.FC<StreamPreviewProps> = ({
  permissionsGranted,
  previewStream,
  previewRef,
  streamName,
  setStreamName,
  streamDescription,
  setStreamDescription,
  startCameraPreview,
  flipCamera,
  handleCreateStream,
  loading,
  error,
  setPermissionsGranted,
  setPreviewStream,
  resetStream,
}) => {
  const stopPreview = () => {
    if (previewStream) {
      previewStream.getTracks().forEach((t) => t.stop());
      setPreviewStream(null);
      setPermissionsGranted(false);
    }
  };

  if (!permissionsGranted) {
    return (
      <div className="p-8 text-center">
        <div className="max-w-md mx-auto">
          <h2 className="text-2xl font-bold text-white mb-6">Start Your Stream</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-2 text-left">Stream Title</label>
              <input
                className="w-full p-4 rounded-2xl bg-white/10 backdrop-blur-sm text-white placeholder-white/60 outline-none border border-white/20 focus:border-purple-400 transition-colors"
                value={streamName}
                onChange={(e) => setStreamName(e.target.value)}
                placeholder="Enter your stream title..."
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-2 text-left">Description</label>
              <textarea
                className="w-full p-4 rounded-2xl bg-white/10 backdrop-blur-sm text-white placeholder-white/60 outline-none border border-white/20 focus:border-purple-400 transition-colors min-h-[60px]"
                value={streamDescription}
                onChange={(e) => setStreamDescription(e.target.value)}
                placeholder="Describe your stream..."
              />
            </div>
            
            <div className="flex gap-3">
              <button
                className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:scale-105 transition-transform duration-200 flex items-center justify-center gap-2"
                onClick={startCameraPreview}
              >
                <FaVideo />
                Start Preview
              </button>
                <button
                onClick={resetStream}
                className="px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 transition-all duration-200 text-sm md:text-base"
              >
                Reset
              </button>
            </div>
          </div>
          
          {error && (
            <div className="mt-4 text-red-400 text-sm bg-red-500/10 p-3 rounded-xl">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[70vh] sm:h-[60vh]">
      <video
        ref={previewRef}
        className="w-full h-full object-cover"
        muted
        playsInline
      />
      
      {/* Preview overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
      
      {/* Preview label */}
      <div className="absolute top-4 left-4 bg-blue-500 text-white text-xs px-3 py-1 rounded-full">
        PREVIEW
      </div>
      
      {/* Controls */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex gap-4">
        <button
          onClick={flipCamera}
          className="p-4 bg-white/20 backdrop-blur-sm text-white rounded-full hover:bg-white/30 transition-colors"
          title="Switch camera"
        >
          <FaSyncAlt size={20} />
        </button>
        
        <button
          onClick={stopPreview}
          className="p-4 bg-red-500/80 backdrop-blur-sm text-white rounded-full hover:bg-red-500 transition-colors"
          title="Stop preview"
        >
          <FaStop size={20} />
        </button>
        
        <button
          onClick={handleCreateStream}
          disabled={loading || !streamName.trim()}
          className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-transform duration-200 flex items-center gap-2"
        >
          {loading ? (
            "Starting..."
          ) : (
            <>
              <FaPlay size={16} />
              Go Live
            </>
          )}
        </button>
      </div>
    </div>
  );
};
