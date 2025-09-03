import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useToast } from '../../hooks/use-toast';
import { supabase } from '../../integrations/supabase/client';
import EpisodeCalendar from '../../components/EpisodeCalendar';
import EpisodeDragDropList from '../../components/EpisodeDragDropList';
import { Input } from '../../components/ui/input';

const defaultShow = {
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
  is_live: false,
  is_active: true,
  created_by: '',
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
  const [episodeModal, setEpisodeModal] = useState(false);
  const [editingEpisode, setEditingEpisode] = useState<any | null>(null);
  const [selectedEpisodeIds, setSelectedEpisodeIds] = useState<any[]>([]);

  // Add state for multistep form and staged episodes
  const [showStep, setShowStep] = useState(12);
  const [stagedEpisodes, setStagedEpisodes] = useState<any[]>([]);
  const [stagedEpisodeForm, setStagedEpisodeForm] = useState<any>(defaultEpisode);
  const [stagedEpisodeIdx, setStagedEpisodeIdx] = useState<number | null>(null);

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
    const { data, error } = await supabase
      .from('studio_episodes')
      .select('*')
      .eq('show_id', showId)
      .order('scheduled_time', { ascending: true });
    if (error) {
      console.error('Error fetching episodes:', error);
      toast({ title: 'Error', description: 'Failed to fetch episodes', variant: 'destructive' });
      return;
    }
    setEpisodes(data || []);
  };

  useEffect(() => {
    if (isAuthenticated && userPrivilege) {
      fetchShows();
    }
  }, [isAuthenticated, userPrivilege]);

  // --- Show CRUD logic (update for multistep) ---
  const handleOpenModal = (show?: any) => {
    if (show) {
      setEditingShow(show);
      setForm(show);
      supabase
        .from('studio_episodes')
        .select('*')
        .eq('show_id', show.id)
        .order('scheduled_time', { ascending: true })
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
        scheduled_time: form.scheduled_time,
        end_time: form.end_time,
        is_live: form.is_live,
        is_active: form.is_active,
        created_by: userId,
        created_at: editingShow ? editingShow.created_at : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      console.log('Attempting to save show data:', showData);
      
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
      
      // Handle episodes
      if (showId) {
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
            
          if (episodeError) {
            console.error('Episode insert error:', episodeError);
            // Continue with other episodes even if one fails
          }
        }
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

  // Open episode management modal
  const handleOpenEpisodeModal = (showId: number) => {
    setEpisodeModal(true);
    fetchEpisodes(showId);
  };

  // Close episode management modal
  const handleCloseEpisodeModal = () => {
    setEpisodeModal(false);
    setEditingEpisode(null);
    setSelectedEpisodeIds([]);
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
                    shows.map((show, idx) => (
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
                      {show.video_url && (
                        <div className="mb-2">
                          <a href={show.video_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Watch Video</a>
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
              <Button variant={showStep === 1 ? 'default' : 'outline'} onClick={() => setShowStep(1)}>Show Details</Button>
              <Button variant={showStep === 2 ? 'default' : 'outline'} onClick={() => setShowStep(2)} disabled={!form.title}>Episodes (optional)</Button>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: '70vh' }}>
              {showStep === 1 && (
                <form onSubmit={e => { e.preventDefault(); setShowStep(2); }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Title</label>
                    <Input name="title" value={form.title} onChange={handleFormChange} required className="w-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <Input name="description" value={form.description} onChange={handleFormChange} required className="w-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Video</label>
                    <select name="video_type" value={form.video_type} onChange={handleFormChange} className="mb-2 border rounded px-2 py-1 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500">
                      <option value="url">URL</option>
                      <option value="upload">Upload</option>
                    </select>
                    {form.video_type === 'url' ? (
                      <Input name="video_url" value={form.video_url} onChange={handleFormChange} placeholder="https://..." className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 w-full" />
                    ) : (
                      <input type="file" name="video_file" accept="video/*" onChange={handleFormChange} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 w-full" />
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Thumbnail</label>
                    <select name="thumbnail_type" value={form.thumbnail_type} onChange={handleFormChange} className="mb-2 border rounded px-2 py-1 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500">
                      <option value="url">URL</option>
                      <option value="upload">Upload</option>
                    </select>
                    {form.thumbnail_type === 'url' ? (
                      <Input name="thumbnail_url" value={form.thumbnail_url} onChange={handleFormChange} placeholder="https://..." className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 w-full" />
                    ) : (
                      <input type="file" name="thumbnail_file" accept="image/*" onChange={handleFormChange} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 w-full" />
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Duration (mins)</label>
                    <Input name="duration" value={form.duration} onChange={handleFormChange} type="number" min="0" className="w-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Scheduled Time</label>
                    <Input name="scheduled_time" value={form.scheduled_time} onChange={handleFormChange} type="datetime-local" className="w-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">End Time</label>
                    <Input name="end_time" value={form.end_time} onChange={handleFormChange} type="datetime-local" className="w-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  </div>
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
                  </div>
                  <div className="text-xs text-gray-500 mb-2">
                    You can add episodes in the next step, or just save the show if this is a one-off video (e.g. a movie or special).
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={handleCloseModal} type="button">Cancel</Button>
                    <Button type="button" onClick={() => setShowStep(2)}>Next: Episodes (optional)</Button>
                    <Button type="button" onClick={handleSubmit} disabled={uploading}>{uploading ? 'Saving...' : 'Save Show Only'}</Button>
                  </div>
                </form>
              )}
              {showStep === 2 && (
                <div>
                  <div className="text-xs text-gray-500 mb-2">
                    Add episodes for this show (optional). You can always add or edit episodes later.
                  </div>
                  {/* Inline episode add/edit form */}
                  <form onSubmit={e => { e.preventDefault(); handleAddOrUpdateStagedEpisode(); }} className="space-y-2 mb-4">
                    <div className="flex gap-2">
                      <input name="title" value={stagedEpisodeForm.title} onChange={handleStagedEpisodeFormChange} placeholder="Episode Title" required className="flex-1" />
                      <Button type="submit" size="sm">{stagedEpisodeIdx !== null ? 'Update' : 'Add'} Episode</Button>
                    </div>
                    <div className="flex gap-2">
                      <input name="description" value={stagedEpisodeForm.description} onChange={handleStagedEpisodeFormChange} placeholder="Description" className="flex-1" />
                      <input name="duration" value={stagedEpisodeForm.duration} onChange={handleStagedEpisodeFormChange} placeholder="Duration" type="number" min="0" className="w-24" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Video</label>
                      <select name="video_type" value={stagedEpisodeForm.video_type} onChange={handleStagedEpisodeFormChange} className="mb-2 border rounded px-2 py-1 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500">
                        <option value="url">URL</option>
                        <option value="upload">Upload</option>
                      </select>
                      {stagedEpisodeForm.video_type === 'url' ? (
                        <Input name="video_url" value={stagedEpisodeForm.video_url} onChange={handleStagedEpisodeFormChange} placeholder="https://..." className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 w-full" />
                      ) : (
                        <input type="file" name="video_file" accept="video/*" onChange={handleStagedEpisodeFormChange} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 w-full" />
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Thumbnail</label>
                      <select name="thumbnail_type" value={stagedEpisodeForm.thumbnail_type} onChange={handleStagedEpisodeFormChange} className="mb-2 border rounded px-2 py-1 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500">
                        <option value="url">URL</option>
                        <option value="upload">Upload</option>
                      </select>
                      {stagedEpisodeForm.thumbnail_type === 'url' ? (
                        <Input name="thumbnail_url" value={stagedEpisodeForm.thumbnail_url} onChange={handleStagedEpisodeFormChange} placeholder="https://..." className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 w-full" />
                      ) : (
                        <input type="file" name="thumbnail_file" accept="image/*" onChange={handleStagedEpisodeFormChange} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 w-full" />
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Scheduled Time</label>
                      <Input name="scheduled_time" value={stagedEpisodeForm.scheduled_time} onChange={handleStagedEpisodeFormChange} type="datetime-local" className="w-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">End Time</label>
                      <Input name="end_time" value={stagedEpisodeForm.end_time} onChange={handleStagedEpisodeFormChange} type="datetime-local" className="w-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500" />
                    </div>
                    <div className="flex gap-2">
                      <div>
                        <label className="block text-sm font-medium mb-1">Is Active</label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" name="is_active" checked={stagedEpisodeForm.is_active} onChange={handleStagedEpisodeFormChange} className="accent-purple-600 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700" />
                          Yes
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Recurring</label>
                      <select name="recurring" value={stagedEpisodeForm.recurring || ''} onChange={handleStagedEpisodeFormChange} className="mb-2 border rounded px-2 py-1 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500">
                        <option value="">None</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                  </form>
                  <div className="mb-4">
                    {stagedEpisodes.length === 0 ? (
                      <p className="text-gray-500 text-center">No episodes added yet.</p>
                    ) : (
                      <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                        {stagedEpisodes.map((ep, idx) => (
                          <li key={idx} className="flex items-center gap-2 py-2">
                            <span className="flex-1">{ep.title}</span>
                            <Button size="sm" variant="outline" onClick={() => handleEditStagedEpisode(idx)}>Edit</Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDeleteStagedEpisode(idx)}>Delete</Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setShowStep(1)} type="button">Back</Button>
                    <Button type="button" onClick={handleSubmit} disabled={uploading}>{uploading ? 'Saving...' : 'Save Show & Episodes'}</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Modal for episode management */}
      {episodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 w-full max-w-3xl relative">
            <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-700" onClick={handleCloseEpisodeModal}>&times;</button>
            <h2 className="text-xl font-bold mb-4">{editingEpisode ? 'Edit Episode' : 'Manage Episodes'}</h2>
            <div className="mb-6">
              <EpisodeCalendar
                episodes={episodes}
                onEventDrop={() => {}}
                onEventClick={() => {}}
              />
            </div>
            <div className="mb-2 flex gap-2 items-center">
              <Button size="sm" variant="secondary" disabled={selectedEpisodeIds.length === 0}>Activate</Button>
              <Button size="sm" variant="secondary" disabled={selectedEpisodeIds.length === 0}>Deactivate</Button>
              <Button size="sm" variant="destructive" disabled={selectedEpisodeIds.length === 0}>Delete</Button>
              <span className="text-xs text-gray-500 ml-2">{selectedEpisodeIds.length} selected</span>
            </div>
            <EpisodeDragDropList
              episodes={episodes}
              selectedIds={selectedEpisodeIds}
              onReorder={() => {}}
              onEdit={() => {}}
              onDelete={() => {}}
              onSelect={() => {}}
            />
          </div>
        </div>
      )}
      <Card className="shadow-lg border-0 mb-6">
        <CardHeader className="flex flex-row items-center gap-2">
          <span className="inline-flex items-center justify-center rounded-full bg-blue-100 dark:bg-gray-800 p-2 mr-2">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
          </span>
          <CardTitle>1Studio Manager</CardTitle>
        </CardHeader>
        <CardContent>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudiosPage;