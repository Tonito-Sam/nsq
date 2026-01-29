import { useState, useEffect } from 'react';
import type { FC, FormEvent } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Star, User, Calendar } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface Review {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  comment: string;
  created_at: string;
  updated_at: string;
  user?: {
    id?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    username?: string;
    avatar_url?: string;
    user_metadata?: {
      full_name?: string;
      avatar_url?: string;
    };
  };
}

interface ProductReviewsProps {
  productId: string;
}

export const ProductReviews: FC<ProductReviewsProps> = ({ productId }) => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [hoverRating, setHoverRating] = useState(0);

  useEffect(() => {
    fetchReviews();
  }, [productId]);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      // Try the joined select first (works when FK relationship exists in PostgREST schema cache)
      const { data, error } = await supabase
        .from('product_reviews')
        .select(`*, user:users(email, user_metadata)`)
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

      if (!error) {
        setReviews(data || []);
        return;
      }

      // If the join failed because there's no FK relationship in the schema cache, fall back
      // to fetching reviews and users separately (some DBs don't expose FK metadata to PostgREST).
      const isRelError = error && (error.code === 'PGRST200' || String(error.message).includes('Could not find a relationship'));
      if (!isRelError) throw error;

      // Fallback path: fetch reviews, then fetch their users by id and merge
      const { data: reviewsData, error: revErr } = await supabase
        .from('product_reviews')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });
      if (revErr) throw revErr;

      const revs = reviewsData || [];
      const userIds = Array.from(new Set(revs.map((r: any) => r.user_id).filter(Boolean)));
      let usersMap: Record<string, any> = {};
      if (userIds.length > 0) {
        let usersData: any = null;
        let usersErr: any = null;
        if (userIds.length === 1) {
          const res = await supabase
            .from('users')
            .select('id, email, user_metadata, first_name, last_name, username, avatar_url')
            .eq('id', userIds[0])
            .maybeSingle();
          usersData = res.data ? [res.data] : [];
          usersErr = res.error;
        } else {
          const res = await supabase
            .from('users')
            .select('id, email, user_metadata, first_name, last_name, username, avatar_url')
            .in('id', userIds as unknown as string[]);
          usersData = res.data;
          usersErr = res.error;
        }

        if (!usersErr && usersData) {
          usersMap = (usersData || []).reduce((acc: any, u: any) => { acc[u.id] = u; return acc; }, {});
        } else if (usersErr) {
          console.error('[ProductReviews] users fetch error', usersErr);
        }
      }

      setReviews((revs || []).map((r: any) => ({ ...r, user: usersMap[r.user_id] })));
    } catch (err) {
      console.error('Error in fetchReviews:', err);
      toast({
        title: 'Error',
        description: 'Failed to load reviews',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: 'Sign In Required',
        description: 'Please sign in to submit a review.',
        variant: 'destructive',
      });
      return;
    }

    if (rating === 0) {
      toast({
        title: 'Rating Required',
        description: 'Please select a rating before submitting.',
        variant: 'destructive',
      });
      return;
    }

    if (!comment.trim()) {
      toast({
        title: 'Comment Required',
        description: 'Please write a comment before submitting.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      // Check if user already reviewed this product
      const { data: existingReview, error: checkError } = await supabase
        .from('product_reviews')
        .select('id')
        .eq('product_id', productId)
        .eq('user_id', user.id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingReview) {
        // Update existing review
        const { error: updateError } = await supabase
          .from('product_reviews')
          .update({
            rating,
            comment: comment.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingReview.id);

        if (updateError) throw updateError;
        
        toast({
          title: 'Review Updated',
          description: 'Your review has been updated successfully.',
        });
      } else {
        // Create new review
        const { error: insertError } = await supabase
          .from('product_reviews')
          .insert({
            product_id: productId,
            user_id: user.id,
            rating,
            comment: comment.trim(),
          });

        if (insertError) throw insertError;
        
        toast({
          title: 'Review Submitted',
          description: 'Thank you for your review!',
        });
      }

      // Reset form and refresh reviews
      setRating(0);
      setComment('');
      setHoverRating(0);
      await fetchReviews();
      
    } catch (error: any) {
      console.error('Error submitting review:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit review. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getUserDisplayName = (review: Review) => {
    const u = review.user as any;
    if (!u) return 'Anonymous User';
    if (u.user_metadata?.full_name) return u.user_metadata.full_name;
    if (u.first_name || u.last_name) return `${u.first_name || ''} ${u.last_name || ''}`.trim();
    if (u.username) return u.username;
    if (u.email) return String(u.email).split('@')[0];
    return 'Anonymous User';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const averageRating = reviews.length > 0 
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
    : 0;

  return (
    <div className="space-y-6">
      {/* Reviews Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Customer Reviews
        </h3>
        {reviews.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-5 w-5 ${
                    star <= Math.round(averageRating)
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-gray-300'
                  }`}
                />
              ))}
            </div>
            <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {averageRating.toFixed(1)} ({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})
            </span>
          </div>
        )}
      </div>

      {/* Review Form */}
      {user && (
        <Card className="p-6 dark:bg-[#1a1a1a]">
          <h4 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Write a Review
          </h4>
          <form onSubmit={handleSubmitReview} className="space-y-4">
            {/* Star Rating */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Your Rating *
              </label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star
                      className={`h-8 w-8 ${
                        star <= (hoverRating || rating)
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Comment */}
            <div>
              <label htmlFor="comment" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Your Review *
              </label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your experience with this product..."
                rows={4}
                className="resize-none"
                required
              />
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={submitting || rating === 0 || !comment.trim()}
              className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Review'}
            </Button>
          </form>
        </Card>
      )}

      {/* Reviews List */}
      {loading ? (
        <div className="text-center py-8">
          <div className="text-gray-600 dark:text-gray-400">Loading reviews...</div>
        </div>
      ) : reviews.length === 0 ? (
        <Card className="p-8 text-center dark:bg-[#1a1a1a]">
          <Star className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h4 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
            No Reviews Yet
          </h4>
          <p className="text-gray-600 dark:text-gray-400">
            {user ? 'Be the first to review this product!' : 'Sign in to be the first to review this product!'}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <Card key={review.id} className="p-6 dark:bg-[#1a1a1a]">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-full overflow-hidden flex items-center justify-center">
                    {review.user?.avatar_url || review.user?.user_metadata?.avatar_url ? (
                      <img
                        src={review.user.avatar_url || review.user.user_metadata?.avatar_url}
                        alt={getUserDisplayName(review)}
                        className="w-10 h-10 object-cover"
                      />
                    ) : (
                      <div className="p-2">
                        <User className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h5 className="font-semibold text-gray-900 dark:text-gray-100">
                      {getUserDisplayName(review)}
                    </h5>
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <Calendar className="h-3 w-3" />
                      {formatDate(review.created_at)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-4 w-4 ${
                        star <= review.rating
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                {review.comment}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};