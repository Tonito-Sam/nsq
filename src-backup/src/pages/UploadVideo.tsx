import React, { useState } from 'react';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { MobileBottomNav } from '@/components/MobileBottomNav';

const UploadVideo = () => {
  const navigate = useNavigate();
  const [caption, setCaption] = useState('');
  const [videoFiles, setVideoFiles] = useState<File[]>([]);

  // TODO: Add upload logic here (copy from Studio.tsx if needed)

  return (
    <div className="min-h-screen bg-background">
      <Header />
      {/* Back Arrow */}
      <div className="max-w-xl mx-auto px-4 pt-4">
        <button
          className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-semibold mb-2 hover:underline"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>
      </div>
      <div className="max-w-xl mx-auto p-6 pt-0">
        <h2 className="text-2xl font-bold mb-4">Upload Video</h2>
        <Input 
          type="file" 
          accept="video/*" 
          multiple
          onChange={e => setVideoFiles(Array.from(e.target.files || []))} 
          className="mb-2 bg-white dark:bg-gray-900 text-black dark:text-white border border-gray-300 dark:border-gray-700"
        />
        <Input 
          type="text" 
          placeholder="Caption" 
          value={caption} 
          onChange={e => setCaption(e.target.value)} 
          className="mb-2" 
        />
        <Button 
          onClick={() => {}} // TODO: Add upload handler
          disabled={videoFiles.length < 1 || !caption}
          className="w-full"
        >
          Upload
        </Button>
        <Button variant="ghost" className="mt-4 w-full" onClick={() => navigate(-1)}>
          Cancel
        </Button>
      </div>
      {/* Mobile Bottom Navigation */}
      <div className="md:hidden">
        <MobileBottomNav />
      </div>
    </div>
  );
};

export default UploadVideo;
