import React, { useState, useRef, useEffect } from 'react';
import { Search, User, FileText, ShoppingBag, Store } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useSearch } from '@/hooks/useSearch';
import { formatDistanceToNow } from 'date-fns';

interface SearchDropdownProps {
  className?: string;
  inputClassName?: string;
}

export const SearchDropdown: React.FC<SearchDropdownProps> = ({ className, inputClassName }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const { results, loading } = useSearch(query);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setIsOpen(true);
  };

  const handleResultClick = (result: any) => {
    if (result.type === 'user') {
      window.location.href = `/profile/${result.id}`;
    } else if (result.type === 'post') {
      // Scroll to post or navigate to post detail
      console.log('Navigate to post:', result.id);
    } else if (result.type === 'hashtag') {
      window.location.href = `/hashtag/${result.title.replace('#', '')}`;
    } else if (result.type === 'product') {
      window.location.href = `/product/${result.id}`;
    } else if (result.type === 'store') {
      window.location.href = `/store/${result.id}`;
    } else if (result.type === 'channel') {
      window.location.href = `/studio/channel/${result.id}`;
    }
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div ref={searchRef} className={`relative ${className || ''}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search users, posts, hashtags, products, stores, channels..."
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          className={`pl-10 bg-muted/50 border-none focus:bg-background ${inputClassName || ''}`}
        />
      </div>

      {isOpen && (query.trim() || (results && results.length > 0)) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">Searching...</div>
          ) : results && results.length > 0 ? (
            <div className="py-2">
              {results.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleResultClick(result)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-3"
                >
                  {/* Icon by type */}
                  {result.type === 'user' ? (
                    <User className="h-4 w-4 text-blue-500" />
                  ) : result.type === 'post' ? (
                    <FileText className="h-4 w-4 text-green-500" />
                  ) : result.type === 'hashtag' ? (
                    <span className="h-4 w-4 text-purple-500 font-bold">#</span>
                  ) : result.type === 'product' ? (
                    <ShoppingBag className="h-4 w-4 text-pink-500" />
                  ) : result.type === 'store' ? (
                    <Store className="h-4 w-4 text-yellow-500" />
                  ) : result.type === 'channel' ? (
                    <User className="h-4 w-4 text-indigo-500" />
                  ) : null}
                  <Avatar className="h-8 w-8">
                    {result.avatar ? (
                      <AvatarImage src={result.avatar} />
                    ) : (
                      <AvatarFallback>
                        {result.title.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                      {result.title}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {result.subtitle}
                      {result.created_at && (
                        <span className="ml-2">
                          {formatDistanceToNow(new Date(result.created_at), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : query.trim() ? (
            <div className="p-4 text-center text-gray-500">No results found</div>
          ) : null}
        </div>
      )}
    </div>
  );
};
