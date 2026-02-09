import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const useQuery = () => new URLSearchParams(useLocation().search);

const ShareTargetPage: React.FC = () => {
  const query = useQuery();
  const navigate = useNavigate();
  const { user } = useAuth() as any;

  const [urls, setUrls] = useState<string[]>([]);
  const [type, setType] = useState<'image' | 'video' | 'text'>('text');
  const [text, setText] = useState('');
  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    const t = query.get('type') || 'image';
    const raw = query.get('urls') || '';
    const u = raw ? raw.split(',').map(s => decodeURIComponent(s)) : [];
    const txt = query.get('text') || '';
    setType(t === 'video' ? 'video' : (t === 'image' ? 'image' : 'text'));
    setUrls(u.filter(Boolean));
    setText(txt);
    setCaption(txt);
  }, []);

  // If this is an image share and user is logged in, open CreatePostModal immediately
  useEffect(() => {
    if (user && type === 'image' && urls && urls.length > 0) {
      const payload = { type: 'image', urls, text: caption };
      try {
        localStorage.setItem('nexsq:share', JSON.stringify(payload));
        // also dispatch event in case header is mounted on same page
        window.dispatchEvent(new CustomEvent('nexsq-open-create-post', { detail: payload }));
      } catch (e) {}
      navigate('/');
    }
  }, [user, type, urls, caption, navigate]);

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <h2 className="text-xl font-semibold mb-4">Sign in to finish sharing</h2>
        <p className="mb-4">You must be logged in to post shared media. After signing in, reopen the share action or paste the URL(s) into the app.</p>
        <a href="/auth" className="px-4 py-2 bg-purple-600 text-white rounded">Sign in / Create account</a>
      </div>
    );
  }

  const handleShareToFeed = async () => {
    // For consistency open the CreatePostModal on the main page with injected media
    const payload = { type: type === 'video' ? 'video' : 'image', urls, text: caption || text };
    try {
      localStorage.setItem('nexsq:share', JSON.stringify(payload));
      window.dispatchEvent(new CustomEvent('nexsq-open-create-post', { detail: payload }));
    } catch (e) {}
    navigate('/');
  };

  const handleOpenInStudio = () => {
    if (urls && urls.length) {
      navigate(`/reels/upload?shared_video_url=${encodeURIComponent(urls[0])}`);
    } else {
      alert('No video URL available');
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h2 className="text-xl font-semibold mb-4">Finish sharing</h2>
      <p className="mb-4 text-sm text-gray-600">Preview the shared media and choose where to post.</p>

      <div className="grid grid-cols-1 gap-4 mb-4">
        {urls.map((u, idx) => (
          <div key={idx} className="border p-2 rounded">
            {type === 'video' || u.match(/\.(mp4|webm|mov)(\?|$)/i) ? (
              <video src={u} controls className="w-full rounded" />
            ) : (
              <img src={u} className="w-full rounded" alt={`shared-${idx}`} />
            )}
          </div>
        ))}
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Caption</label>
        <textarea value={caption} onChange={e => setCaption(e.target.value)} className="w-full border rounded p-2" rows={3} />
      </div>

      <div className="flex space-x-3">
        <button onClick={handleShareToFeed} disabled={posting} className="px-4 py-2 bg-purple-600 text-white rounded">
          {posting ? 'Posting...' : 'Share to Feed'}
        </button>
        {type === 'video' && (
          <button onClick={handleOpenInStudio} className="px-4 py-2 bg-gray-200 rounded">Open in Studio</button>
        )}
        <button onClick={() => navigate(-1)} className="px-4 py-2 border rounded">Cancel</button>
      </div>
    </div>
  );
};

export default ShareTargetPage;
