
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bookmark, Image, Video, FileText } from 'lucide-react';

const savedPosts = [
  {
    id: 1,
    title: "Beautiful sunset photography tips",
    type: "photo",
    author: "John Doe",
    timeAgo: "2 hours ago"
  },
  {
    id: 2,
    title: "React best practices for 2024",
    type: "text",
    author: "Jane Smith",
    timeAgo: "1 day ago"
  },
  {
    id: 3,
    title: "Weekend cooking tutorial",
    type: "video",
    author: "Chef Mike",
    timeAgo: "3 days ago"
  }
];

const getPostIcon = (type: string) => {
  switch (type) {
    case 'photo':
      return <Image className="h-4 w-4 text-green-600" />;
    case 'video':
      return <Video className="h-4 w-4 text-red-600" />;
    default:
      return <FileText className="h-4 w-4 text-blue-600" />;
  }
};

export const SavedPosts = () => {
  return (
    <Card className="p-4 dark:bg-[#161616] bg-white dark:border-gray-700">
      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
        <Bookmark className="h-5 w-5 mr-2 text-orange-600" />
        Saved Posts
      </h3>
      
      <div className="space-y-3">
        {savedPosts.map((post) => (
          <div key={post.id} className="flex items-start space-x-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg cursor-pointer">
            <div className="flex-shrink-0 mt-1">
              {getPostIcon(post.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 dark:text-gray-100 text-sm line-clamp-2">
                {post.title}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                by {post.author} • {post.timeAgo}
              </p>
            </div>
          </div>
        ))}
      </div>
      
      <Button variant="ghost" className="w-full mt-3 text-orange-600 dark:text-orange-400">
        View all saved
      </Button>
    </Card>
  );
};
