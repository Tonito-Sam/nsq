
import React from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu, Store, ShoppingBag, CreditCard, Users, UserPlus, Eye, ThumbsUp, Settings, LogOut, User, MessageCircle, Wallet, UserCircle, Bookmark, Calendar, Megaphone, Star, Award, Globe, Heart, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { ModeToggle } from './ModeToggle';

export const MobileNav = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const quickLinks = [
    { label: 'Profile', icon: User, path: '/profile', color: 'text-blue-600' },
    { label: 'My Store', icon: Store, path: '/my-store', color: 'text-green-600' },
    { label: 'Square Marketplace', icon: ShoppingBag, path: '/square', color: 'text-purple-600' },
    { label: 'Wallet', icon: Wallet, path: '/wallet', color: 'text-yellow-600' },
    { label: 'Messages', icon: MessageCircle, path: '/messages', color: 'text-blue-500' },
    { label: 'Groups', icon: Users, path: '/groups', color: 'text-indigo-600' },
    { label: 'Bookmarks', icon: Bookmark, path: '/bookmarks', color: 'text-orange-600' },
    { label: 'Events', icon: Calendar, path: '/events', color: 'text-red-600' },
    { label: 'Settings', icon: Settings, path: '/settings', color: 'text-gray-600' },
  ];

  if (!user) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="sm" className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80 bg-white dark:bg-[#1a1a1a] p-0">
          <div className="p-4 text-center">
            <p className="text-gray-500 dark:text-gray-400">Please sign in to access menu</p>
            <Button onClick={() => navigate('/auth')} className="mt-4">
              Sign In
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 bg-white dark:bg-[#1a1a1a] p-0 overflow-y-auto max-h-screen">
        <div className="p-4 space-y-6">
          {/* Profile Section - matching ProfileSection component */}
          <div className="w-full">
            <div className="overflow-hidden dark:bg-[#161616] dark:border-gray-700 bg-white border border-gray-200 rounded-lg">
              <div 
                className="h-32 bg-gradient-to-r from-purple-600 via-yellow-400 to-purple-600 relative"
                style={{
                  backgroundImage: "linear-gradient(135deg, #9333ea 0%, #eab308 50%, #9333ea 100%)"
                }}
              >
                <div className="absolute top-4 left-4 text-white font-bold">
                  BIG SALE
                </div>
                <div className="absolute top-8 left-4 text-white text-sm">
                  UP TO 50% OFF
                </div>
              </div>
              
              <div className="p-6 text-center relative">
                <Avatar className="h-20 w-20 mx-auto -mt-12 border-4 border-white shadow-lg">
                  <AvatarImage src={user?.user_metadata?.avatar_url || "/placeholder.svg"} />
                  <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-lg">
                    {user?.user_metadata?.first_name?.[0] || user?.email?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                <h3 className="font-semibold text-lg mt-3 text-gray-900 dark:text-gray-100">
                  {user?.user_metadata?.first_name} {user?.user_metadata?.last_name}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm">@{user?.user_metadata?.username || 'user'}</p>
                
                <div className="grid grid-cols-3 gap-4 mt-6">
                  <div className="text-center">
                    <div className="flex justify-center mb-2">
                      <Users className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="font-semibold text-lg text-gray-900 dark:text-gray-100">0</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Followers</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="flex justify-center mb-2">
                      <UserPlus className="h-5 w-5 text-green-400" />
                    </div>
                    <div className="font-semibold text-lg text-gray-900 dark:text-gray-100">0</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Following</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="flex justify-center mb-2">
                      <Store className="h-5 w-5 text-purple-400" />
                    </div>
                    <div className="font-semibold text-lg text-gray-900 dark:text-gray-100">0</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Customers</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="text-center">
                    <div className="flex justify-center mb-2">
                      <Heart className="h-5 w-5 text-red-400" />
                    </div>
                    <div className="font-semibold text-lg text-gray-900 dark:text-gray-100">0</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Likes</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="flex justify-center mb-2">
                      <Eye className="h-5 w-5 text-indigo-400" />
                    </div>
                    <div className="font-semibold text-lg text-gray-900 dark:text-gray-100">0</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Views</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="flex justify-center mb-2">
                      <DollarSign className="h-5 w-5 text-yellow-400" />
                    </div>
                    <div className="font-semibold text-lg text-gray-900 dark:text-gray-100">$0</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Earned</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="bg-white dark:bg-[#161616] rounded-lg p-4 shadow-sm border dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 text-purple-600 dark:text-purple-400">Quick Links</h3>
            <div className="space-y-2">
              {quickLinks.map((link) => (
                <Button
                  key={link.label}
                  variant="ghost"
                  className="w-full justify-start hover:bg-purple-50 dark:hover:bg-purple-900/20"
                  onClick={() => navigate(link.path)}
                >
                  <link.icon className={`h-5 w-5 mr-3 ${link.color}`} />
                  <span className="text-gray-700 dark:text-gray-300">{link.label}</span>
                </Button>
              ))}
              
              {/* Mode Toggle */}
              <ModeToggle />
              
              <Button
                variant="ghost"
                className="w-full justify-start hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
                onClick={handleSignOut}
              >
                <LogOut className="h-5 w-5 mr-3" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
