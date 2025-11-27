import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { SearchDropdown } from './SearchDropdown';
import { CreatePostModal } from './CreatePostModal';
import { MobileOffcanvas } from './MobileOffcanvas';
import { HeaderLogo } from './header/HeaderLogo';
import { HeaderNavigation } from './header/HeaderNavigation';
import { NotificationBell } from './NotificationBell';
import { ProfileDropdown } from './header/ProfileDropdown';
import { Video, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Header = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMobileOffcanvas, setShowMobileOffcanvas] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          {/* Desktop: Logo first, Mobile: Logo first, then hamburger */}
          <div className="flex items-center space-x-4">
            <HeaderLogo />
          </div>

          {/* Desktop Search Bar */}
          <div className="flex-1 max-w-md mx-4 relative hidden md:block">
            <SearchDropdown />
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center space-x-3">
            <HeaderNavigation />
            <NotificationBell />
            <ProfileDropdown />

            {/* Mobile: Avatar button instead of hamburger */}
            <div className="md:hidden ml-auto">
              {user ? (
                <button
                  onClick={() => setShowMobileOffcanvas(true)}
                  className="rounded-full focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={
                      (user as any).avatar || (user as any).avatar_url || user?.user_metadata?.avatar_url || ''
                    } />
                    <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm">
                      {(() => {
                        const firstName = ((user as any).first_name || user?.user_metadata?.first_name || '').trim();
                        const lastName = ((user as any).last_name || user?.user_metadata?.last_name || '').trim();
                        const username = ((user as any).username || user?.user_metadata?.username || '').trim();
                        const email = (user as any).email || user?.email || '';
                        if (firstName && lastName) {
                          return `${firstName[0].toUpperCase()}${lastName[0].toUpperCase()}`;
                        }
                        if (username && username.length >= 2) {
                          return username[0].toUpperCase() + username[1].toUpperCase();
                        }
                        if (email && email.length >= 2) {
                          return email[0].toUpperCase() + email[1].toUpperCase();
                        }
                        return 'US';
                      })()}
                    </AvatarFallback>
                  </Avatar>
                </button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMobileOffcanvas(true)}
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <CreatePostModal 
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
      />

      <MobileOffcanvas
        open={showMobileOffcanvas}
        onOpenChange={setShowMobileOffcanvas}
      />
    </>
  );
};
