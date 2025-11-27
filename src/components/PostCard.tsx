import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { PostHeader } from './PostHeader';
import { PostContent } from './PostContent';
import { PostEngagement } from './PostEngagement';
import { CommentForm } from './CommentForm';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { ShareModal } from './ShareModal';
import { PollCard } from './PollCard';
import { EditPostModal } from './EditPostModal';
import { EventCard } from './EventCard';

interface PostCardProps {
  post: {
    id: string;
    created_at: string;
    user_id: string;
    content?: string;
    image_url?: string;
    video_url?: string;
    post_type: string;
    voice_note_url?: string;
    voice_duration?: number;
    likes_count?: number;
    comments_count?: number;
    reposts_count?: number;
    poll_options?: string[];
    event_date?: string;
    event_location?: string;
    user_has_liked?: boolean;
    user_has_bookmarked?: boolean;
    user?: {
      first_name?: string;
      last_name?: string;
      username?: string;
      avatar_url?: string;
      verified?: boolean;
      heading?: string;
      bio?: string;
    };
    original_post?: {
      id: string;
      content: string;
      media_url?: string;
      user?: {
        first_name?: string;
        last_name?: string;
        username?: string;
        avatar_url?: string;
      };
    };
    media_urls?: string[];
    location?: string;
    feeling?: string;
    event_banner?: string;
    event_description?: string;
    // Moment-related fields (shared from Moments)
    moment_bg?: string | null;
    moment_font?: string | null;
    moment_font_size?: number | null;
    moment_type?: string | null;
    moment_special_message?: string | null;
    moment_special_icon?: string | null;
    moment_special_name?: string | null;
    is_custom_special_day?: boolean | null;
    moment_special_id?: string | null;
  };
  currentUser: any;
  reactionCounts?: { [key: string]: number };
  userReaction?: string | null;
  onReact?: (reactionType: string) => void;
  onLike?: (postId: string, reactionType: string) => void | Promise<void>;
  onComment?: (postId: string) => void;
  onRepost?: (postId: string) => void;
  onDeletePost?: (postId: string) => void;
  onHidePost?: (postId: string) => void;
  onShare?: (postId: string) => void;
  showComments?: boolean;
}

