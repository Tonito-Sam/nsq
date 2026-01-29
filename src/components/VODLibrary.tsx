import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Clock, Loader2, Calendar, Eye, CalendarDays, Filter, Tv, EyeOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import apiUrl from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';
import { SHOW_CATEGORIES } from '@/config/showCategories';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Enhanced VODEpisode type with view tracking
export interface VODEpisode {
  id: string;
  show_id?: string;
  show_title?: string;
  show_thumbnail?: string;
  show_category?: string;
  title: string;
  description?: string;
  duration?: number;
  thumbnail_url?: string;
  video_url?: string;
  views?: number;
  scheduled_time?: string;
  air_time?: string;
  published_at?: string;
  created_at: string;
  is_live?: boolean;
  is_active?: boolean;
  tags?: string[];
  category?: string;
  last_viewed_at?: string; // Track when last viewed
  unique_views?: number; // Unique user views
}

type SortOption = 'newest' | 'oldest' | 'most-viewed' | 'least-viewed' | 'longest' | 'shortest';
type FilterOption = 'all' | 'recent' | 'popular' | 'featured' | 'trending';
type ViewMode = 'grid' | 'list' | 'by-show' | 'by-category';

interface VODLibraryProps {
  showId?: string;
  onEpisodeSelect?: (episode: VODEpisode) => void;
  playingEpisodeId?: string;
  showAllPastShows?: boolean;
  defaultViewMode?: ViewMode;
  shows?: Array<{ id: string; title: string; thumbnail_url?: string; category?: string; views?: number }>;
}

