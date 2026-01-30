import React, { useState, useEffect } from 'react';
import { Home, Store, Video, Plus, Grid3X3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation } from 'react-router-dom';
import { CreatePostModal } from './CreatePostModal';

export const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [hiddenByOverlay, setHiddenByOverlay] = useState(false);

  // Helper to determine mobile width (match Tailwind md breakpoint)
  const isMobileWidth = () => typeof window !== 'undefined' && window.innerWidth < 768;

  useEffect(() => {
    // initialize from global flag (in case overlay was already active)
    try {
      const active = !!(window as any).__videoOverlayActive;
      if (isMobileWidth()) {
        setHiddenByOverlay(active);
      } else {
        setHiddenByOverlay(false);
      }
    } catch (e) {
      // ignore
    }

    const handler = (ev: Event) => {
      try {
        const detail = (ev as CustomEvent)?.detail;
        const overlayActive = !!detail?.overlayActive;
        // only hide when on mobile width
        if (isMobileWidth()) {
          setHiddenByOverlay(overlayActive);
        } else {
          setHiddenByOverlay(false);
        }
        // helpful debug when testing in devtools
        // eslint-disable-next-line no-console
        console.debug('[MobileBottomNav] video-overlay-change received, overlayActive=', overlayActive, 'isMobile=', isMobileWidth());
      } catch (e) {
        // ignore
      }
    };

    window.addEventListener('video-overlay-change', handler as EventListener);

    const onResize = () => {
      if (!isMobileWidth()) setHiddenByOverlay(false);
      else {
        // re-evaluate using global flag
        try { setHiddenByOverlay(!!(window as any).__videoOverlayActive); } catch (e) { /* ignore */ }
      }
    };

    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('video-overlay-change', handler as EventListener);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const navItems = [
    { icon: Home, label: 'Feeds', path: '/' },
    { icon: Store, label: 'My Store', path: '/my-store' },
  ];

  const rightNavItems = [
    { icon: Grid3X3, label: 'Square', path: '/square' },
    { icon: Video, label: 'Studio', path: '/studio' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {!hiddenByOverlay && (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#161616] border-t border-gray-200 dark:border-gray-700 md:hidden z-50 safe-area-inset-bottom">
          <div className="flex items-center justify-between px-3 sm:px-4 py-2 pb-safe">
            {/* Left side navigation items */}
            <div className="flex space-x-3 sm:space-x-4">
              {navItems.map((item) => (
                <Button
                  key={item.path}
                  variant="ghost"
                  size="sm"
                  className={`flex flex-col items-center p-2 h-auto min-w-0 ${
                    isActive(item.path) 
                      ? 'text-purple-600 dark:text-purple-400' 
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                  onClick={() => navigate(item.path)}
                >
                  <item.icon className="h-4 w-4 sm:h-5 sm:w-5 mb-1" />
                  <span className="text-xs truncate">{item.label}</span>
                </Button>
              ))}
            </div>

            {/* Center create button - Rounded, moment style */}
            <Button
              size="lg"
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-2xl p-3 shadow-lg flex-shrink-0 border border-purple-500"
              style={{ boxShadow: '0 2px 12px 0 rgba(80, 36, 180, 0.12)' }}
            >
              <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
            </Button>

            {/* Right side navigation items */}
            <div className="flex space-x-3 sm:space-x-4">
              {rightNavItems.map((item) => (
                <Button
                  key={item.path}
                  variant="ghost"
                  size="sm"
                  className={`flex flex-col items-center p-2 h-auto min-w-0 ${
                    isActive(item.path) 
                      ? 'text-purple-600 dark:text-purple-400' 
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                  onClick={() => navigate(item.path)}
                >
                  <item.icon className="h-4 w-4 sm:h-5 sm:w-5 mb-1" />
                  <span className="text-xs truncate">{item.label}</span>
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      <CreatePostModal 
        open={showCreateModal} 
        onOpenChange={setShowCreateModal}
      />
    </>
  );
};