export const PostCard: React.FC<PostCardProps> = ({ post, currentUser, reactionCounts = {}, userReaction = null, onReact, onLike, onComment, onRepost, onDeletePost, onHidePost, onShare, showComments }) => {
  const [showShareModal, setShowShareModal] = useState(false);
  const [pollOptions, setPollOptions] = useState<any[]>([]);
  const [pollVotes, setPollVotes] = useState<any[]>([]);
  const [userVote, setUserVote] = useState<string | null>(null);
  const [poll, setPoll] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [postState, setPostState] = useState(post);
  const viewRef = useRef<HTMLDivElement>(null);
  
  // Use actual user data from the post
  const user = {
    id: post.user_id,
    name: `${post.user?.first_name || ''} ${post.user?.last_name || ''}`.trim() || 'Anonymous User',
    username: post.user?.username || 'user',
    avatar: post.user?.avatar_url || '/placeholder.svg',
    verified: post.user?.verified || false,
    heading: post.user?.heading || '',
    bio: post.user?.bio || ''
  };

  // Fetch poll data if this is a poll
  useEffect(() => {
    const fetchPollData = async () => {
      if (post.post_type !== 'poll') return;
      // Fetch poll record
      const { data: pollData } = await supabase
        .from('polls')
        .select('*')
        .eq('post_id', post.id)
        .single();
      setPoll(pollData);
      if (pollData) {
        // Fetch poll options
        const { data: options } = await supabase
          .from('poll_options')
          .select('*')
          .eq('poll_id', pollData.id);
        console.log('Fetched poll options:', options);
        setPollOptions(options || []);
        // Fetch poll votes
        const { data: votes } = await supabase
          .from('poll_votes')
          .select('*')
          .eq('poll_id', pollData.id);
        setPollVotes(votes || []);
        // Check if current user has voted
        const userVoted = votes?.find((v: any) => v.user_id === currentUser?.id);
        setUserVote(userVoted?.option_id || null);
      }
    };
    fetchPollData();
  }, [post.id, post.post_type, currentUser?.id]);

  // Handle voting
  const handlePollVote = async (optionId: string) => {
    if (!currentUser?.id || !poll) return;
    // Prevent double voting
    if (userVote) return;
    await supabase.from('poll_votes').insert({
      poll_id: poll.id,
      option_id: optionId,
      user_id: currentUser.id,
    });
    setUserVote(optionId);
    // Refetch poll votes
    const { data: votes } = await supabase
      .from('poll_votes')
      .select('*')
      .eq('poll_id', poll.id);
    setPollVotes(votes || []);
  };

  const handleLike = () => {
    if (onLike) {
      onLike(post.id, userReaction || 'like');
    }
  };

  const handleComment = () => {
    if (onComment) {
      onComment(post.id);
      // Remove setShowComments, as showComments is now a prop
    }
  };

  const handleRepost = () => {
    if (onRepost) {
      onRepost(post.id);
    }
  };

  // Copy post URL
  const handleCopyPostUrl = async () => {
    const url = `${window.location.origin}/post/${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Copied!', description: 'Post URL copied to clipboard.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to copy post URL.' });
    }
  };

  // Delete post
  const handleDeletePost = async () => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    if (typeof onDeletePost === 'function') {
      await onDeletePost(post.id);
    } else {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', post.id);
      if (error) {
        toast({ title: 'Error', description: 'Failed to delete post.' });
      } else {
        toast({ title: 'Deleted', description: 'Post deleted successfully.' });
      }
    }
  };

  // Save post
  const handleSavePost = async () => {
    if (!currentUser?.id) return;
    const { error } = await supabase
      .from('saved_posts')
      .upsert({
        user_id: currentUser.id,
        post_id: post.id
      }, { onConflict: 'user_id,post_id' });
    if (error) {
      toast({ title: 'Error', description: 'Failed to save post.' });
    } else {
      toast({ title: 'Saved', description: 'Post saved to your collection.' });
    }
  };

  // Hide post
  const handleHidePost = async () => {
    if (!currentUser?.id) return;
    if (typeof onHidePost === 'function') {
      await onHidePost(post.id);
    } else {
      const { error } = await supabase
        .from('hidden_posts')
        .upsert({
          user_id: currentUser.id,
          post_id: post.id
        }, { onConflict: 'user_id,post_id' });
      if (error) {
        toast({ title: 'Error', description: 'Failed to hide post.' });
      } else {
        toast({ title: 'Hidden', description: 'Post hidden from your feed.' });
      }
    }
  };

  // Edit post handler
  const handleEditPost = () => {
    setShowEditModal(true);
  };
  const handlePostUpdated = (updated: any) => {
    setPostState(updated);
  };

  useEffect(() => {
    if (!currentUser?.id) return;
    let timer: NodeJS.Timeout | null = null;
    const handleVisibility = () => {
      if (!viewRef.current) return;
      const rect = viewRef.current.getBoundingClientRect();
      const inView = rect.top >= 0 && rect.bottom <= (window.innerHeight || document.documentElement.clientHeight);
      if (inView && !timer) {
        timer = setTimeout(async () => {
          // Record view via server endpoint to avoid client RLS/permission errors
          try {
            await fetch('/api/post-views', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ post_id: post.id, user_id: currentUser.id })
            });
          } catch (err) {
            // Log but don't break the feed
            console.error('failed to report post view', err);
          }
        }, 30000);
      } else if (!inView && timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
    window.addEventListener('scroll', handleVisibility);
    window.addEventListener('resize', handleVisibility);
    handleVisibility();
    return () => {
      window.removeEventListener('scroll', handleVisibility);
      window.removeEventListener('resize', handleVisibility);
      if (timer) clearTimeout(timer);
    };
  }, [post.id, currentUser?.id]);

  // Post options menu

  return (
    <div ref={viewRef}>
      <Card className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-gray-700 mb-4">
        <div className="p-4 space-y-4">
          <PostHeader 
            author={user}
            timestamp={postState.created_at}
            userId={postState.user_id}
            currentUserId={currentUser?.id}
            isFollowing={false}
            showFollowButton={currentUser?.id !== postState.user_id}
            onFollowUpdate={() => {}}
            onCopyPostUrl={handleCopyPostUrl}
            onDeletePost={handleDeletePost}
            onSavePost={handleSavePost}
            onHidePost={handleHidePost}
            onEditPost={handleEditPost}
          />
          {/* Repost logic */}
          {post.post_type === 'repost' && post.original_post ? (
            <div className="my-4">
              {/* Repost comment/message */}
              {post.content && (
                <div className="mb-2 text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                  {post.content}
                </div>
              )}
              {/* Original post nested card */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-[#23232b]">
                <div className="flex items-center space-x-3 mb-2">
                  <img
                    src={post.original_post.user?.avatar_url || '/placeholder.svg'}
                    alt="Avatar"
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-medium text-sm">
                      {`${post.original_post.user?.first_name || ''} ${post.original_post.user?.last_name || ''}`.trim() || 'Anonymous'}
                    </p>
                    <p className="text-gray-500 text-xs">@{post.original_post.user?.username || 'user'}</p>
                  </div>
                </div>
                <div className="text-gray-900 dark:text-gray-100 mb-2 whitespace-pre-wrap">
                  {post.original_post.content}
                </div>
                {post.original_post.media_url && (
                  <img
                    src={post.original_post.media_url}
                    alt="Post media"
                    className="mt-2 rounded-lg max-w-full h-auto object-contain"
                  />
                )}
              </div>
            </div>
          ) : post.post_type === 'poll' && poll ? (
            <div className="my-4">
              <PollCard
                id={poll.id}
                question={poll.question || ''}
                options={pollOptions.map(opt => ({
                  id: opt.id,
                  text: opt.option_text,
                  votes: pollVotes.filter((v: any) => v.option_id === opt.id).length,
                  media_url: opt.media_url || null,
                }))}
                totalVotes={pollVotes.length}
                expiresAt={poll.expires_at || new Date(Date.now() + 7*24*60*60*1000).toISOString()}
                hasVoted={!!userVote}
                userVote={userVote || undefined}
                onVote={handlePollVote}
              />
            </div>
          ) : post.post_type === 'event' ? (
            <EventCard
              postId={post.id}
              title={post.content || ''}
              eventDate={post.event_date || ''}
              eventLocation={post.event_location || ''}
              bannerUrl={post.event_banner || ''}
              description={post.event_description || ''}
            />
          ) : (
            <PostContent
              content={post.content || ''}
              media_url={post.image_url || post.video_url}
              media_urls={post.media_urls}
              postType={post.post_type}
              voiceNoteUrl={post.voice_note_url || ''}
              voiceDuration={post.voice_duration || 0}
                backgroundAudioUrl={(post as any).background_audio_url || ''}
                backgroundAudioMeta={(post as any).background_audio_meta || null}
                audioMixMeta={(post as any).audio_mix_meta || null}
                originalVoiceUsername={post.user?.username || post.user?.first_name || ''}
              eventDate={post.event_date || ''}
              eventLocation={post.event_location || ''}
              location={post.location || ''}
              feeling={post.feeling || ''}
                // Pass moment fields so PostContent can render postcard style moments in-feed
                momentBg={post.moment_bg}
                momentFont={post.moment_font}
                momentFontSize={post.moment_font_size}
                momentType={post.moment_type}
                momentSpecialMessage={post.moment_special_message}
                momentSpecialIcon={post.moment_special_icon}
                momentSpecialName={post.moment_special_name}
                isCustomSpecialDay={post.is_custom_special_day}
                momentSpecialId={post.moment_special_id}
            />
          )}
          {/* PostEngagement with share modal handler */}
          <PostEngagement 
            selectedReaction={userReaction}
            reactionCounts={reactionCounts}
            currentLikes={Object.values(reactionCounts).reduce((a, b) => a + b, 0)}
            currentComments={post.comments_count || 0}
            currentReposts={post.reposts_count || 0}
            shares={0}
            reposted={false}
              postId={post.id}
              showReactions={false}
            onToggleReactions={() => {}}
            onReaction={onReact ? (type) => onReact(type) : handleLike}
            onToggleComments={handleComment}
            onRepost={handleRepost}
            onShare={() => {
              setShowShareModal(true);
              if (onShare) onShare(post.id);
            }}
          />
          {showComments && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
              <CommentForm postId={post.id} onCommentAdded={() => {}} />
            </div>
          )}
          <ShareModal postId={post.id} postContent={post.content || ''} authorName={user.name} onClose={() => setShowShareModal(false)} open={showShareModal} />
          {showEditModal && (
            <EditPostModal
              open={showEditModal}
              onClose={() => setShowEditModal(false)}
              post={postState}
              onPostUpdated={handlePostUpdated}
            />
          )}
        </div>
      </Card>
    </div>
  );
};
