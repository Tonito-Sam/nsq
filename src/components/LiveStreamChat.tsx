import React from "react";

interface Comment {
  id: string;
  text: string;
  from: string;
  userId?: string;
  avatarUrl?: string;
}

interface LiveStreamChatProps {
  comments: Comment[];
}

export const LiveStreamChat: React.FC<LiveStreamChatProps> = ({ comments }) => {
  return (
    <div className="absolute top-4 right-4 w-80 max-h-[50vh] pointer-events-none">
      <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-4 shadow-xl">
        <div className="text-white font-semibold mb-3 flex items-center gap-2">
          <span className="w-2 h-2 bg-green-400 rounded-full"></span>
          Live Chat
        </div>
        
        <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-hide">
          {comments.length === 0 ? (
            <div className="text-white/60 text-sm">
              Be the first to comment!
            </div>
          ) : (
            comments.slice(0, 10).map((comment) => (
              <div key={comment.id} className="text-sm animate-fade-in flex items-center gap-2">
                {comment.avatarUrl ? (
                  <img src={comment.avatarUrl} alt="avatar" className="w-6 h-6 rounded-full object-cover" />
                ) : (
                  <span className="w-6 h-6 rounded-full bg-purple-400 flex items-center justify-center text-white font-bold text-xs">
                    {comment.from?.[0] || '?'}
                  </span>
                )}
                <span className="text-purple-400 font-semibold">{comment.from}:</span>
                <span className="text-white ml-2">{comment.text}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveStreamChat;
