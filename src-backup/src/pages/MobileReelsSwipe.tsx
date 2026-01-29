import React, { useRef, useState } from 'react';
import Studio from './Studio'; // For type only, not used directly

// ReelCard will be passed as a prop from Studio to avoid circular import
export default function MobileReelsSwipe({
  videos,
  handleLike,
  handleView,
  userLikes,
  handleSubscribe,
  userSubscriptions,
  subscriberCounts,
  userData,
  videoCreators,
  isDesktop,
  setUserSubscriptions,
  supabase,
  ReelCard
}: any) {
  const [current, setCurrent] = useState(0);
  const touchStartY = useRef<number | null>(null);
  const touchEndY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = () => {
    if (touchStartY.current === null || touchEndY.current === null) return;
    const deltaY = touchStartY.current - touchEndY.current;
    if (Math.abs(deltaY) > 50) {
      if (deltaY > 0 && current < videos.length - 1) {
        setCurrent(current + 1); // swipe up
      } else if (deltaY < 0 && current > 0) {
        setCurrent(current - 1); // swipe down
      }
    }
    touchStartY.current = null;
    touchEndY.current = null;
  };

  return (
    <div
      className="w-full h-full flex flex-col snap-y snap-mandatory overflow-y-auto"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: 'pan-y' }}
    >
      {videos.map((video: any, idx: number) => (
        <div
          key={video.id}
          className="w-full h-[100dvh] snap-start flex-shrink-0"
          style={{ display: idx === current ? 'block' : 'none' }}
        >
          <ReelCard
            video={video}
            onLike={handleLike}
            onView={handleView}
            userLikes={userLikes}
            onSubscribe={handleSubscribe}
            isSubscribed={userSubscriptions.has(video.channel_id)}
            subscriberCount={subscriberCounts[video.channel_id] || 0}
            mobile
            ownedSeries={userSubscriptions}
            userData={userData}
            creatorData={videoCreators[video.user_id]}
            isDesktop={isDesktop}
            onBuySeries={async (seriesTitle: string, authorId: string, price: number) => {
              if (!userData) {
                alert('You must be logged in to purchase a series.');
                return;
              }
              const confirmed = confirm(`Buy access to ${seriesTitle} for $${price}? This will be deducted from your wallet balance.`);
              if (!confirmed) return;
              try {
                // 1. Fetch user balance
                const { data: userDataRes, error: userError } = await supabase
                  .from('users')
                  .select('id, balance')
                  .eq('id', userData.id)
                  .single();
                if (userError || !userDataRes) throw new Error('Could not fetch your wallet balance.');
                if ((userDataRes.balance ?? 0) < price) {
                  alert('Insufficient wallet balance. Please top up your wallet.');
                  return;
                }
                // 2. Fetch author balance
                const { data: authorData, error: authorError } = await supabase
                  .from('users')
                  .select('id, balance')
                  .eq('id', authorId)
                  .single();
                if (authorError || !authorData) throw new Error('Could not fetch author wallet.');
                // 3. Debit user, credit author (atomic update)
                const { error: updateError } = await supabase.rpc('transfer_series_payment', {
                  buyer_id: userData.id,
                  author_id: authorId,
                  amount: price
                });
                if (updateError) throw new Error('Transaction failed. Please try again.');
                // 4. Record purchase
                const { error: purchaseError } = await supabase
                  .from('series_purchases')
                  .insert({
                    user_id: userData.id,
                    series_title: seriesTitle,
                    author_id: authorId,
                    amount: price,
                    purchased_at: new Date().toISOString()
                  });
                if (purchaseError) throw new Error('Could not record purchase.');
                // 5. Update ownedSeries state
                setUserSubscriptions((prev: Set<string>) => new Set(prev).add(seriesTitle));
                alert('Payment successful! You now own this series.');
              } catch (err: any) {
                alert(err.message || 'Purchase failed.');
              }
            }}
          />
        </div>
      ))}
      {/* All Squared Up message at end of feed */}
      {current === videos.length - 1 && (
        <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400">
          <button
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-600 text-white font-semibold hover:bg-purple-700 transition"
            onClick={() => setCurrent(0)}
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
