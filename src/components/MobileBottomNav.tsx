import React, { useState } from 'react';
import { Home, Store, Video, Plus, Grid3X3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation } from 'react-router-dom';
import { CreatePostModal } from './CreatePostModal';

export const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const navItems = [
    { icon: Home, label: 'Feeds', path: '/' },
    { icon: Store, label: 'My Store', path: '/my-store' },
  ];

  const rightNavItems = [
    { icon: Grid3X3, label: 'Square', path: '/square' },
    { icon: Video, label: '1Studio', path: '/studio' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
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

      <CreatePostModal 
        open={showCreateModal} 
        onOpenChange={setShowCreateModal}
      />
    </>
  );
};
