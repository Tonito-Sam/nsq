import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, MessageSquare, ShoppingCart, Search, Tag, Zap, Grid, Box, Music, Headphones, BookOpen, Menu, X, CreditCard, Play, Pause, ChevronLeft, ChevronRight, ArrowRight, Store } from 'lucide-react';
import { Header } from '@/components/Header';
import { SearchDropdown } from '@/components/SearchDropdown';
import { ChatModal } from '@/components/ChatModal';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import type { Database } from '@/types/supabase';
import { getDisplayPrice, getDiscountPercentage } from '@/utils/pricing';
// use ShoppingCart from the main import

type ProductRow = Database['public']['Tables']['store_products']['Row'];

interface Product extends ProductRow {
  store?: {
    id: string;
    store_name: string;
    verification_status: string;
  };
}

// Audio player component for previews
interface AudioPlayerProps {
  audioUrl: string;
  productTitle: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioUrl, productTitle }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Setup audio listeners and 30s preview cutoff. Re-run when audioUrl changes.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.currentTime >= 30) {
        audio.pause();
        setIsPlaying(false);
        audio.currentTime = 0;
      }
    };

    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, [audioUrl]);


  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    // Try to play and update state only on success
    audio.play()
      .then(() => setIsPlaying(true))
      .catch((err) => {
        console.error('Audio play failed', err);
        toast({ title: 'Playback failed', description: 'Unable to play preview. Your browser may block playback or the file is unreachable.' });
      });
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2">
      {audioUrl ? (
        <>
          <audio
            ref={audioRef}
            src={audioUrl}
            preload="metadata"
            aria-label={productTitle}
          />

          <Button
            variant="outline"
            size="sm"
            onClick={togglePlay}
            className="h-9 w-9 p-0"
          >
            {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          </Button>

          <div className="text-xs text-gray-500">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </>
      ) : (
        <>
          <Button variant="outline" size="sm" disabled className="h-9 w-9 p-0">
            <Play className="h-3 w-3" />
          </Button>
          <div className="text-xs text-gray-500">No preview</div>
        </>
      )}
    </div>
  );
};

// Global styles used by the Square page feature hub (line-clamp + hide scrollbar)
const globalStyles = `
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
`;

// React Query keys
const QUERY_KEYS = {
  products: ['products'] as const,
  cartCount: ['cartCount'] as const,
} as const;

