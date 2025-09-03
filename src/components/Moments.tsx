import React, { useState, useRef, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { uploadFile, getMediaUrl } from '@/utils/mediaUtils';
import { VideoModal } from './VideoModal';
import TextMomentCreator from './moment/TextMomentCreator';
import VideoTrimmer from './VideoTrimmer';

interface Moment {
  id: string;
  media_url: string;
  content: string;
  created_at: string;
  user: {
    first_name?: string;
    last_name?: string;
    username?: string;
    avatar_url?: string;
    id: string; // id is required
  };
  likes_count: number;
  userHasLiked: boolean;
  reply_count: number;
  user_id: string; // user_id is required
  moment_bg?: string;
  moment_font?: string;
  moment_font_size?: number;
  moment_type?: string;
  moment_special_message?: string;
  moment_special_icon?: string;
  moment_special_name?: string;
  is_custom_special_day?: boolean;
  special_id?: string;
  views_count?: number;
}

export const Moments = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [groupedMoments, setGroupedMoments] = useState<Record<string, Moment[]>>({});
  const [userOrder, setUserOrder] = useState<string[]>([]); // To keep order of users
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userMomentIndex, setUserMomentIndex] = useState<number>(0);
  const [modalOpen, setModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewers, setViewers] = useState<any[]>([]);
  const fileInputImageRef = useRef<HTMLInputElement>(null);
  const fileInputVideoRef = useRef<HTMLInputElement>(null);
  const fileInputCameraRef = useRef<HTMLInputElement>(null);
  const [textMomentMode, setTextMomentMode] = useState(false);
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);

  useEffect(() => {
    fetchMoments();
  }, []);

  const fetchMoments = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id,
          content,
          media_url,
          created_at,
          likes_count,
          moment_bg,
          moment_font,
          moment_font_size,
          moment_type,
          user:users!posts_user_id_fkey(
            first_name,
            last_name,
            username,
            avatar_url,
            id
          )
        `)
        .eq('post_type', 'moment')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching moments:', error);
        return;
      }

      if (data && user) {
        // Check which moments the user has liked
        const momentIds = data.map(m => m.id);
        const { data: likes } = await supabase
          .from('likes')
          .select('post_id')
          .eq('user_id', user.id)
          .in('post_id', momentIds);
        const likedMomentIds = new Set(likes?.map(l => l.post_id) || []);
        // Fetch reply counts (robust)
        let replyCountMap = new Map();
        try {
          const { data: replyCounts } = await supabase
            .from('moment_replies')
            .select('moment_id, count:id');
          if (Array.isArray(replyCounts)) {
            replyCountMap = new Map(replyCounts.map(rc => [rc.moment_id, rc.count]));
          }
        } catch (e) {
          replyCountMap = new Map();
        }
        // Fetch views count per moment
        let viewsCountMap = new Map();
        try {
          const { data: viewsCounts } = await supabase
            .from('moment_views')
            .select('moment_id, count:id');
          if (Array.isArray(viewsCounts)) {
            viewsCountMap = new Map(viewsCounts.map(vc => [vc.moment_id, vc.count]));
          }
        } catch (e) {
          viewsCountMap = new Map();
        }
        // Fix: moments mapping, ensure user is a single object
        const momentsWithLikes = data.map(moment => ({
          ...moment,
          user: Array.isArray(moment.user) ? moment.user[0] : moment.user,
          userHasLiked: likedMomentIds.has(moment.id),
          reply_count: replyCountMap.get(moment.id) || 0,
          views_count: viewsCountMap.get(moment.id) || 0,
          user_id: Array.isArray(moment.user) ? moment.user[0]?.['id'] : (moment.user && typeof moment.user === 'object' ? (moment.user as any).id : undefined)
        }));
        setMoments(momentsWithLikes);
        // Group by user
        const grouped: Record<string, Moment[]> = {};
        const order: string[] = [];
        for (const m of momentsWithLikes) {
          if (!m.user_id) continue;
          if (!grouped[m.user_id]) {
            grouped[m.user_id] = [];
            order.push(m.user_id);
          }
          grouped[m.user_id].push(m);
        }
        setGroupedMoments(grouped);
        setUserOrder(order);
      }
    } catch (error) {
      console.error('Error fetching moments:', error);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');

      if (!isImage && !isVideo) {
        toast({
          description: "Please select an image or video file",
          variant: "destructive",
        });
        return;
      }

      // Handle video files
      if (isVideo) {
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
      }

      // Handle image files
      if (isImage) {
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
      }
    }
  };

  const handleShareMoment = async () => {
    if (!selectedFile || !user) {
      console.log('Missing requirements:', { selectedFile: !!selectedFile, user: !!user });
      return;
    }

    setIsUploading(true);
    try {
      console.log('Starting moment upload...');

      // Upload file to Supabase storage
      const mediaUrl = await uploadFile(selectedFile, 'posts', 'moments/', user.id);
      console.log('Media uploaded, URL:', mediaUrl);

      // Create moment post - removed trim_start and trim_end fields
      const { data: insertData, error: insertError } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content: caption || '',
          media_url: mediaUrl,
          post_type: 'moment',
          privacy: 'public'
        })
        .select()
        .single();

      if (insertError) {
        console.error('Insert error details:', insertError);
        throw new Error(`Database insert failed: ${insertError.message}`);
      }

      console.log('Moment created successfully:', insertData);

      toast({
        description: "Moment shared successfully!",
      });

      // Reset form and refresh moments
      cancelCreation();
      fetchMoments();

    } catch (error: any) {
      console.error('Error sharing moment:', error);
      toast({
        description: error.message || "Failed to share moment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleLikeMoment = async (momentObj: any) => {
    if (!user || !momentObj) return;
    const momentId = momentObj.id;
    try {
      if (momentObj.userHasLiked) {
        // Unlike
        await supabase
          .from('likes')
          .delete()
          .eq('post_id', momentId)
          .eq('user_id', user.id);
        setMoments(prev => prev.map(m =>
          m.id === momentId
            ? { ...m, likes_count: m.likes_count - 1, userHasLiked: false }
            : m
        ));
        setGroupedMoments(prev => {
          const copy = { ...prev };
          for (const uid in copy) {
            copy[uid] = copy[uid].map(m => m.id === momentId ? { ...m, likes_count: m.likes_count - 1, userHasLiked: false } : m);
          }
          return copy;
        });
        // Send notification to author - fixed user reference
        if (momentObj.user?.id && momentObj.user.id !== user.id) {
          await supabase.from('notifications').insert({
            user_id: momentObj.user.id,
            type: 'moment_like',
            title: 'Your moment was liked',
            message: `${user?.username || user?.email?.split('@')[0] || 'Someone'} liked your moment`,
            data: { momentId: momentId, userId: user.id },
            read: false
          });
        }
      } else {
        // Like
        await supabase
          .from('likes')
          .insert({
            post_id: momentId,
            user_id: user.id,
            reaction_type: 'like'
          });
        setMoments(prev => prev.map(m =>
          m.id === momentId
            ? { ...m, likes_count: m.likes_count + 1, userHasLiked: true }
            : m
        ));
        setGroupedMoments(prev => {
          const copy = { ...prev };
          for (const uid in copy) {
            copy[uid] = copy[uid].map(m => m.id === momentId ? { ...m, likes_count: m.likes_count + 1, userHasLiked: true } : m);
          }
          return copy;
        });
        // Send notification to author - fixed user reference
        if (momentObj.user?.id && momentObj.user.id !== user.id) {
          await supabase.from('notifications').insert({
            user_id: momentObj.user.id,
            type: 'moment_like',
            title: 'Your moment was liked',
            message: `${user?.username || user?.email?.split('@')[0] || 'Someone'} liked your moment`,
            data: { momentId: momentId, userId: user.id },
            read: false
          });
        }
      }
    } catch (error) {
      console.error('Error liking moment:', error);
      toast({
        description: "Failed to like moment. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleReplyMoment = (momentObj: any) => {
    if (!momentObj) return;
    const momentId = momentObj.id;
    setMoments(prev => prev.map(m =>
      m.id === momentId
        ? { ...m, reply_count: (m.reply_count || 0) + 1 }
        : m
    ));
    setGroupedMoments(prev => {
      const copy = { ...prev };
      for (const uid in copy) {
        copy[uid] = copy[uid].map(m => m.id === momentId ? { ...m, reply_count: (m.reply_count || 0) + 1 } : m);
      }
      return copy;
    });
  };

  const viewedMomentIds = useRef<Set<string>>(new Set());
  const handleViewMoment = (momentObj: any) => {
    if (!momentObj) return;
    const momentId = momentObj.id;
    if (viewedMomentIds.current.has(momentId)) return;
    viewedMomentIds.current.add(momentId);
    setMoments(prev => prev.map(m =>
      m.id === momentId
        ? { ...m, views_count: (m.views_count || 0) + 1 }
        : m
    ));
    setGroupedMoments(prev => {
      const copy = { ...prev };
      for (const uid in copy) {
        copy[uid] = copy[uid].map(m => m.id === momentId ? { ...m, views_count: (m.views_count || 0) + 1 } : m);
      }
      return copy;
    });
  };

  const cancelCreation = () => {
    setIsCreating(false);
    setSelectedFile(null);
    setPreviewUrl('');
    setCaption('');
    setTextMomentMode(false);
    setTrimStart(0);
    setTrimEnd(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
  };

  useEffect(() => {
    const fetchViewers = async () => {
      if (
        selectedUserId &&
        groupedMoments[selectedUserId] &&
        groupedMoments[selectedUserId][userMomentIndex] &&
        user &&
        groupedMoments[selectedUserId][userMomentIndex].user?.id === user.id
      ) {
        const { data } = await supabase
          .from('moment_views')
          .select('user_id, viewed_at, users (username, first_name, last_name, avatar_url)')
          .eq('moment_id', groupedMoments[selectedUserId][userMomentIndex].id);
        setViewers(data || []);
      } else {
        setViewers([]);
      }
    };
    fetchViewers();
  }, [selectedUserId, userMomentIndex, groupedMoments, user]);

  if (!user) return null;

  return (
    <>
      <div className="bg-card rounded-xl border border-border p-4 mb-6 shadow-sm">
        {!isCreating ? (
          <div className="flex items-start space-x-4 overflow-x-auto pb-2">
            <div
              className="flex-shrink-0 w-16 h-16 rounded-lg border-2 border-dashed border-muted-foreground/50 flex items-center justify-center cursor-pointer hover:border-primary hover:bg-muted/50 transition-all duration-200"
              onClick={() => setIsCreating(true)}
            >
              <Plus className="h-6 w-6 text-muted-foreground hover:text-primary transition-colors" />
            </div>

            <div className="flex space-x-3">
              {userOrder.map(userId => {
                const userMoments = groupedMoments[userId];
                if (!userMoments || userMoments.length === 0) return null;
                const firstMoment = userMoments[0];
                return (
                  <div key={userId} className="flex flex-col items-center space-y-1">
                    <div
                      className="relative flex-shrink-0 cursor-pointer group"
                      style={{ width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onClick={() => {
                        setSelectedUserId(userId);
                        setUserMomentIndex(0);
                        setModalOpen(true);
                      }}
                    >
                      {/* Purple gradient border with rounded corners */}
                      <div
                        style={{
                          width: 64,
                          height: 64,
                          background: 'linear-gradient(45deg, #8b5cf6 0%, #a855f7 25%, #c084fc 50%, #d946ef 75%, #e879f9 100%)',
                          borderRadius: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                          overflow: 'hidden',
                          padding: '3px', // This creates the border thickness
                        }}
                      >
                        {/* Inner content area with card background and spacing */}
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            background: 'hsl(var(--card))',
                            borderRadius: '9px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            overflow: 'hidden',
                            padding: '2px', // Extra spacing between border and content
                          }}
                        >
                          {/* Actual content container */}
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              borderRadius: '7px',
                              overflow: 'hidden',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              position: 'relative',
                            }}
                          >
                            {firstMoment.media_url ? (
                              <img
                                src={getMediaUrl(firstMoment.media_url, 'posts')}
                                alt="Moment"
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  borderRadius: '7px',
                                }}
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            ) : firstMoment.moment_type === 'text' ? (
                              <span
                                style={{
                                  color: '#fff',
                                  fontWeight: 600,
                                  fontSize: '0.75rem',
                                  textAlign: 'center',
                                  width: '90%',
                                  wordBreak: 'break-word',
                                  background: firstMoment.moment_bg || 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)',
                                  padding: '4px',
                                  borderRadius: '7px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  height: '90%',
                                }}
                                className="line-clamp-3"
                              >
                                {firstMoment.content}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        {/* Avatar overlay bottom right */}
                        <div style={{ position: 'absolute', bottom: 4, right: 4, zIndex: 3 }}>
                          <Avatar className="w-4 h-4 border border-white">
                            <AvatarImage src={firstMoment.user?.avatar_url} />
                            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                              {firstMoment.user?.first_name?.[0] || firstMoment.user?.username?.[0] || 'U'}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      </div>
                    </div>
                    {/* Username under the moment box */}
                    <div className="text-xs text-center text-muted-foreground max-w-[64px] truncate">
                      {firstMoment.user?.username || 'User'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : textMomentMode ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-md font-medium text-foreground">Create Text Moment</h4>
              <Button variant="ghost" size="sm" onClick={() => { setTextMomentMode(false); setIsCreating(false); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <TextMomentCreator
              user={user}
              isUploading={isUploading}
              setIsUploading={setIsUploading}
              onMomentCreated={() => {
                setTextMomentMode(false);
                setIsCreating(false);
                fetchMoments();
              }}
            />
            <Button variant="outline" className="mt-4 w-full" onClick={() => setTextMomentMode(false)}>
              Back to Moment Options
            </Button>
          </div>
        ) : (
          <div className="space-y-3 relative">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={cancelCreation}
              className="absolute top-0 right-0 z-10"
            >
              <X className="h-4 w-4" />
            </Button>

            <div className="flex gap-6 justify-center my-2 pt-8">
              <button type="button" onClick={() => fileInputImageRef.current?.click()} className="flex flex-col items-center group focus:outline-none">
                <svg width="48" height="48" viewBox="0 0 48 48" className="text-muted-foreground group-hover:text-primary">
                  <rect x="8" y="12" width="32" height="24" rx="2" fill="none" stroke="currentColor" strokeWidth="2"/>
                  <circle cx="16" cy="20" r="2" fill="currentColor"/>
                  <path d="M8 32l8-8 4 4 8-8 12 12" stroke="currentColor" strokeWidth="2" fill="none"/>
                </svg>
                <span className="text-xs mt-1 text-muted-foreground group-hover:text-primary">Image</span>
              </button>
              
              <button type="button" onClick={() => fileInputVideoRef.current?.click()} className="flex flex-col items-center group focus:outline-none">
                <svg width="48" height="48" viewBox="0 0 48 48" className="text-muted-foreground group-hover:text-primary">
                  <rect x="8" y="12" width="32" height="24" rx="2" fill="none" stroke="currentColor" strokeWidth="2"/>
                  <polygon points="20,18 20,30 28,24" fill="currentColor"/>
                </svg>
                <span className="text-xs mt-1 text-muted-foreground group-hover:text-primary">Video</span>
              </button>
              
              <button type="button" onClick={() => fileInputCameraRef.current?.click()} className="flex flex-col items-center group focus:outline-none">
                <svg width="48" height="48" viewBox="0 0 48 48" className="text-muted-foreground group-hover:text-primary">
                  <rect x="6" y="16" width="36" height="20" rx="2" fill="none" stroke="currentColor" strokeWidth="2"/>
                  <rect x="18" y="12" width="12" height="4" rx="1" fill="none" stroke="currentColor" strokeWidth="2"/>
                  <circle cx="24" cy="26" r="6" fill="none" stroke="currentColor" strokeWidth="2"/>
                </svg>
                <span className="text-xs mt-1 text-muted-foreground group-hover:text-primary">Camera</span>
              </button>
              
              <button type="button" onClick={() => setTextMomentMode(true)} className="flex flex-col items-center group focus:outline-none">
                <svg width="48" height="48" viewBox="0 0 48 48" className="text-muted-foreground group-hover:text-primary">
                  <text x="12" y="36" fontSize="28" fontWeight="bold" fill="currentColor">T</text>
                </svg>
                <span className="text-xs mt-1 text-muted-foreground group-hover:text-primary">Text</span>
              </button>
              
              <input
                ref={fileInputImageRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
              <input
                ref={fileInputVideoRef}
                type="file"
                accept="video/*"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
              <input
                ref={fileInputCameraRef}
                type="file"
                accept="image/*,video/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
            </div>

            {selectedFile && previewUrl && (
              <div className="border border-border rounded-lg p-2 relative">
                <div className="text-sm text-muted-foreground mb-2">
                  Preview: {selectedFile.name}
                </div>
                {selectedFile.type.startsWith('image/') ? (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-48 object-cover rounded-lg"
                  />
                ) : selectedFile.type.startsWith('video/') && videoDuration === null ? (
                  <video
                    src={previewUrl}
                    style={{ display: 'none' }}
                    onLoadedMetadata={e => setVideoDuration(e.currentTarget.duration)}
                  />
                ) : selectedFile.type.startsWith('video/') && videoDuration && videoDuration > 90 ? (
                  <VideoTrimmer
                    key={previewUrl}
                    file={selectedFile}
                    onTrim={(start, end) => {
                      setTrimStart(start);
                      setTrimEnd(end);
                    }}
                  />
                ) : (
                  <video
                    src={previewUrl}
                    className="w-full h-48 object-cover rounded-lg"
                    controls
                    onLoadedMetadata={e => setVideoDuration(e.currentTarget.duration)}
                  />
                )}
              </div>
            )}

            <Input
              placeholder="Add a caption..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="border-border"
            />

            <Button
              onClick={handleShareMoment}
              disabled={!selectedFile || isUploading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              {isUploading ? "Sharing..." : "Share Moment"}
            </Button>
          </div>
        )}
      </div>

      {selectedUserId && groupedMoments[selectedUserId] && groupedMoments[selectedUserId][userMomentIndex] && (
        <VideoModal
          open={modalOpen}
          onOpenChange={(open) => {
            setModalOpen(open);
            if (!open) {
              setSelectedUserId(null);
              setUserMomentIndex(0);
            }
          }}
          videoUrl={(() => {
            const m = groupedMoments[selectedUserId][userMomentIndex];
            return m.media_url && m.media_url.match(/\.(mp4|webm|ogg|mov|avi)$/i) ? getMediaUrl(m.media_url, 'posts') : undefined;
          })()}
          imageUrl={(() => {
            const m = groupedMoments[selectedUserId][userMomentIndex];
            return m.media_url && !m.media_url.match(/\.(mp4|webm|ogg|mov|avi)$/i) ? getMediaUrl(m.media_url, 'posts') : undefined;
          })()}
          user={{
            name: `${groupedMoments[selectedUserId][userMomentIndex].user?.first_name || ''} ${groupedMoments[selectedUserId][userMomentIndex].user?.last_name || ''}`.trim() || groupedMoments[selectedUserId][userMomentIndex].user?.username || 'User',
            avatar: groupedMoments[selectedUserId][userMomentIndex].user?.avatar_url || '/placeholder.svg'
          }}
          moment={{
            ...groupedMoments[selectedUserId][userMomentIndex],
          }}
          onLike={() => handleLikeMoment(groupedMoments[selectedUserId][userMomentIndex])}
          onReply={() => handleReplyMoment(groupedMoments[selectedUserId][userMomentIndex])}
          onView={() => handleViewMoment(groupedMoments[selectedUserId][userMomentIndex])}
          moments={groupedMoments[selectedUserId]}
          currentIndex={userMomentIndex}
          onAdvance={() => {
            if (userMomentIndex < groupedMoments[selectedUserId].length - 1) {
              setUserMomentIndex(userMomentIndex + 1);
            } else {
              setModalOpen(false);
              setSelectedUserId(null);
              setUserMomentIndex(0);
            }
          }}
          refreshReplyCount={fetchMoments}
          trimStart={trimStart}
          trimEnd={trimEnd}
        />
      )}
      {selectedUserId && groupedMoments[selectedUserId] && groupedMoments[selectedUserId][userMomentIndex] && user && groupedMoments[selectedUserId][userMomentIndex].user?.id === user.id && (
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded shadow">
          <h4 className="font-semibold mb-2">Views ({viewers.length})</h4>
          <ul className="space-y-1">
            {viewers.map(v => (
              <li key={v.user_id} className="flex items-center gap-2">
                <img src={v.users?.avatar_url || '/placeholder.svg'} alt="avatar" className="w-6 h-6 rounded-full" />
                <span>{v.users?.first_name || ''} {v.users?.last_name || ''} (@{v.users?.username})</span>
                <span className="text-xs text-gray-400 ml-auto">{new Date(v.viewed_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
};
