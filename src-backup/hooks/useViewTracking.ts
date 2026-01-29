import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ViewTrackingOptions {
  showId?: string;
  isPlaying?: boolean;
  onViewCountUpdate?: (count: number) => void;
}

export const useViewTracking = ({ showId, isPlaying = false, onViewCountUpdate }: ViewTrackingOptions) => {
  const [viewCount, setViewCount] = useState(0);
  const [hasViewed, setHasViewed] = useState(false);
  const viewStartTimeRef = useRef<number | null>(null);
  const totalViewTimeRef = useRef(0);
  const viewersRef = useRef(new Set<string>());

  // Generate a unique viewer ID for this session
  const viewerIdRef = useRef(`viewer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    if (!showId) return;

    // Reset tracking when show changes
    setHasViewed(false);
    totalViewTimeRef.current = 0;
    viewStartTimeRef.current = null;
    
    // Load existing view count from localStorage
    const savedData = localStorage.getItem(`views_${showId}`);
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        setViewCount(data.count || 0);
        viewersRef.current = new Set(data.viewers || []);
      } catch (error) {
        console.error('Error loading view data:', error);
        setViewCount(0);
      }
    } else {
      setViewCount(0);
      viewersRef.current = new Set();
    }
  }, [showId]);

  useEffect(() => {
    if (!showId || hasViewed) return;

    let interval: NodeJS.Timeout;

    if (isPlaying) {
      // Start tracking view time
      if (!viewStartTimeRef.current) {
        viewStartTimeRef.current = Date.now();
        console.log('Started tracking view time for show:', showId);
      }

      // Check every second if we've reached 15 seconds
      interval = setInterval(() => {
        if (viewStartTimeRef.current) {
          const currentTime = Date.now();
          const sessionViewTime = currentTime - viewStartTimeRef.current;
          const totalViewTime = totalViewTimeRef.current + sessionViewTime;

          console.log(`View time for ${showId}: ${Math.floor(totalViewTime / 1000)}s`);

          // If user has watched for 15+ seconds, count as a view
          if (totalViewTime >= 15000 && !hasViewed) {
            console.log('Counting view for show:', showId);
            setHasViewed(true);
            
              // Only count if this viewer hasn't been counted before
              if (!viewersRef.current.has(viewerIdRef.current)) {
                viewersRef.current.add(viewerIdRef.current);
                const newCount = viewCount + 1;
                setViewCount(newCount);
                
                // Save to localStorage
                const viewData = {
                  count: newCount,
                  viewers: Array.from(viewersRef.current),
                  lastUpdated: Date.now()
                };
                localStorage.setItem(`views_${showId}`, JSON.stringify(viewData));
                
                // Notify parent component
                onViewCountUpdate?.(newCount);

                // Persist to server (fire-and-forget). Prefer RPC for atomic increments,
                // fallback to read+update if RPC is not available.
                (async () => {
                  try {
                    // Try RPC first
                    if (supabase) {
                      const rpcName = 'increment_show_views';
                      // Best-effort: call RPC and ignore if it doesn't exist
                      try {
                        const { data: _rpcData, error: rpcError } = await supabase.rpc(rpcName, { show_id: showId });
                        if (rpcError) {
                          // If RPC doesn't exist or fails, fallback to safe update
                          throw rpcError;
                        }
                      } catch (rpcErr) {
                        // Fallback: read current value and update incrementally
                        try {
                          const { data: row, error: selErr } = await supabase
                            .from('studio_shows')
                            .select('views')
                            .eq('id', showId)
                            .single();
                          if (selErr) throw selErr;
                          const serverCount = (row && (row as any).views) || 0;
                          const { error: updErr } = await supabase
                            .from('studio_shows')
                            .update({ views: serverCount + 1 })
                            .eq('id', showId);
                          if (updErr) throw updErr;
                        } catch (fallbackErr) {
                          console.error('[useViewTracking] Failed to persist view (fallback):', fallbackErr);
                        }
                      }
                    }
                  } catch (err) {
                    console.error('[useViewTracking] Failed to persist view:', err);
                  }
                })();
              }
          }
        }
      }, 1000);
    } else {
      // Paused - accumulate the time watched so far
      if (viewStartTimeRef.current) {
        const sessionTime = Date.now() - viewStartTimeRef.current;
        totalViewTimeRef.current += sessionTime;
        viewStartTimeRef.current = null;
        console.log(`Paused. Total accumulated time: ${Math.floor(totalViewTimeRef.current / 1000)}s`);
      }
    }

    return () => {
      if (interval) clearInterval(interval);
      
      // Save accumulated time when component unmounts or pauses
      if (viewStartTimeRef.current) {
        const sessionTime = Date.now() - viewStartTimeRef.current;
        totalViewTimeRef.current += sessionTime;
        viewStartTimeRef.current = null;
      }
    };
  }, [showId, isPlaying, hasViewed, viewCount, onViewCountUpdate]);

  return {
    viewCount,
    hasViewed,
    totalViewTime: Math.floor(totalViewTimeRef.current / 1000)
  };
};