const Square = () => {
  // page-specific meta
  useMeta({
    title: 'Square — Shop, Deals & Discover — NexSq',
    description: 'Explore the Square: featured products, limited-time deals, and curated shops on NexSq.',
    url: window.location.href,
  });
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  // UI filters
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [mainTab, setMainTab] = useState<'all' | 'physical' | 'digital'>('all');
  const [digitalSubTab, setDigitalSubTab] = useState<'all' | 'music' | 'audiobook' | 'ebook'>('all');
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  

  // Fetch products with React Query
  const { data: products = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.products,
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('store_products')
          .select('*');

        if (error) throw error;

        const typedProducts = (data || []) as ProductRow[];

        const storeIds = Array.from(new Set(typedProducts.map(p => p.store_id).filter(Boolean)));

        // Fetch all stores in one query
        const { data: storesData, error: storesError } = await supabase
          .from('user_stores')
          .select('id, store_name, verification_status, is_active')
          .in('id', storeIds);

        if (storesError) throw storesError;

        const storesMap = new Map((storesData || []).map((store: any) => [store.id, store]));

        // Attach store info, but always keep the original store_id for navigation
        return typedProducts.map(product => {
          const storeData = storesMap.get(product.store_id);
          return {
            ...product,
            store: storeData
              ? {
                  store_name: storeData.store_name,
                  verification_status: storeData.verification_status,
                  id: storeData.id,
                }
              : undefined,
          };
        });
      } catch (error) {
        console.error('Error fetching products:', error);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // derived categories for sidebar
  const categories: string[] = Array.from(new Set((products || []).map(p => p.category).filter(Boolean))) as string[];

  // Top stores derived from products (by number of products listed)
  const topStores = (() => {
    const map = new Map<string, { id: string; name: string; verification?: string; count: number; image?: string }>();
    (products || []).forEach(p => {
      const storeId = p.store?.id || p.store_id;
      if (!storeId) return;
      const existing = map.get(storeId);
      const name = p.store?.store_name || (p as any).store_name || 'Store';
      const verification = p.store?.verification_status;
      const image = p.images?.[0];
      if (existing) {
        existing.count += 1;
      } else {
        map.set(storeId, { id: storeId, name, verification, count: 1, image });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 6);
  })();

  // Derived product sections for UI (client-side heuristics)
  // Helper: apply current main/category/digital filters to a product (used for section derivations)
  const applyMainFilters = (p: Product) => {
    // category filter
    if (categoryFilter) {
      if ((p.category || '').toLowerCase() !== categoryFilter.toLowerCase()) return false;
    }

    // main tab filter
    if (mainTab !== 'all') {
      const type = (p.product_type || '').toLowerCase();
      if (mainTab !== type) return false;
    }

    // digital sub-tab filter (only when mainTab === 'digital')
    if (mainTab === 'digital' && digitalSubTab !== 'all') {
      const cat = (p.category || '').toLowerCase();
      const pt = (p.product_type || '').toLowerCase();
      if (digitalSubTab === 'music' && !(cat.includes('music') || pt.includes('music'))) return false;
      if (digitalSubTab === 'audiobook' && !(cat.includes('audiobook') || pt.includes('audiobook') || cat.includes('audio'))) return false;
      if (digitalSubTab === 'ebook' && !(cat.includes('pdf') || pt.includes('pdf') || cat.includes('ebook') || cat.includes('book'))) return false;
    }

    return true;
  };

  // Base product list for section derivations — respects category/main/digital tabs (but not searchTerm)
  const baseForSections = (products || []).filter(applyMainFilters);

  // featuredProducts was removed (unused): picks are built per-store in featuredStoresProducts

  // Updated onSaleProducts to use the getDisplayPrice helper
  const onSaleProducts = baseForSections.filter(p => {
    const priceInfo = getDisplayPrice(p);
    return priceInfo.isOnSale;
  }).slice(0, 8);

  // Featured stores: pick one random product per store (for feature carousel)
  const featuredStoresProducts = (() => {
    const byStore = new Map<string, Product[]>();
    baseForSections.forEach(p => {
      const sid = p.store?.id || p.store_id;
      if (!sid) return;
      const arr = byStore.get(sid) || [];
      arr.push(p);
      byStore.set(sid, arr);
    });

    // pick one random product per store
    const picks: Product[] = [];
    for (const [, arr] of byStore) {
      if (!arr || arr.length === 0) continue;
      const pick = arr[Math.floor(Math.random() * arr.length)];
      picks.push(pick);
    }

    // show up to 12 stores
    return picks.slice(0, 12);
  })();
  
  const dealsOfTheDay = baseForSections
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6);
  
  const newArrivals = baseForSections
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6);
  
  // Top selling heuristic (by sales_count or sold_count)
  const topSellingProducts = baseForSections
    .slice()
    .sort((a, b) => ((b as any).sales_count || (b as any).sold_count || 0) - ((a as any).sales_count || (a as any).sold_count || 0))
    .slice(0, 6);
  
  // Trending heuristic (by views or recent)
  const trendingProducts = baseForSections
    .slice()
    .sort((a, b) => ((b as any).views || 0) - ((a as any).views || 0))
    .slice(0, 6);

  // Pagination states for desktop views
  const [dealsPage, setDealsPage] = useState(0);
  const dealsPerPage = 6;

  const [onSalePage, setOnSalePage] = useState(0);
  const onSalePerPage = 6;

  const [trendingPage, setTrendingPage] = useState(0);
  const trendingPerPage = 12;

  // Filter digital products for table view
  const digitalMusicProducts = baseForSections.filter(p => {
    const cat = (p.category || '').toLowerCase();
    const pt = (p.product_type || '').toLowerCase();
    return (cat.includes('music') || pt.includes('music'));
  });

  const digitalAudiobookProducts = baseForSections.filter(p => {
    const cat = (p.category || '').toLowerCase();
    const pt = (p.product_type || '').toLowerCase();
    return (cat.includes('audiobook') || pt.includes('audiobook') || cat.includes('audio'));
  });


  // Refs for mobile carousels
  const topSellingRef = useRef<HTMLDivElement | null>(null);
  const dealsRef = useRef<HTMLDivElement | null>(null);
  const newArrivalsRef = useRef<HTMLDivElement | null>(null);
  const trendingRef = useRef<HTMLDivElement | null>(null);
  const mainCarouselRef = useRef<HTMLDivElement | null>(null);
  const featuredStoresRef = useRef<HTMLDivElement | null>(null);
  const onSaleRef = useRef<HTMLDivElement | null>(null);

  // Featured carousel state (index for single-item view)
  const [featuredIndex, setFeaturedIndex] = useState(0);
  // autoplay for the featured hero (single-item mode)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const autoPlayRef = useRef<number | null>(null);

  // helper: chunk array into groups of `size`
  const chunk = <T,>(arr: T[], size: number) => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  // Auto-advance carousel helper
  const useAutoAdvance = (ref: React.RefObject<HTMLDivElement>, slidesCount: number, intervalMs = 10000) => {
    useEffect(() => {
      const el = ref.current;
      if (!el || slidesCount <= 1) return;
      let idx = 0;
      const handler = () => {
        if (window.innerWidth >= 1024) return; // only auto-advance on mobile
        idx = (idx + 1) % slidesCount;
        const width = el.clientWidth;
        el.scrollTo({ left: idx * width, behavior: 'smooth' });
      };
      const timer = setInterval(handler, intervalMs);
      return () => clearInterval(timer);
    }, [ref, slidesCount, intervalMs]);
  };

  // Simple carousel scroll helper used by the feature hub (Takealot-style controls)
  // (Removed unused scrollCarousel helper)

  // Scroll directly to a featured slide index (calculates slide width from first child)
  // Enhanced to wrap indexes and reset the autoplay timer when user manually navigates.
  const scrollToFeatured = (index: number) => {
    if (!featuredStoresProducts || featuredStoresProducts.length === 0) return;

    // wrap index
    if (index < 0) {
      index = featuredStoresProducts.length - 1;
    } else if (index >= featuredStoresProducts.length) {
      index = 0;
    }

    setFeaturedIndex(index);

    // Reset autoplay timer if user manually navigates
    if (isAutoPlaying) {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
      }
      autoPlayRef.current = window.setInterval(() => {
        setFeaturedIndex((current) => (current === featuredStoresProducts.length - 1 ? 0 : current + 1));
      }, 12000);
    }

    // also scroll the store-track (if present) for the small-store track layout
    const el = featuredStoresRef.current;
    if (!el) return;
    const track = el.firstElementChild as HTMLElement | null;
    if (!track) return;
    const first = track.children[0] as HTMLElement | undefined;
    const gap = 16; // Tailwind gap-4 == 1rem == 16px
    const slideWidth = (first?.offsetWidth || el.clientWidth) + gap;
    const left = Math.max(0, Math.min(index, Math.max(0, track.children.length - 1))) * slideWidth;
    el.scrollTo({ left, behavior: 'smooth' });
  };

  // Autoplay effect for the featured hero (updates featuredIndex every 12s)
  useEffect(() => {
    if (!isAutoPlaying) return;
    // clear any existing timer
    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
      autoPlayRef.current = null;
    }

    autoPlayRef.current = window.setInterval(() => {
      setFeaturedIndex((current) => (current === (featuredStoresProducts.length - 1) ? 0 : current + 1));
    }, 12000);

    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
        autoPlayRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAutoPlaying, featuredStoresProducts.length]);

  const toggleAutoPlay = () => {
    setIsAutoPlaying((s) => {
      const next = !s;
      if (!next && autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
        autoPlayRef.current = null;
      }
      return next;
    });
  };

  // Keep featuredIndex in sync with manual scrolling
  useEffect(() => {
    const el = featuredStoresRef.current;
    if (!el) return;

    const onScroll = () => {
      const track = el.firstElementChild as HTMLElement | null;
      if (!track) return;
      const first = track.children[0] as HTMLElement | undefined;
      const gap = 16;
      const slideWidth = (first?.offsetWidth || el.clientWidth) + gap;
      const idx = Math.round(el.scrollLeft / slideWidth);
      setFeaturedIndex(Math.max(0, Math.min(idx, track.children.length - 1)));
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [featuredStoresProducts.length]);

  // Fetch cart count with React Query
  const { data: cartCount = 0 } = useQuery({
    queryKey: QUERY_KEYS.cartCount,
    queryFn: async () => {
      if (!user) return 0;
      
      const { count, error } = await supabase
        .from('cart_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch cart items for dropdown preview
  const { data: cartItems = [], isLoading: cartLoading } = useQuery({
    queryKey: ['cartItems'],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('cart_items')
        .select('id,quantity,product_id,store_products(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!user,
    staleTime: 30 * 1000,
  });

  // Add to cart mutation
  const addToCartMutation = useMutation({
    mutationFn: async (product: Product) => {
      if (!user) throw new Error('User not authenticated');

      // Check if item already exists in cart
      try {
        const { data: existing, error: checkError } = await supabase
          .from('cart_items')
          .select('id, quantity')
          .eq('user_id', user.id)
          .eq('product_id', product.id)
          .maybeSingle();

        if (checkError) {
          console.warn('[addToCart] check existing error', checkError);
        }

        if (existing) {
          // If already in cart, increment quantity
          const { error: updateError } = await supabase
            .from('cart_items')
            .update({ quantity: (existing.quantity || 0) + 1 })
            .eq('id', existing.id)
            .select()
            .maybeSingle();

          if (updateError) {
            console.error('[addToCart] update error', updateError);
            throw updateError;
          }
          return { action: 'updated', product };
        }

        // If not in cart, insert new row and return the inserted row
        const { error: insError } = await supabase
          .from('cart_items')
          .insert({
            user_id: user.id,
            product_id: product.id,
            quantity: 1,
          })
          .select()
          .maybeSingle();

        if (insError) {
          console.error('[addToCart] insert error', insError);
          // throw with full error to allow UI to display
          throw insError;
        }

        return { action: 'added', product };
      } catch (err: any) {
        console.error('[addToCart] unexpected error', err);
        throw err;
      }
    },
    onSuccess: ({ action, product }) => {
      // Invalidate cart count query
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cartCount });
      
      toast({
        title: action === 'added' ? 'Added to Cart' : 'Cart Updated',
        description: `${product.title} ${action === 'added' ? 'has been added to' : 'quantity increased in'} your cart.`,
      });
    },
    onError: (error) => {
      console.error('Error adding to cart:', error);
      toast({
        title: 'Error',
        description: 'Failed to add to cart. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleAddToCart = async (product: Product) => {
    if (!user) {
      toast({
        title: 'Sign In Required',
        description: 'Please sign in to add items to your cart.',
        variant: 'destructive',
      });
      return;
    }
    addToCartMutation.mutate(product);
  };

  const filteredProducts = products.filter(product =>
    (product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category?.toLowerCase().includes(searchTerm.toLowerCase()))
  )
  // category sidebar filter
  .filter(product => {
    if (!categoryFilter) return true;
    return (product.category || '').toLowerCase() === categoryFilter.toLowerCase();
  })
  // main tab filter
  .filter(product => {
    if (mainTab === 'all') return true;
    const type = (product.product_type || '').toLowerCase();
    return mainTab === type;
  })
  // digital sub-tab filter
  .filter(product => {
    if (mainTab !== 'digital' || digitalSubTab === 'all') return true;
    const cat = (product.category || '').toLowerCase();
    const pt = (product.product_type || '').toLowerCase();
  if (digitalSubTab === 'music') return cat.includes('music') || pt.includes('music');
  if (digitalSubTab === 'audiobook') return cat.includes('audiobook') || pt.includes('audiobook') || cat.includes('audio');
  if (digitalSubTab === 'ebook') return cat.includes('pdf') || pt.includes('pdf') || cat.includes('ebook') || cat.includes('book');
    return true;
  });

  // wire up auto-advance for carousels now that filteredProducts is available
  useAutoAdvance(topSellingRef, Math.max(1, Math.ceil(topSellingProducts.length / 2)));
  // Deals: mobile 3-per-view auto-advance every 12s
  useAutoAdvance(dealsRef, Math.max(1, Math.ceil(dealsOfTheDay.length / 3)), 12000);
  // New Arrivals: show 1 per view on mobile and auto-advance every 15s
  useAutoAdvance(newArrivalsRef, Math.max(1, newArrivals.length), 15000);
  useAutoAdvance(trendingRef, Math.max(1, Math.ceil(trendingProducts.length / 6)), 12000);
  useAutoAdvance(mainCarouselRef, Math.max(1, filteredProducts.length));
  // Featured stores carousel (auto-advance on mobile)
  useAutoAdvance(featuredStoresRef, Math.max(1, Math.ceil(featuredStoresProducts.length / 3)), 12000);
  // On Sale compact carousel
  useAutoAdvance(onSaleRef, Math.max(1, Math.ceil(onSaleProducts.length / 3)), 12000);

  // AUTO SLIDE FOR NEW ARRIVALS
  useEffect(() => {
    if (!newArrivalsRef.current) return;

    const container = newArrivalsRef.current;
    let slideIndex = 0;

    const handleAutoSlide = () => {
      if (!container) return;

      const containerWidth = container.clientWidth;

      // Detect items-per-view
      let itemsPerView = 1; // default mobile
      if (window.innerWidth >= 1024) {
        itemsPerView = 4; // desktop
      } else if (window.innerWidth >= 640) {
        itemsPerView = 2; // tablet
      }

      const slideWidth = containerWidth / itemsPerView;

      slideIndex++;

      // Loop back when reaching end
      if (slideIndex * slideWidth >= container.scrollWidth) {
        slideIndex = 0;
      }

      container.scrollTo({
        left: slideIndex * slideWidth,
        behavior: 'smooth',
      });
    };

    const interval = setInterval(handleAutoSlide, 6000);

    return () => clearInterval(interval);
  }, [newArrivals]);

  // Reset pagination when underlying collections or filters change
  useEffect(() => {
    setDealsPage(0);
  }, [newArrivals.length, dealsOfTheDay.length, categoryFilter, mainTab, digitalSubTab]);

  useEffect(() => {
    setOnSalePage(0);
  }, [onSaleProducts.length, categoryFilter, mainTab, digitalSubTab]);

  useEffect(() => {
    setTrendingPage(0);
  }, [trendingProducts.length, categoryFilter, mainTab, digitalSubTab]);

  // Mobile deals carousel controls
  const mobileDealsPerView = 3;
  const mobileDealsSlides = Math.max(1, Math.ceil(dealsOfTheDay.length / mobileDealsPerView));
  const mobileDealsIndexRef = useRef<number>(0);
  const [mobileDealsIndex, setMobileDealsIndex] = useState(0);

  const scrollDealsTo = (idx: number) => {
    const el = dealsRef.current;
    if (!el) return;
    const width = el.clientWidth;
    el.scrollTo({ left: idx * width, behavior: 'smooth' });
    mobileDealsIndexRef.current = idx;
    setMobileDealsIndex(idx);
  };

  const handleDealsPrev = () => {
    const slides = mobileDealsSlides;
    let idx = mobileDealsIndexRef.current - 1;
    if (idx < 0) idx = slides - 1;
    scrollDealsTo(idx);
  };

  const handleDealsNext = () => {
    const slides = mobileDealsSlides;
    let idx = (mobileDealsIndexRef.current + 1) % slides;
    scrollDealsTo(idx);
  };

  // Keep mobileDealsIndex in sync with manual scrolls
  useEffect(() => {
    const el = dealsRef.current;
    if (!el) return;
    const onScroll = () => {
      const idx = Math.round(el.scrollLeft / el.clientWidth);
      mobileDealsIndexRef.current = idx;
      setMobileDealsIndex(idx);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [dealsRef.current]);

  // Mobile trending carousel controls (mirror deals behavior)
  // Show 6 items per slide on mobile as 3 columns x 2 rows
  const mobileTrendingPerView = 6;
  const mobileTrendingSlides = Math.max(1, Math.ceil(trendingProducts.length / mobileTrendingPerView));
  const mobileTrendingIndexRef = useRef<number>(0);
  const [mobileTrendingIndex, setMobileTrendingIndex] = useState(0);

  const scrollTrendingTo = (idx: number) => {
    const el = trendingRef.current;
    if (!el) return;
    const width = el.clientWidth;
    el.scrollTo({ left: idx * width, behavior: 'smooth' });
    mobileTrendingIndexRef.current = idx;
    setMobileTrendingIndex(idx);
  };

  const handleTrendingPrev = () => {
    const slides = mobileTrendingSlides;
    let idx = mobileTrendingIndexRef.current - 1;
    if (idx < 0) idx = slides - 1;
    scrollTrendingTo(idx);
  };

  const handleTrendingNext = () => {
    const slides = mobileTrendingSlides;
    let idx = (mobileTrendingIndexRef.current + 1) % slides;
    scrollTrendingTo(idx);
  };

  useEffect(() => {
    const el = trendingRef.current;
    if (!el) return;
    const onScroll = () => {
      const idx = Math.round(el.scrollLeft / el.clientWidth);
      mobileTrendingIndexRef.current = idx;
      setMobileTrendingIndex(idx);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [trendingRef.current]);

  // Helper function to get file type from product
  const getFileType = (product: Product) => {
    // Extract file type from description or use default
    const desc = product.description?.toLowerCase() || '';
    if (desc.includes('mp3') || product.title.toLowerCase().includes('mp3')) return 'MP3';
    if (desc.includes('wav') || product.title.toLowerCase().includes('wav')) return 'WAV';
    if (desc.includes('flac') || product.title.toLowerCase().includes('flac')) return 'FLAC';
    if (desc.includes('m4a') || product.title.toLowerCase().includes('m4a')) return 'M4A';
    if (desc.includes('aac') || product.title.toLowerCase().includes('aac')) return 'AAC';
    return 'Audio File';
  };

    // Helper function to get preview URL (this would come from your product data)
    const getPreviewUrl = (product: Product) => {
      // prefer explicit audio/preview fields if present
      const AUDIO_EXTS = ['.mp3', '.wav', '.m4a', '.flac', '.aac', '.ogg', '.oga'];
      const looksLikeAudio = (url?: string) => typeof url === 'string' && AUDIO_EXTS.some(ext => url.toLowerCase().includes(ext));

      const candidateKeys = [
        (product as any).preview_url,
        (product as any).audio_url,
        (product as any).preview_audio,
        (product as any).audio_preview,
        (product as any).file_url,
        (product as any).file,
        (product as any).src,
      ];

      for (const c of candidateKeys) {
        if (looksLikeAudio(c)) return c as string;
      }

      // check arrays that may contain files
      const fileArrays = (product as any).files || (product as any).attachments || (product as any).media || (product as any).assets;
      if (Array.isArray(fileArrays)) {
        for (const f of fileArrays) {
          const url = typeof f === 'string' ? f : f?.url || f?.path || f?.file || f?.src;
          if (looksLikeAudio(url)) return url;
        }
      }

      // fallback: no audio preview available
      return '';
    };

  // Seasonal flags are declared where needed in the Feature Hub to keep scope local.

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a]">
        <Header />
        <div className="max-w-7xl mx-auto px-4 py-8 pb-32 lg:pb-8">
          <div className="text-center">Loading products...</div>
        </div>
        <MobileBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a]">
  <Header />
  {/* Inject small global styles for line-clamp and scrollbar hiding used by the featured hub */}
  <style>{globalStyles}</style>
      
      <div className="max-w-7xl mx-auto px-4 pt-6 pb-32 lg:pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar: categories */}
          <aside className="hidden lg:block col-span-1">
            <div className="sticky top-24 space-y-4">
              <div className="bg-white dark:bg-[#161616] p-4 rounded-lg shadow-sm">
                <h4 className="font-semibold mb-3">Categories</h4>
                <div className="flex flex-col space-y-2">
                  <button
                    className={`text-left px-2 py-1 rounded ${!categoryFilter ? 'bg-gray-100 dark:bg-gray-800' : ''}`}
                    onClick={() => setCategoryFilter('')}
                  >
                    All Categories
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat}
                      className={`text-left px-2 py-1 rounded ${categoryFilter === cat ? 'bg-gray-100 dark:bg-gray-800' : ''}`}
                      onClick={() => setCategoryFilter(categoryFilter === cat ? '' : cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {trendingProducts && trendingProducts.length > 0 && (
                <div className="bg-white dark:bg-[#161616] p-4 rounded-lg shadow-sm">
                  <h4 className="font-semibold mb-2">Trending</h4>
                  <div className="space-y-3">
                    {trendingProducts.slice(0, 5).map(p => {
                      const priceInfo = getDisplayPrice(p);
                      return (
                        <div
                          key={p.id}
                          className="flex items-center space-x-3 cursor-pointer"
                          onClick={() => navigate(`/product/${p.id}`)}
                        >
                            <div className="w-12 h-12 overflow-hidden rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                            {p.images?.[0] ? (
                              <img src={p.images[0]} alt={p.title} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                            ) : (
                              <Package className="h-6 w-6 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium line-clamp-1">{p.title}</div>
                            <div className="text-xs text-gray-500">
                              ZAR {priceInfo.displayPrice.toLocaleString()}
                              {priceInfo.isOnSale && (
                                <span className="ml-1 text-red-600 font-semibold">
                                  -{getDiscountPercentage(priceInfo.originalPrice, priceInfo.displayPrice)}%
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Top Stores Card (desktop sidebar) */}
              {topStores && topStores.length > 0 && (
                <div className="bg-white dark:bg-[#161616] p-4 rounded-lg shadow-sm">
                  <h4 className="font-semibold mb-2">Top Stores</h4>
                  <div className="space-y-3">
                    {topStores.slice(0, 6).map(store => (
                      <div key={store.id} className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/store/${store.id}`)}>
                          <div className="w-12 h-12 overflow-hidden rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                          {store.image ? (
                            <img src={store.image} alt={store.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex items-center justify-center w-full h-full text-gray-600">{store.name.charAt(0)}</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium line-clamp-1">{store.name}</div>
                          <div className="text-xs text-gray-500">{store.count} products</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* Main content */}
          <main className="col-span-1 lg:col-span-3">
            {/* Tabs: All / Physical / Digital */}
            {/* Mobile: showing + search above tabs */}
            <div className="mb-2 lg:hidden">
              <div className="flex items-center mb-2">
                <button
                  aria-label="Open categories"
                  onClick={() => setCategoriesOpen(true)}
                  className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 mr-2"
                >
                  <Menu className="h-5 w-5 text-gray-700 dark:text-gray-200" />
                </button>

                <div className="flex-1">
                  <SearchDropdown className="w-full" inputClassName="h-8 text-sm" />
                </div>
              </div>
              {/* Offcanvas categories panel */}
              <div className={`fixed inset-0 z-50 transition-transform ${categoriesOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
                <div className={`fixed inset-0 bg-black/40 transition-opacity ${categoriesOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setCategoriesOpen(false)} />
                <aside className={`fixed left-0 top-0 h-full w-64 bg-white dark:bg-[#0f0f0f] p-4 transform transition-transform ${categoriesOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold">Categories</h4>
                    <button onClick={() => setCategoriesOpen(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="flex flex-col space-y-2">
                    <button className={`text-left px-2 py-2 rounded ${!categoryFilter ? 'bg-gray-100 dark:bg-gray-800' : ''}`} onClick={() => { setCategoryFilter(''); setCategoriesOpen(false); }}>
                      All Categories
                    </button>
                    {categories.map(cat => (
                      <button key={cat} className={`text-left px-2 py-2 rounded ${categoryFilter === cat ? 'bg-gray-100 dark:bg-gray-800' : ''}`} onClick={() => { setCategoryFilter(categoryFilter === cat ? '' : cat); setCategoriesOpen(false); }}>
                        {cat}
                      </button>
                    ))}
                  </div>
                
                  {/* Top Stores (mobile offcanvas) */}
                  <div className="mt-4">
                    <h4 className="font-semibold mb-2">Top Stores</h4>
                    <div className="flex flex-col space-y-2">
                      {topStores.length === 0 ? (
                        <div className="text-sm text-gray-500">No stores available</div>
                      ) : (
                        topStores.slice(0,6).map(store => (
                          <button
                            key={store.id}
                            className="flex items-center gap-3 px-2 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                            onClick={() => { setCategoriesOpen(false); navigate(`/store/${store.id}`); }}
                          >
                            <div className="w-10 h-10 overflow-hidden rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                              {store.image ? (
                                <img src={store.image} alt={store.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                              ) : (
                                <div className="text-gray-600">{store.name.charAt(0)}</div>
                              )}
                            </div>
                            <div className="text-left">
                              <div className="text-sm font-medium">{store.name}</div>
                              <div className="text-xs text-gray-500">{store.count} products</div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </aside>
              </div>
            </div>

            <div className="mb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center justify-between space-x-2 w-full">
                    <button
                      className={`flex-1 flex items-center justify-center gap-2 text-sm lg:text-base px-3 py-1 rounded ${mainTab === 'all' ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}
                      onClick={() => { setMainTab('all'); setDigitalSubTab('all'); }}
                    ><Grid className="h-4 w-4" /> <span className="hidden sm:inline">All</span></button>
                    <button
                      className={`flex-1 flex items-center justify-center gap-2 text-sm lg:text-base px-3 py-1 rounded ${mainTab === 'physical' ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}
                      onClick={() => { setMainTab('physical'); setDigitalSubTab('all'); }}
                    ><Box className="h-4 w-4" /> <span className="hidden sm:inline">Physical</span></button>
                    <button
                      className={`flex-1 flex items-center justify-center gap-2 text-sm lg:text-base px-3 py-1 rounded ${mainTab === 'digital' ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}
                      onClick={() => { setMainTab('digital'); setDigitalSubTab('all'); }}
                    ><BookOpen className="h-4 w-4" /> <span className="hidden sm:inline">Digital</span></button>
                  </div>

                <div className="hidden lg:flex items-center">
                  <div className="text-sm text-gray-500 mr-4">Showing {filteredProducts.length} items</div>
                  <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      type="text"
                      placeholder="Search products..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                    />
                  </div>
                </div>
              </div>

              {/* digital sub-tabs: render under the main tabs to avoid overlap */}
              {mainTab === 'digital' && (
                <>
                  {/* Mobile: icon above label, compact */}
                  <div className="mt-3 flex items-center justify-between gap-2 lg:hidden w-full">
                    <button
                      onClick={() => setDigitalSubTab('all')}
                      className={`flex-1 flex flex-col items-center px-2 py-1 rounded ${digitalSubTab === 'all' ? 'bg-purple-500 text-white' : 'bg-purple-800/10 dark:bg-purple-900/20 text-white/80'}`}
                    >
                      <BookOpen className="h-6 w-6" />
                      <span className="text-[10px] mt-1">All</span>
                    </button>

                    <button
                      onClick={() => setDigitalSubTab('music')}
                      className={`flex-1 flex flex-col items-center px-2 py-1 rounded ${digitalSubTab === 'music' ? 'bg-indigo-500 text-white' : 'bg-indigo-800/10 dark:bg-indigo-900/20 text-white/80'}`}
                    >
                      <Music className="h-6 w-6" />
                      <span className="text-[10px] mt-1">Music</span>
                    </button>

                    <button
                      onClick={() => setDigitalSubTab('audiobook')}
                      className={`flex-1 flex flex-col items-center px-2 py-1 rounded ${digitalSubTab === 'audiobook' ? 'bg-emerald-500 text-white' : 'bg-emerald-800/10 dark:bg-emerald-900/20 text-white/80'}`}
                    >
                      <Headphones className="h-6 w-6" />
                      <span className="text-[10px] mt-1">Audiobooks</span>
                    </button>

                    <button
                      onClick={() => setDigitalSubTab('ebook')}
                      className={`flex-1 flex flex-col items-center px-2 py-1 rounded ${digitalSubTab === 'ebook' ? 'bg-pink-500 text-white' : 'bg-pink-800/10 dark:bg-pink-900/20 text-white/80'}`}
                    >
                      <BookOpen className="h-6 w-6" />
                      <span className="text-[10px] mt-1">eBooks</span>
                    </button>
                  </div>

                  {/* Desktop: inline with icons (existing) */}
                  <div className="mt-3 hidden lg:flex items-center justify-between gap-2 w-full">
                    <button
                      className={`flex-1 flex items-center justify-center px-2 py-1 rounded ${digitalSubTab === 'all' ? 'bg-purple-500 text-white' : 'bg-purple-800/10 dark:bg-purple-900/20 text-white/80'}`}
                      onClick={() => setDigitalSubTab('all')}
                    ><BookOpen className="h-4 w-4 mr-2" />All</button>

                    <button
                      className={`flex-1 flex items-center justify-center px-2 py-1 rounded ${digitalSubTab === 'music' ? 'bg-indigo-500 text-white' : 'bg-indigo-800/10 dark:bg-indigo-900/20 text-white/80'}`}
                      onClick={() => setDigitalSubTab('music')}
                    ><Music className="h-4 w-4 mr-2" />Music</button>

                    <button
                      className={`flex-1 flex items-center justify-center px-2 py-1 rounded ${digitalSubTab === 'audiobook' ? 'bg-emerald-500 text-white' : 'bg-emerald-800/10 dark:bg-emerald-900/20 text-white/80'}`}
                      onClick={() => setDigitalSubTab('audiobook')}
                    ><Headphones className="h-4 w-4 mr-2" />Audiobooks</button>

                    <button
                      className={`flex-1 flex items-center justify-center px-2 py-1 rounded ${digitalSubTab === 'ebook' ? 'bg-pink-500 text-white' : 'bg-pink-800/10 dark:bg-pink-900/20 text-white/80'}`}
                      onClick={() => setDigitalSubTab('ebook')}
                    ><BookOpen className="h-4 w-4 mr-2" />eBooks</button>
                  </div>
                </>
              )}
            </div>

            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  Square
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Discover and shop from amazing stores
                </p>
              </div>
              <div className="relative">
                  <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate('/checkout')}
                    className="flex flex-col items-center sm:flex-row sm:items-center gap-0 sm:gap-2 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-sm"
                  >
                    <CreditCard className="h-4 w-4 mt-1 mb-0 sm:mb-0 rounded text-purple-700" />
                    <span className="text-[11px] sm:text-sm">Checkout</span>
                  </button>

                  <button
                    className="relative p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                    onClick={() => setCartOpen((s) => !s)}
                    aria-label="View Cart"
                  >
                    <ShoppingCart className="h-7 w-7 text-purple-700" />
                    {cartCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                        {cartCount}
                      </span>
                    )}
                  </button>
                </div>

                {cartOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#161616] rounded-lg shadow-lg p-3 z-50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold">Cart</div>
                      <div className="text-xs text-gray-500">{cartCount} items</div>
                    </div>
                    <div className="max-h-56 overflow-y-auto">
                      {user ? (
                        cartLoading ? (
                          <div className="text-sm text-gray-500">Loading...</div>
                        ) : cartItems.length === 0 ? (
                          <div className="text-sm text-gray-500">No items in cart</div>
                        ) : (
                          cartItems.map((it: any) => {
                            const prod = it.store_products || null;
                            const priceInfo = prod ? getDisplayPrice(prod) : { displayPrice: 0 } as any;
                            return (
                              <div key={it.id} className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-800">
                                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 overflow-hidden rounded">
                                  {prod?.images?.[0] ? <img src={prod.images[0]} alt={prod?.title || 'Product image'} loading="lazy" decoding="async" className="w-full h-full object-cover" /> : <Package className="h-6 w-6 text-gray-400 m-2" />}
                                </div>
                                <div className="flex-1 text-sm">
                                  <div className="font-medium line-clamp-1">{prod?.title || 'Product'}</div>
                                  <div className="text-xs text-gray-500">Qty: {it.quantity}</div>
                                </div>
                                <div className="text-sm font-semibold">ZAR {priceInfo.displayPrice.toLocaleString()}</div>
                              </div>
                            );
                          })
                          )
                      ) : (
                        <div className="text-sm text-gray-500">Sign in to view cart</div>
                      )}
                    </div>
                    {/* subtotal and actions */}
                    <div className="mt-3 border-t border-gray-100 dark:border-gray-800 pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm text-gray-500">Subtotal</div>
                        <div className="font-semibold">ZAR {(() => {
                          const subtotal = (cartItems || []).reduce((s: number, it: any) => {
                            const prod = it.store_products || null;
                            const pi = prod ? getDisplayPrice(prod) : { displayPrice: 0 } as any;
                            return s + (pi.displayPrice * (it.quantity || 1));
                          }, 0);
                          return subtotal.toLocaleString();
                        })()}</div>
                      </div>
                      <div className="flex gap-2">
                        <button className="flex-1 px-3 py-2 rounded bg-gray-100 dark:bg-gray-800 text-sm flex items-center justify-center gap-2" onClick={() => { setCartOpen(false); navigate('/cart'); }}>
                          <ShoppingCart className="h-4 w-4" /> View Cart
                        </button>
                        <button className="flex-1 px-3 py-2 rounded bg-purple-600 text-white text-sm flex items-center justify-center gap-2" onClick={() => { setCartOpen(false); navigate('/checkout'); }}>
                          <CreditCard className="h-4 w-4" /> Checkout
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Feature Hub: seasonal hero + compact feature carousels (Featured Stores, Deals, On Sale) */}
            <section className="mb-6">
              {/* seasonal / promo hero */}
              {(() => {
                const month = new Date().getMonth(); // 0 = Jan, 10 = Nov
                const isBlackFridaySeason = month === 10; // November
                const isHolidaySeason = month === 11; // December
                if (isBlackFridaySeason) {
                  // Moved Black Friday hero to the Sales area below (before New Arrivals).
                  // Keep this spot empty during Black Friday so the promo appears in the Sales section instead.
                  return null;
                }

                if (isHolidaySeason) {
                  return (
                    <div className="bg-gradient-to-r from-purple-700 via-pink-600 to-yellow-400 text-white rounded-lg p-6 mb-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h2 className="text-2xl font-extrabold">Seasonal Savings — Gift More, Spend Less</h2>
                          <p className="mt-1 text-gray-100">Discover curated gift picks, limited time bundles, and store promos for the season.</p>
                        </div>
                        <div className="mt-4 sm:mt-0 flex gap-2">
                          <Button size="sm" className="bg-white text-black" onClick={() => navigate('/collections/holiday')}>Browse Gifts</Button>
                          <Button size="sm" variant="outline" onClick={() => navigate('/deals')}>Today's Deals</Button>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="bg-white dark:bg-[#161616] rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Featured Picks</h2>
                        <p className="text-gray-500 dark:text-gray-400">Handpicked highlights from stores you’ll love.</p>
                      </div>
                      <div className="hidden sm:flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => navigate('/featured')}>Explore Featured</Button>
                        <Button size="sm" className="bg-purple-600 text-white" onClick={() => navigate('/deals')}>Shop Deals</Button>
                      </div>
                    </div>
                  </div>
                );
              })()}

     
{/* World-Class Featured Products Carousel */}
{featuredStoresProducts && featuredStoresProducts.length > 0 && (
  <div className="mb-6">
    <div className="flex items-center justify-between mb-3">
      <div>
        <h3 className="text-2xl font-extrabold">Featured Products</h3>
        <div className="text-sm text-gray-500">One standout product from each store — handpicked for you</div>
      </div>
      <div className="hidden sm:flex items-center gap-3">
        <Button size="sm" className="bg-purple-600 text-white" onClick={() => navigate('/deals')}>Browse Deals</Button>
      </div>
    </div>

    <div className="relative group">
      {/* Navigation Arrows */}
      <button
        aria-label="Previous featured"
        onClick={() => scrollToFeatured(featuredIndex - 1)}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-white/90 dark:bg-gray-800/90 shadow-2xl hover:shadow-xl transition-all duration-300 opacity-0 group-hover:opacity-100 hover:scale-110 hover:bg-white border border-gray-200 dark:border-gray-700"
      >
        <ChevronLeft className="h-6 w-6 text-gray-700 dark:text-gray-200" />
      </button>

      <button
        aria-label="Next featured"
        onClick={() => scrollToFeatured(featuredIndex + 1)}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-white/90 dark:bg-gray-800/90 shadow-2xl hover:shadow-xl transition-all duration-300 opacity-0 group-hover:opacity-100 hover:scale-110 hover:bg-white border border-gray-200 dark:border-gray-700"
      >
        <ChevronRight className="h-6 w-6 text-gray-700 dark:text-gray-200" />
      </button>

      {/* Main Carousel Container */}
      <div className="relative h-[600px] sm:h-[700px] rounded-2xl overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-lg">
        {featuredStoresProducts.map((p, idx) => {
          const priceInfo = getDisplayPrice(p);
          const isActive = idx === featuredIndex;
          
          return (
            <div
              key={p.id}
              className={`absolute inset-0 transition-all duration-1000 ease-in-out ${
                isActive
                  ? 'opacity-100 translate-x-0 scale-100'
                  : 'opacity-0 translate-x-full scale-95 pointer-events-none'
              }`}
            >
              {/* Content Grid: On mobile show image first, details after. On lg+ keep two-column layout */}
              <div className="relative h-full grid grid-cols-1 lg:grid-cols-2 gap-8 p-6">
                {/* Product Image - mobile-first (order-first on mobile, last on lg+) */}
                <div className="flex items-center justify-center relative order-first lg:order-last">
                  {/* Image Container with Floating Animation */}
                  <div className={`relative w-full h-56 sm:h-96 lg:h-full transition-all duration-1000 delay-200 ${
                    isActive ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-110 rotate-6'
                  }`}>
                    {p.images?.[0] ? (
                      <div className="relative w-full h-full flex items-center justify-center">
                        {/* Subtle Glow Effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/20 dark:to-pink-900/20 rounded-3xl blur-2xl scale-105" />
                        
                        {/* Main Image */}
                        <img
                          src={p.images[0]}
                          alt={p.title}
                          loading="lazy"
                          decoding="async"
                          className="relative z-10 w-full h-full object-contain drop-shadow-2xl animate-float"
                          style={{
                            animation: 'float 6s ease-in-out infinite'
                          }}
                        />
                        
                        {/* Subtle Floating Elements */}
                        <div className="absolute -top-4 -right-4 w-24 h-24 bg-purple-100 dark:bg-purple-900/30 rounded-full blur-xl opacity-60" />
                        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-pink-100 dark:bg-pink-900/30 rounded-full blur-xl opacity-60" />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-300 dark:border-gray-700">
                        <Package className="w-32 h-32 text-gray-400" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Text Content - Left Side (on lg this appears left) */}
                <div className="flex flex-col justify-center space-y-6 z-20 order-last lg:order-first">
                  {/* Product Name with Animation */}
                  <div className={`space-y-2 transition-all duration-1000 delay-200 ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                    <h2 className="text-2xl sm:text-4xl md:text-6xl lg:text-7xl font-black leading-tight text-gray-900 dark:text-white">
                      {p.title}
                    </h2>
                  </div>

                  {/* Price with Animation */}
                  <div className={`transition-all duration-1000 delay-300 ${isActive ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-6 scale-95'}`}>
                    <div className="text-xl sm:text-3xl md:text-5xl font-black text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-4 sm:px-6 py-3 sm:py-4 rounded-2xl inline-block">
                      ZAR {priceInfo.displayPrice.toLocaleString()}
                    </div>
                    {p.originalPrice && p.originalPrice > priceInfo.displayPrice && (
                      <div className="text-sm sm:text-xl text-gray-500 line-through mt-3 ml-2">
                        ZAR {p.originalPrice.toLocaleString()}
                      </div>
                    )}
                  </div>

                  {/* Store Info with Animation */}
                  <div className={`transition-all duration-1000 delay-700 ${
                    isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                  }`}>
                    <div className="text-lg sm:text-xl text-gray-600 dark:text-gray-300">
                      <span className="font-semibold text-purple-600 dark:text-purple-400">Sold by:</span> {p.store?.store_name || 'Seller'}
                    </div>
                  </div>

                  {/* Action Buttons with Animation */}
                  <div className={`transition-all duration-1000 delay-400 ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                    {/* Full buttons on md+ */}
                    <div className="hidden md:flex flex-row gap-4">
                      <Button
                        size="lg"
                        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-4 px-8 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg text-lg flex items-center gap-3"
                        onClick={() => navigate(`/product/${p.id}`)}
                      >
                        <ShoppingCart className="w-6 h-6" />
                        Buy Now
                      </Button>

                      <Button
                        size="lg"
                        variant="outline"
                        className="border-2 border-purple-600 text-purple-600 hover:bg-purple-600 hover:text-white font-bold py-4 px-8 rounded-2xl transition-all duration-300 transform hover:scale-105 text-lg flex items-center gap-3 dark:border-purple-400 dark:text-purple-400 dark:hover:bg-purple-400 dark:hover:text-white"
                        onClick={() => {
                          const sid = p.store?.id || p.store_id;
                          if (sid) navigate(`/store/${sid}`);
                        }}
                      >
                        <Store className="w-6 h-6" />
                        Visit Store
                      </Button>
                    </div>

                    {/* Compact icon-only buttons for mobile */}
                    <div className="flex md:hidden items-center gap-3">
                      <Button
                        size="sm"
                        className="h-10 w-10 p-0 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white flex items-center justify-center"
                        onClick={() => navigate(`/product/${p.id}`)}
                        aria-label="Buy Now"
                      >
                        <ShoppingCart className="w-4 h-4" />
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        className="h-10 w-10 p-0 rounded-full border-2 border-purple-600 text-purple-600 flex items-center justify-center"
                        onClick={() => {
                          const sid = p.store?.id || p.store_id;
                          if (sid) navigate(`/store/${sid}`);
                        }}
                        aria-label="Visit Store"
                      >
                        <Store className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress Bar for Auto-transition */}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-12000 ease-linear"
                    style={{ width: '100%' }}
                    key={featuredIndex}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Navigation Dots */}
      <div className="flex justify-center mt-6 space-x-3">
        {featuredStoresProducts.map((_, idx) => (
          <button
            key={idx}
            onClick={() => scrollToFeatured(idx)}
            className={`w-3 h-3 rounded-full transition-all duration-500 border border-gray-300 dark:border-gray-600 ${
              idx === featuredIndex 
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 w-12 scale-125' 
                : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>

      {/* Auto-play Controls */}
      <div className="flex justify-center mt-4 space-x-4">
        <button
          onClick={toggleAutoPlay}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
        >
          {isAutoPlaying ? (
            <>
              <Pause className="w-4 h-4" />
              Pause
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Play
            </>
          )}
        </button>
        
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {featuredIndex + 1} / {featuredStoresProducts.length}
        </div>
      </div>
    </div>
  </div>
)}
            </section>

            {/* Digital Products Table View for Music and Audiobooks */}
            {(digitalSubTab === 'music' || digitalSubTab === 'audiobook') && (
              <section className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xl font-semibold flex items-center">
                    {digitalSubTab === 'music' ? <Music className="mr-2 h-5 w-5 text-indigo-500" /> : <Headphones className="mr-2 h-5 w-5 text-emerald-500" />}
                    {digitalSubTab === 'music' ? 'Music Tracks' : 'Audiobooks'}
                  </h2>
                  <div className="text-sm text-gray-500">
                    {digitalSubTab === 'music' ? `${digitalMusicProducts.length} tracks` : `${digitalAudiobookProducts.length} audiobooks`}
                  </div>
                </div>

                <Card className="dark:bg-[#161616] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">S/N</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">File Name / Product Name</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">File Type</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Preview (30s)</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Amount</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(digitalSubTab === 'music' ? digitalMusicProducts : digitalAudiobookProducts).map((product, index) => {
                          const priceInfo = getDisplayPrice(product);
                          return (
                            <tr key={product.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                              <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{index + 1}</td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-800/30 dark:to-pink-800/30 rounded flex items-center justify-center">
                                    {digitalSubTab === 'music' ? <Music className="h-5 w-5 text-purple-600" /> : <Headphones className="h-5 w-5 text-emerald-600" />}
                                  </div>
                                  <div>
                                    <div className="font-medium text-gray-900 dark:text-gray-100">{product.title}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">{product.store?.store_name || 'Unknown Store'}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                                <Badge variant="secondary">{getFileType(product)}</Badge>
                              </td>
                              <td className="py-3 px-4">
                                <AudioPlayer 
                                  audioUrl={getPreviewUrl(product)} 
                                  productTitle={product.title}
                                />
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex flex-col">
                                  <span className="font-semibold text-purple-600 dark:text-purple-400">
                                    ZAR {priceInfo.displayPrice.toLocaleString()}
                                  </span>
                                  {priceInfo.isOnSale && (
                                    <span className="text-xs text-gray-500 line-through">
                                      ZAR {priceInfo.originalPrice.toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedProduct(product);
                                    }}
                                  >
                                    <MessageSquare className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="bg-purple-600 hover:bg-purple-700"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAddToCart(product);
                                    }}
                                  >
                                    <ShoppingCart className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  
                  {(digitalSubTab === 'music' ? digitalMusicProducts.length === 0 : digitalAudiobookProducts.length === 0) && (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        {digitalSubTab === 'music' ? <Music className="h-12 w-12 text-gray-400" /> : <Headphones className="h-12 w-12 text-gray-400" />}
                        <p>No {digitalSubTab === 'music' ? 'music tracks' : 'audiobooks'} found</p>
                      </div>
                    </div>
                  )}
                </Card>
              </section>
            )}

            {/* Regular grid view for other digital products and when not in music/audiobook tabs */}
            {digitalSubTab !== 'music' && digitalSubTab !== 'audiobook' && (
              <>
                {/* Featured section */}
                

                {/* Deals of the Day */}
                {dealsOfTheDay && dealsOfTheDay.length > 0 && (
                  <section className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-xl font-semibold flex items-center"><Zap className="mr-2 h-5 w-5 text-red-500"/>Deals of the Day</h2>
                      <div className="text-sm text-gray-500">Limited-time highlights</div>
                    </div>

                    {/* Mobile carousel: 3 per view, auto-advance handled by useAutoAdvance */}
                    <div ref={dealsRef} style={{ WebkitOverflowScrolling: 'touch' }} className="lg:hidden mb-4 overflow-x-auto scroll-smooth snap-x snap-mandatory">
                      <div className="flex gap-3 px-2">
                        {dealsOfTheDay.map(p => {
                          const priceInfo = getDisplayPrice(p);
                          return (
                            <div
                              key={p.id}
                              className="snap-start flex-shrink-0 w-1/3 lg:w-[16.666%] bg-white dark:bg-[#161616] rounded-lg p-2 shadow-sm hover:shadow-md transition cursor-pointer"
                              onClick={() => navigate(`/product/${p.id}`)}
                            >
                              {/* smaller image height for compact look */}
                              <div className="w-full h-20 sm:h-24 lg:h-28 overflow-hidden rounded">
                                {p.images?.[0] ? (
                                  <img src={p.images[0]} alt={p.title} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Package />
                                  </div>
                                )}
                              </div>

                              <div className="mt-2">
                                <div className="text-sm font-semibold truncate" title={p.title}>{p.title}</div>

                                <div className="text-sm font-bold text-purple-600 mt-1">ZAR {priceInfo.displayPrice.toLocaleString()}</div>

                                <div className="text-xs text-gray-500 mt-1">{p.store?.store_name || 'Seller'}</div>

                                <div className="text-[11px] text-green-600 font-semibold mt-1">Today only</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Mobile controls: prettier pagination and View All (outside carousel so always visible) */}
                    <div className="lg:hidden flex items-center justify-between mt-3 px-2">
                      <div className="flex items-center gap-3">
                        <Button size="sm" variant="ghost" onClick={handleDealsPrev} className="p-2 rounded-full border border-gray-200 dark:border-gray-700">
                          <ChevronLeft className="h-4 w-4" />
                        </Button>

                        <div className="flex items-center gap-2">
                          {Array.from({ length: mobileDealsSlides }).map((_, i) => (
                            <button
                              key={i}
                              onClick={() => scrollDealsTo(i)}
                              aria-label={`Go to slide ${i + 1}`}
                              className={`w-2 h-2 rounded-full ${i === mobileDealsIndex ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                            />
                          ))}
                        </div>

                        <Button size="sm" variant="ghost" onClick={handleDealsNext} className="p-2 rounded-full bg-purple-600 text-white">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>

                      <Button size="sm" variant="outline" onClick={() => navigate('/deals')} className="flex items-center gap-2">
                        View All <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Desktop / tablet paginated grid */}
                    <div className="hidden md:block mb-6">
                      {(() => {
                        const total = dealsOfTheDay.length;
                        const pages = Math.max(1, Math.ceil(total / dealsPerPage));
                        const start = dealsPage * dealsPerPage;
                        const pageItems = dealsOfTheDay.slice(start, start + dealsPerPage);

                        return (
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                              {pageItems.map(p => {
                                const priceInfo = getDisplayPrice(p);
                                return (
                                  <div key={p.id} className="bg-white dark:bg-[#161616] rounded-lg p-4 shadow-sm hover:shadow-md transition cursor-pointer flex" onClick={() => navigate(`/product/${p.id}`)}>
                                    <div className="w-24 h-24 mr-4 overflow-hidden rounded">
                                      {p.images?.[0] ? <img src={p.images[0]} alt={p.title} loading="lazy" decoding="async" className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-24 bg-gray-100 dark:bg-gray-700"><Package /></div>}
                                    </div>
                                    <div className="flex-1">
                                      <div className="text-sm font-semibold truncate" title={p.title}>{p.title}</div>
                                      <div className="text-xs text-gray-500 mb-2">{p.store?.store_name || 'Seller'}</div>
                                      <div className="flex items-center justify-between">
                                        <div className="text-sm font-bold text-purple-600">
                                          ZAR {priceInfo.displayPrice.toLocaleString()}
                                          {priceInfo.isOnSale && (
                                            <span className="ml-1 text-red-600 text-xs font-semibold">-{getDiscountPercentage(priceInfo.originalPrice, priceInfo.displayPrice)}%</span>
                                          )}
                                        </div>
                                        <div className="text-xs text-green-600 font-semibold">Today only</div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="text-sm text-gray-500">Showing {Math.min(start + 1, total)} - {Math.min(start + dealsPerPage, total)} of {total}</div>
                              <div className="flex items-center gap-2">
                                <Button size="sm" variant="outline" onClick={() => setDealsPage(p => Math.max(0, p - 1))} disabled={dealsPage === 0}>Prev</Button>
                                <div className="text-sm text-gray-600">{dealsPage + 1} / {pages}</div>
                                <Button size="sm" variant="outline" onClick={() => setDealsPage(p => Math.min(pages - 1, p + 1))} disabled={dealsPage >= pages - 1}>Next</Button>
                                <Button size="sm" className="ml-2" onClick={() => navigate('/deals')}>View All</Button>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </section>
                )}

                {/* On Sale section */}
                {onSaleProducts && onSaleProducts.length > 0 && (
                  <section className="mb-6">
                    {/* Black Friday hero lives in Sales during November */}
                    {(() => {
                      const monthLocal = new Date().getMonth(); // 0 = Jan, 10 = Nov
                      const isBlackFridaySeasonLocal = monthLocal === 10;
                      if (!isBlackFridaySeasonLocal) return null;
                      return (
                        <div className="bg-gradient-to-r from-black via-purple-800 to-red-600 text-white rounded-lg p-6 mb-6">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <h2 className="text-2xl font-extrabold">Black Friday Blowout — Today Only</h2>
                              <p className="mt-1 text-gray-200">Massive deals across thousands of products.</p>
                            </div>
                            <div className="mt-4 sm:mt-0 flex gap-2">
                              <Button size="sm" className="bg-white text-black" onClick={() => navigate('/deals')}>Shop Deals</Button>
                              <Button size="sm" variant="outline" onClick={() => navigate('/sales')}>See Sales</Button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-xl font-semibold flex items-center"><Tag className="mr-2 h-5 w-5 text-pink-500"/>On Sale</h2>
                      <div className="text-sm text-gray-500">Discounted items</div>
                    </div>
                    {(() => {
                      const total = onSaleProducts.length;
                      const pages = Math.max(1, Math.ceil(total / onSalePerPage));
                      const start = onSalePage * onSalePerPage;
                      const pageItems = onSaleProducts.slice(start, start + onSalePerPage);

                      return (
                        <>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            {pageItems.map(p => {
                              const priceInfo = getDisplayPrice(p);
                              const discountPercentage = getDiscountPercentage(priceInfo.originalPrice, priceInfo.displayPrice);

                              return (
                                <div key={p.id} className="bg-white dark:bg-[#161616] rounded-lg p-3 shadow-sm hover:shadow-md transition cursor-pointer" onClick={() => navigate(`/product/${p.id}`)}>
                                  <div className="h-36 mb-2 overflow-hidden rounded relative">
                                    {p.images?.[0] ? <img src={p.images[0]} alt={p.title} loading="lazy" decoding="async" className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-36 bg-gray-100 dark:bg-gray-700"><Package /></div>}
                                    <div className="absolute top-2 right-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">-{discountPercentage}%</div>
                                  </div>
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="text-sm font-semibold line-clamp-2">{p.title}</div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="text-sm font-bold text-purple-600">ZAR {priceInfo.displayPrice.toLocaleString()}</div>
                                    {priceInfo.isOnSale && (
                                      <div className="text-xs text-gray-500 line-through">ZAR {priceInfo.originalPrice.toLocaleString()}</div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-500">Showing {Math.min(start + 1, total)} - {Math.min(start + onSalePerPage, total)} of {total}</div>
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="outline" onClick={() => setOnSalePage(p => Math.max(0, p - 1))} disabled={onSalePage === 0}>Prev</Button>
                              <div className="text-sm text-gray-600">{onSalePage + 1} / {pages}</div>
                              <Button size="sm" variant="outline" onClick={() => setOnSalePage(p => Math.min(pages - 1, p + 1))} disabled={onSalePage >= pages - 1}>Next</Button>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </section>
                )}

                {/* New Arrivals */}
                {newArrivals && newArrivals.length > 0 && (
                  <section className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-xl font-semibold flex items-center">
                        <Zap className="mr-2 h-5 w-5 text-red-500"/>New Arrivals
                      </h2>
                      <div className="text-sm text-gray-500">Recently added products</div>
                    </div>

                    {/* Responsive Auto-Sliding Carousel */}
                    <div
                      ref={newArrivalsRef}
                      style={{ WebkitOverflowScrolling: 'touch' }}
                      className="
                        overflow-x-auto 
                        scroll-smooth 
                        snap-x snap-mandatory 
                        flex 
                        gap-4 
                        pb-3
                      "
                    >
                      {newArrivals.map(product => {
                        const priceInfo = getDisplayPrice(product);
                        return (
                          <div
                            key={product.id}
                            className="
                              snap-start flex-shrink-0
                              bg-white dark:bg-[#161616] 
                              rounded-lg shadow-sm hover:shadow-md 
                              transition cursor-pointer

                              w-[90%]      /* 1 per view mobile */
                              sm:w-[45%]   /* 2 per view tablet */
                              lg:w-[23%]   /* 4 per view desktop */
                            "
                            onClick={() => navigate(`/product/${product.id}`)}
                          >
                            <div className="aspect-square bg-gray-200 dark:bg-gray-700 overflow-hidden rounded-t">
                              {product.images?.[0] ? (
                                <img
                                  src={product.images[0]}
                                  alt={product.title}
                                  loading="lazy"
                                  decoding="async"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Package className="h-16 w-16 text-gray-400" />
                                </div>
                              )}
                            </div>

                            <div className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-xs">{product.category || 'General'}</Badge>
                                  {product.store?.verification_status === 'verified' && (
                                    <Badge className="bg-green-600 text-xs">Verified</Badge>
                                  )}
                                </div>

                                <div className="text-right">
                                  <div className="text-lg font-bold text-purple-600">ZAR {priceInfo.displayPrice.toLocaleString()}</div>
                                  {priceInfo.isOnSale && (
                                    <div className="text-sm text-gray-500 line-through">ZAR {priceInfo.originalPrice.toLocaleString()}</div>
                                  )}
                                </div>
                              </div>

                              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-base line-clamp-2">{product.title}</h3>

                              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{product.description}</p>

                              <div className="mt-3 flex items-center justify-between">
                                <div />
                                <div className="flex items-center space-x-2">
                                  {user && user.id !== product.user_id && (
                                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setSelectedProduct(product); }}>
                                      <MessageSquare className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={(e) => { e.stopPropagation(); handleAddToCart(product); }}>
                                    <ShoppingCart className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Trending - Desktop section */}
                {trendingProducts && trendingProducts.length > 0 && (
                  <section className="mb-6 hidden lg:block">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-xl font-semibold flex items-center"><Tag className="mr-2 h-5 w-5 text-indigo-500"/>Trending</h2>
                      <div className="text-sm text-gray-500">Most viewed products</div>
                    </div>

                    {(() => {
                      const total = trendingProducts.length;
                      const pages = Math.max(1, Math.ceil(total / trendingPerPage));
                      const start = trendingPage * trendingPerPage;
                      const pageItems = trendingProducts.slice(start, start + trendingPerPage);

                      return (
                        <>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
                            {pageItems.map(p => {
                              const priceInfo = getDisplayPrice(p);
                              return (
                                <div key={p.id} className="bg-white dark:bg-[#161616] rounded-lg p-3 shadow-sm hover:shadow-md transition cursor-pointer" onClick={() => navigate(`/product/${p.id}`)}>
                                  <div className="h-28 mb-2 overflow-hidden rounded">
                                    {p.images?.[0] ? <img src={p.images[0]} alt={p.title} loading="lazy" decoding="async" className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-28 bg-gray-100 dark:bg-gray-700"><Package /></div>}
                                  </div>
                                  <div className="text-sm font-semibold line-clamp-2 mb-1">{p.title}</div>
                                  <div className="text-sm text-purple-600">
                                    ZAR {priceInfo.displayPrice.toLocaleString()}
                                    {priceInfo.isOnSale && (
                                      <span className="ml-1 text-red-600 text-xs font-semibold">-{getDiscountPercentage(priceInfo.originalPrice, priceInfo.displayPrice)}%</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-500">Showing {Math.min(start + 1, total)} - {Math.min(start + trendingPerPage, total)} of {total}</div>
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="outline" onClick={() => setTrendingPage(p => Math.max(0, p - 1))} disabled={trendingPage === 0}>Prev</Button>
                              <div className="text-sm text-gray-600">{trendingPage + 1} / {pages}</div>
                              <Button size="sm" variant="outline" onClick={() => setTrendingPage(p => Math.min(pages - 1, p + 1))} disabled={trendingPage >= pages - 1}>Next</Button>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </section>
                )}

                {/* Trending (mobile carousel, 2 per slide) */}
                {trendingProducts && trendingProducts.length > 0 && (
                  <div className="mt-4 lg:hidden">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold flex items-center"><Tag className="mr-2 h-4 w-4 text-indigo-500"/>Trending</h3>
                      <div className="text-sm text-gray-500">Trending based on views</div>
                    </div>
                    <div ref={trendingRef} style={{ WebkitOverflowScrolling: 'touch' }} className="overflow-x-auto scroll-smooth snap-x snap-mandatory">
                      {chunk(trendingProducts, 6).map((slide, si) => (
                        <div key={si} className="min-w-full snap-start px-2">
                          <div className="grid grid-cols-3 gap-3">
                            {slide.map(p => {
                              const priceInfo = getDisplayPrice(p);
                              return (
                                <div key={p.id} className="bg-white dark:bg-[#161616] rounded-lg p-2 shadow-sm hover:shadow-md transition cursor-pointer" onClick={() => navigate(`/product/${p.id}`)}>
                                  <div className="w-full h-20 overflow-hidden rounded">
                                    {p.images?.[0] ? (
                                      <img src={p.images[0]} alt={p.title} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <Package />
                                      </div>
                                    )}
                                  </div>

                                  <div className="mt-2">
                                    <div className="text-sm font-semibold truncate" title={p.title}>{p.title}</div>
                                    <div className="text-sm text-purple-600 font-bold mt-1">ZAR {priceInfo.displayPrice.toLocaleString()}</div>

                                    <div className="text-xs text-gray-500 mt-1">{p.store?.store_name || 'Seller'}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Mobile trending controls: outside carousel so always visible */}
                    <div className="lg:hidden flex items-center justify-between mt-3 px-2">
                      <div className="flex items-center gap-3">
                        <Button size="sm" variant="ghost" onClick={handleTrendingPrev} className="p-2 rounded-full border border-gray-200 dark:border-gray-700">
                          <ChevronLeft className="h-4 w-4" />
                        </Button>

                        <div className="flex items-center gap-2">
                          {Array.from({ length: mobileTrendingSlides }).map((_, i) => (
                            <button
                              key={i}
                              onClick={() => scrollTrendingTo(i)}
                              aria-label={`Go to trending slide ${i + 1}`}
                              className={`w-2 h-2 rounded-full ${i === mobileTrendingIndex ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                            />
                          ))}
                        </div>

                        <Button size="sm" variant="ghost" onClick={handleTrendingNext} className="p-2 rounded-full bg-indigo-600 text-white">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="text-sm text-gray-500">Trending</div>
                    </div>
                  </div>
                )}

                {filteredProducts.length === 0 && (
                  <Card className="dark:bg-[#161616] p-8 text-center">
                    <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      {searchTerm ? 'No products found' : 'No Products Available'}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      {searchTerm ? 'Try adjusting your search terms' : 'Be the first to add products to the marketplace'}
                    </p>
                  </Card>
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {selectedProduct && (
        <ChatModal
          product={selectedProduct as any}
          onClose={() => setSelectedProduct(null)}
        />
      )}
      <MobileBottomNav />
    </div>
  );
};

export default Square;