
import React from 'react';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Bookmark, Search, Filter, Heart, MessageCircle, Share, MoreHorizontal } from 'lucide-react';

const Bookmarks = () => {
  const bookmarkedPosts = [
    {
      id: 1,
      title: '10 Tips for Growing Your Digital Business',
      author: 'Sarah Johnson',
      category: 'Business',
      date: '2 days ago',
      likes: 245,
      comments: 32,
      content: 'Here are some proven strategies that helped me grow my digital business from zero to six figures...'
    },
    {
      id: 2,
      title: 'Christian Leadership Principles',
      author: 'Pastor Mike',
      category: 'Faith',
      date: '1 week ago',
      likes: 189,
      comments: 28,
      content: 'Biblical principles that every Christian leader should embrace in their daily walk...'
    },
    {
      id: 3,
      title: 'Photography Composition Masterclass',
      author: 'Emma Davis',
      category: 'Photography',
      date: '3 days ago',
      likes: 156,
      comments: 45,
      content: 'Learn the rule of thirds, leading lines, and other composition techniques...'
    }
  ];

  const categories = [
    { name: 'All', count: 23 },
    { name: 'Business', count: 8 },
    { name: 'Faith', count: 6 },
    { name: 'Photography', count: 4 },
    { name: 'Technology', count: 5 }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a]">
      <Header />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Bookmarks</h1>
          <p className="text-gray-600 dark:text-gray-400">Your saved posts and content</p>
        </div>

        {/* Search and Filter */}
        <Card className="dark:bg-[#161616] p-4 mb-6">
          <div className="flex space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="Search bookmarks..." 
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Categories Sidebar */}
          <div className="lg:col-span-1">
            <Card className="dark:bg-[#161616]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bookmark className="h-5 w-5 text-blue-500" />
                  Categories
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {categories.map((category, index) => (
                    <div key={index} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{category.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {category.count}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Bookmarked Posts */}
          <div className="lg:col-span-3">
            <div className="space-y-4">
              {bookmarkedPosts.map((post) => (
                <Card key={post.id} className="dark:bg-[#161616]">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge variant="outline">{post.category}</Badge>
                          <span className="text-sm text-gray-500">{post.date}</span>
                        </div>
                        <h3 className="font-semibold text-lg mb-2">{post.title}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                          by {post.author}
                        </p>
                        <p className="text-gray-700 dark:text-gray-300 mb-4">
                          {post.content}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <div className="flex items-center space-x-1">
                          <Heart className="h-4 w-4" />
                          <span>{post.likes}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <MessageCircle className="h-4 w-4" />
                          <span>{post.comments}</span>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button size="sm" variant="outline">
                          <Share className="h-4 w-4 mr-2" />
                          Share
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600 border-red-600 hover:bg-red-50">
                          <Bookmark className="h-4 w-4 mr-2" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Bookmarks;
