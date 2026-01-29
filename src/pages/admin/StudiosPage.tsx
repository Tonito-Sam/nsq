import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useToast } from '../../hooks/use-toast';
import { supabase } from '../../integrations/supabase/client';
import apiUrl from '@/lib/api';
import EpisodeCalendar from '../../components/EpisodeCalendar';
import EpisodeDragDropList from '../../components/EpisodeDragDropList';
import { Input } from '../../components/ui/input';
import ScheduleGridView, { ProgramSchedule } from '../../components/ScheduleGridView';
import generateEpisodesForShow from '../../lib/scheduleGenerator';
import { getCategoryColor } from '../../lib/scheduleUtils';

const defaultShow = {
  title: '',
  description: '',
  video_type: 'url',
  video_url: '',
  video_file: null,
  live_url: '',
  show_type: 'show',
  thumbnail_type: 'url',
  thumbnail_url: '',
  thumbnail_file: null,
  duration: '',
  scheduled_time: '',
  end_time: '',
  is_live: false,
  is_active: true,
  // Ad scheduling fields
  is_ad: false,
  ad_interval_minutes: 30,
  ad_duration_seconds: 60,
  ad_start_at: null,
  ad_end_at: null,
  ad_placement: 'between_shows',
  created_by: '',
  auto_generate_days: 7,
};

const defaultEpisode = {
  title: '',
  description: '',
  video_type: 'url',
  video_url: '',
  video_file: null,
  thumbnail_type: 'url',
  thumbnail_url: '',
  thumbnail_file: null,
  duration: '',
  scheduled_time: '',
  end_time: '',
  is_active: true,
  show_id: null,
};

// ScheduleGridView, VODLibrary and schedule generator are imported from separate modules

