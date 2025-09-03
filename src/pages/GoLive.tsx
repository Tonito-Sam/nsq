import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import AgoraLive from '@/components/AgoraLive';
import { ArrowLeft } from 'lucide-react';
import { MobileBottomNav } from '@/components/MobileBottomNav';

const GoLive = () => {
  const navigate = useNavigate();
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
        <h2 className="text-2xl font-bold mb-4">Go Live</h2>
        <AgoraLive
          appId="c5362cce311f4bd9800fb484ed4be03d"
          channel="1vsquare"
          token="007eJxTYKjTzlxuLpa+cnv2lhleMesNLq/iPcC8veHKusUbSifa7ZBQYEg2NTYzSk5ONTY0TDNJSrG0MDBISzKxMElNMUlKNTBOiZIMzmgIZGTYwqrPxMgAgSA+B4NhWXFhaWJRKgMDAJ5CH84="
        />
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

export default GoLive;
