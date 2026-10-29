import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { Check, ImagePlus, LayoutDashboard, Loader2, Palette, Search, Save, Send, Sparkles, Trash2, Tv, Upload, UserPlus, Users, Video, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import VODLibrary from '@/components/VODLibrary';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface StudioShowManagementProps {
  showId: string;
  isOwner: boolean;
  onShowUpdated?: (show: ShowDetails) => void;
}

interface ShowDetails {
  title: string;
  description: string;
  category: string;
  thumbnail_url: string | null;
  logo_url: string | null;
  banner_url: string | null;
  brand_color: string | null;
  publication_status: 'draft' | 'pending_review' | 'published' | 'changes_requested';
  publication_review_notes: string | null;
}

interface ShowManager {
  manager_id: string;
  username: string;
  avatar_url: string | null;
  added_at: string;
}

interface ManagerProfile {
  id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

interface ShowEpisode {
  id: string;
  title: string;
  video_url: string | null;
  thumbnail_url: string | null;
  created_at: string;
}

type Section = 'overview' | 'episodes' | 'branding' | 'managers';
type ArtworkField = 'thumbnail_url' | 'logo_url' | 'banner_url';

const ARTWORK_FIELDS: { field: ArtworkField; label: string; hint: string; aspect: string; contain?: boolean }[] = [
  { field: 'thumbnail_url', label: 'Show artwork', hint: 'Portrait or square artwork', aspect: 'aspect-[4/3]' },
  { field: 'logo_url', label: 'Show logo', hint: 'Square PNG works best', aspect: 'aspect-square', contain: true },
  { field: 'banner_url', label: 'Banner image', hint: 'Wide image for show promotion', aspect: 'aspect-[16/7]' },
];

const ArtworkDropzone = ({
  label,
  hint,
  aspect,
  imageUrl,
  file,
  contain = false,
  onFileSelect,
}: {
  label: string;
  hint: string;
  aspect: string;
  imageUrl: string | null;
  file: File | null;
  contain?: boolean;
  onFileSelect: (file: File) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setFilePreview(null);
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setFilePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [file]);

  const acceptFile = (candidate?: File) => {
    if (candidate?.type.startsWith('image/')) onFileSelect(candidate);
  };

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-[11px] text-muted-foreground">{file ? 'Ready to save' : imageUrl ? 'Current' : 'Not set'}</span>
      </div>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="image/*"

        aria-label={`Choose ${label.toLowerCase()}`}
        onChange={(event) => {
          acceptFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          acceptFile(event.dataTransfer.files[0]);
        }}
        className={`group relative block w-full ${aspect} overflow-hidden rounded-2xl border-2 border-dashed text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2 ${dragging ? 'scale-[1.01] border-pink-500 bg-pink-500/10 shadow-lg shadow-pink-500/10' : 'border-border/70 bg-gradient-to-br from-pink-500/[0.06] via-background to-rose-500/[0.06] hover:border-pink-500/60 hover:shadow-md'}`}
      >
        {(filePreview || imageUrl) && (
          <img
            src={filePreview || imageUrl || ''}
            alt={`${label} preview`}
            className={`absolute inset-0 h-full w-full ${contain ? 'object-contain p-8' : 'object-cover'}`}
          />
        )}
        <div className={`absolute inset-0 transition-colors ${filePreview || imageUrl ? 'bg-gradient-to-t from-black/75 via-black/10 to-black/25 group-hover:from-black/80' : 'bg-transparent'}`} />
        <div className={`absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-xl p-3 backdrop-blur-md transition-colors ${filePreview || imageUrl ? 'bg-black/35 text-white' : 'bg-background/75 text-foreground group-hover:bg-background/90'}`}>
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${filePreview || imageUrl ? 'bg-white/15 text-white' : 'bg-gradient-to-br from-pink-600 to-rose-500 text-white shadow-md shadow-pink-500/20'}`}>
            <Upload className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{dragging ? 'Drop to upload' : file ? file.name : imageUrl ? 'Drop to replace or browse' : 'Drop image here or browse'}</span>
            <span className={`mt-0.5 block text-xs ${filePreview || imageUrl ? 'text-white/75' : 'text-muted-foreground'}`}>{hint}</span>
          </span>
          <ImagePlus className="h-4 w-4 shrink-0 opacity-70" />
        </div>
        {dragging && <div className="pointer-events-none absolute inset-2 rounded-xl border border-white/80" />}
      </button>
    </div>
  );
};

const EpisodeFileDropzone = ({
  label,
  hint,
  accept,
  file,
  icon: Icon,
  onFileSelect,
  onInvalidFile,
}: {
  label: string;
  hint: string;
  accept: string;
  file: File | null;
  icon: LucideIcon;
  onFileSelect: (file: File) => void;
  onInvalidFile: (file: File) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const acceptFile = (candidate?: File) => {
    if (!candidate) return;
    const expectedType = accept.split('/')[0];
    if (candidate.type.startsWith(`${expectedType}/`)) onFileSelect(candidate);
    else onInvalidFile(candidate);
  };

  return (
    <div className="min-w-0 space-y-2">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept={accept}
        aria-label={`Choose ${label.toLowerCase()}`}
        onChange={(event) => {
          acceptFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          acceptFile(event.dataTransfer.files[0]);
        }}
        className={`flex min-h-28 w-full items-center gap-3 rounded-2xl border-2 border-dashed p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${dragging ? 'border-blue-500 bg-blue-500/10' : 'border-border/70 bg-gradient-to-br from-blue-500/[0.05] via-background to-cyan-500/[0.04] hover:border-blue-500/50'}`}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/20">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">
            {dragging ? 'Drop to select file' : file?.name || 'Choose or drop a file'}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {file ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : hint}
          </span>
        </span>
      </button>
    </div>
  );
};

const StudioShowManagement = ({ showId, isOwner, onShowUpdated }: StudioShowManagementProps) => {
  const { toast } = useToast();
  const [show, setShow] = useState<ShowDetails | null>(null);
  const [managers, setManagers] = useState<ShowManager[]>([]);
  const [episodes, setEpisodes] = useState<ShowEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submittingForReview, setSubmittingForReview] = useState(false);
  const [section, setSection] = useState<Section>('overview');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [brandColor, setBrandColor] = useState('#7c3aed');
  const [artwork, setArtwork] = useState<Record<ArtworkField, File | null>>({
    thumbnail_url: null,
    logo_url: null,
    banner_url: null,
  });
  const [managerUsername, setManagerUsername] = useState('');
  const [managerMatches, setManagerMatches] = useState<ManagerProfile[]>([]);
  const [selectedManager, setSelectedManager] = useState<ManagerProfile | null>(null);
  const [searchingManagers, setSearchingManagers] = useState(false);
  const [managerSearchOpen, setManagerSearchOpen] = useState(false);
  const [episodeTitle, setEpisodeTitle] = useState('');
  const [episodeDescription, setEpisodeDescription] = useState('');
  const [episodeVideo, setEpisodeVideo] = useState<File | null>(null);
  const [episodeThumbnail, setEpisodeThumbnail] = useState<File | null>(null);
  const [episodeListVersion, setEpisodeListVersion] = useState(0);

  const refreshManagers = async () => {
    const { data, error } = await supabase.rpc('get_studio_show_managers' as any, { p_show_id: showId });
    if (error) console.error('Could not load show managers:', error);
    else setManagers((data || []) as ShowManager[]);
  };

  const refreshEpisodes = async () => {
    const { data, error } = await (supabase.from('studio_episodes') as any)
      .select('id, title, video_url, thumbnail_url, created_at')
      .eq('show_id', showId)
      .order('created_at', { ascending: false });
    if (error) console.error('Could not load show episodes:', error);
    else setEpisodes((data || []) as ShowEpisode[]);
  };

  useEffect(() => {
    let active = true;
    const loadManagementData = async () => {
      setLoading(true);
      const [{ data: showData, error: showError }, managersResult, episodesResult] = await Promise.all([
        (supabase.from('studio_shows') as any)
          .select('title, description, category, thumbnail_url, logo_url, banner_url, brand_color, publication_status, publication_review_notes')
          .eq('id', showId)
          .maybeSingle(),
        supabase.rpc('get_studio_show_managers' as any, { p_show_id: showId }),
        (supabase.from('studio_episodes') as any)
          .select('id, title, video_url, thumbnail_url, created_at')
          .eq('show_id', showId)
          .order('created_at', { ascending: false }),
      ]);
      if (!active) return;

      if (showError || !showData) {
        console.error('Could not load show details:', showError);
        toast({ title: 'Could not load show management', description: showError?.message, variant: 'destructive' });
      } else {
        const loadedShow = showData as ShowDetails;
        setShow(loadedShow);
        setTitle(loadedShow.title || '');
        setDescription(loadedShow.description || '');
        setCategory(loadedShow.category || '');
        setBrandColor(loadedShow.brand_color || '#7c3aed');
      }
      if (managersResult.error) console.error('Could not load show managers:', managersResult.error);
      else setManagers((managersResult.data || []) as ShowManager[]);
      if (episodesResult.error) console.error('Could not load show episodes:', episodesResult.error);
      else setEpisodes((episodesResult.data || []) as ShowEpisode[]);
      setLoading(false);
    };

    void loadManagementData();
    return () => { active = false; };
  }, [showId, toast]);

  useEffect(() => {
    const query = managerUsername.trim().replace(/^@/, '');
    if (query.length < 2 || selectedManager?.username === query) {
      setManagerMatches([]);
      setSearchingManagers(false);
      return;
    }

    let active = true;
    const timeout = window.setTimeout(async () => {
      setSearchingManagers(true);
      const escapedQuery = query.replace(/[%_]/g, '');
      try {
        const [usernameResult, firstNameResult, lastNameResult] = await Promise.all([
          supabase.from('users').select('id, username, first_name, last_name, avatar_url').ilike('username', `%${escapedQuery}%`).limit(5),
          supabase.from('users').select('id, username, first_name, last_name, avatar_url').ilike('first_name', `%${escapedQuery}%`).limit(5),
          supabase.from('users').select('id, username, first_name, last_name, avatar_url').ilike('last_name', `%${escapedQuery}%`).limit(5),
        ]);

        if (!active) return;
        const profiles = [
          ...(usernameResult.data || []),
          ...(firstNameResult.data || []),
          ...(lastNameResult.data || []),
        ] as ManagerProfile[];
        const existingManagerIds = new Set(managers.map((manager) => manager.manager_id));
        const uniqueProfiles = Array.from(new Map(profiles.map((profile) => [profile.id, profile])).values());
        setManagerMatches(uniqueProfiles.filter((profile) => !existingManagerIds.has(profile.id)).slice(0, 8));
      } catch (error) {
        if (active) {
          console.error('Could not search NexSq profiles:', error);
          setManagerMatches([]);
        }
      } finally {
        if (active) setSearchingManagers(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [managerUsername, managers, selectedManager]);

  const uploadAsset = async (file: File, folder: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Sign in to upload show assets.');
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const path = `${user.id}/tv-shows/${showId}/${folder}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from('studio-videos').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (error) throw error;
    return supabase.storage.from('studio-videos').getPublicUrl(path).data.publicUrl;
  };

  const saveDetails = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!show || saving) return;
    setSaving(true);
    try {
      const nextArtwork = { ...show };
      for (const { field } of ARTWORK_FIELDS) {
        if (artwork[field]) nextArtwork[field] = await uploadAsset(artwork[field] as File, field);
      }
      const { error } = await supabase.rpc('update_studio_show_management' as any, {
        p_show_id: showId,
        p_title: title.trim(),
        p_description: description.trim(),
        p_category: category.trim(),
        p_thumbnail_url: nextArtwork.thumbnail_url,
        p_logo_url: nextArtwork.logo_url,
        p_banner_url: nextArtwork.banner_url,
        p_brand_color: brandColor,
      });
      if (error) throw error;
      const updatedShow = {
        ...nextArtwork,
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        brand_color: brandColor,
        publication_status: show.publication_status === 'changes_requested' ? 'draft' : show.publication_status,
        publication_review_notes: show.publication_status === 'changes_requested' ? null : show.publication_review_notes,
      };
      setShow(updatedShow);
      onShowUpdated?.(updatedShow);
      setArtwork({ thumbnail_url: null, logo_url: null, banner_url: null });
      toast({ title: 'Show details saved' });
    } catch (error) {
      toast({ title: 'Could not save show details', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const submitForPublication = async () => {
    if (submittingForReview || !show) return;
    setSubmittingForReview(true);
    const { error } = await supabase.rpc('submit_studio_show_for_review' as any, {
      p_show_id: showId,
    });
    setSubmittingForReview(false);
    if (error) {
      toast({ title: 'Could not submit show', description: error.message, variant: 'destructive' });
      return;
    }
    const submittedShow = { ...show, publication_status: 'pending_review' as const, publication_review_notes: null };
    setShow(submittedShow);
    onShowUpdated?.(submittedShow);
    toast({ title: 'Show submitted for publishing', description: 'The NexSq team will review your show and episodes.' });
  };

  const uploadEpisode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!episodeVideo || uploading) return;
    setUploading(true);
    try {
      const videoUrl = await uploadAsset(episodeVideo, 'episodes');
      const thumbnailUrl = episodeThumbnail ? await uploadAsset(episodeThumbnail, 'episode-artwork') : null;
      const { error } = await supabase.rpc('create_studio_show_episode' as any, {
        p_show_id: showId,
        p_title: episodeTitle.trim(),
        p_description: episodeDescription.trim(),
        p_video_url: videoUrl,
        p_thumbnail_url: thumbnailUrl,
      });
      if (error) throw error;
      setEpisodeTitle('');
      setEpisodeDescription('');
      setEpisodeVideo(null);
      setEpisodeThumbnail(null);
      await refreshEpisodes();
      setEpisodeListVersion((value) => value + 1);
      toast({ title: 'Episode uploaded' });
    } catch (error) {
      toast({ title: 'Episode upload failed', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const addManager = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedManager) {
      toast({ title: 'Choose a registered user', description: 'Select a profile from the search results before adding a manager.', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.rpc('add_studio_show_manager' as any, { p_show_id: showId, p_username: selectedManager.username });
    if (error) {
      toast({ title: 'Could not add manager', description: error.message, variant: 'destructive' });
      return;
    }
    setManagerUsername('');
    setSelectedManager(null);
    setManagerMatches([]);
    setManagerSearchOpen(false);
    await refreshManagers();
    toast({ title: 'Show manager added' });
  };

  const removeManager = async (managerId: string) => {
    const { error } = await supabase.rpc('remove_studio_show_manager' as any, { p_show_id: showId, p_manager_id: managerId });
    if (error) toast({ title: 'Could not remove manager', description: error.message, variant: 'destructive' });
    else {
      await refreshManagers();
      toast({ title: 'Show manager removed' });
    }
  };

  const removeEpisode = async (episodeId: string) => {
    const { error } = await supabase.rpc('delete_studio_show_episode' as any, { p_episode_id: episodeId });
    if (error) toast({ title: 'Could not remove episode', description: error.message, variant: 'destructive' });
    else {
      await refreshEpisodes();
      setEpisodeListVersion((value) => value + 1);
      toast({ title: 'Episode removed' });
    }
  };

  const updateArtworkFile = (field: ArtworkField, file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Choose an image file', description: `${file.name} is not a supported image.`, variant: 'destructive' });
      return;
    }
    setArtwork((value) => ({ ...value, [field]: file }));
  };

  if (loading) return <p className="py-12 text-center text-sm text-muted-foreground">Loading show management…</p>;
  if (!show) return null;

  const sections = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, gradient: 'from-purple-600 to-fuchsia-500' },
    { id: 'episodes', label: 'Episodes', icon: Video, gradient: 'from-blue-600 to-cyan-500' },
    { id: 'branding', label: 'Branding', icon: Palette, gradient: 'from-pink-600 to-rose-500' },
    { id: 'managers', label: 'Managers', icon: Users, gradient: 'from-emerald-600 to-teal-500' },
  ];

  return (
    <div className="space-y-5">
      <nav aria-label="Show management sections" className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-2 shadow-sm">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-purple-500/[0.03] via-transparent to-fuchsia-500/[0.03]" />
        <div className="relative flex min-w-max gap-1 overflow-x-auto px-1">
          {sections.map(({ id, label, icon: Icon, gradient }) => (
            <Button key={id} type="button" size="sm" variant="ghost" aria-pressed={section === id} onClick={() => setSection(id)} className={`flex shrink-0 items-center gap-2 rounded-full px-4 text-xs font-semibold transition-all ${section === id ? `bg-gradient-to-br ${gradient} text-white shadow-md hover:text-white` : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}`}>
              <Icon className="h-3.5 w-3.5" />{label}
            </Button>
          ))}
        </div>
      </nav>

      {section === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {([
              { label: 'Episodes', value: episodes.length, note: 'Published uploads', icon: Video, tone: 'blue' },
              { label: 'Show team', value: managers.length + 1, note: 'Owner and managers', icon: Users, tone: 'emerald' },
              { label: 'Status', value: show.publication_status === 'pending_review' ? 'In review' : show.publication_status === 'published' ? 'Published' : show.publication_status === 'changes_requested' ? 'Changes needed' : 'Draft', note: 'NexSq TV publishing', icon: Check, tone: 'purple' },
              { label: 'Category', value: show.category || 'Uncategorized', note: 'Show genre', icon: Palette, tone: 'amber' },
            ] as const).map(({ label, value, note, icon: Icon, tone }) => {
              const tones = {
                blue: 'from-blue-500/15 to-cyan-500/10 text-blue-600 ring-blue-500/20 dark:text-blue-400',
                emerald: 'from-emerald-500/15 to-teal-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400',
                purple: 'from-purple-500/15 to-fuchsia-500/10 text-purple-600 ring-purple-500/20 dark:text-purple-400',
                amber: 'from-amber-500/15 to-orange-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400',
              };
              return (
                <div key={label} className="min-w-0 rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:bg-muted/30">
                  <span className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ring-1 ${tones[tone]}`}><Icon className="h-4 w-4" /></span>
                  <p className="truncate text-lg font-bold leading-tight">{value}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">{note}</p>
                </div>
              );
            })}
          </div>

          <Card className="overflow-hidden rounded-3xl border-border/60 bg-card shadow-sm">
            <CardHeader className="border-b border-border/50 bg-gradient-to-r from-purple-500/[0.06] to-fuchsia-500/[0.03]">
              <CardTitle className="flex items-center gap-2 text-sm font-bold"><Tv className="h-4 w-4 text-purple-500" />Publishing status</CardTitle>
              <p className="text-xs text-muted-foreground">
                {show.publication_status === 'published'
                  ? 'Your show is published on NexSq TV.'
                  : show.publication_status === 'pending_review'
                    ? 'Your completed show is with the NexSq team for review.'
                    : show.publication_status === 'changes_requested'
                      ? 'Update the requested items, then submit the show again.'
                      : 'When your show details and at least one episode are ready, submit them to NexSq for publishing review.'}
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <span className="inline-flex rounded-full bg-purple-500/10 px-3 py-1 text-xs font-semibold capitalize text-purple-700 ring-1 ring-purple-500/20 dark:text-purple-300">
                  {show.publication_status.replace('_', ' ')}
                </span>
                {show.publication_review_notes && (
                  <p className="mt-2 text-sm text-muted-foreground">Admin note: {show.publication_review_notes}</p>
                )}
              </div>
              {isOwner && ['draft', 'changes_requested'].includes(show.publication_status) && (
                <Button type="button" onClick={() => void submitForPublication()} disabled={submittingForReview} className="shrink-0 gap-2 rounded-xl bg-gradient-to-br from-purple-600 to-fuchsia-500 font-semibold shadow-md shadow-purple-500/20">
                  {submittingForReview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {submittingForReview ? 'Submitting…' : show.publication_status === 'changes_requested' ? 'Resubmit for publishing' : 'Submit for publishing'}
                </Button>
              )}
            </CardContent>
          </Card>

          <form onSubmit={saveDetails}>
            <Card className="overflow-hidden rounded-3xl border-border/60 bg-card shadow-sm">
              <CardHeader className="border-b border-border/50 bg-gradient-to-r from-purple-500/[0.06] to-fuchsia-500/[0.03]">
                <CardTitle className="flex items-center gap-2 text-sm font-bold"><Sparkles className="h-4 w-4 text-purple-500" />Show synopsis and details</CardTitle>
                <p className="text-xs text-muted-foreground">Keep your show introduction current for viewers and promotions.</p>
              </CardHeader>
              <CardContent className="grid gap-4 p-5 sm:p-6">
                <label className="block space-y-1.5 text-xs font-semibold"><span className="text-muted-foreground">Show title</span><Input className="h-11 rounded-xl text-sm" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} required /></label>
                <label className="block space-y-1.5 text-xs font-semibold"><span className="text-muted-foreground">Synopsis</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1200} rows={4} required className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-purple-500/40" /></label>
                <label className="block space-y-1.5 text-xs font-semibold"><span className="text-muted-foreground">Category</span><Input className="h-11 rounded-xl text-sm" value={category} onChange={(event) => setCategory(event.target.value)} maxLength={80} required /></label>
                <div className="flex justify-end border-t border-border/50 pt-4"><Button type="submit" disabled={saving} className="gap-2 rounded-xl bg-gradient-to-br from-purple-600 to-fuchsia-500 font-semibold shadow-md shadow-purple-500/20 hover:from-purple-700 hover:to-fuchsia-600">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save details</Button></div>
              </CardContent>
            </Card>
          </form>
        </div>
      )}

      {section === 'episodes' && (
        <div className="space-y-5">
          <Card className="overflow-hidden rounded-3xl border-border/60 bg-card shadow-sm">
            <CardHeader className="border-b border-border/50 bg-gradient-to-r from-blue-500/[0.07] to-cyan-500/[0.03]">
              <CardTitle className="flex items-center gap-2 text-sm font-bold"><Upload className="h-4 w-4 text-blue-500" />Publish a new episode</CardTitle>
              <p className="text-xs text-muted-foreground">Add a video to your show library with its own title and artwork.</p>
            </CardHeader>
            <CardContent className="p-5 sm:p-6">
              <form onSubmit={uploadEpisode} className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-1.5 text-xs font-semibold md:col-span-2"><span className="text-muted-foreground">Episode title</span><Input className="h-11 rounded-xl text-sm" value={episodeTitle} onChange={(event) => setEpisodeTitle(event.target.value)} maxLength={120} placeholder="Give this episode a title" required /></label>
                <label className="block space-y-1.5 text-xs font-semibold md:col-span-2"><span className="text-muted-foreground">Description <span className="font-normal">(optional)</span></span><textarea value={episodeDescription} onChange={(event) => setEpisodeDescription(event.target.value)} rows={3} placeholder="What should viewers know about this episode?" className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/40" /></label>
                <EpisodeFileDropzone label="Episode video" hint="Video file · MP4, MOV, or WebM" accept="video/*" file={episodeVideo} icon={Video} onFileSelect={setEpisodeVideo} onInvalidFile={(file) => toast({ title: 'Choose a video file', description: `${file.name} is not a supported video.`, variant: 'destructive' })} />
                <EpisodeFileDropzone label="Episode artwork" hint="Optional image · JPG, PNG, or WebP" accept="image/*" file={episodeThumbnail} icon={ImagePlus} onFileSelect={setEpisodeThumbnail} onInvalidFile={(file) => toast({ title: 'Choose an image file', description: `${file.name} is not a supported image.`, variant: 'destructive' })} />
                <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-4 md:col-span-2">
                  <span className="min-w-0 truncate text-xs text-muted-foreground">{episodeVideo ? 'Video ready to upload' : 'Choose or drop a video to continue'}</span>
                  <Button type="submit" disabled={uploading || !episodeVideo} className="shrink-0 gap-2 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 font-semibold shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-cyan-600">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{uploading ? 'Uploading…' : 'Publish episode'}</Button>
                </div>
              </form>
            </CardContent>
          </Card>
          <Card className="overflow-hidden rounded-3xl border-border/60 bg-card shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/50">
              <div><CardTitle className="text-sm font-bold">Your episodes</CardTitle><p className="mt-1 text-xs text-muted-foreground">Manage the videos published under this show.</p></div>
              <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-bold tabular-nums text-blue-700 ring-1 ring-blue-500/20 dark:text-blue-300">{episodes.length} {episodes.length === 1 ? 'episode' : 'episodes'}</span>
            </CardHeader>
            <CardContent className="space-y-3 p-4 sm:p-5">
              {episodes.length === 0 ? (
                <div className="relative overflow-hidden rounded-2xl border border-dashed border-blue-500/25 bg-gradient-to-br from-blue-500/[0.06] via-background to-cyan-500/[0.05] px-5 py-10 text-center">
                  <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600/15 to-cyan-500/15 text-blue-600 ring-1 ring-blue-500/20 dark:text-blue-300"><Video className="h-5 w-5" /></span>
                  <p className="text-sm font-semibold">Your first episode starts here</p>
                  <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">Upload a show video above and it will appear in this episode list and library.</p>
                </div>
              ) : episodes.map((episode, index) => (
                <article key={episode.id} className="group flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-background/50 p-3 transition-colors hover:border-blue-500/30 hover:bg-blue-500/[0.025] sm:gap-4">
                  <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-blue-600/20 to-cyan-500/20">
                    {episode.thumbnail_url ? <img src={episode.thumbnail_url} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" /> : <span className="flex h-full w-full items-center justify-center text-blue-600 dark:text-blue-300"><Video className="h-6 w-6" /></span>}
                    <span className="absolute bottom-1 left-1 rounded-md bg-black/65 px-1.5 py-0.5 text-[9px] font-bold text-white">EP {String(episodes.length - index).padStart(2, '0')}</span>
                  </div>
                  <div className="min-w-0 flex-1 py-1"><h3 className="truncate text-sm font-semibold">{episode.title}</h3><p className="mt-1 text-xs text-muted-foreground">Added {new Date(episode.created_at).toLocaleDateString()}</p></div>
                  <div className="ml-auto flex items-center gap-1">
                    {episode.video_url && <a className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-500/10 dark:text-blue-300" href={episode.video_url} target="_blank" rel="noreferrer"><Video className="h-3.5 w-3.5" />Preview</a>}
                    <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${episode.title}`} onClick={() => void removeEpisode(episode.id)} className="h-9 w-9 rounded-xl text-muted-foreground hover:bg-red-500/10 hover:text-red-600"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </article>
              ))}
            </CardContent>
          </Card>
          <section aria-labelledby="episode-library-heading" className="space-y-3"><h2 id="episode-library-heading" className="text-lg font-semibold">Episode library preview</h2><VODLibrary key={episodeListVersion} showId={showId} defaultViewMode="grid" /></section>
        </div>
      )}

      {section === 'branding' && (
        <form onSubmit={saveDetails} className="space-y-4">
          <Card className="overflow-hidden rounded-3xl border-border/60 bg-card shadow-sm">
            <CardHeader><CardTitle className="flex items-center gap-2 text-sm font-bold"><ImagePlus className="h-5 w-5 text-pink-500" /> Show artwork</CardTitle></CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-2">
              {ARTWORK_FIELDS.map(({ field, label, hint, aspect, contain }) => (
                <ArtworkDropzone
                  key={field}
                  label={label}
                  hint={hint}
                  aspect={aspect}
                  imageUrl={show[field]}
                  file={artwork[field]}
                  contain={contain}
                  onFileSelect={(file) => updateArtworkFile(field, file)}
                />
              ))}
            </CardContent>
          </Card>
          <Card className="overflow-hidden rounded-3xl border-border/60 bg-card shadow-sm"><CardHeader><CardTitle className="text-sm font-bold">Brand color</CardTitle></CardHeader><CardContent className="flex items-center gap-3"><Input type="color" value={brandColor} onChange={(event) => setBrandColor(event.target.value)} className="h-12 w-16 rounded-xl p-1" aria-label="Show brand color" /><span className="text-sm text-muted-foreground">{brandColor}</span></CardContent></Card>
          <Button type="submit" disabled={saving} className="gap-2 rounded-xl bg-gradient-to-br from-pink-600 to-rose-500 font-semibold shadow-md shadow-pink-500/20 hover:from-pink-700 hover:to-rose-600">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save artwork and branding</Button>
        </form>
      )}

      {section === 'managers' && (
        <div className="space-y-4">
          {isOwner && <Card className="overflow-visible rounded-3xl border-border/60 bg-card shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-sm font-bold"><UserPlus className="h-5 w-5 text-emerald-500" /> Add a show manager</CardTitle></CardHeader><CardContent><form onSubmit={addManager} className="flex flex-col gap-3 sm:flex-row"><div className="relative min-w-0 flex-1"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="h-11 rounded-xl pl-9" value={managerUsername} onFocus={() => setManagerSearchOpen(true)} onChange={(event) => { setManagerUsername(event.target.value); setSelectedManager(null); setManagerSearchOpen(true); }} placeholder="Search by name or username" aria-label="Search NexSq users" autoComplete="off" required />{selectedManager && <Check className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />}</div>{managerSearchOpen && managerUsername.trim().replace(/^@/, '').length >= 2 && !selectedManager && <div className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-border/70 bg-popover p-1.5 shadow-xl">{searchingManagers ? <p className="px-3 py-4 text-center text-xs text-muted-foreground">Searching NexSq profiles…</p> : managerMatches.length ? managerMatches.map((profile) => <button key={profile.id} type="button" onClick={() => { setSelectedManager(profile); setManagerUsername(profile.username); setManagerSearchOpen(false); setManagerMatches([]); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-muted"><span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-sm font-semibold text-emerald-700 dark:text-emerald-300">{profile.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : profile.username?.[0]?.toUpperCase() || 'N'}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{[profile.first_name, profile.last_name].filter(Boolean).join(' ') || `@${profile.username}`}</span><span className="block truncate text-xs text-muted-foreground">@{profile.username}</span></span><UserPlus className="h-4 w-4 shrink-0 text-muted-foreground" /></button>) : <p className="px-3 py-4 text-center text-xs text-muted-foreground">No matching NexSq profiles found.</p>}</div>}</div><Button type="submit" disabled={!selectedManager} className="gap-2 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 font-semibold shadow-md shadow-emerald-500/20 hover:from-emerald-700 hover:to-teal-600 disabled:opacity-50"><UserPlus className="h-4 w-4" />Add manager</Button></form><p className="mt-2 text-xs text-muted-foreground">Search for a registered profile and select the person you want to add.</p></CardContent></Card>}
          <Card className="overflow-hidden rounded-3xl border-border/60 bg-card shadow-sm"><CardHeader><CardTitle className="text-sm font-bold">Show managers</CardTitle></CardHeader><CardContent className="space-y-3">{managers.length === 0 ? <p className="rounded-2xl border border-dashed border-border/60 py-8 text-center text-sm text-muted-foreground">No additional managers yet.</p> : managers.map((manager) => <div key={manager.manager_id} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/40 p-3">{manager.avatar_url ? <img src={manager.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">{manager.username?.[0]?.toUpperCase() || 'N'}</span>}<div className="min-w-0 flex-1"><p className="font-medium">@{manager.username}</p><p className="text-xs text-muted-foreground">Manager</p></div>{isOwner && <Button type="button" size="icon" variant="ghost" aria-label={`Remove @${manager.username}`} onClick={() => void removeManager(manager.manager_id)}><Trash2 className="h-4 w-4" /></Button>}</div>)}</CardContent></Card>
        </div>
      )}
    </div>
  );
};

export default StudioShowManagement;