const VODLibrary: React.FC<VODLibraryProps> = ({
  showId,
  onEpisodeSelect,
  playingEpisodeId,
  showAllPastShows = false,
  defaultViewMode,
  shows,
}) => {
  const [episodes, setEpisodes] = useState<VODEpisode[]>([]);
  const [showsList, setShowsList] = useState<Array<{ id: string; title: string; thumbnail_url?: string; category?: string; views?: number }>>(shows || []);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode || 'grid');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [userViews, setUserViews] = useState<Record<string, boolean>>({}); // Track user's viewed episodes
  
  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };
  const containerRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastLoadAtRef = useRef<number>(0);
  const consecutiveErrorRef = useRef<number>(0);

  // Load user's viewed episodes from localStorage
  useEffect(() => {
    const loadUserViews = () => {
      try {
        const viewedEpisodes = localStorage.getItem('viewed_episodes');
        if (viewedEpisodes) {
          setUserViews(JSON.parse(viewedEpisodes));
        }
      } catch (error) {
        console.error('Error loading user views:', error);
      }
    };
    loadUserViews();
  }, []);

  // Track when an episode is viewed
  const trackEpisodeView = useCallback(async (episodeId: string, episodeTitle: string, showId?: string) => {
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      
      // Check if user has already viewed this episode in this session
      if (userViews[episodeId]) {
        return; // Already tracked in this session
      }

      // Update local state
      setUserViews(prev => ({
        ...prev,
        [episodeId]: true
      }));

      // Save to localStorage
      try {
        const viewedEpisodes = JSON.parse(localStorage.getItem('viewed_episodes') || '{}');
        viewedEpisodes[episodeId] = true;
        localStorage.setItem('viewed_episodes', JSON.stringify(viewedEpisodes));
      } catch (e) {
        console.error('Error saving to localStorage:', e);
      }

      // Update episode view count in state
      setEpisodes(prev => prev.map(ep => {
        if (ep.id === episodeId) {
          return {
            ...ep,
            views: (ep.views || 0) + 1,
            last_viewed_at: new Date().toISOString()
          };
        }
        return ep;
      }));

      // Update Supabase database
      const { data: existingEpisode, error: fetchError } = await supabase
        .from('studio_episodes')
        .select('views')
        .eq('id', episodeId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error fetching episode:', fetchError);
        return;
      }

      const currentViews = existingEpisode?.views || 0;
      const newViews = currentViews + 1;

      // Update episode views
      const { error: updateError } = await supabase
        .from('studio_episodes')
        .update({ 
          views: newViews,
          last_viewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', episodeId);

      if (updateError) {
        console.error('Error updating episode views:', updateError);
      }

      // Also track unique user views if user is logged in
      if (userId) {
        try {
          // Check if user has already viewed this episode
          const { data: existingView, error: viewError } = await supabase
            .from('episode_views')
            .select('id')
            .eq('episode_id', episodeId)
            .eq('user_id', userId)
            .single();

          // If no existing view, create one
          if (viewError?.code === 'PGRST116') {
            await supabase
              .from('episode_views')
              .insert({
                episode_id: episodeId,
                user_id: userId,
                episode_title: episodeTitle,
                show_id: showId,
                viewed_at: new Date().toISOString()
              });
          } else if (existingView) {
            // Update existing view timestamp
            await supabase
              .from('episode_views')
              .update({
                viewed_at: new Date().toISOString()
              })
              .eq('id', existingView.id);
          }
        } catch (err) {
          console.error('Error tracking unique view:', err);
        }
      }

      // Update show's total views if showId is provided
      if (showId) {
        try {
          const { data: show, error: showError } = await supabase
            .from('studio_shows')
            .select('total_views')
            .eq('id', showId)
            .single();

          if (!showError && show) {
            const newShowViews = (show.total_views || 0) + 1;
            await supabase
              .from('studio_shows')
              .update({ 
                total_views: newShowViews,
                updated_at: new Date().toISOString()
              })
              .eq('id', showId);
          }
        } catch (err) {
          console.error('Error updating show views:', err);
        }
      }

      console.log(`Tracked view for episode: ${episodeTitle} (${episodeId})`);
    } catch (error) {
      console.error('Error tracking episode view:', error);
    }
  }, [userViews]);

  // Enhanced episode selection handler
  const handleEpisodeSelect = useCallback((episode: VODEpisode) => {
    // Track the view
    trackEpisodeView(episode.id, episode.title, episode.show_id);
    
    // Call the original onEpisodeSelect handler
    if (onEpisodeSelect) {
      onEpisodeSelect(episode);
    }
  }, [onEpisodeSelect, trackEpisodeView]);

  // Get episode's airing/reference date
  const getEpisodeDate = (ep: VODEpisode): Date | null => {
    const dateStr = ep.scheduled_time || ep.air_time || ep.published_at || ep.created_at;
    if (!dateStr) return null;
    
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  };

  // Check if episode has already aired
  const hasEpisodeAired = (ep: VODEpisode): boolean => {
    const episodeDate = getEpisodeDate(ep);
    if (!episodeDate) return true;
    
    const now = new Date();
    return episodeDate <= now;
  };

  // Enhanced fetchEpisodes with view counts
  const fetchEpisodes = useCallback(async (pageNum: number) => {
    try {
      setLoading(pageNum === 1);
      setLoadingMore(pageNum > 1);

      let endpointPath = '';
      if (showAllPastShows || !showId) {
        endpointPath = `/api/shows/past/all?page=${pageNum}&limit=20&sort=${encodeURIComponent(sortBy)}&filter=${encodeURIComponent(filterBy)}`;
      } else {
        endpointPath = `/api/shows/${encodeURIComponent(showId)}/episodes?page=${pageNum}&limit=20&sort=${encodeURIComponent(sortBy)}&filter=${encodeURIComponent(filterBy)}`;
      }

      if (searchQuery) {
        endpointPath += `&search=${encodeURIComponent(searchQuery)}`;
      }

      const endpoint = apiUrl(endpointPath);
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        console.error('Episodes fetch returned non-ok status', response.status);
        setHasMore(false);
        return;
      }
      
      const data = await response.json();
      let incoming: VODEpisode[] = data.episodes || [];

      // Filter to only include episodes that have already aired
      const pastEpisodes = incoming.filter(ep => {
        if (ep.is_live === true) return false;
        return hasEpisodeAired(ep);
      });

      // If we're showing all past shows, fetch show details to get categories
      if (showAllPastShows) {
        // Get all unique show IDs from episodes
        const showIds = [...new Set(pastEpisodes.map(ep => ep.show_id).filter(Boolean))];
        
        if (showIds.length > 0) {
          // Fetch show details to get categories
          const { data: showsData, error } = await supabase
            .from('studio_shows')
            .select('id, title, category, thumbnail_url, total_views')
            .in('id', showIds);

          if (!error && showsData) {
            // Create a map of show_id to show details
            const showMap = showsData.reduce((acc, show) => {
              acc[show.id] = show;
              return acc;
            }, {} as Record<string, any>);

            // Enhance episodes with show category
            const enhancedEpisodes = pastEpisodes.map(ep => ({
              ...ep,
              show_category: showMap[ep.show_id!]?.category || 'Other',
              show_title: showMap[ep.show_id!]?.title || ep.show_title,
              show_thumbnail: showMap[ep.show_id!]?.thumbnail_url || ep.show_thumbnail,
              // Ensure views is a number
              views: ep.views || 0,
            }));

            incoming = enhancedEpisodes;
          }
        }
      }

      // Sort episodes based on sortBy option
      let sortedEpisodes = [...incoming];
      switch (sortBy) {
        case 'newest':
          sortedEpisodes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          break;
        case 'oldest':
          sortedEpisodes.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          break;
        case 'most-viewed':
          sortedEpisodes.sort((a, b) => (b.views || 0) - (a.views || 0));
          break;
        case 'least-viewed':
          sortedEpisodes.sort((a, b) => (a.views || 0) - (b.views || 0));
          break;
        case 'longest':
          sortedEpisodes.sort((a, b) => (b.duration || 0) - (a.duration || 0));
          break;
        case 'shortest':
          sortedEpisodes.sort((a, b) => (a.duration || 0) - (b.duration || 0));
          break;
      }

      // Apply additional filters
      if (filterBy === 'popular') {
        sortedEpisodes = sortedEpisodes.filter(ep => (ep.views || 0) > 100);
      } else if (filterBy === 'trending') {
        // Trending: recent episodes with high views
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        sortedEpisodes = sortedEpisodes.filter(ep => {
          const episodeDate = getEpisodeDate(ep);
          return episodeDate && episodeDate > oneWeekAgo && (ep.views || 0) > 50;
        });
      }

      if (pageNum === 1) {
        setEpisodes(sortedEpisodes);
      } else {
        setEpisodes(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newEpisodes = sortedEpisodes.filter(ep => !existingIds.has(ep.id));
          return [...prev, ...newEpisodes];
        });
      }

      setHasMore(Boolean(data.hasMore) && pastEpisodes.length > 0);
      consecutiveErrorRef.current = 0;
    } catch (error) {
      console.error('Error fetching episodes:', error);
      consecutiveErrorRef.current = (consecutiveErrorRef.current || 0) + 1;
      if (consecutiveErrorRef.current > 3) {
        setHasMore(false);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [showId, showAllPastShows, sortBy, filterBy, searchQuery]);

  // Initial load
  useEffect(() => {
    setPage(1);
    setEpisodes([]);
    fetchEpisodes(1);
  }, [showId, sortBy, filterBy, searchQuery, showAllPastShows]);

  // Load shows list
  useEffect(() => {
    let mounted = true;
    const loadShows = async () => {
      if (shows && shows.length) return;
      try {
        const { data, error } = await supabase
          .from('studio_shows')
          .select('id, title, thumbnail_url, category, video_url, total_views')
          .eq('is_active', true)
          .order('title', { ascending: true });
        
        if (error) throw error;
        if (mounted) setShowsList(data || []);
      } catch (err) {
        console.warn('Error fetching shows list', err);
      }
    };
    loadShows();
    return () => { mounted = false; };
  }, [shows]);

  // Group episodes by category for "by-category" view
  const getGroupedByCategory = () => {
    const categories: Record<string, VODEpisode[]> = {};
    
    // Initialize with all categories
    SHOW_CATEGORIES.forEach(cat => {
      categories[cat] = [];
    });
    categories['Other'] = [];
    
    // Group episodes by category
    episodes.forEach(episode => {
      const category = episode.show_category || episode.category || 'Other';
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(episode);
    });
    
    // Filter out empty categories
    return Object.entries(categories)
      .filter(([_, episodes]) => episodes.length > 0)
      .sort(([catA, epsA], [catB, epsB]) => epsB.length - epsA.length);
  };

  // Group episodes by show for "by-show" view
  const getGroupedByShow = () => {
    const showsMap: Record<string, { 
      show: { id: string; title: string; thumbnail_url?: string; category?: string; total_views?: number };
      episodes: VODEpisode[] 
    }> = {};
    
    // Create show map
    showsList.forEach(show => {
      showsMap[show.id] = {
        show,
        episodes: []
      };
    });
    
    // Add "Other" for episodes without show info
    showsMap['other'] = {
      show: { id: 'other', title: 'Other Shows' },
      episodes: []
    };
    
    // Group episodes by show
    episodes.forEach(episode => {
      const showId = episode.show_id || 'other';
      if (showsMap[showId]) {
        showsMap[showId].episodes.push(episode);
      } else {
        showsMap['other'].episodes.push(episode);
      }
    });
    
    // Filter out shows with no episodes and sort by total views
    return Object.entries(showsMap)
      .filter(([_, data]) => data.episodes.length > 0)
      .sort(([, dataA], [, dataB]) => {
        const viewsA = dataA.show.total_views || 0;
        const viewsB = dataB.show.total_views || 0;
        return viewsB - viewsA;
      });
  };

  // Get filtered episodes based on selected category
  const getFilteredEpisodes = () => {
    if (selectedCategory === 'all') return episodes;
    return episodes.filter(ep => 
      (ep.show_category === selectedCategory) || (ep.category === selectedCategory)
    );
  };

  // Get unique categories from episodes
  const getAvailableCategories = () => {
    const categories = new Set<string>();
    episodes.forEach(ep => {
      const cat = ep.show_category || ep.category;
      if (cat) categories.add(cat);
    });
    return ['all', ...Array.from(categories)].sort();
  };

  // Format view count with K/M suffixes
  const formatViewCount = (views?: number) => {
    if (!views || views === 0) return '0';
    if (views < 1000) return views.toString();
    if (views < 1000000) return (views / 1000).toFixed(1) + 'K';
    return (views / 1000000).toFixed(1) + 'M';
  };

  // Calculate total views for a category
  const getCategoryTotalViews = (categoryEpisodes: VODEpisode[]) => {
    return categoryEpisodes.reduce((total, ep) => total + (ep.views || 0), 0);
  };

  if (loading && episodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-purple-500" />
        <p className="text-gray-400">
          {showAllPastShows ? 'Loading all past shows...' : 'Loading episodes...'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with mode selector */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div>
          <h3 className="text-xl font-semibold text-white">
            {showAllPastShows ? 'All Past Shows' : 'Past Episodes'}
          </h3>
          {showAllPastShows && (
            <p className="text-sm text-gray-400 mt-1">
              Browse and watch shows from all series • Total views across all episodes: {formatViewCount(episodes.reduce((total, ep) => total + (ep.views || 0), 0))}
            </p>
          )}
        </div>
        
        {/* View Mode Toggle - only show in "all shows" mode */}
        {showAllPastShows && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-400">View:</span>
            <div className="flex bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1 rounded text-sm ${viewMode === 'grid' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode('by-show')}
                className={`px-3 py-1 rounded text-sm ${viewMode === 'by-show' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                By Show
              </button>
              <button
                onClick={() => setViewMode('by-category')}
                className={`px-3 py-1 rounded text-sm ${viewMode === 'by-category' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                By Category
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-400">Sort by:</span>
          </div>
          <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
            <SelectTrigger className="w-[180px] bg-gray-800 border-gray-700">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="most-viewed">Most Viewed</SelectItem>
              <SelectItem value="least-viewed">Least Viewed</SelectItem>
              <SelectItem value="trending">Trending</SelectItem>
              <SelectItem value="longest">Longest</SelectItem>
              <SelectItem value="shortest">Shortest</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterBy} onValueChange={(value: FilterOption) => setFilterBy(value)}>
            <SelectTrigger className="w-[150px] bg-gray-800 border-gray-700">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              <SelectItem value="all">All Episodes</SelectItem>
              <SelectItem value="recent">Last 7 Days</SelectItem>
              <SelectItem value="popular">Most Popular</SelectItem>
              <SelectItem value="trending">Trending Now</SelectItem>
              <SelectItem value="featured">Featured</SelectItem>
            </SelectContent>
          </Select>

          {/* Category Filter for grid view */}
          {showAllPastShows && viewMode === 'grid' && (
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[150px] bg-gray-800 border-gray-700">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700">
                {getAvailableCategories().map(cat => (
                  <SelectItem key={cat} value={cat}>
                    {cat === 'all' ? 'All Categories' : cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder={showAllPastShows ? "Search all shows..." : "Search episodes..."}
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 pl-10 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Episode Count */}
      <div className="text-sm text-gray-400">
        {selectedCategory !== 'all' ? (
          <>
            Showing {getFilteredEpisodes().length} episode{getFilteredEpisodes().length !== 1 ? 's' : ''} in {selectedCategory} • {formatViewCount(getCategoryTotalViews(getFilteredEpisodes()))} total views
          </>
        ) : (
          <>
            Showing {episodes.length} {showAllPastShows ? 'show' : 'episode'}{episodes.length !== 1 ? 's' : ''} • {formatViewCount(episodes.reduce((total, ep) => total + (ep.views || 0), 0))} total views
          </>
        )}
      </div>

      {/* Episodes Grid/List */}
      <div 
        ref={containerRef}
        className="space-y-4"
        style={{ maxHeight: '600px', overflowY: 'auto' }}
      >
        {/* View Modes */}
        {showAllPastShows ? (
          <>
            {viewMode === 'by-category' ? (
              /* Category View */
              <div className="space-y-8">
                {getGroupedByCategory().map(([category, categoryEpisodes]) => {
                  const categoryViews = getCategoryTotalViews(categoryEpisodes);
                  return (
                    <div key={category} className="space-y-4">
                      {/* Category Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-900 to-pink-900 flex items-center justify-center">
                            <Tv className="h-6 w-6 text-white/70" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-white text-lg">{category}</h4>
                            <p className="text-sm text-gray-400">
                              {categoryEpisodes.length} episode{categoryEpisodes.length !== 1 ? 's' : ''} • {formatViewCount(categoryViews)} views
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-purple-400 hover:text-purple-300"
                          onClick={() => {
                            setViewMode('grid');
                            setSelectedCategory(category);
                          }}
                        >
                          View All
                        </Button>
                      </div>

                      {/* Episodes Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ml-0 md:ml-6">
                        {categoryEpisodes.slice(0, 6).map(episode => (
                          <EpisodeCard
                            key={episode.id}
                            episode={episode}
                            playingEpisodeId={playingEpisodeId}
                            onEpisodeSelect={handleEpisodeSelect}
                            showAllPastShows={showAllPastShows}
                            userHasViewed={userViews[episode.id]}
                          />
                        ))}
                      </div>

                      {/* Show More if there are more episodes */}
                      {categoryEpisodes.length > 6 && (
                        <div className="text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-gray-700 text-gray-400 hover:text-white"
                            onClick={() => {
                              setViewMode('grid');
                              setSelectedCategory(category);
                            }}
                          >
                            Show all {categoryEpisodes.length} episodes in {category} • {formatViewCount(categoryViews)} views
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : viewMode === 'by-show' ? (
              /* Show View */
              <div className="space-y-8">
                {getGroupedByShow().map(([showId, { show, episodes: showEpisodes }]) => {
                  const showTotalViews = showEpisodes.reduce((total, ep) => total + (ep.views || 0), 0);
                  return (
                    <div key={showId} className="space-y-4">
                      {/* Show Header */}
                      <div className="flex items-center space-x-3">
                        {show.thumbnail_url ? (
                          <img
                            src={show.thumbnail_url}
                            alt={show.title}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-900 to-pink-900 flex items-center justify-center">
                            <Tv className="h-6 w-6 text-white/70" />
                          </div>
                        )}
                        <div>
                          <h4 className="font-semibold text-white text-lg">{show.title}</h4>
                          <p className="text-sm text-gray-400">
                            {showEpisodes.length} episode{showEpisodes.length !== 1 ? 's' : ''} • {formatViewCount(showTotalViews)} views
                            {show.category && (
                              <span className="ml-2 px-2 py-1 bg-gray-800 rounded text-xs">
                                {show.category}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Episodes Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ml-0 md:ml-14">
                        {showEpisodes.slice(0, 6).map(episode => (
                          <EpisodeCard
                            key={episode.id}
                            episode={episode}
                            playingEpisodeId={playingEpisodeId}
                            onEpisodeSelect={handleEpisodeSelect}
                            showAllPastShows={showAllPastShows}
                            userHasViewed={userViews[episode.id]}
                          />
                        ))}
                      </div>

                      {/* Show More if there are more episodes */}
                      {showEpisodes.length > 6 && (
                        <div className="text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-gray-700 text-gray-400 hover:text-white"
                            onClick={() => {
                              // This would ideally navigate to the show's page
                              console.log('Navigate to show:', show.title);
                            }}
                          >
                            Show all {showEpisodes.length} episodes • {formatViewCount(showTotalViews)} views
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Grid View (default) */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {getFilteredEpisodes().map(episode => (
                  <EpisodeCard
                    key={episode.id}
                    episode={episode}
                    playingEpisodeId={playingEpisodeId}
                    onEpisodeSelect={handleEpisodeSelect}
                    showAllPastShows={showAllPastShows}
                    userHasViewed={userViews[episode.id]}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          /* Single Show View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {episodes.map(episode => (
              <EpisodeCard
                key={episode.id}
                episode={episode}
                playingEpisodeId={playingEpisodeId}
                onEpisodeSelect={handleEpisodeSelect}
                showAllPastShows={showAllPastShows}
                userHasViewed={userViews[episode.id]}
              />
            ))}
          </div>
        )}
        
        {/* Loading More Indicator */}
        {loadingMore && (
          <div className="flex justify-center py-8">
            <div className="flex flex-col items-center space-y-2">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
              <p className="text-sm text-gray-400">Loading more episodes...</p>
            </div>
          </div>
        )}
        
        {/* No More Content */}
        {!hasMore && episodes.length > 0 && (
          <div className="text-center py-8 border-t border-gray-800">
            <p className="text-gray-400 text-sm">
              You've reached the end of available {showAllPastShows ? 'shows' : 'episodes'}
            </p>
            <p className="text-gray-500 text-xs mt-1">
              Check back later for new content
            </p>
          </div>
        )}
        
        {/* No Episodes Found */}
        {episodes.length === 0 && !loading && (
          <div className="text-center py-16 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center">
              <Calendar className="h-8 w-8 text-gray-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">No Past Shows Found</h3>
              <p className="text-gray-400 max-w-md mx-auto">
                {searchQuery 
                  ? `No shows match "${searchQuery}". Try different search terms.`
                  : 'No past shows available at the moment. Check back later!'}
              </p>
            </div>
            {searchQuery && (
              <Button
                variant="outline"
                onClick={() => setSearchQuery('')}
                className="mt-4 border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                Clear Search
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Enhanced EpisodeCard with view tracking indicators
const EpisodeCard: React.FC<{
  episode: VODEpisode;
  playingEpisodeId?: string;
  onEpisodeSelect?: (episode: VODEpisode) => void;
  showAllPastShows?: boolean;
  userHasViewed?: boolean;
}> = ({ episode, playingEpisodeId, onEpisodeSelect, showAllPastShows, userHasViewed }) => {
  const getEpisodeDate = (ep: VODEpisode): Date | null => {
    const dateStr = ep.scheduled_time || ep.air_time || ep.published_at || ep.created_at;
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  };

  const formatDisplayDate = (ep: VODEpisode): string => {
    const date = getEpisodeDate(ep);
    if (!date) return 'Date unavailable';
    
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getEpisodeBadgeColor = (ep: VODEpisode) => {
    const date = getEpisodeDate(ep);
    if (!date) return 'bg-gray-500';
    
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    
    if (diffDays < 1) return 'bg-green-500';
    if (diffDays < 3) return 'bg-blue-500';
    if (diffDays < 7) return 'bg-purple-500';
    return 'bg-gray-500';
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  };

  const formatViewCount = (views?: number) => {
    if (!views || views === 0) return '0';
    if (views < 1000) return views.toString();
    if (views < 1000000) return (views / 1000).toFixed(1) + 'K';
    return (views / 1000000).toFixed(1) + 'M';
  };

  // Determine view count badge color
  const getViewCountColor = (views?: number) => {
    if (!views || views === 0) return 'text-gray-400';
    if (views < 10) return 'text-gray-300';
    if (views < 100) return 'text-blue-300';
    if (views < 1000) return 'text-green-300';
    if (views < 10000) return 'text-yellow-300';
    return 'text-red-300';
  };

  return (
    <Card 
      className={`group cursor-pointer transition-all hover:scale-[1.02] hover:shadow-xl hover:border-purple-500/30 border-2 ${
        playingEpisodeId === episode.id 
          ? 'border-purple-500 ring-2 ring-purple-500/30' 
          : userHasViewed 
          ? 'border-green-500/30 bg-green-500/5' 
          : 'border-gray-800'
      } bg-gray-900/50 backdrop-blur-sm`}
      onClick={() => onEpisodeSelect?.(episode)}
    >
      {/* Thumbnail Container */}
      <div className="relative aspect-video overflow-hidden rounded-t-lg bg-gradient-to-br from-gray-900 to-black">
        {(episode.thumbnail_url || episode.show_thumbnail) ? (
          <>
            <img
              src={episode.thumbnail_url || episode.show_thumbnail || '/placeholder.svg'}
              alt={episode.title}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900/50 to-pink-900/50">
            <Play className="h-16 w-16 text-white/30" />
          </div>
        )}
        
        {/* Play Button Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="bg-white/20 backdrop-blur-sm rounded-full p-4 transform group-hover:scale-110 transition-transform">
            <Play className="h-8 w-8 text-white" fill="white" />
          </div>
        </div>
        
        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
          <div className="flex flex-wrap gap-1">
            <Badge className={`${getEpisodeBadgeColor(episode)} text-white text-xs px-2 py-1`}>
              {formatDisplayDate(episode)}
            </Badge>
            {/* Show name badge in "all shows" mode */}
            {showAllPastShows && episode.show_title && (
              <Badge className="bg-gray-700 text-gray-300 text-xs px-2 py-1">
                {episode.show_title}
              </Badge>
            )}
            {/* Viewed indicator */}
            {userHasViewed && (
              <Badge className="bg-green-600 text-white text-xs px-2 py-1">
                Viewed
              </Badge>
            )}
          </div>
          
          {/* Duration Badge */}
          {episode.duration && (
            <Badge className="bg-black/80 text-white text-xs px-2 py-1">
              <Clock className="inline w-3 h-3 mr-1" />
              {formatDuration(episode.duration)}
            </Badge>
          )}
        </div>
        
        {/* Bottom Info */}
        <div className="absolute bottom-3 left-3 right-3">
          {/* Now Playing Indicator */}
          {playingEpisodeId === episode.id && (
            <Badge className="bg-purple-600 text-white text-xs mb-2 animate-pulse">
              Now Playing
            </Badge>
          )}
          
          {/* View Count with eye icon */}
          <div className={`flex items-center text-xs ${getViewCountColor(episode.views)}`}>
            {episode.views === 0 ? (
              <EyeOff className="h-3 w-3 mr-1" />
            ) : (
              <Eye className="h-3 w-3 mr-1" />
            )}
            <span className="font-semibold">{formatViewCount(episode.views)}</span>
            <span className="ml-1">view{episode.views !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>
      
      {/* Episode Info */}
      <CardContent className="p-4">
        <h4 className="font-semibold text-white mb-2 line-clamp-1 group-hover:text-purple-300 transition-colors">
          {episode.title}
        </h4>
        {episode.description && (
          <p className="text-sm text-gray-400 line-clamp-2 mb-3">
            {episode.description}
          </p>
        )}
        
        {/* Metadata */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center">
            <CalendarDays className="h-3 w-3 mr-1" />
            <span>
              {getEpisodeDate(episode)?.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              }) || 'Date unavailable'}
            </span>
          </div>
          
          {/* Category Badge */}
          {episode.show_category && (
            <Badge className="bg-gray-800 text-gray-300">
              {episode.show_category}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default VODLibrary;