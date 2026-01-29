import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Search, User, Store, Package, Calendar, MapPin, X, UserCheck, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

interface SearchResult {
  type: 'user' | 'store' | 'product' | 'event' | 'post' | 'channel' | 'group' | 'hashtag';
  id: string;
  title: string;
  subtitle?: string;
  image?: string;
  verified?: boolean;
  category?: string;
  price?: number;
  currency?: string;
  location?: string;
  date?: string;
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.length >= 2) {
      performSearch();
    } else {
      setResults([]);
    }
  }, [query]);

  const performSearch = async () => {
    setLoading(true);
    try {
      const searchResults: SearchResult[] = [];

      // Search users
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, first_name, last_name, username, avatar_url, verified')
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,username.ilike.%${query}%`)
        .limit(5);

      if (users && !usersError) {
        users.forEach(user => {
          searchResults.push({
            type: 'user',
            id: user.id,
            title: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username,
            subtitle: `@${user.username}`,
            image: user.avatar_url,
            verified: user.verified
          });
        });
      }

      // Search stores
      const { data: stores, error: storesError } = await supabase
        .from('user_stores')
        .select('id, store_name, description, logo_url, store_category')
        .ilike('store_name', `%${query}%`)
        .eq('is_active', true)
        .limit(5);

      if (stores && !storesError) {
        stores.forEach(store => {
          searchResults.push({
            type: 'store',
            id: store.id,
            title: store.store_name,
            subtitle: store.description,
            image: store.logo_url,
            category: store.store_category
          });
        });
      }

      // Search products
      const { data: products, error: productsError } = await supabase
        .from('store_products')
        .select('id, title, description, price, product_type, images')
        .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
        .eq('is_active', true)
        .limit(5);

      if (products && !productsError) {
        products.forEach(product => {
          searchResults.push({
            type: 'product',
            id: product.id,
            title: product.title,
            subtitle: product.description,
            image: product.images?.[0],
            category: product.product_type,
            price: product.price,
            currency: 'USD' // Default currency
          });
        });
      }

      // Search posts
      const { data: posts, error: postsError } = await supabase
        .from('posts')
        .select(`
          id, content, created_at, post_type, event_date, event_location,
          user:users!posts_user_id_fkey(first_name, last_name, username)
        `)
        .ilike('content', `%${query}%`)
        .limit(5);

      if (posts && !postsError) {
        posts.forEach(post => {
          // Fix: post.user may be an array or object
          const user = Array.isArray(post.user) ? post.user[0] : post.user;
          if (post.post_type === 'event') {
            searchResults.push({
              type: 'event',
              id: post.id,
              title: post.content?.substring(0, 50) + '...',
              subtitle: user ? `by ${user.first_name || ''} ${user.last_name || ''}` : '',
              location: post.event_location,
              date: post.event_date
            });
          } else {
            searchResults.push({
              type: 'post',
              id: post.id,
              title: post.content?.substring(0, 50) + '...',
              subtitle: user ? `by ${user.first_name || ''} ${user.last_name || ''}` : ''
            });
          }
        });
      }

      // Search channels
      const { data: channels, error: channelsError } = await supabase
        .from('studio_channels')
        .select('id, name, description, avatar_url, category')
        .ilike('name', `%${query}%`)
        .limit(5);

      if (channels && !channelsError) {
        channels.forEach(channel => {
          searchResults.push({
            type: 'channel',
            id: channel.id,
            title: channel.name,
            subtitle: channel.description,
            image: channel.avatar_url,
            category: channel.category
          });
        });
      }

      // Search groups
      const { data: groups, error: groupsError } = await supabase
        .from('groups')
        .select('id, name, description, group_avatar_url, category')
        .ilike('name', `%${query}%`)
        .limit(5);

      if (groups && !groupsError) {
        groups.forEach(group => {
          searchResults.push({
            type: 'group',
            id: group.id,
            title: group.name,
            subtitle: group.description,
            image: group.group_avatar_url,
            category: group.category
          });
        });
      }

      // Search hashtags
      const { data: hashtags, error: hashtagsError } = await supabase
        .from('hashtags')
        .select('id, tag')
        .ilike('tag', `%${query}%`)
        .limit(5);

      if (hashtags && !hashtagsError) {
        hashtags.forEach(hashtag => {
          searchResults.push({
            type: 'hashtag',
            id: hashtag.id,
            title: `#${hashtag.tag}`,
            subtitle: 'Hashtag',
          });
        });
      }

      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'user': return User;
      case 'store': return Store;
      case 'product': return Package;
      case 'event': return Calendar;
      case 'channel': return UserCheck;
      case 'group': return UserPlus;
      case 'hashtag': return null; // Render # for hashtag
      default: return Search;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 pt-20">
      <Card className="w-full max-w-2xl mx-4 bg-white dark:bg-gray-900 max-h-[70vh] overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Search className="h-5 w-5 text-gray-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people, stores, products, events, channels, groups..."
              className="border-0 focus-visible:ring-0 text-lg"
              autoFocus
            />
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="overflow-y-auto max-h-96 p-2">
          {loading ? (
            <div className="p-4 text-center text-gray-500">Searching...</div>
          ) : results.length === 0 && query.length >= 2 ? (
            <div className="p-4 text-center text-gray-500">No results found</div>
          ) : (
            <div className="space-y-1">
              {results.map((result) => {
                const IconComponent = getResultIcon(result.type);
                return (
                  <div
                    key={`${result.type}-${result.id}`}
                    className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                  >
                    {result.type === 'hashtag' ? (
                      <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center font-bold text-purple-600 text-xl">#</div>
                    ) : result.image ? (
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={result.image} />
                        <AvatarFallback>
                          {IconComponent && <IconComponent className="h-5 w-5" />}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                        {IconComponent && <IconComponent className="h-5 w-5 text-gray-500" />}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {result.title}
                        </p>
                        {result.verified && (
                          <Badge variant="secondary" className="text-xs">✓</Badge>
                        )}
                        {result.category && (
                          <Badge variant="outline" className="text-xs">
                            {result.category}
                          </Badge>
                        )}
                      </div>
                      {result.subtitle && (
                        <p className="text-sm text-gray-500 truncate">{result.subtitle}</p>
                      )}
                      {result.price && (
                        <p className="text-sm font-semibold text-green-600">
                          {result.currency} {result.price}
                        </p>
                      )}
                      {result.location && (
                        <p className="text-sm text-gray-500 flex items-center">
                          <MapPin className="h-3 w-3 mr-1" />
                          {result.location}
                        </p>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-xs capitalize">
                      {result.type}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
