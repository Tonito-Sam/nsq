
import React from 'react';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Bell, Heart, MessageCircle, UserPlus, Share } from 'lucide-react';

const Notifications = () => {
  const notifications = [
    {
      id: 1,
      type: 'like',
      user: { name: 'Sarah Johnson', avatar: '/placeholder.svg' },
      content: 'liked your post',
      time: '2m ago',
      read: false
    },
    {
      id: 2,
      type: 'comment',
      user: { name: 'Mike Chen', avatar: '/placeholder.svg' },
      content: 'commented on your post: "Great content!"',
      time: '1h ago',
      read: false
    },
    {
      id: 3,
      type: 'follow',
      user: { name: 'Emily Davis', avatar: '/placeholder.svg' },
      content: 'started following you',
      time: '3h ago',
      read: true
    },
    {
      id: 4,
      type: 'share',
      user: { name: 'John Smith', avatar: '/placeholder.svg' },
      content: 'shared your post',
      time: '1d ago',
      read: true
    }
  ];

  const getIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <Heart className="h-4 w-4 text-red-500" />;
      case 'comment':
        return <MessageCircle className="h-4 w-4 text-blue-500" />;
      case 'follow':
        return <UserPlus className="h-4 w-4 text-green-500" />;
      case 'share':
        return <Share className="h-4 w-4 text-purple-500" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a]">
      <Header />
      <div className="max-w-4xl mx-auto px-4 py-6">
        <Card className="dark:bg-[#161616]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifications
              </CardTitle>
              <Button variant="outline" size="sm">
                Mark all as read
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-1">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`flex items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-b dark:border-gray-700 ${
                    !notification.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={notification.user.avatar} />
                    <AvatarFallback>
                      {notification.user.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 ml-3 min-w-0">
                    <div className="flex items-center space-x-2">
                      {getIcon(notification.type)}
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        <span className="font-medium">{notification.user.name}</span>{' '}
                        {notification.content}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{notification.time}</p>
                  </div>
                  {!notification.read && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Notifications;
