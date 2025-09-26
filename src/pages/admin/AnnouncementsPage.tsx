import React, { useState, useEffect } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { Megaphone, CalendarDays, Send, Edit, Trash2, RefreshCw, Video } from 'lucide-react';

const defaultTimes = ["07:00", "12:00", "19:00"];

type Announcement = {
  id: number;
  title: string;
  content: string;
  send_email: boolean;
  schedule_times: string[];
  created_at: string;
  image_url?: string;
  video_url?: string;
  announcement_type?: string;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
  status?: string;
};

function getStatus(start: string, end: string | null | undefined, isActive: boolean | undefined) {
  const now = new Date();
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : null;
  if (!isActive) return 'Canceled';
  if (now < startDate) return 'Upcoming';
  if (endDate && now > endDate) return 'Complete';
  return 'Running';
}

const AnnouncementsPage = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [form, setForm] = useState({
    title: '',
    content: '',
    sendEmail: false,
    scheduleTimes: [...defaultTimes],
    startDate: '',
    endDate: '',
    imageUrl: '',
    videoUrl: '',
    type: 'campaign',
  });
  const [selectedTime, setSelectedTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [superAdminId, setSuperAdminId] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);

  useEffect(() => {
    fetchAnnouncements();
    fetchSuperAdmin();
  }, []);

  async function fetchSuperAdmin() {
    // Fetch a user with Super Admin privilege
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('privilege', 'superadmin')
      .limit(1)
      .single();

    if (!error && data) {
      setSuperAdminId(data.id);
    } else {
      console.error('Error fetching Super Admin:', error);
      // Fallback: try to get any admin user if Super Admin not found
      const { data: adminData } = await supabase
        .from('users')
        .select('id')
        .eq('privilege', 'admin') // Try alternative privilege name
        .limit(1)
        .single();
      
      if (adminData) {
        setSuperAdminId(adminData.id);
      } else {
        // Last fallback: get the first user available
        const { data: firstUser } = await supabase
          .from('users')
          .select('id')
          .limit(1)
          .single();
        
        if (firstUser) {
          setSuperAdminId(firstUser.id);
          console.warn('Using first available user as fallback for created_by');
        }
      }
    }
  }

  async function fetchAnnouncements() {
    setLoading(true);
    const { data, error } = await supabase
      .from('platform_announcements')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setAnnouncements(data as Announcement[]);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    
    // Validate end date is after start date
    if (form.endDate && form.startDate > form.endDate) {
      alert('End date must be after start date');
      setLoading(false);
      return;
    }

    // Validate we have a user for created_by
    if (!superAdminId) {
      alert('Error: No valid user found to assign as creator. Please try again.');
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from('platform_announcements')
      .insert([
        {
          title: form.title,
          content: form.content,
          announcement_type: form.type,
          target_audience: 'all',
          is_active: true,
          start_date: form.startDate,
          end_date: form.endDate || null,
          created_by: superAdminId,
          send_email: form.sendEmail,
          schedule_times: form.scheduleTimes,
          image_url: form.imageUrl,
          video_url: form.videoUrl,
        },
      ]);
      
    if (!error) {
      setForm({ 
        title: '', 
        content: '', 
        sendEmail: false, 
        scheduleTimes: [...defaultTimes], 
        startDate: '',
        endDate: '',
        imageUrl: '',
        videoUrl: '',
        type: 'campaign',
      });
      fetchAnnouncements();
      
      // Trigger campaign email if sendEmail is checked
      if (form.sendEmail) {
        try {
          const { data: users, error: userError } = await supabase.from('users').select('email');
          if (!userError && users) {
            const emails = users.map((u: any) => u.email).filter(Boolean);
            await fetch('https://nsq-email-backend.onrender.com/send-bulk', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                emails,
                subject: form.title,
                message: form.content
              })
            });
          }
        } catch (err) {
          console.error('Error sending emails:', err);
        }
      }
    } else {
      console.error('Error creating announcement:', error);
      alert('Error creating announcement: ' + error.message);
    }
    setLoading(false);
  }

  // Actions (edit, rerun, delete) - stubs for now
  const handleEdit = (id: number) => alert('Edit ' + id);
  const handleRerun = (id: number) => alert('Rerun ' + id);
  const handleDelete = (id: number) => alert('Delete ' + id);

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-100">Announcements Management</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
        {/* Create Announcement Card */}
        <div className="rounded-xl shadow-lg p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-900 dark:to-black border border-blue-200 dark:border-gray-700">
          <div className="flex items-center mb-4">
            <Megaphone className="w-7 h-7 text-blue-600 dark:text-blue-400 mr-2" />
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-100">Create Announcement</h2>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block font-semibold mb-1">Title</label>
              <input
                type="text"
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring focus:border-blue-400 dark:bg-gray-900 dark:text-gray-100"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                required
              />
            </div>
            <div className="mb-4">
              <label className="block font-semibold mb-1">Content</label>
              <textarea
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring focus:border-blue-400 dark:bg-gray-900 dark:text-gray-100"
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                required
                rows={4}
              />
            </div>
            <div className="mb-4">
              <label className="block font-semibold mb-1">Type</label>
              <select
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring focus:border-blue-400 dark:bg-gray-900 dark:text-gray-100"
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                required
              >
                <option value="campaign">Campaign</option>
                <option value="newsletter">Newsletter</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block font-semibold mb-1">Image (optional)</label>
              <input
                type="file"
                accept="image/*"
                className="w-full border rounded-lg px-3 py-2 dark:bg-gray-900 dark:text-gray-100"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setImageUploading(true);
                  const fileExt = file.name.split('.').pop();
                  const fileName = `${Date.now()}.${fileExt}`;
                  const { data, error } = await supabase.storage.from('announcements').upload(fileName, file);
                  if (!error && data) {
                    const { publicUrl } = supabase.storage.from('announcements').getPublicUrl(data.path).data;
                    setForm(f => ({ ...f, imageUrl: publicUrl }));
                  }
                  setImageUploading(false);
                }}
              />
              {imageUploading && <div className="text-xs text-blue-500 mt-1">Uploading...</div>}
              {form.imageUrl && (
                <img src={form.imageUrl} alt="Announcement" className="mt-2 max-h-32 rounded" />
              )}
            </div>
            <div className="mb-4">
              <label className="block font-semibold mb-1">Video (optional)</label>
              <input
                type="file"
                accept="video/*"
                className="w-full border rounded-lg px-3 py-2 dark:bg-gray-900 dark:text-gray-100"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setVideoUploading(true);
                  const fileExt = file.name.split('.').pop();
                  const fileName = `${Date.now()}.${fileExt}`;
                  const { data, error } = await supabase.storage.from('announcements-videos').upload(fileName, file);
                  if (!error && data) {
                    const { publicUrl } = supabase.storage.from('announcements-videos').getPublicUrl(data.path).data;
                    setForm(f => ({ ...f, videoUrl: publicUrl }));
                  }
                  setVideoUploading(false);
                }}
              />
              {videoUploading && <div className="text-xs text-blue-500 mt-1">Uploading...</div>}
              {form.videoUrl && (
                <video src={form.videoUrl} controls className="mt-2 max-h-32 rounded w-full" />
              )}
            </div>
            <div className="mb-4 flex items-center">
              <input
                type="checkbox"
                checked={form.sendEmail}
                onChange={e => setForm(f => ({ ...f, sendEmail: e.target.checked }))}
                id="sendEmail"
              />
              <label htmlFor="sendEmail" className="ml-2">Send as Email Campaign</label>
              {form.sendEmail && <Send className="ml-2 w-5 h-5 text-blue-500 dark:text-blue-300" />}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block font-semibold mb-1">Start Date</label>
                <input
                  type="date"
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring focus:border-blue-400 dark:bg-gray-900 dark:text-gray-100"
                  value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">End Date (Optional)</label>
                <input
                  type="date"
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring focus:border-blue-400 dark:bg-gray-900 dark:text-gray-100"
                  value={form.endDate}
                  onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                  min={form.startDate}
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="block font-semibold mb-1">Schedule Times (24h, comma separated or select below)</label>
              <div className="flex flex-col gap-2">
                <div className="flex items-center">
                  <input
                    type="text"
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring focus:border-blue-400 dark:bg-gray-900 dark:text-gray-100"
                    value={form.scheduleTimes.join(", ")}
                    onChange={e => setForm(f => ({ ...f, scheduleTimes: e.target.value.split(/,\s*/) }))}
                    placeholder="07:00, 12:00, 19:00"
                  />
                  <CalendarDays className="ml-2 w-5 h-5 text-blue-400 dark:text-blue-300" />
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="time"
                    className="border rounded-lg px-3 py-2 focus:outline-none focus:ring focus:border-blue-400 dark:bg-gray-900 dark:text-gray-100"
                    value={selectedTime}
                    onChange={e => setSelectedTime(e.target.value)}
                  />
                  <button
                    type="button"
                    className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition"
                    onClick={() => {
                      if (selectedTime && !form.scheduleTimes.includes(selectedTime)) {
                        setForm(f => ({ ...f, scheduleTimes: [...f.scheduleTimes, selectedTime] }));
                        setSelectedTime('');
                      }
                    }}
                  >
                    Add Time
                  </button>
                </div>
                {form.scheduleTimes.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {form.scheduleTimes.map((t, idx) => (
                      <span key={t+idx} className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 px-2 py-1 rounded text-xs flex items-center gap-1">
                        {t}
                        <button
                          type="button"
                          className="ml-1 text-red-500 hover:text-red-700"
                          onClick={() => setForm(f => ({ ...f, scheduleTimes: f.scheduleTimes.filter((_, i) => i !== idx) }))}
                          title="Remove time"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button
              type="submit"
              className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 transition dark:bg-blue-500 dark:hover:bg-blue-600"
              disabled={loading || !superAdminId}
            >
              {loading ? 'Saving...' : !superAdminId ? 'Loading User...' : 'Create Announcement'}
            </button>
            {!superAdminId && (
              <div className="text-red-500 text-sm mt-2">
                Warning: No Super Admin user found. Please ensure you have a user with "Super Admin" privilege.
              </div>
            )}
          </form>
        </div>
        {/* Existing Announcements Table */}
        <div className="rounded-xl shadow-lg p-6 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-gray-900 dark:to-black border border-purple-200 dark:border-gray-700">
          <div className="flex items-center mb-4">
            <Megaphone className="w-7 h-7 text-purple-600 dark:text-purple-400 mr-2" />
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-100">Existing Announcements</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border rounded-lg overflow-hidden bg-white dark:bg-gray-900">
              <thead className="bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-2 text-left">Title</th>
                  <th className="px-4 py-2 text-left">Start Date</th>
                  <th className="px-4 py-2 text-left">End Date</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">Media</th>
                  <th className="px-4 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {announcements.map(a => (
                  <tr key={a.id} className="border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                    <td className="px-4 py-2 font-semibold text-gray-900 dark:text-gray-100">{a.title}</td>
                    <td className="px-4 py-2">{a.start_date ? new Date(a.start_date).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-2">{a.end_date ? new Date(a.end_date).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-2">
                      <span className="inline-block px-2 py-1 rounded text-xs font-medium "
                        style={{ background: getStatus(a.start_date || '', a.end_date, a.is_active) === 'Upcoming' ? '#e0e7ff' : getStatus(a.start_date || '', a.end_date, a.is_active) === 'Running' ? '#bbf7d0' : getStatus(a.start_date || '', a.end_date, a.is_active) === 'Complete' ? '#fef08a' : '#fecaca', color: '#222' }}>
                        {getStatus(a.start_date || '', a.end_date, a.is_active)}
                      </span>
                    </td>
                    <td className="px-4 py-2 capitalize">{a.announcement_type || 'campaign'}</td>
                    <td className="px-4 py-2">
                      {a.image_url && <img src={a.image_url} alt="img" className="h-8 w-8 rounded inline-block mr-1" />}
                      {a.video_url && (
                        <span title="Has video">
                          <Video className="inline-block h-6 w-6 text-blue-500" />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 flex gap-2">
                      <button onClick={() => handleEdit(a.id)} className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-800" title="Edit"><Edit className="h-4 w-4" /></button>
                      <button onClick={() => handleRerun(a.id)} className="p-1 rounded hover:bg-yellow-100 dark:hover:bg-yellow-800" title="Rerun"><RefreshCw className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(a.id)} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-800" title="Delete"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnouncementsPage;