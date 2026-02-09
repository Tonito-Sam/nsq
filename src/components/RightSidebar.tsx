import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { TrendingCard } from './TrendingCard';
import { SuggestedFriends } from './SuggestedFriends';
import { EventsSidebar } from './EventsSidebar';
import { LiveChat } from './LiveChat';

export const RightSidebar = () => {
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Hide right sidebar on specific profile edit path to allow custom right column
  if (isMobile) return null;
  if (location.pathname && location.pathname.startsWith('/profile/edit')) return null;

  return (
    <div className="w-80 p-4 space-y-6">
      {/* Live Chat Section */}
      <div className="space-y-2">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-lg"></h3>
        <LiveChat />
      </div>
      <TrendingCard />
      <EventsSidebar />
      <SuggestedFriends />
    </div>
  );
}; // <-- Add this closing brace