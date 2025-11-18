import { useState, useRef, useEffect } from 'react';
import { ReelCard } from './ReelCard';

type VideoType = any; // Replace 'any' with your actual video type if available
export type MobileReelScrollerProps = {
  videos: VideoType[];
  userLikes: Set<string>;
  userSubscriptions: Set<string>;
  handleLike: (videoId: string) => void;
  handleView: (videoId: string) => void;
  handleShare: (videoId: string) => void;
  handleFollow: (channelId: string) => void;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage?: () => void;
  // When true, hide live controls in each ReelCard
  hideLive?: boolean;
  // Logged-in user data to forward to ReelCard (so comments/posting can identify user)
  userData?: any;
};

export function MobileReelScroller({
  videos,
  userLikes,
  userSubscriptions,
  handleLike,
  handleView,
  handleShare,
  handleFollow,
  isFetchingNextPage,
  hasNextPage,
  fetchNextPage,
  hideLive,
  userData
}: MobileReelScrollerProps) {
  // Infinite scroll: load more when near end
  useEffect(() => {
    if (!fetchNextPage || !hasNextPage || isFetchingNextPage) return;
    const onScroll = () => {
      const container = containerRef.current;
      if (!container) return;
      // When user nears the bottom (400px), trigger fetchNextPage to pre-load content
      if (container.scrollHeight - container.scrollTop - container.clientHeight < 400) {
        fetchNextPage();
      }
    };
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', onScroll);
    }
    return () => {
      if (container) container.removeEventListener('scroll', onScroll);
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    if (!videos.length) return;
    // IntersectionObserver to detect which video is in view
    const observer = new window.IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter(e => e.isIntersecting && e.intersectionRatio > 0.5)
          .map(e => Number(e.target.getAttribute('data-idx')));
        if (visible.length > 0) {
          setActiveIdx(visible[0]);
        }
      },
      { threshold: 0.6 }
    );
    itemRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });
    return () => {
      itemRefs.current.forEach((ref) => {
        if (ref) observer.unobserve(ref);
      });
      observer.disconnect();
    };
  }, [videos]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col snap-y snap-mandatory overflow-y-auto"
      style={{ WebkitOverflowScrolling: 'touch' as any, touchAction: 'pan-y' as any, overscrollBehavior: 'contain' as any }}
    >
      {videos.map((video: VideoType, idx: number) => (
        <div
          key={video.id}
          data-idx={idx}
          ref={(el: HTMLDivElement | null) => { itemRefs.current[idx] = el; }}
          className="w-full h-[100dvh] snap-start flex-shrink-0"
        >
          <ReelCard
            video={video}
            onLike={handleLike}
            onView={handleView}
            onShare={handleShare}
            onFollow={handleFollow}
            isLiked={userLikes.has(video.id)}
            isFollowing={userSubscriptions.has(video.channel_id)}
            isActive={idx === activeIdx}
            hideLive={!!hideLive}
            userData={userData}
          />
        </div>
      ))}
      {/* Loading indicator for mobile infinite scroll */}
      {isFetchingNextPage && (
        <div className="w-full h-[100dvh] snap-start flex-shrink-0 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      )}
      {/* All Squared Up message at end of feed */}
      {!hasNextPage && (
        <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400">
          <button
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-600 text-white font-semibold hover:bg-purple-700 transition"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            <span className="font-bold text-lg">You're all squared up!</span>
          </button>
        </div>
      )}
    </div>
  );
}
