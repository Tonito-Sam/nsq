import { useEffect, useRef } from 'react';
import { StudioReelCard } from './StudioReelCard';
import type { StudioReelVideo } from '@/hooks/useStudioReels';

interface StudioFeedProps {
  videos: StudioReelVideo[];
  isDesktop: boolean;
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  userLikes: Set<string>;
  userSubscriptions: Set<string>;
  userData?: any;
  hideLive?: boolean;
  onLike: (videoId: string) => void;
  onView: (videoId: string) => void;
  onShare: (videoId: string) => void;
  onOpenComments?: () => void;
  onFollow?: () => void;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage?: () => void;
}

export function StudioFeed({
  videos,
  isDesktop,
  activeIndex,
  setActiveIndex,
  userLikes,
  userSubscriptions,
  userData,
  hideLive,
  onLike,
  onView,
  onShare,
  onOpenComments,
  onFollow,
  isFetchingNextPage,
  hasNextPage,
  fetchNextPage,
}: StudioFeedProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!videos.length) return;

    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visibleIndexes = entries
          .filter((entry) => entry.isIntersecting && entry.intersectionRatio > 0.55)
          .map((entry) => Number(entry.target.getAttribute('data-idx')));
        if (visibleIndexes.length > 0) {
          setActiveIndex(visibleIndexes[0]);
        }
      },
      {
        threshold: [0.55],
        root: isDesktop ? null : containerRef.current,
        rootMargin: isDesktop ? '0px' : '0px 0px -40% 0px',
      }
    );

    itemRefs.current.forEach((item) => {
      if (item) observerRef.current?.observe(item);
    });

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [videos, isDesktop, setActiveIndex]);

  useEffect(() => {
    if (!fetchNextPage || !hasNextPage || isDesktop) return;
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (container.scrollHeight - container.scrollTop - container.clientHeight < 400) {
        fetchNextPage();
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [fetchNextPage, hasNextPage, isDesktop]);

  if (videos.length === 0) {
    return <div className="w-full text-center text-gray-300 py-12">No videos available.</div>;
  }

  if (isDesktop) {
    return (
      <div className="flex flex-col items-center w-full gap-4 md:gap-6">
        {videos.map((video, idx) => (
          <div key={video.id} className="w-full max-w-4xl">
            <StudioReelCard
              video={video}
              isActive={idx === activeIndex}
              isLiked={userLikes.has(video.id)}
              isFollowing={userSubscriptions.has(video.channel_id || '')}
              onLike={onLike}
              onView={onView}
              onShare={onShare}
              onOpenComments={onOpenComments}
              onFollow={onFollow}
              userData={userData}
              hideLive={hideLive}
            />
          </div>
        ))}
        {isFetchingNextPage && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
          </div>
        )}
        {hasNextPage && !isFetchingNextPage && fetchNextPage ? (
          <div className="flex items-center justify-center py-4">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10 transition"
              onClick={fetchNextPage}
            >
              Load more
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-y-auto snap-y snap-mandatory bg-black"
      style={{ WebkitOverflowScrolling: 'touch' as any, touchAction: 'pan-y' as any, overscrollBehavior: 'contain' as any }}
    >
      {videos.map((video, idx) => (
        <div
          key={video.id}
          data-idx={idx}
          ref={(el) => {
            itemRefs.current[idx] = el;
          }}
          className="w-full h-[100dvh] snap-start flex-shrink-0"
        >
          <StudioReelCard
            video={video}
            isActive={idx === activeIndex}
            isLiked={userLikes.has(video.id)}
            isFollowing={userSubscriptions.has(video.channel_id || '')}
            mobile
            onLike={onLike}
            onView={onView}
            onShare={onShare}
            onOpenComments={onOpenComments}
            onFollow={onFollow}
            userData={userData}
            hideLive={hideLive}
          />
        </div>
      ))}
      {isFetchingNextPage && (
        <div className="w-full h-[100dvh] snap-start flex items-center justify-center bg-black text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
        </div>
      )}
      {!hasNextPage && (
        <div className="w-full h-[100dvh] snap-start flex flex-col items-center justify-center text-center px-6 text-white/80">
          <div className="text-lg font-semibold mb-3">You’re all caught up</div>
          <div className="max-w-sm text-sm text-gray-300">Browse the studio header filters or refresh to see the latest videos.</div>
        </div>
      )}
    </div>
  );
}
