import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Heart, MessageCircle, Send, Share2 } from 'lucide-react';
import { getPodcastLowerThirdStage } from '@/utils/podcastIntroMontage';
import { Header } from '@/components/Header';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

type EpisodeComment = {
  id: number;
  user_id: string;
  comment: string;
  created_at: string;
  authorName: string;
  authorAvatar: string | null;
};

interface PodcastEpisodeEngagementProps {
  episodeId: string;
  showId: string;
  episodeTitle: string;
  shareCount: number;
  onShareEpisode: () => void;
  podcastName: string;
  topic: string;
  hostNames: string;
  channelLogoUrl: string | null;
  videoUrl: string;
  thumbnailUrl: string | null;
  initialLikes: number;
  open: boolean;
  autoPlayVideo: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscussionOpen: () => void;
  onEpisodePlay: () => void;
}

export function PodcastEpisodeEngagement({
  episodeId,
  showId,
  episodeTitle,
  shareCount,
  onShareEpisode,
  podcastName,
  topic,
  hostNames,
  channelLogoUrl,
  videoUrl,
  thumbnailUrl,
  initialLikes,
  open,
  autoPlayVideo,
  onOpenChange,
  onDiscussionOpen,
  onEpisodePlay,
}: PodcastEpisodeEngagementProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastProgressSaveAtRef = useRef(0);
  const [likes, setLikes] = useState(initialLikes);
  const [isLiked, setIsLiked] = useState(false);
  const [liking, setLiking] = useState(false);
  const [comments, setComments] = useState<EpisodeComment[]>([]);
  const [commentsCount, setCommentsCount] = useState(0);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [playbackElapsedMs, setPlaybackElapsedMs] = useState(0);
  const playbackProgressKey = `nexsq:podcast-progress:${user?.id || 'anonymous'}:${episodeId}`;
  const lowerThirdStage = getPodcastLowerThirdStage(playbackElapsedMs);

  const savePlaybackPosition = useCallback((video = videoRef.current) => {
    if (!video || !Number.isFinite(video.currentTime)) return;
    try {
      const isNearEnd = Number.isFinite(video.duration)
        && video.duration > 0
        && video.currentTime >= video.duration - 1;
      if (video.ended || isNearEnd) {
        window.localStorage.removeItem(playbackProgressKey);
      } else {
        window.localStorage.setItem(playbackProgressKey, String(video.currentTime));
      }
    } catch (error) {
      console.error('Could not save podcast episode playback position:', error);
    }
  }, [playbackProgressKey]);

  const restorePlaybackPosition = useCallback((video: HTMLVideoElement) => {
    try {
      const savedPosition = Number(window.localStorage.getItem(playbackProgressKey));
      if (!Number.isFinite(savedPosition) || savedPosition <= 0) return;
      if (Number.isFinite(video.duration) && video.duration > 0) {
        if (savedPosition >= video.duration - 1) {
          window.localStorage.removeItem(playbackProgressKey);
          return;
        }
        video.currentTime = savedPosition;
        setPlaybackElapsedMs(savedPosition * 1000);
      }
    } catch (error) {
      console.error('Could not restore podcast episode playback position:', error);
    }
  }, [playbackProgressKey]);

  useEffect(() => {
    if (!open) return;
    const persistBeforeExit = () => savePlaybackPosition();
    window.addEventListener('pagehide', persistBeforeExit);
    window.addEventListener('beforeunload', persistBeforeExit);
    return () => {
      persistBeforeExit();
      window.removeEventListener('pagehide', persistBeforeExit);
      window.removeEventListener('beforeunload', persistBeforeExit);
    };
  }, [open, savePlaybackPosition]);

  useEffect(() => {
    if (!user?.id) return;

    let active = true;
    const loadCounts = async () => {
      const [likeResult, commentResult] = await Promise.all([
        supabase
          .from('studio_episode_likes')
          .select('episode_id')
          .eq('episode_id', episodeId)
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('studio_episode_comments')
          .select('id', { count: 'exact', head: true })
          .eq('episode_id', episodeId),
      ]);

      if (likeResult.error) throw likeResult.error;
      if (commentResult.error) throw commentResult.error;
      if (!active) return;
      setIsLiked(Boolean(likeResult.data));
      setCommentsCount(commentResult.count || 0);
    };

    void loadCounts().catch((error: unknown) => {
      if (!active) return;
      console.error('Could not load podcast episode engagement:', error);
      toast({
        title: 'Could not load episode likes and comments',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    });

    return () => {
      active = false;
    };
  }, [episodeId, toast, user?.id]);

  const loadComments = useCallback(async () => {
    setCommentsLoading(true);
    try {
      const { data, error, count } = await supabase
        .from('studio_episode_comments')
        .select('id, user_id, comment, created_at', { count: 'exact' })
        .eq('episode_id', episodeId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;

      const rows = (data || []) as Array<{
        id: number;
        user_id: string;
        comment: string;
        created_at: string;
      }>;
      const userIds = [...new Set(rows.map((row) => row.user_id))];
      const authors = userIds.length
        ? await supabase
          .from('users')
          .select('id, username, first_name, last_name, avatar_url')
          .in('id', userIds)
        : { data: [], error: null };
      if (authors.error) throw authors.error;

      const authorById = new Map(
        (authors.data || []).map((author) => [
          String(author.id),
          {
            name: author.username
              || [author.first_name, author.last_name].filter(Boolean).join(' ')
              || 'Subscriber',
            avatar: author.avatar_url || null,
          },
        ]),
      );
      setComments(rows.map((row) => {
        const author = authorById.get(row.user_id);
        return {
          ...row,
          authorName: author?.name || 'Subscriber',
          authorAvatar: author?.avatar || null,
        };
      }));
      setCommentsCount(count ?? rows.length);
    } catch (error) {
      console.error('Could not load podcast episode comments:', error);
      toast({
        title: 'Could not load comments',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setCommentsLoading(false);
    }
  }, [episodeId, toast]);

  useEffect(() => {
    if (!open) return;
    onDiscussionOpen();
    void loadComments();
  }, [loadComments, onDiscussionOpen, open]);

  const toggleLike = async () => {
    if (!user?.id || liking) return;
    setLiking(true);
    try {
      const { data, error } = await supabase.rpc('toggle_studio_episode_like', {
        p_episode_id: episodeId,
      });
      if (error) throw error;
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('The server returned an invalid like response.');
      }
      if (typeof data.liked !== 'boolean' || typeof data.likes_count !== 'number') {
        throw new Error('The server returned an invalid like response.');
      }
      setIsLiked(data.liked);
      setLikes(data.likes_count);
    } catch (error) {
      console.error('Could not update podcast episode like:', error);
      toast({
        title: 'Could not update like',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLiking(false);
    }
  };

  const submitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const comment = commentText.trim();
    if (!user?.id || !comment || submittingComment) return;

    setSubmittingComment(true);
    try {
      const { error } = await supabase
        .from('studio_episode_comments')
        .insert({ episode_id: episodeId, user_id: user.id, comment });
      if (error) throw error;
      setCommentText('');
      await loadComments();
    } catch (error) {
      console.error('Could not post podcast episode comment:', error);
      toast({
        title: 'Could not post comment',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmittingComment(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => void toggleLike()}
          disabled={!user?.id || liking}
          aria-pressed={isLiked}
          aria-label={`${isLiked ? 'Unlike' : 'Like'} ${episodeTitle}`}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Heart className={`h-4 w-4 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
          {likes.toLocaleString()}
        </button>

        <Dialog
          open={open}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) savePlaybackPosition();
            onOpenChange(nextOpen);
          }}
        >
          <DialogTrigger asChild>
            <button
              type="button"
              disabled={!user?.id}
              aria-label={`Watch ${episodeTitle} and view ${commentsCount} comments`}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              <MessageCircle className="h-4 w-4" />
              {commentsCount.toLocaleString()}
            </button>
          </DialogTrigger>
          <DialogContent className="!fixed !inset-0 !left-0 !top-0 !h-[100dvh] !w-screen !max-w-none !translate-x-0 !translate-y-0 [&>button]:!top-20 flex flex-col gap-0 overflow-hidden rounded-none border-0 bg-background p-0 text-foreground duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:slide-in-from-bottom-6 data-[state=closed]:slide-out-to-bottom-6">
            <DialogHeader className="sr-only">
              <DialogTitle>Watch and discuss {episodeTitle}</DialogTitle>
              <DialogDescription>Watch this episode and join the subscriber discussion.</DialogDescription>
            </DialogHeader>
            <div className="shrink-0">
              <Header />
            </div>
            <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,40%)_minmax(0,1fr)] md:grid-cols-[minmax(0,1fr)_380px] md:grid-rows-1">
              <section className="flex min-h-0 flex-col bg-black text-white">
                <div className="relative min-h-0 flex-1 bg-black">
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    poster={thumbnailUrl || undefined}
                    controls
                    playsInline
                    autoPlay={autoPlayVideo}
                    className="absolute inset-0 h-full w-full object-contain"
                    aria-label={episodeTitle}
                    onLoadedMetadata={(event) => restorePlaybackPosition(event.currentTarget)}
                    onTimeUpdate={(event) => {
                      setPlaybackElapsedMs(event.currentTarget.currentTime * 1000);
                      const now = Date.now();
                      if (now - lastProgressSaveAtRef.current < 2000) return;
                      lastProgressSaveAtRef.current = now;
                      savePlaybackPosition(event.currentTarget);
                    }}
                    onPause={(event) => savePlaybackPosition(event.currentTarget)}
                    onEnded={() => {
                      setPlaybackElapsedMs(0);
                      try {
                        window.localStorage.removeItem(playbackProgressKey);
                      } catch (error) {
                        console.error('Could not clear completed podcast episode progress:', error);
                      }
                    }}
                    onPlay={onEpisodePlay}
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex h-[14%] min-h-14 items-center gap-3 border-t border-white/15 bg-gradient-to-r from-[#03100d]/95 via-[#050c0d]/95 to-[#080a0e]/95 px-4 text-white shadow-xl backdrop-blur-sm">
                    {lowerThirdStage && (
                      <>
                        {channelLogoUrl ? (
                          <img
                            src={channelLogoUrl}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded object-contain ring-1 ring-white/25"
                          />
                        ) : (
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded bg-gradient-to-br from-emerald-500 to-emerald-900 text-xs font-bold ring-1 ring-white/25">
                            {podcastName.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'P'}
                          </div>
                        )}
                        <div
                          key={lowerThirdStage.stage}
                          className="min-w-0 flex-1 animate-in fade-in slide-in-from-bottom-3 zoom-in-95 duration-700 ease-out"
                        >
                          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-300">
                            {lowerThirdStage.stage === 0 ? 'Podcast' : lowerThirdStage.stage === 1 ? 'Topic' : 'Host'}
                          </p>
                          <p className="truncate text-sm font-bold">
                            {lowerThirdStage.stage === 0
                              ? podcastName
                              : lowerThirdStage.stage === 1
                                ? topic
                                : hostNames}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="hidden shrink-0 px-5 py-3 md:block">
                  <h2 className="line-clamp-2 text-base font-semibold">{episodeTitle}</h2>
                </div>
              </section>

              <aside className="flex min-h-0 flex-col border-t bg-background animate-in slide-in-from-bottom-3 duration-300 md:border-l md:border-t-0 md:slide-in-from-right-3">
                <header className="border-b px-4 py-4 pr-12">
                  <Link
                    to={`/podcast/${encodeURIComponent(showId)}`}
                    onClick={() => onOpenChange(false)}
                    className="mb-2 inline-flex max-w-full items-center gap-1 truncate text-xs font-medium text-muted-foreground transition hover:text-foreground"
                  >
                    <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
                    Back to podcast page
                  </Link>
                  <h2 className="font-semibold">Episode discussion</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {commentsCount.toLocaleString()} {commentsCount === 1 ? 'comment' : 'comments'}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => void toggleLike()}
                      disabled={!user?.id || liking}
                      aria-pressed={isLiked}
                      className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition hover:bg-muted disabled:opacity-60"
                    >
                      <Heart className={`h-4 w-4 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
                      {isLiked ? 'Liked' : 'Like'} · {likes.toLocaleString()}
                    </button>
                    <button
                      type="button"
                      onClick={onShareEpisode}
                      aria-label={`Share episode, ${shareCount.toLocaleString()} shares`}
                      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
                    >
                      <Share2 className="h-4 w-4" />
                      {shareCount.toLocaleString()} shares
                    </button>
                  </div>
                </header>

                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4" role="log" aria-live="polite">
                  {commentsLoading ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">Loading comments…</p>
                  ) : comments.length ? (
                    comments.map((comment) => {
                      const initials = comment.authorName
                        .split(/\s+/)
                        .map((part) => part[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase();
                      return (
                        <article key={comment.id} className="flex items-start gap-3">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={comment.authorAvatar || undefined} alt="" />
                            <AvatarFallback>{initials || 'S'}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1 rounded-xl bg-muted/60 px-3 py-2">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                              <span className="text-xs font-semibold">{comment.authorName}</span>
                              <time className="text-[10px] text-muted-foreground" dateTime={comment.created_at}>
                                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                              </time>
                            </div>
                            <p className="mt-1 whitespace-pre-wrap break-words text-sm">{comment.comment}</p>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <p className="py-8 text-center text-sm text-muted-foreground">Be the first to join the conversation.</p>
                  )}
                </div>

                <form onSubmit={(event) => void submitComment(event)} className="border-t bg-background p-3">
                  <div className="flex items-end gap-2">
                    <Textarea
                      value={commentText}
                      onChange={(event) => setCommentText(event.target.value)}
                      placeholder="Write a comment…"
                      maxLength={2000}
                      rows={2}
                      disabled={!user?.id || submittingComment}
                      aria-label="Write a comment"
                      className="max-h-32 min-h-10 resize-y"
                    />
                    <Button
                      type="submit"
                      size="icon"
                      aria-label="Post comment"
                      disabled={!commentText.trim() || !user?.id || submittingComment}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="mt-1 text-right text-[10px] text-muted-foreground">{commentText.length}/2000</p>
                </form>
              </aside>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
