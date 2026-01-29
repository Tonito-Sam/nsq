import React, { useState } from 'react';
import { Search, ChevronDown, X, Video, Grid3x3, Flame, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface StudioHeaderProps {
  categories: { name: string; icon: React.ElementType }[];
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  activeTab: 'all' | 'trending';
  setActiveTab: (tab: 'all' | 'trending') => void;
  navigate: (path: string) => void;
}

const StudioHeader: React.FC<StudioHeaderProps> = ({ 
  categories, 
  selectedCategory, 
  setSelectedCategory, 
  activeTab, 
  setActiveTab,
  navigate 
}) => {
  const [showCategoriesDropdown, setShowCategoriesDropdown] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchType, setSearchType] = useState<'all' | 'creators' | 'channels' | 'videos'>('all');
  const routerNavigate = useNavigate();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) return;
    
    setSearchLoading(true);
    
    try {
      console.log('Searching for:', searchQuery, 'type:', searchType);
      
      // Navigate to search results page with query parameters
      const searchParams = new URLSearchParams({
        q: searchQuery.trim(),
        type: searchType
      }).toString();
      
      // You can navigate to a dedicated search page or filter the current page
      // Option 1: Navigate to search results page
      // navigate(`/studio/search?${searchParams}`);
      
      // Option 2: Reload current page with search filter (if you want to search within current videos)
      // This depends on your implementation
      
      // For now, let's just log and close modal
      console.log('Redirecting to search with:', searchQuery);
      
      // Wait a bit to show loading state
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Close modal
      setShowSearchModal(false);
      setSearchQuery('');
      
      // Here you would typically implement the actual search
      // For example, if you have a search API endpoint:
      // const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&type=${searchType}`);
      // const results = await response.json();
      // Then display results...
      
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  // Quick search suggestions
  const searchSuggestions = [
    { label: '#gaming', type: 'videos' },
    { label: '#music', type: 'videos' },
    { label: '#tutorial', type: 'videos' },
    { label: '#comedy', type: 'videos' },
    { label: 'Gaming Channel', type: 'channels' },
    { label: 'Music Producer', type: 'creators' },
  ];

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string, type?: string) => {
    setSearchQuery(suggestion);
    if (type) {
      if (type === 'channels') setSearchType('channels');
      else if (type === 'creators') setSearchType('creators');
      else setSearchType('videos');
    }
  };

  return (
    <div className="pointer-events-auto relative">
      {/* Search Modal Overlay - Fixed position with very high z-index */}
      {showSearchModal && (
        <div 
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            // Close when clicking outside modal
            if (e.target === e.currentTarget) {
              setShowSearchModal(false);
            }
          }}
        >
          <div 
            className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Search Studio</h3>
              <button
                onClick={() => setShowSearchModal(false)}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                disabled={searchLoading}
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            {/* Search Type Tabs */}
            <div className="flex items-center gap-2 mb-4">
              {(['all', 'creators', 'channels', 'videos'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSearchType(type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    searchType === type
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
            
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    searchType === 'creators' ? 'Search creators by name...' :
                    searchType === 'channels' ? 'Search channels by name...' :
                    searchType === 'videos' ? 'Search videos by title or tag...' :
                    'Search creators, channels, videos...'
                  }
                  autoFocus
                  className="w-full pl-12 pr-10 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-gray-900 dark:text-white disabled:opacity-50"
                  disabled={searchLoading}
                />
                {searchQuery && !searchLoading && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                {searchLoading && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />
                  </div>
                )}
              </div>
              
              {/* Quick Suggestions */}
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Quick suggestions:</p>
                <div className="flex flex-wrap gap-2">
                  {searchSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => handleSuggestionClick(suggestion.label, suggestion.type)}
                    >
                      {suggestion.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <button
                type="submit"
                disabled={!searchQuery.trim() || searchLoading}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {searchLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Searching...
                  </>
                ) : (
                  'Search'
                )}
              </button>
              
              {/* Tips */}
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center pt-2">
                <p>Tip: Use # for tags, @ for creators, or search by keywords</p>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Header - Transparent with high but lower z-index */}
      <header
        className="fixed top-0 left-0 right-0 z-[100] px-4 pt-3 pb-2"
        style={{ background: 'transparent' }}
      >
        <div className="max-w-7xl mx-auto">
          {/* First Row: Logo + Brand + Dropdown */}
          <div className="flex items-center justify-between mb-3">
            {/* Left: Favicon */}
            <button 
              onClick={() => navigate('/')} 
              className="flex items-center gap-2 text-foreground hover:opacity-80 transition-opacity z-[110] relative"
              aria-label="Home"
            >
              <img src="/favicon.ico" alt="Home" className="h-7 w-7 rounded-md" />
            </button>

            {/* Middle: Brand */}
            <div className="flex items-center gap-2 z-[110] relative">
              <Video className="h-4 w-4 text-red-500" />
              <span className="font-semibold text-sm text-gray-900 dark:text-white">Shorts On</span>
              <span className="text-xs px-2 py-0.5 bg-red-500 text-white rounded-full font-medium">
                One-Studio
              </span>
            </div>

            {/* Right: Dropdown Icon */}
            <button
              onClick={() => setShowCategoriesDropdown(!showCategoriesDropdown)}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors z-[110] relative"
              aria-label="Categories"
            >
              <ChevronDown className="w-5 h-5 text-gray-700 dark:text-white" />
            </button>
          </div>

          {/* Second Row: Tabs - Clean underline style */}
          <div className="flex items-center justify-center mb-1 relative z-[110]">
            <div className="flex items-center gap-6">
              <button
                onClick={() => setActiveTab('all')}
                className="flex flex-col items-center gap-1.5"
              >
                <div className="flex items-center gap-1.5">
                  <Grid3x3 className={`w-3.5 h-3.5 transition-colors ${
                    activeTab === 'all' ? 'text-purple-400' : 'text-gray-700/70 dark:text-white/70'
                  }`} />
                  <span className={`text-xs font-medium transition-colors ${
                    activeTab === 'all' ? 'text-gray-900 dark:text-white' : 'text-gray-700/70 dark:text-white/70 hover:text-gray-900 dark:hover:text-white'
                  }`}>
                    All
                  </span>
                </div>
                {/* Animated underline for active tab */}
                <div className={`h-0.5 w-full rounded-full transition-all duration-300 ${
                  activeTab === 'all' 
                    ? 'bg-gradient-to-r from-purple-500 via-purple-400 to-purple-500 animate-pulse-glow' 
                    : 'bg-transparent'
                }`} />
              </button>
              
              <button
                onClick={() => setActiveTab('trending')}
                className="flex flex-col items-center gap-1.5"
              >
                <div className="flex items-center gap-1.5">
                  <Flame className={`w-3.5 h-3.5 transition-colors ${
                    activeTab === 'trending' ? 'text-orange-400' : 'text-gray-700/70 dark:text-white/70'
                  }`} />
                  <span className={`text-xs font-medium transition-colors ${
                    activeTab === 'trending' ? 'text-gray-900 dark:text-white' : 'text-gray-700/70 dark:text-white/70 hover:text-gray-900 dark:hover:text-white'
                  }`}>
                    Trending
                  </span>
                </div>
                {/* Animated underline for active tab */}
                <div className={`h-0.5 w-full rounded-full transition-all duration-300 ${
                  activeTab === 'trending' 
                    ? 'bg-gradient-to-r from-orange-500 via-orange-400 to-orange-500 animate-pulse-glow' 
                    : 'bg-transparent'
                }`} />
              </button>
            </div>
          </div>

          {/* Third Row: Search Icon - At the far right */}
          <div className="flex justify-end -mt-8">
              <button
              onClick={() => {
                console.log('Search button clicked');
                setShowSearchModal(true);
                setSearchQuery('');
                setSearchType('all');
              }}
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors z-[110] relative"
              aria-label="Search"
            >
              <Search className="w-5 h-5 text-gray-700 dark:text-white" />
            </button>
          </div>
        </div>

        {/* Categories Dropdown */}
        {showCategoriesDropdown && (
          <>
            <div 
              className="fixed inset-0 z-[9998]"
              onClick={() => setShowCategoriesDropdown(false)}
            />
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-64 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden z-[9999] animate-slide-down">
              <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                <h3 className="font-semibold text-gray-700 dark:text-gray-300">Video Categories</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Browse by content type</p>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {categories.map((category) => (
                  <button
                    key={category.name}
                    onClick={() => {
                      setSelectedCategory(category.name);
                      setShowCategoriesDropdown(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group ${
                      selectedCategory === category.name 
                        ? 'bg-purple-50 dark:bg-purple-900/20 border-l-2 border-purple-500' 
                        : 'border-l-2 border-transparent'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${
                      selectedCategory === category.name 
                        ? 'bg-purple-100 dark:bg-purple-900/30' 
                        : 'bg-gray-100 dark:bg-gray-800'
                    }`}>
                      <category.icon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {category.name}
                      </span>
                      {selectedCategory === category.name && (
                        <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                          Active
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              <div className="p-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <button
                  onClick={() => {
                    setSelectedCategory('');
                    setShowCategoriesDropdown(false);
                  }}
                  className="w-full text-center text-sm text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                >
                  Clear filter
                </button>
              </div>
            </div>
          </>
        )}
      </header>

      {/* Spacer to prevent content from hiding behind fixed header */}
      <div className="h-20"></div>

      {/* CSS animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; }
        }
        .animate-fade-in {
          animation: fadeIn 0.15s ease-out;
        }
        .animate-slide-down {
          animation: slideDown 0.15s ease-out;
        }
        .animate-pulse-glow {
          animation: pulseGlow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default StudioHeader;