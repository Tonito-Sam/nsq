import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/types/supabase';

type ProductReview = Database['public']['Tables']['product_reviews']['Row'];
type UserProfile = Database['public']['Tables']['users']['Row'];

type ReviewWithUser = ProductReview & {
  user?: Pick<UserProfile, 'id' | 'username' | 'first_name' | 'last_name' | 'avatar_url'>;
};

type ReviewSortOption = 'newest' | 'highest' | 'lowest';

const StarRating = ({
  rating,
  onRatingChange,
  interactive = false,
  size = 'md'
}: {
  rating: number;
  onRatingChange?: (rating: number) => void;
  interactive?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) => {
  const sizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl'
  };

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          type="button"
          key={i}
          className={`${i <= rating ? 'text-yellow-400' : 'text-gray-300'} ${sizes[size]}`}
          onClick={() => interactive && onRatingChange?.(i)}
          disabled={!interactive}
          aria-label={`${i} star${i > 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
    </div>
  );
};

export const ProductReviews: React.FC<{ productId: string }> = ({ productId }) => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<ReviewWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sortBy, setSortBy] = useState<ReviewSortOption>('newest');

  useEffect(() => {
    fetchReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, sortBy]);

  const fetchReviews = async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('product_reviews')
        .select(`*, user:users(id, username, first_name, last_name, avatar_url)`)
        .eq('product_id', productId);

      // Apply sorting
      switch (sortBy) {
        case 'newest':
          query = query.order('created_at', { ascending: false });
          break;
        case 'highest':
          query = query.order('rating', { ascending: false });
          break;
        case 'lowest':
          query = query.order('rating', { ascending: true });
          break;
      }

      const { data, error } = await query;
      if (error) throw error;
      setReviews(
        (data ?? []).map((r: any) => {
          if (typeof r.user === 'object' && r.user !== null && 'id' in r.user && 'username' in r.user) {
            return r;
          } else {
            // Remove invalid user join
            const { user, ...rest } = r;
            return rest;
          }
        }) as ReviewWithUser[]
      );
    } catch (err) {
      console.error('Error fetching reviews:', err);
      setError('Failed to load reviews. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || rating === 0 || comment.length < 10) return;

    setSubmitting(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('product_reviews')
        .insert([
          {
            product_id: productId,
            user_id: user.id,
            rating,
            comment,
          }
        ]);

      if (error) throw error;

      setRating(0);
      setComment('');
      await fetchReviews();
    } catch (err) {
      console.error('Error submitting review:', err);
      setError('Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-8">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Product Reviews</h2>
      
      {error && (
        <div className="text-red-500 text-sm mb-4">{error}</div>
      )}

      {loading ? (
        <div className="text-gray-500">Loading reviews...</div>
      ) : (
        <div className="space-y-4">
          {reviews.length > 1 && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-gray-500">Sort by:</span>
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as ReviewSortOption)}
                className="text-sm border rounded p-1 dark:bg-[#18181b] dark:border-gray-700"
              >
                <option value="newest">Newest</option>
                <option value="highest">Highest Rating</option>
                <option value="lowest">Lowest Rating</option>
              </select>
            </div>
          )}

          {reviews.length === 0 && <div className="text-gray-500">No reviews yet.</div>}
          
          {reviews.map((review) => (
            <Card key={review.id} className="p-4 dark:bg-[#18181b]">
              <div className="flex items-center gap-3 mb-2">
                {review.user?.avatar_url ? (
                  <img
                    src={review.user.avatar_url}
                    alt="avatar"
                    className="w-8 h-8 rounded-full"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-300" />
                )}
                <div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                    {review.user?.first_name || ''} {review.user?.last_name || review.user?.username || 'User'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {review.created_at ? new Date(review.created_at).toLocaleDateString() : ''}
                  </div>
                </div>
                <div className="ml-auto">
                  <StarRating rating={review.rating} size="sm" />
                </div>
              </div>
              <div className="text-gray-700 dark:text-gray-300 text-sm">
                {review.comment}
              </div>
            </Card>
          ))}
        </div>
      )}

      {user && (
        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <div className="flex items-center gap-2">
            <span className="font-medium">Your Rating:</span>
            <StarRating 
              rating={rating} 
              onRatingChange={setRating} 
              interactive 
            />
          </div>
          <textarea
            className="w-full border rounded p-2 min-h-[60px] dark:bg-[#18181b] dark:border-gray-700"
            placeholder="Write your review (minimum 10 characters)..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            required
            minLength={10}
          />
          <Button
            type="submit"
            className="bg-purple-600 hover:bg-purple-700"
            disabled={submitting || rating === 0 || comment.length < 10}
          >
            {submitting ? 'Submitting...' : 'Submit Review'}
          </Button>
        </form>
      )}
    </div>
  );
};