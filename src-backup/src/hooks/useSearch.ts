import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SearchResult {
  id: string;
  type: 'user' | 'post' | 'product' | 'store' | 'hashtag' | 'channel';
  title: string;
  subtitle?: string;
  avatar?: string;
  content?: string;
  created_at?: string;
}

export const useSearch = (query: string) => {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const searchDelay = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(searchDelay);
  }, [query]);

  const performSearch = async (searchQuery: string) => {
    setLoading(true);
    try {
      const searchResults: SearchResult[] = [];

      // Search users
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, first_name, last_name, username, avatar_url')
        .or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%`)
        .limit(15);

      if (!usersError && users) {
        users.forEach(user => {
          searchResults.push({
            id: user.id,
            type: 'user',
            title: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username,
            subtitle: `@${user.username}`,
            avatar: user.avatar_url
          });
        });
      }

      // Search posts
      const { data: posts, error: postsError } = await supabase
        .from('posts')
        .select(`
          id, content, created_at,
          user:users!posts_user_id_fkey(first_name, last_name, username, avatar_url)
        `)
        .ilike('content', `%${searchQuery}%`)
        .limit(15);

      if (!postsError && posts) {
        posts.forEach(post => {
          // Fix: post.user may be an array or object
          const user = Array.isArray(post.user) ? post.user[0] : post.user;
          searchResults.push({
            id: post.id,
            type: 'post',
            title: post.content?.substring(0, 100) + (post.content && post.content.length > 100 ? '...' : '') || 'Post',
            subtitle: user ? (`by ${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username) : undefined,
            avatar: user?.avatar_url,
            content: post.content,
            created_at: post.created_at
          });
        });
      }

      // Search products - improved
      const { data: products, error: productsError } = await supabase
        .from('store_products')
        .select(`
          id, title, description, price,
          user:users!store_products_user_id_fkey(first_name, last_name, username, avatar_url)
        `)
        .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
        .limit(15);

      if (!productsError && products) {
        products.forEach(product => {
          const user = Array.isArray(product.user) ? product.user[0] : product.user;
          searchResults.push({
            id: product.id,
            type: 'product',
            title: product.title,
            subtitle: `$${product.price}${user ? ` by ${user.first_name || ''} ${user.last_name || ''}`.trim() || ` by @${user.username}` : ''}`,
            avatar: user?.avatar_url
          });
        });
      }

      // Search stores - improved
      const { data: stores, error: storesError } = await supabase
        .from('user_stores')
        .select(`
          id, store_name, description, logo_url,
          user:users!user_stores_user_id_fkey(first_name, last_name, username, avatar_url)
        `)
        .or(`store_name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
        .limit(15);

      if (!storesError && stores) {
        stores.forEach(store => {
          const user = Array.isArray(store.user) ? store.user[0] : store.user;
          searchResults.push({
            id: store.id,
            type: 'store',
            title: store.store_name,
            subtitle: `Store${user ? ` by ${user.first_name || ''} ${user.last_name || ''}`.trim() || ` by @${user.username}` : ''}`,
            avatar: store.logo_url || user?.avatar_url
          });
        });
      }

      // Search hashtags
      const { data: hashtags, error: hashtagsError } = await supabase
        .from('hashtags')
        .select('id, tag')
        .ilike('tag', `%${searchQuery}%`)
        .limit(15);

      if (!hashtagsError && hashtags) {
        hashtags.forEach(hashtag => {
          searchResults.push({
            id: hashtag.id,
            type: 'hashtag',
            title: `#${hashtag.tag}`,
            subtitle: 'Hashtag',
            avatar: undefined
          });
        });
      }

      // Search studio channels - improved
      const { data: channels, error: channelsError } = await supabase
        .from('studio_channels')
        .select('id, name, description, avatar_url')
        .or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
        .limit(15);

      if (!channelsError && channels) {
        channels.forEach(channel => {
          searchResults.push({
            id: channel.id,
            type: 'channel',
            title: channel.name,
            subtitle: channel.description || 'Studio Channel',
            avatar: channel.avatar_url
          });
        });
      }

      // JS-side fallback filter for all types
      const lowerQuery = searchQuery.toLowerCase();
      const filteredResults = searchResults.filter(result =>
        result.title?.toLowerCase().includes(lowerQuery) ||
        result.subtitle?.toLowerCase().includes(lowerQuery)
      );
      // Sort results by relevance: startsWith > includes > others
      filteredResults.sort((a, b) => {
        const aTitle = a.title?.toLowerCase() || '';
        const bTitle = b.title?.toLowerCase() || '';
        if (aTitle.startsWith(lowerQuery) && !bTitle.startsWith(lowerQuery)) return -1;
        if (!aTitle.startsWith(lowerQuery) && bTitle.startsWith(lowerQuery)) return 1;
        if (aTitle.includes(lowerQuery) && !bTitle.includes(lowerQuery)) return -1;
        if (!aTitle.includes(lowerQuery) && bTitle.includes(lowerQuery)) return 1;
        return 0;
      });
      setResults(filteredResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  return { results, loading };
};