const StudiosPage = () => {
  const [shows, setShows] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingShow, setEditingShow] = useState<any | null>(null);
  const [form, setForm] = useState<any>(defaultShow);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [userPrivilege, setUserPrivilege] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Episode management state
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [calendarEpisodes, setCalendarEpisodes] = useState<any[]>([]);
  const [editingEpisode, setEditingEpisode] = useState<any | null>(null);
  const [selectedEpisodeIds, setSelectedEpisodeIds] = useState<any[]>([]);
  const [currentEpisodeShowId, setCurrentEpisodeShowId] = useState<number | null>(null);
  const [newEpisodeForm, setNewEpisodeForm] = useState<any>(defaultEpisode);
  const [showEpisodePage, setShowEpisodePage] = useState(false);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  // Add state for multistep form and staged episodes
  const [showStep, setShowStep] = useState(12);
  const [stagedEpisodes, setStagedEpisodes] = useState<any[]>([]);
  const [stagedEpisodeForm, setStagedEpisodeForm] = useState<any>(defaultEpisode);
  const [stagedEpisodeIdx, setStagedEpisodeIdx] = useState<number | null>(null);
  
  // Schedule / Channel state
  const [currentSchedule, setCurrentSchedule] = useState<ProgramSchedule[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'grid' | 'calendar'>('grid');
  const [nowPlaying, setNowPlaying] = useState<ProgramSchedule | null>(null);

  useEffect(() => {
    const initializeUser = async () => {
      try {
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          console.log('No authenticated user found');
          setIsAuthenticated(false);
          return;
        }

        console.log('User found:', user.id);
        setUserId(user.id);
        setIsAuthenticated(true);

        // Check if user exists in users table
        const { data: existingUser, error: fetchError } = await supabase
          .from('users')
          .select('id, privilege')
          .eq('id', user.id)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          console.error('Error fetching user:', fetchError);
          return;
        }

        if (!existingUser) {
          console.log('User not found in users table, creating...');
          // Create user in users table with admin privilege
          const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert([{
              id: user.id,
              email: user.email,
              privilege: 'admin',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }])
            .select()
            .single();

          if (insertError) {
            console.error('Error creating user:', insertError);
            toast({ 
              title: 'Error', 
              description: 'Failed to initialize user. Please try refreshing the page.', 
              variant: 'destructive' 
            });
            return;
          }

          console.log('User created successfully:', newUser);
          setUserPrivilege('admin');
        } else {
          console.log('User found with privilege:', existingUser.privilege);
          setUserPrivilege(existingUser.privilege);
        }

      } catch (error) {
        console.error('Error initializing user:', error);
        toast({ 
          title: 'Error', 
          description: 'Failed to initialize user session.', 
          variant: 'destructive' 
        });
      }
    };

    initializeUser();
  }, [toast]);

  const fetchShows = async () => {
    if (!isAuthenticated) return;
    
    const { data, error } = await supabase
      .from('studio_shows')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching shows:', error);
      toast({ title: 'Error', description: 'Failed to fetch shows', variant: 'destructive' });
      return;
    }
    setShows(data || []);
  };

  const fetchEpisodes = async (showId: number) => {
    setLoadingEpisodes(true);
    try {
      const { data, error } = await supabase
        .from('studio_episodes')
        .select('*')
        .eq('show_id', showId)
        .order('scheduled_time', { ascending: true });

      if (error) {
        console.error('Error fetching episodes:', error);
        toast({ 
          title: 'Error', 
          description: 'Failed to fetch episodes', 
          variant: 'destructive' 
        });
        return;
      }
      
      console.log(`Fetched ${data?.length || 0} episodes for show ${showId}`);
      setEpisodes(data || []);
      
    } catch (error) {
      console.error('Error in fetchEpisodes:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to fetch episodes', 
        variant: 'destructive' 
      });
    } finally {
      setLoadingEpisodes(false);
    }
  };

  const fetchCalendarEpisodes = async () => {
    try {
      const { data } = await supabase
        .from('studio_episodes')
        .select('*')
        .order('scheduled_time', { ascending: true })
        .limit(100);
      setCalendarEpisodes(data || []);
    } catch (e) {
      console.error('Failed to fetch calendar episodes', e);
    }
  };

  useEffect(() => {
    if (isAuthenticated && userPrivilege) {
      fetchShows();
    }
  }, [isAuthenticated, userPrivilege]);

  // Parse days_of_week which might be stored as array or JSON string
  const parseDays = (val: any): string[] | undefined => {
    if (!val) return undefined;
    if (Array.isArray(val)) return val.map((d: string) => d.toLowerCase());
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.map((d: string) => d.toLowerCase());
    } catch (e) {
      // not JSON
    }
    if (typeof val === 'string') return val.split(',').map(s => s.trim().toLowerCase());
    return undefined;
  };

  const toHHMM = (dateStr?: string) => {
    if (!dateStr) return '00:00';
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
    } catch (e) {}
    // If already an HH:MM
    if (dateStr.indexOf('T') === -1 && dateStr.indexOf(':') !== -1) return dateStr.substring(0,5);
    return '00:00';
  };

  const generateSchedule = async (date: Date) => {
    if (!isAuthenticated) return;
    try {
      const { data: showsData } = await supabase.from('studio_shows').select('*').eq('is_active', true);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const schedule: ProgramSchedule[] = [];
      (showsData || []).forEach((show: any) => {
        const days = parseDays(show.days_of_week) || [];
        const pattern = (show.schedule_pattern || '').toLowerCase();
        const start = show.time_slot_start ? show.time_slot_start : toHHMM(show.scheduled_time);
        const end = show.time_slot_end ? show.time_slot_end : toHHMM(show.end_time);

        const airsToday = pattern === 'daily' || days.includes(dayName) || (!pattern && (!show.days_of_week && show.scheduled_time && new Date(show.scheduled_time).toDateString() === date.toDateString()));
        if (airsToday) {
          schedule.push({
            id: show.id,
            title: show.title,
            description: show.description,
            category: show.category,
            time_slot_start: start,
            time_slot_end: end,
            days_of_week: days,
            is_live: !!show.is_live,
            is_rerun: !!show.is_rerun,
            color_code: getCategoryColor(show.category),
            show_id: show.id,
          });
        }
      });
      schedule.sort((a,b) => a.time_slot_start.localeCompare(b.time_slot_start));
      setCurrentSchedule(schedule);
    } catch (err) {
      console.error('Error generating schedule', err);
    }
  };

  const updateNowPlaying = () => {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
    const playing = currentSchedule.find(p => p.time_slot_start <= currentTime && p.time_slot_end > currentTime) || null;
    setNowPlaying(playing);
  };

  useEffect(() => {
    generateSchedule(selectedDate);
    const interval = setInterval(updateNowPlaying, 60_000);
    // run once immediately
    updateNowPlaying();
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, isAuthenticated]);

  useEffect(() => {
    if (viewMode === 'calendar') fetchCalendarEpisodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  // --- Show CRUD logic (update for multistep) ---
  const handleOpenModal = (show?: any) => {
    if (show) {
      setEditingShow(show);
      setForm(show);
      supabase
        .from('studio_episodes')
        .select('*')
        .eq('show_id', show.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => setStagedEpisodes(data || []));
    } else {
      setEditingShow(null);
      setForm(defaultShow);
      setStagedEpisodes([]);
    }
    setShowStep(1);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingShow(null);
    setForm(defaultShow);
    setStagedEpisodes([]);
    setShowStep(1);
  };

  // --- Inline episode add/edit for stagedEpisodes ---
  const handleStagedEpisodeFormChange = (e: any) => {
    const { name, value, type, checked, files } = e.target;
    if (type === 'checkbox') {
      setStagedEpisodeForm((f: any) => ({ ...f, [name]: checked }));
    } else if (type === 'file') {
      setStagedEpisodeForm((f: any) => ({ ...f, [name]: files[0] }));
    } else {
      setStagedEpisodeForm((f: any) => ({ ...f, [name]: value }));
    }
  };

  const handleAddOrUpdateStagedEpisode = () => {
    if (stagedEpisodeIdx !== null) {
      setStagedEpisodes((eps) => eps.map((ep, i) => (i === stagedEpisodeIdx ? { ...stagedEpisodeForm } : ep)));
    } else {
      setStagedEpisodes((eps) => [...eps, { ...stagedEpisodeForm }]);
    }
    setStagedEpisodeForm(defaultEpisode);
    setStagedEpisodeIdx(null);
  };

  const handleEditStagedEpisode = (idx: number) => {
    setStagedEpisodeForm(stagedEpisodes[idx]);
    setStagedEpisodeIdx(idx);
  };

  const handleDeleteStagedEpisode = (idx: number) => {
    setStagedEpisodes((eps) => eps.filter((_, i) => i !== idx));
    if (stagedEpisodeIdx === idx) {
      setStagedEpisodeForm(defaultEpisode);
      setStagedEpisodeIdx(null);
    }
  };

  // --- Multistep show form submit ---
  const handleSubmit = async (e: any) => {
    e.preventDefault();
    
    if (!userId || !userPrivilege) {
      toast({ 
        title: 'Error', 
        description: 'User not properly authenticated. Please refresh the page.', 
        variant: 'destructive' 
      });
      return;
    }

    if (!['admin', 'superadmin'].includes(userPrivilege)) {
      toast({ 
        title: 'Error', 
        description: 'You do not have permission to create or edit shows.', 
        variant: 'destructive' 
      });
      return;
    }

    setUploading(true);
    try {
      let video_url = form.video_url;
      let thumbnail_url = form.thumbnail_url;
      
      if (form.video_type === 'upload' && form.video_file) {
        video_url = await uploadToStorage(form.video_file, 'videos');
      }
      if (form.thumbnail_type === 'upload' && form.thumbnail_file) {
        thumbnail_url = await uploadToStorage(form.thumbnail_file, 'thumbnails');
      }
      
      const showData = {
        title: form.title,
        description: form.description,
        video_url,
        thumbnail_url,
        duration: form.duration,
        scheduled_time: form.scheduled_time || null,
        end_time: form.end_time || null,
        schedule_pattern: form.schedule_pattern || null,
        time_slot_start: form.time_slot_start || null,
        time_slot_end: form.time_slot_end || null,
        days_of_week: Array.isArray(form.days_of_week) ? form.days_of_week.join(',') : form.days_of_week || null,
        category: form.category || null,
        is_live: form.is_live || !!form.live_url,
        live_url: form.live_url || null,
        // Ad fields
        is_ad: !!form.is_ad,
        ad_interval_minutes: form.ad_interval_minutes ? Number(form.ad_interval_minutes) : null,
        ad_duration_seconds: form.ad_duration_seconds ? Number(form.ad_duration_seconds) : null,
        ad_start_at: form.ad_start_at || null,
        ad_end_at: form.ad_end_at || null,
        ad_placement: form.ad_placement || 'between_shows',
        show_type: form.show_type || 'show',
        is_active: form.is_active,
        created_by: userId,
        created_at: editingShow ? editingShow.created_at : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      console.log('Attempting to save show data:', showData);
      
      // Create or update the show record
      let showId = editingShow ? editingShow.id : null;
      let error;
      if (editingShow) {
        const { error: updateError } = await supabase
          .from('studio_shows')
          .update(showData)
          .eq('id', editingShow.id);
        error = updateError;
      } else {
        const { data, error: insertError } = await supabase
          .from('studio_shows')
          .insert([showData])
          .select();
        error = insertError;
        if (data && data[0]) showId = data[0].id;
      }
      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      // If staged episodes exist (rare), insert them for the created/updated show
      if (showId && stagedEpisodes.length > 0) {
        if (editingShow) {
          await supabase.from('studio_episodes').delete().eq('show_id', showId);
        }
        for (let ep of stagedEpisodes) {
          let epVideoUrl = ep.video_url;
          let epThumbUrl = ep.thumbnail_url;
          if (ep.video_type === 'upload' && ep.video_file) {
            epVideoUrl = await uploadToStorage(ep.video_file, 'episodes/videos');
          }
          if (ep.thumbnail_type === 'upload' && ep.thumbnail_file) {
            epThumbUrl = await uploadToStorage(ep.thumbnail_file, 'episodes/thumbnails');
          }
          const episodeData = {
            ...ep,
            video_url: epVideoUrl,
            thumbnail_url: epThumbUrl,
            show_id: showId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          const { error: episodeError } = await supabase
            .from('studio_episodes')
            .insert(episodeData);
          if (episodeError) console.error('Episode insert error:', episodeError);
        }
      }

      // Auto-generate recurring episodes for next 7 days if schedule data provided
      try {
        const daysToGen = Number(form.auto_generate_days || 7);
        if (showId && daysToGen > 0 && (form.schedule_pattern || form.time_slot_start || form.days_of_week)) {
          await generateEpisodesForShow(showId, {
            title: form.title,
            schedule_pattern: form.schedule_pattern,
            time_slot_start: form.time_slot_start || form.scheduled_time?.substring(11,16),
            time_slot_end: form.time_slot_end || form.end_time?.substring(11,16),
            days_of_week: form.days_of_week,
            is_vod_available: true,
          }, daysToGen);
        }
      } catch (err) {
        console.error('Auto-generate episodes error:', err);
      }
      
      toast({ title: 'Success', description: 'Show and episodes saved successfully.' });
      setShowModal(false);
      setForm(defaultShow);
      setStagedEpisodes([]);
      fetchShows();
    } catch (err: any) {
      console.error('Save error:', err);
      toast({ 
        title: 'Error', 
        description: err.message || 'Failed to save show. Please try again.', 
        variant: 'destructive' 
      });
    } finally {
      setUploading(false);
    }
  };

  const uploadToStorage = async (file: File, folder: string) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    const { error } = await supabase.storage.from('studio-media').upload(fileName, file, { upsert: true });
    if (error) throw error;
    const { publicUrl } = supabase.storage.from('studio-media').getPublicUrl(fileName).data;
    return publicUrl;
  };

  // Show form field handler
  const handleFormChange = (e: any) => {
    const { name, value, type, checked, files } = e.target;
    if (type === 'checkbox') {
      setForm((f: any) => ({ ...f, [name]: checked }));
    } else if (type === 'file') {
      setForm((f: any) => ({ ...f, [name]: files[0] }));
    } else {
      setForm((f: any) => ({ ...f, [name]: value }));
    }
  };

  // Toggle a day in the days_of_week field (stored as array in form)
  const handleDaysToggle = (day: string) => {
    setForm((f: any) => {
      const existing = Array.isArray(f.days_of_week) ? f.days_of_week : (f.days_of_week ? String(f.days_of_week).split(',').map((s: string) => s.trim()) : []);
      const lowered = day.toLowerCase();
      const found = existing.map((d: string) => d.toLowerCase()).indexOf(lowered) !== -1;
      let next;
      if (found) {
        next = existing.filter((d: string) => d.toLowerCase() !== lowered);
      } else {
        next = [...existing, day];
      }
      return { ...f, days_of_week: next };
    });
  };

  // Delete show handler
  const handleDeleteShow = async (showId: number) => {
    if (!window.confirm('Are you sure you want to delete this show?')) return;
    setUploading(true);
    try {
      await supabase.from('studio_shows').delete().eq('id', showId);
      await supabase.from('studio_episodes').delete().eq('show_id', showId);
      toast({ title: 'Show deleted' });
      fetchShows();
    } catch (err: any) {
      console.error('Delete error:', err);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  // Open episode management page
  const handleOpenEpisodeModal = (showId: number) => {
    console.log('Opening episodes for show', showId);
    setCurrentEpisodeShowId(showId);
    setShowEpisodePage(true);
    fetchEpisodes(showId);
  };

  const episodePanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (showEpisodePage && episodePanelRef.current) {
      try { episodePanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    }
  }, [showEpisodePage]);

  // Close episode management page
  const handleCloseEpisodeModal = () => {
    setShowEpisodePage(false);
    setEditingEpisode(null);
    setSelectedEpisodeIds([]);
    setCurrentEpisodeShowId(null);
    setNewEpisodeForm(defaultEpisode);
  };

  const handleSelectEpisode = (id: string | number) => {
    setSelectedEpisodeIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Delete single episode
  const handleDeleteEpisode = async (id: string | number) => {
    if (!window.confirm('Delete this episode?')) return;
    try {
      const { error } = await supabase
        .from('studio_episodes')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }
      
      toast({ title: 'Success', description: 'Episode deleted successfully' });
      
      // Refresh episodes list
      if (currentEpisodeShowId) {
        fetchEpisodes(currentEpisodeShowId);
      }
      // Also refresh calendar view if in use
      fetchCalendarEpisodes();
    } catch (err: any) {
      console.error('Delete episode error', err);
      toast({ 
        title: 'Error', 
        description: err.message || 'Failed to delete episode', 
        variant: 'destructive' 
      });
    }
  };

  // Bulk delete episodes
  const handleBulkDelete = async () => {
    if (selectedEpisodeIds.length === 0) return;
    
    if (!window.confirm(`Delete ${selectedEpisodeIds.length} selected episodes?`)) return;
    
    try {
      const { error } = await supabase
        .from('studio_episodes')
        .delete()
        .in('id', selectedEpisodeIds);

      if (error) throw error;

      toast({ 
        title: 'Success', 
        description: `${selectedEpisodeIds.length} episode(s) deleted successfully` 
      });
      
      // Clear selection and refresh data
      setSelectedEpisodeIds([]);
      
      if (currentEpisodeShowId) {
        fetchEpisodes(currentEpisodeShowId);
      }
      
      // Also refresh calendar view if in use
      fetchCalendarEpisodes();
      
    } catch (err: any) {
      console.error('Bulk delete error', err);
      toast({ 
        title: 'Error', 
        description: err.message || 'Failed to delete episodes', 
        variant: 'destructive' 
      });
    }
  };

  // Edit episode
  const handleEditEpisode = (ep: any) => {
    setEditingEpisode(ep);
    setNewEpisodeForm({ 
      ...defaultEpisode,
      ...ep,
      video_type: ep.video_url && ep.video_url.startsWith('http') ? 'url' : 'upload',
      thumbnail_type: ep.thumbnail_url && ep.thumbnail_url.startsWith('http') ? 'url' : 'upload'
    });
    // ensure the episode manager page is visible when editing
    if (ep && (ep.show_id || ep.showId)) {
      setCurrentEpisodeShowId(ep.show_id || ep.showId || null);
    }
    setShowEpisodePage(true);
  };

  // Handle new episode form changes
  const handleNewEpisodeChange = (e: any) => {
    const { name, value, type, files, checked } = e.target;
    if (type === 'file') {
      setNewEpisodeForm((f:any) => ({ 
        ...f, 
        [name]: files[0],
        // Clear URL when file is selected
        ...(name === 'video_file' && { video_url: '' }),
        ...(name === 'thumbnail_file' && { thumbnail_url: '' })
      }));
    } else if (type === 'checkbox') {
      setNewEpisodeForm((f:any) => ({ ...f, [name]: checked }));
    } else if (name === 'video_type' || name === 'thumbnail_type') {
      setNewEpisodeForm((f:any) => ({ 
        ...f, 
        [name]: value,
        // Clear file when switching to URL
        ...(name === 'video_type' && value === 'url' && { video_file: null }),
        ...(name === 'thumbnail_type' && value === 'url' && { thumbnail_file: null })
      }));
    } else {
      setNewEpisodeForm((f:any) => ({ ...f, [name]: value }));
    }
  };

  // Validate episode form
  const validateEpisodeForm = () => {
    if (!newEpisodeForm.title?.trim()) {
      toast({ title: 'Error', description: 'Episode title is required', variant: 'destructive' });
      return false;
    }
    if (newEpisodeForm.video_type === 'url' && !newEpisodeForm.video_url?.trim()) {
      toast({ title: 'Error', description: 'Video URL is required', variant: 'destructive' });
      return false;
    }
    if (newEpisodeForm.video_type === 'upload' && !newEpisodeForm.video_file) {
      toast({ title: 'Error', description: 'Video file is required', variant: 'destructive' });
      return false;
    }
    return true;
  };

  // Save or update episode
  const handleSaveEpisode = async () => {
    if (!currentEpisodeShowId) {
      toast({ 
        title: 'Error', 
        description: 'No show selected for episode', 
        variant: 'destructive' 
      });
      return;
    }

    if (!validateEpisodeForm()) {
      return;
    }

    try {
      const payload: any = {
        title: newEpisodeForm.title,
        description: newEpisodeForm.description || '',
        duration: newEpisodeForm.duration || '0',
        scheduled_time: newEpisodeForm.scheduled_time || null,
        end_time: newEpisodeForm.end_time || null,
        is_active: newEpisodeForm.is_active !== undefined ? newEpisodeForm.is_active : true,
        show_id: currentEpisodeShowId,
        updated_at: new Date().toISOString(),
      };

      // Handle video upload/URL
      if (newEpisodeForm.video_type === 'upload' && newEpisodeForm.video_file) {
        try {
          payload.video_url = await uploadToStorage(newEpisodeForm.video_file, 'episodes/videos');
        } catch (e) {
          console.warn('Video upload failed', e);
          toast({ 
            title: 'Warning', 
            description: 'Video upload failed', 
            variant: 'destructive' 
          });
          return;
        }
      } else if (newEpisodeForm.video_type === 'url' && newEpisodeForm.video_url) {
        payload.video_url = newEpisodeForm.video_url;
      }

      // Handle thumbnail upload/URL
      if (newEpisodeForm.thumbnail_type === 'upload' && newEpisodeForm.thumbnail_file) {
        try {
          payload.thumbnail_url = await uploadToStorage(newEpisodeForm.thumbnail_file, 'episodes/thumbnails');
        } catch (e) {
          console.warn('Thumbnail upload failed', e);
          // Continue without thumbnail if upload fails
          payload.thumbnail_url = '';
        }
      } else if (newEpisodeForm.thumbnail_type === 'url' && newEpisodeForm.thumbnail_url) {
        payload.thumbnail_url = newEpisodeForm.thumbnail_url;
      }

      let result;
      
      if (editingEpisode) {
        // Update existing episode
        const { data, error } = await supabase
          .from('studio_episodes')
          .update(payload)
          .eq('id', editingEpisode.id)
          .select();

        if (error) throw error;
        result = data?.[0];
        toast({ title: 'Success', description: 'Episode updated successfully' });
      } else {
        // Create new episode
        payload.created_at = new Date().toISOString();
        payload.created_by = userId;
        
        const { data, error } = await supabase
          .from('studio_episodes')
          .insert([payload])
          .select();

        if (error) throw error;
        result = data?.[0];
        toast({ title: 'Success', description: 'Episode created successfully' });
      }

      // Reset form and refresh data
      setNewEpisodeForm(defaultEpisode);
      setEditingEpisode(null);
      
      // Refresh episodes list
      if (currentEpisodeShowId) {
        fetchEpisodes(currentEpisodeShowId);
      }
      // Also refresh calendar view
      fetchCalendarEpisodes();

    } catch (err: any) {
      console.error('Save episode error', err);
      toast({ 
        title: 'Error', 
        description: err.message || 'Failed to save episode', 
        variant: 'destructive' 
      });
    }
  };

  // Show loading or authentication message
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 text-center">
          <CardContent>
            <p>Loading or authenticating...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      {/* Tabs UI */}
      <div className="mb-6">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {['Studio Manager', 'Schedule Guide', 'Show Insights'].map((tab, i) => (
            <button
              key={tab}
              className={`px-6 py-3 font-semibold focus:outline-none transition-colors duration-200 ${showStep === i + 12 ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-500 hover:text-purple-600'}`}
              onClick={() => setShowStep(i + 12)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Channel Schedule (Live / Grid / VOD) */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Channel Schedule</CardTitle>
          <div className="flex gap-4">
            <Button 
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              onClick={() => setViewMode('grid')}
            >
              Grid View
            </Button>
            <Button 
              variant={viewMode === 'calendar' ? 'default' : 'outline'}
              onClick={() => setViewMode('calendar')}
            >
              Calendar
            </Button>
            <Button 
              variant="outline"
              onClick={() => setSelectedDate(new Date())}
            >
              Today
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Live Now Banner */}
          {nowPlaying && (
            <Card className="bg-gradient-to-r from-purple-600 to-blue-600 text-white mb-4">
              <CardContent className="py-3">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="animate-pulse bg-red-500 rounded-full w-3 h-3"></span>
                      <span className="text-sm font-semibold">LIVE NOW</span>
                    </div>
                    <h3 className="text-xl font-bold">{nowPlaying.title}</h3>
                    <p className="text-sm opacity-90">{nowPlaying.time_slot_start} - {nowPlaying.time_slot_end}</p>
                  </div>
                  <Button variant="secondary" className="bg-white text-purple-600">Watch Live</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {viewMode === 'grid' ? (
            <ScheduleGridView schedule={currentSchedule} date={selectedDate} onDateChange={setSelectedDate} />
          ) : (
            <div>
                <EpisodeCalendar
                episodes={calendarEpisodes}
                onEventDrop={(info: any) => { console.log('Event drop', info); toast({ title: 'Not implemented', description: 'Drag & drop scheduling is not enabled in this preview.' }); }}
                onEventClick={(info: any) => { 
                  const ep = info.event.extendedProps?.episode; 
                  if (ep) { 
                    handleEditEpisode(ep); 
                  } 
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tab Panels */}
      {showStep === 14 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Show Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-8">
              <div>
                <div className="text-2xl font-bold">{shows.length}</div>
                <div className="text-xs text-gray-500">Total Shows</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{shows.filter(s => s.is_active).length}</div>
                <div className="text-xs text-gray-500">Active</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{shows.filter(s => !s.is_active).length}</div>
                <div className="text-xs text-gray-500">Inactive</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{shows.filter(s => new Date(s.scheduled_time) > new Date()).length}</div>
                <div className="text-xs text-gray-500">Upcoming</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {showStep === 13 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Schedule Guide</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800">
                    <th className="px-2 py-1 text-left">Show</th>
                    <th className="px-2 py-1 text-left">Start Time</th>
                    <th className="px-2 py-1 text-left">End Time</th>
                  </tr>
                </thead>
                <tbody>
                  {shows.length === 0 ? (
                    <tr><td colSpan={3} className="text-center py-4 text-gray-400">No scheduled shows</td></tr>
                  ) : (
                    [...shows]
                      .sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime())
                      .map((show, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="px-2 py-1 font-semibold">{show.title}</td>
                          <td className="px-2 py-1">{show.scheduled_time}</td>
                          <td className="px-2 py-1">{show.end_time}</td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {showStep === 12 && (
        <Card className="mb-6">
          <CardContent>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h1 className="text-2xl font-bold">Studio Manager</h1>
                <p className="text-gray-600">User: {userId} | Privilege: {userPrivilege}</p>
              </div>
              <Button 
                onClick={() => handleOpenModal()}
                disabled={!['admin', 'superadmin'].includes(userPrivilege || '')}
              >
                Add TV Show
              </Button>
            </div>
            {!['admin', 'superadmin'].includes(userPrivilege || '') && (
              <Card className="mb-4 border-yellow-200 bg-yellow-50">
                <CardContent className="pt-4">
                  <p className="text-yellow-800">
                    You have {userPrivilege} privileges. Only admin and superadmin users can create or edit shows.
                  </p>
                </CardContent>
              </Card>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {shows.length === 0 ? (
                <p className="text-gray-500 col-span-full text-center py-8">No shows added yet.</p>
              ) : (
                shows.map((show, idx) => (
                  <Card key={idx} className="shadow border-0">
                    <CardHeader>
                      <div className="flex items-center gap-4">
                        <div className="w-40 h-32 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                          {show.thumbnail_url ? (
                            <img src={show.thumbnail_url} alt={show.title + ' preview'} className="object-cover w-full h-full" />
                          ) : (
                            <span className="text-gray-400 text-xs">No Image</span>
                          )}
                        </div>
                        <div>
                          <CardTitle className="text-lg font-bold">{show.title}</CardTitle>
                          <div className="text-xs text-gray-500">{show.scheduled_time} - {show.end_time}</div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-2">{show.description}</div>
                      {show.show_type === 'event' && (
                        <div className="mb-2">
                          <span className="inline-flex items-center gap-2 bg-indigo-600 text-white px-2 py-1 rounded text-xs">EVENT</span>
                        </div>
                      )}
                      {show.video_url && (
                        <div className="mb-2">
                          <a href={show.video_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Watch Video</a>
                        </div>
                      )}
                      {(show.live_url || show.is_live) && (
                        <div className="mb-2 flex items-center gap-2">
                          <span className="inline-flex items-center gap-2 bg-red-600 text-white px-2 py-1 rounded text-xs">LIVE</span>
                          {show.live_url && (
                            <a href={show.live_url} target="_blank" rel="noopener noreferrer" className="text-white bg-red-500 px-3 py-1 rounded text-sm">Watch Live</a>
                          )}
                        </div>
                      )}
                      <div className="flex gap-2 mb-2">
                        <Button size="sm" onClick={() => handleOpenModal(show)} disabled={!['admin', 'superadmin'].includes(userPrivilege || '')}>Edit</Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDeleteShow(show.id)} disabled={!['admin', 'superadmin'].includes(userPrivilege || '')}>Delete</Button>
                        <Button size="sm" variant="outline" onClick={() => handleOpenEpisodeModal(show.id)}>Manage Episodes</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal for add/edit show (multistep) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 w-full max-w-2xl relative overflow-y-auto max-h-[90vh]">
            <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-700" onClick={handleCloseModal}>&times;</button>
            <h2 className="text-xl font-bold mb-4">{editingShow ? 'Edit Show' : 'Add TV Show'}</h2>
            
            <div className="flex gap-2 mb-4">
              <Button variant="default">Show Details</Button>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: '70vh' }}>
              {showStep === 1 && (
                <form onSubmit={e => { e.preventDefault(); setShowStep(2); }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="col-span-full">
                    <label className="block text-sm font-medium mb-1">Title</label>
                    <Input name="title" value={form.title} onChange={handleFormChange} required className="w-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  </div>
                  <div className="col-span-full">
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <textarea name="description" value={form.description} onChange={handleFormChange} required rows={4} className="w-full p-3 rounded border bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Type</label>
                    <select name="show_type" value={form.show_type || 'show'} onChange={handleFormChange} className="mb-2 w-full border rounded px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500">
                      <option value="show">Show</option>
                      <option value="event">Live Event</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Choose "Live Event" for one-off live events.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Category</label>
                    <select name="category" value={form.category || ''} onChange={handleFormChange} className="mb-2 w-full border rounded px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500">
                        <option value="">None</option>
                        {[
                          "Fanalysis",
                          "Mic'd Breakfast Show",
                          "Girls Talk",
                          "Mid-Day Groove",
                          "Perspective Inspiration",
                          "Documentary",
                          "Sermons",
                          "Business",
                          "Education",
                        ].map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Video</label>
                    <select name="video_type" value={form.video_type} onChange={handleFormChange} className="mb-2 w-full border rounded px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500">
                      <option value="url">URL</option>
                      <option value="upload">Upload</option>
                    </select>
                    {form.video_type === 'url' ? (
                      <Input name="video_url" value={form.video_url} onChange={handleFormChange} placeholder="https://..." className="w-full" />
                    ) : (
                      <label className="w-full flex items-center gap-2 px-3 py-2 border rounded bg-white dark:bg-gray-900 cursor-pointer">
                        <input type="file" name="video_file" accept="video/*" onChange={handleFormChange} className="hidden" />
                        <span className="text-sm text-gray-700 dark:text-gray-200">Choose video file</span>
                      </label>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Thumbnail</label>
                    <select name="thumbnail_type" value={form.thumbnail_type} onChange={handleFormChange} className="mb-2 w-full border rounded px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500">
                      <option value="url">URL</option>
                      <option value="upload">Upload</option>
                    </select>
                    {form.thumbnail_type === 'url' ? (
                      <Input name="thumbnail_url" value={form.thumbnail_url} onChange={handleFormChange} placeholder="https://..." className="w-full" />
                    ) : (
                      <label className="w-full flex items-center gap-2 px-3 py-2 border rounded bg-white dark:bg-gray-900 cursor-pointer">
                        <input type="file" name="thumbnail_file" accept="image/*" onChange={handleFormChange} className="hidden" />
                        <span className="text-sm text-gray-700 dark:text-gray-200">Choose thumbnail</span>
                      </label>
                    )}
                  </div>
                  <div className="col-span-full">
                    <label className="block text-sm font-medium mb-1">Live Stream URL</label>
                    <Input name="live_url" value={form.live_url || ''} onChange={handleFormChange} placeholder="https://example.com/live/stream.m3u8 or https://youtube.com/watch?v=..." className="w-full" />
                    <p className="text-xs text-gray-500 mt-1">Optional: add a live stream URL to mark this show as live immediately.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Duration (mins)</label>
                    <Input name="duration" value={form.duration} onChange={handleFormChange} type="number" min="0" className="w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Auto-generate episodes (days)</label>
                    <input name="auto_generate_days" type="number" min={0} value={form.auto_generate_days ?? 7} onChange={handleFormChange} className="w-24 border rounded px-2 py-1" />
                    <p className="text-xs text-gray-500 mt-1">When saving, the system will auto-create episode slots for the next N days based on schedule settings. Set 0 to disable.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Schedule Pattern</label>
                    <select name="schedule_pattern" value={form.schedule_pattern || ''} onChange={handleFormChange} className="mb-2 w-full border rounded px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500">
                      <option value="">None</option>
                      <option value="daily">Daily</option>
                      <option value="weekdays">Weekdays</option>
                      <option value="weekly">Weekly (select days)</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Time Slot Start</label>
                    <input type="time" name="time_slot_start" value={form.time_slot_start || (form.scheduled_time ? form.scheduled_time.substring(11,16) : '')} onChange={handleFormChange} className="w-full border rounded px-2 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Time Slot End</label>
                    <input type="time" name="time_slot_end" value={form.time_slot_end || (form.end_time ? form.end_time.substring(11,16) : '')} onChange={handleFormChange} className="w-full border rounded px-2 py-2" />
                  </div>
                  <div className="col-span-full">
                    <label className="block text-sm font-medium mb-1">Days Of Week</label>
                    <div className="flex gap-2 flex-wrap">
                      {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d => (
                        <label key={d} className="inline-flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={(Array.isArray(form.days_of_week) ? form.days_of_week.map((x: string) => x.toLowerCase()) : String(form.days_of_week || '').split(',').map((s:string)=>s.trim().toLowerCase())).includes(d.toLowerCase())} onChange={() => handleDaysToggle(d)} />
                          {d.substring(0,3)}
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Select days the show should recur. Leave empty for one-off scheduled_time.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Scheduled Time</label>
                    <Input name="scheduled_time" value={form.scheduled_time} onChange={handleFormChange} type="datetime-local" className="w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">End Time</label>
                    <Input name="end_time" value={form.end_time} onChange={handleFormChange} type="datetime-local" className="w-full" />
                  </div>
                  <div className="col-span-full flex gap-4 justify-end mt-2">
                    <div className="flex gap-2">
                      <div>
                        <label className="block text-sm font-medium mb-1">Is Live</label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" name="is_live" checked={form.is_live} onChange={handleFormChange} className="accent-purple-600 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700" />
                          Yes
                        </label>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Is Active</label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleFormChange} className="accent-purple-600 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700" />
                          Yes
                        </label>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Is Ad</label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" name="is_ad" checked={!!form.is_ad} onChange={handleFormChange} className="accent-amber-600 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700" />
                          Yes
                        </label>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={handleCloseModal} type="button">Cancel</Button>
                      <Button type="button" onClick={handleSubmit} disabled={uploading}>{uploading ? 'Saving...' : 'Save Show'}</Button>
                    </div>
                  </div>
                  {/* Ad scheduling fields shown when Is Ad is checked */}
                  {form.is_ad && (
                    <div className="col-span-full grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                      <div>
                        <label className="block text-sm font-medium mb-1">Ad Interval (minutes)</label>
                        <input name="ad_interval_minutes" type="number" min={1} value={form.ad_interval_minutes || 30} onChange={handleFormChange} className="w-full border rounded px-2 py-2" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Ad Duration (seconds)</label>
                        <input name="ad_duration_seconds" type="number" min={5} value={form.ad_duration_seconds || 60} onChange={handleFormChange} className="w-full border rounded px-2 py-2" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Placement</label>
                        <select name="ad_placement" value={form.ad_placement || 'between_shows'} onChange={handleFormChange} className="w-full border rounded px-2 py-2">
                          <option value="between_shows">Between Shows</option>
                          <option value="pre_roll">Pre-roll</option>
                          <option value="post_roll">Post-roll</option>
                          <option value="overlay">Overlay</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Ad Start (optional)</label>
                        <Input name="ad_start_at" value={form.ad_start_at || ''} onChange={handleFormChange} type="datetime-local" className="w-full" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Ad End (optional)</label>
                        <Input name="ad_end_at" value={form.ad_end_at || ''} onChange={handleFormChange} type="datetime-local" className="w-full" />
                      </div>
                    </div>
                  )}
                  <div className="text-xs text-gray-500 mb-2">
                    You can add episodes in the next step, or just save the show if this is a one-off video (e.g. a movie or special).
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={handleCloseModal} type="button">Cancel</Button>
                    <Button type="button" onClick={handleSubmit} disabled={uploading}>{uploading ? 'Saving...' : 'Save Show'}</Button>
                  </div>
                </form>
              )}
              
            </div>
          </div>
        </div>
      )}

      {/* Episode Management Panel */}
      {showEpisodePage && (
        <div ref={episodePanelRef}>
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center w-full">
                <CardTitle>
                  Manage Episodes {currentEpisodeShowId && `for Show ID: ${currentEpisodeShowId}`}
                  {loadingEpisodes && <span className="ml-2 text-sm text-gray-500">(Loading...)</span>}
                </CardTitle>
                <div className="ml-auto">
                  <Button variant="outline" onClick={handleCloseEpisodeModal}>Back to Shows</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingEpisodes ? (
                <div className="text-center py-8">Loading episodes...</div>
              ) : (
                <>
                  <div className="mb-6">
                    <EpisodeCalendar
                      episodes={episodes}
                      onEventDrop={() => {}}
                      onEventClick={(info: any) => {
                        const ep = info.event.extendedProps?.episode;
                        if (ep) {
                          handleEditEpisode(ep);
                        }
                      }}
                    />
                  </div>
                  
                  <div className="mb-4 flex gap-2 items-center">
                    <Button size="sm" onClick={() => { 
                      setEditingEpisode(null); 
                      setNewEpisodeForm(defaultEpisode); 
                    }}>Add New Episode</Button>
                    <Button size="sm" variant="destructive" disabled={selectedEpisodeIds.length === 0} onClick={handleBulkDelete}>
                      Delete Selected ({selectedEpisodeIds.length})
                    </Button>
                    <span className="text-xs text-gray-500 ml-2">
                      {episodes.length} total episodes
                    </span>
                  </div>
                  
                  <EpisodeDragDropList
                    key={episodes.length}
                    episodes={episodes}
                    selectedIds={selectedEpisodeIds}
                    onReorder={() => {}}
                    onEdit={handleEditEpisode}
                    onDelete={handleDeleteEpisode}
                    onSelect={handleSelectEpisode}
                  />

                  {/* Add / Edit Episode Form */}
                  <div className="mt-8 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
                    <h3 className="font-semibold text-lg mb-4">
                      {editingEpisode ? `Edit Episode: ${editingEpisode.title}` : 'Add New Episode'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-1 block">Title *</label>
                        <Input 
                          name="title" 
                          value={newEpisodeForm.title || ''} 
                          onChange={handleNewEpisodeChange} 
                          placeholder="Episode title" 
                          className="w-full" 
                        />
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium mb-1 block">Duration (minutes)</label>
                        <Input 
                          name="duration" 
                          value={newEpisodeForm.duration || ''} 
                          onChange={handleNewEpisodeChange} 
                          placeholder="e.g., 30" 
                          type="number" 
                          className="w-full" 
                        />
                      </div>

                      <div className="col-span-full">
                        <label className="text-sm font-medium mb-1 block">Video *</label>
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            <select 
                              name="video_type" 
                              value={newEpisodeForm.video_type || 'url'} 
                              onChange={handleNewEpisodeChange} 
                              className="p-2 rounded border"
                            >
                              <option value="url">URL</option>
                              <option value="upload">Upload File</option>
                            </select>
                            {newEpisodeForm.video_type === 'upload' ? (
                              <input 
                                type="file" 
                                name="video_file" 
                                accept="video/*" 
                                onChange={handleNewEpisodeChange} 
                                className="flex-1 p-2 rounded bg-white dark:bg-gray-900 border"
                              />
                            ) : (
                              <Input 
                                name="video_url" 
                                value={newEpisodeForm.video_url || ''} 
                                onChange={handleNewEpisodeChange} 
                                placeholder="https://example.com/video.mp4" 
                                className="flex-1" 
                              />
                            )}
                          </div>
                          {newEpisodeForm.video_type === 'url' && newEpisodeForm.video_url && (
                            <div className="text-xs text-green-600">
                              ✓ Using URL: {newEpisodeForm.video_url.substring(0, 50)}...
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="col-span-full">
                        <label className="text-sm font-medium mb-1 block">Thumbnail</label>
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            <select 
                              name="thumbnail_type" 
                              value={newEpisodeForm.thumbnail_type || 'url'} 
                              onChange={handleNewEpisodeChange} 
                              className="p-2 rounded border"
                            >
                              <option value="url">URL</option>
                              <option value="upload">Upload File</option>
                            </select>
                            {newEpisodeForm.thumbnail_type === 'upload' ? (
                              <input 
                                type="file" 
                                name="thumbnail_file" 
                                accept="image/*" 
                                onChange={handleNewEpisodeChange} 
                                className="flex-1 p-2 rounded bg-white dark:bg-gray-900 border"
                              />
                            ) : (
                              <Input 
                                name="thumbnail_url" 
                                value={newEpisodeForm.thumbnail_url || ''} 
                                onChange={handleNewEpisodeChange} 
                                placeholder="https://example.com/thumbnail.jpg" 
                                className="flex-1" 
                              />
                            )}
                          </div>
                          {newEpisodeForm.thumbnail_type === 'url' && newEpisodeForm.thumbnail_url && (
                            <div className="text-xs text-green-600">
                              ✓ Using thumbnail URL
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-1 block">Scheduled Time</label>
                        <Input 
                          name="scheduled_time" 
                          value={newEpisodeForm.scheduled_time || ''} 
                          onChange={handleNewEpisodeChange} 
                          type="datetime-local" 
                          className="w-full" 
                        />
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium mb-1 block">End Time</label>
                        <Input 
                          name="end_time" 
                          value={newEpisodeForm.end_time || ''} 
                          onChange={handleNewEpisodeChange} 
                          type="datetime-local" 
                          className="w-full" 
                        />
                      </div>
                      
                      <div className="col-span-full">
                        <label className="text-sm font-medium mb-1 block">Description</label>
                        <Input 
                          name="description" 
                          value={newEpisodeForm.description || ''} 
                          onChange={handleNewEpisodeChange} 
                          placeholder="Episode description" 
                          className="w-full" 
                        />
                      </div>
                    </div>
                    
                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                      <Button 
                        variant="outline" 
                        onClick={() => { 
                          setEditingEpisode(null); 
                          setNewEpisodeForm(defaultEpisode); 
                        }}
                      >
                        Clear Form
                      </Button>
                      <Button 
                        onClick={handleSaveEpisode}
                        disabled={!newEpisodeForm.title?.trim()}
                      >
                        {editingEpisode ? 'Update Episode' : 'Create Episode'}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      
      <Card className="shadow-lg border-0 mb-6">
        <CardHeader className="flex flex-row items-center gap-2">
          <span className="inline-flex items-center justify-center rounded-full bg-blue-100 dark:bg-gray-800 p-2 mr-2">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </span>
          <CardTitle>Studio Manager</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your TV shows and episodes. Click "Manage Episodes" on any show to add, edit, or delete episodes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudiosPage;