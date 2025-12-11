
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChevronDown, User, Wallet, Store, Shield, Settings, LogOut, Megaphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { ModeToggle } from '@/components/ModeToggle';
import { Badge } from '@/components/ui/badge';

export const ProfileDropdown = () => {
  const { user, signOut } = useAuth();
  const { isAdmin, isSuperAdmin } = useAdmin();
  const navigate = useNavigate();
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debug: Log user fields for avatar and initials
  console.log('ProfileDropdown user:', user);
  console.log('Avatar fields:', {
    avatar: (user as any)?.avatar,
    avatar_url: (user as any)?.avatar_url,
    user_metadata_avatar_url: user?.user_metadata?.avatar_url,
    first_name: (user as any)?.first_name || user?.user_metadata?.first_name,
    last_name: (user as any)?.last_name || user?.user_metadata?.last_name,
    username: (user as any)?.username || user?.user_metadata?.username,
    email: user?.email,
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (!user) {
    return (
      <Button onClick={() => navigate('/auth')} className="hidden md:flex">
        Sign In
      </Button>
    );
  }

  // Helper: get avatar, name, username from user object (users table or user_metadata)
  // Prioritize avatar image, then fallback initials
  const avatarUrl = (user as any).avatar || (user as any).avatar_url || user?.user_metadata?.avatar_url || '';
  const firstName = ((user as any).first_name || user?.user_metadata?.first_name || '').trim();
  const lastName = ((user as any).last_name || user?.user_metadata?.last_name || '').trim();
  const username = ((user as any).username || user?.user_metadata?.username || '').trim();
  const email = (user as any).email || user?.email || '';

  const getInitials = () => {
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
  };

  return (
    <div ref={dropdownRef} className="relative hidden md:block">
      <button
        onClick={() => setShowProfileDropdown(!showProfileDropdown)}
        className="flex items-center space-x-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg p-1 transition-colors"
      >
        <Avatar className="h-8 w-8">
          <AvatarImage src={avatarUrl} />
          <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm">
            {getInitials()}
          </AvatarFallback>
        </Avatar>
        <ChevronDown className="h-4 w-4 text-gray-500" />
      </button>

      {showProfileDropdown && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
          {/* User Info Section */}
          <div className="flex items-center space-x-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <Avatar className="h-10 w-10">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-base">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-semibold text-gray-900 dark:text-gray-100 leading-tight">{firstName} {lastName}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">@{username}</span>
              {(isSuperAdmin || isAdmin) && (
                <Badge variant={isSuperAdmin ? 'destructive' : 'default'} className="mt-1 w-fit">
                  {isSuperAdmin ? 'Superadmin' : 'Admin'}
                </Badge>
              )}
            </div>
          </div>

          <div className="p-2">
            <button
              onClick={() => {
                navigate('/profile');
                setShowProfileDropdown(false);
              }}
              className="w-full flex items-center space-x-3 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <User className="h-4 w-4" />
              <span>Profile</span>
            </button>

            <button
              onClick={() => {
                navigate('/wallet');
                setShowProfileDropdown(false);
              }}
              className="w-full flex items-center space-x-3 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <Wallet className="h-4 w-4" />
              <span>Wallet</span>
            </button>

            <button
              onClick={() => {
                navigate('/campaigns');
                setShowProfileDropdown(false);
              }}
              className="w-full flex items-center space-x-3 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <Megaphone className="h-4 w-4" />
              <span>Ad Center</span>
            </button>

            <button
              onClick={() => {
                navigate('/my-store');
                setShowProfileDropdown(false);
              }}
              className="w-full flex items-center space-x-3 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <Store className="h-4 w-4" />
              <span>My Store</span>
            </button>

            {isAdmin && (
              <>
                <div className="border-t border-gray-200 dark:border-gray-600 my-2"></div>
                
                <button
                  onClick={() => {
                    navigate('/admin/overview');
                    setShowProfileDropdown(false);
                  }}
                  className="w-full flex items-center space-x-3 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <Shield className="h-4 w-4" />
                  <span>Admin Dashboard</span>
                </button>
              </>
            )}

            <div className="border-t border-gray-200 dark:border-gray-600 my-2"></div>

            <button
              onClick={() => {
                navigate('/settings');
                setShowProfileDropdown(false);
              }}
              className="w-full flex items-center space-x-3 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </button>

            <div className="px-3 py-2">
              <ModeToggle />
            </div>

            <div className="border-t border-gray-200 dark:border-gray-600 my-2"></div>

            <button
              onClick={() => {
                handleSignOut();
                setShowProfileDropdown(false);
              }}
              className="w-full flex items-center space-x-3 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-red-600 dark:text-red-400"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
