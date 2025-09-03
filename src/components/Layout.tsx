import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { ProfileSidebar } from './ProfileSidebar';
import { RightSidebar } from './RightSidebar';
import { MobileNav } from './MobileNav';
import { MobileBottomNav } from './MobileBottomNav';
import { useAuth } from '@/hooks/useAuth';

interface LayoutProps {
  children: React.ReactNode;
  hideSidebar?: boolean;
  hideRightSidebar?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children, hideSidebar = false, hideRightSidebar = false }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Determine which sidebar to show
  let SidebarComponent = Sidebar;
  if (/^\/profile(\/.*)?$/.test(location.pathname)) {
    SidebarComponent = ProfileSidebar;
  }

  useEffect(() => {
    // If not loading and no user, redirect to auth
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  // Don't render anything if no user (will redirect)
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <Header />
      
      <div className="flex max-w-7xl mx-auto">
        {/* Conditionally render sidebar */}
        {!hideSidebar && (
          <div className="hidden lg:block">
            <SidebarComponent />
          </div>
        )}
        
        <main className="flex-1 px-2 py-4 sm:px-4 sm:py-6 lg:px-8 w-full min-w-0 pb-20 md:pb-4">
          {children}
        </main>
        
        {/* Conditionally render right sidebar */}
        {!hideRightSidebar && (
          <div className="hidden lg:block">
            <RightSidebar />
          </div>
        )}
      </div>
      
      {/* Mobile Bottom Navigation - shown on all pages */}
      <MobileBottomNav />
    </div>
  );
};