import React, { useState, useEffect } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { 
  Megaphone, CalendarDays, Send, Edit, Trash2, RefreshCw, Video, 
  Image as ImageIcon, Clock, Users, Eye, EyeOff, Filter, X,
  ChevronRight, AlertCircle, CheckCircle, PlayCircle, MoreVertical,
  BarChart3, Mail, Bell, Globe, Zap, FileText, Calendar
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { toast } from 'sonner';
import { Progress } from '../../components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { Calendar as CalendarComponent } from '../../components/ui/calendar';
import { format } from 'date-fns';

type Announcement = {
  id: number;
  title: string;
  content: string;
  send_email: boolean;
  schedule_times: string[];
  created_at: string;
  image_url?: string;
  video_url?: string;
  announcement_type: 'campaign' | 'newsletter' | 'maintenance' | 'update';
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
  status?: string;
  target_audience: 'all' | 'admins' | 'users' | 'specific';
  created_by?: string;
  views?: number;
  click_rate?: number;
  scheduled_at?: string;
};

const defaultTimes = ["07:00", "12:00", "19:00"];
const announcementTypes = [
  { value: 'campaign', label: 'Campaign', color: 'bg-blue-500' },
  { value: 'newsletter', label: 'Newsletter', color: 'bg-green-500' },
  { value: 'maintenance', label: 'Maintenance', color: 'bg-orange-500' },
  { value: 'update', label: 'Platform Update', color: 'bg-purple-500' }
];

const targetAudiences = [
  { value: 'all', label: 'All Users', icon: <Globe className="h-4 w-4" /> },
  { value: 'admins', label: 'Administrators', icon: <Users className="h-4 w-4" /> },
  { value: 'users', label: 'Regular Users', icon: <Users className="h-4 w-4" /> }
];

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
    type: 'campaign' as 'campaign' | 'newsletter' | 'maintenance' | 'update',
    targetAudience: 'all' as 'all' | 'admins' | 'users' | 'specific',
    scheduledDate: '',
    isActive: true,
  });
  const [selectedTime, setSelectedTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [superAdminId, setSuperAdminId] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [previewMode, setPreviewMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    scheduled: 0,
    completed: 0
  });

  useEffect(() => {
    fetchAnnouncements();
    fetchSuperAdmin();
    calculateStats();
  }, []);

  useEffect(() => {
    calculateStats();
  }, [announcements]);

  async function fetchSuperAdmin() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('privilege', 'superadmin')
        .limit(1)
        .single();

      if (!error && data) {
        setSuperAdminId(data.id);
      }
    } catch (error) {
      console.error('Error fetching Super Admin:', error);
    }
  }

  async function fetchAnnouncements() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('platform_announcements')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        setAnnouncements(data as Announcement[]);
      }
    } catch (error) {
      console.error('Error fetching announcements:', error);
      toast.error('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  }

  function calculateStats() {
    const now = new Date();
    const total = announcements.length;
    const active = announcements.filter(a => 
      a.is_active && 
      (!a.start_date || new Date(a.start_date) <= now) &&
      (!a.end_date || new Date(a.end_date) >= now)
    ).length;
    const scheduled = announcements.filter(a => 
      a.start_date && new Date(a.start_date) > now
    ).length;
    const completed = announcements.filter(a => 
      a.end_date && new Date(a.end_date) < now
    ).length;

    setStats({ total, active, scheduled, completed });
  }

  function getStatus(announcement: Announcement) {
    const now = new Date();
    const startDate = announcement.start_date ? new Date(announcement.start_date) : null;
    const endDate = announcement.end_date ? new Date(announcement.end_date) : null;
    
    if (!announcement.is_active) return { label: 'Inactive', color: 'bg-gray-100 text-gray-800' };
    if (startDate && now < startDate) return { label: 'Scheduled', color: 'bg-blue-100 text-blue-800' };
    if (endDate && now > endDate) return { label: 'Completed', color: 'bg-green-100 text-green-800' };
    if (announcement.scheduled_at && new Date(announcement.scheduled_at) > now) return { label: 'Scheduled', color: 'bg-blue-100 text-blue-800' };
    return { label: 'Active', color: 'bg-emerald-100 text-emerald-800' };
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    
    if (form.endDate && form.startDate > form.endDate) {
      toast.error('End date must be after start date');
      setLoading(false);
      return;
    }

    if (!superAdminId) {
      toast.error('No valid user found to assign as creator');
      setLoading(false);
      return;
    }

    const announcementData = {
      title: form.title,
      content: form.content,
      announcement_type: form.type,
      target_audience: form.targetAudience,
      is_active: form.isActive,
      start_date: form.startDate || null,
      end_date: form.endDate || null,
      created_by: superAdminId,
      send_email: form.sendEmail,
      schedule_times: form.scheduleTimes,
      image_url: form.imageUrl || null,
      video_url: form.videoUrl || null,
      scheduled_at: form.scheduledDate || null,
    };

    try {
      const { error } = await supabase
        .from('platform_announcements')
        .insert([announcementData]);

      if (error) throw error;

      toast.success('Announcement created successfully');
      
      // Send email campaign if enabled
      if (form.sendEmail) {
        try {
          const { data: users, error: userError } = await supabase
            .from('users')
            .select('email')
            .eq('privilege', form.targetAudience === 'admins' ? 'admin' : 'user');

          if (!userError && users?.length) {
            const emails = users.map(u => u.email).filter(Boolean);
            await fetch('https://nsq-email-backend.onrender.com/send-bulk', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                emails,
                subject: form.title,
                message: form.content
              })
            });
            toast.success(`Email sent to ${emails.length} users`);
          }
        } catch (err) {
          console.error('Error sending emails:', err);
          toast.error('Failed to send emails');
        }
      }

      // Reset form
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
        targetAudience: 'all',
        scheduledDate: '',
        isActive: true,
      });
      
      fetchAnnouncements();
    } catch (error: any) {
      console.error('Error creating announcement:', error);
      toast.error(error.message || 'Failed to create announcement');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Are you sure you want to delete this announcement?')) return;

    try {
      const { error } = await supabase
        .from('platform_announcements')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Announcement deleted');
      fetchAnnouncements();
    } catch (error: any) {
      console.error('Error deleting announcement:', error);
      toast.error('Failed to delete announcement');
    }
  }

  async function handleToggleActive(id: number, currentActive: boolean) {
    try {
      const { error } = await supabase
        .from('platform_announcements')
        .update({ is_active: !currentActive })
        .eq('id', id);

      if (error) throw error;

      toast.success(`Announcement ${currentActive ? 'deactivated' : 'activated'}`);
      fetchAnnouncements();
    } catch (error: any) {
      console.error('Error toggling announcement:', error);
      toast.error('Failed to update announcement');
    }
  }

  async function handleUploadImage(file: File) {
    setImageUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const { data, error } = await supabase.storage
        .from('announcements')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('announcements')
        .getPublicUrl(data.path);

      setForm(f => ({ ...f, imageUrl: publicUrl }));
      toast.success('Image uploaded successfully');
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    } finally {
      setImageUploading(false);
    }
  }

  async function handleUploadVideo(file: File) {
    setVideoUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const { data, error } = await supabase.storage
        .from('announcements-videos')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('announcements-videos')
        .getPublicUrl(data.path);

      setForm(f => ({ ...f, videoUrl: publicUrl }));
      toast.success('Video uploaded successfully');
    } catch (error: any) {
      console.error('Error uploading video:', error);
      toast.error('Failed to upload video');
    } finally {
      setVideoUploading(false);
    }
  }

  const filteredAnnouncements = announcements.filter(a => {
    if (filter === 'all') return true;
    if (filter === 'active') return getStatus(a).label === 'Active';
    if (filter === 'scheduled') return getStatus(a).label === 'Scheduled';
    if (filter === 'completed') return getStatus(a).label === 'Completed';
    if (filter === 'inactive') return !a.is_active;
    return true;
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Announcements</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage platform-wide announcements and campaigns
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchAnnouncements}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Announcements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{stats.active}</div>
            <p className="text-xs text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.scheduled}</div>
            <p className="text-xs text-muted-foreground">Future announcements</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">Past campaigns</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Announcement Panel */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5" />
              Create New Announcement
            </CardTitle>
            <CardDescription>
              Create a new announcement or campaign for your platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="basic" className="space-y-4">
              <TabsList className="grid grid-cols-3">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="media">Media & Schedule</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>

              <TabsContent value="basic">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      placeholder="Enter announcement title"
                      value={form.title}
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="content">Content *</Label>
                    <Textarea
                      id="content"
                      placeholder="Write your announcement content here..."
                      value={form.content}
                      onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                      rows={4}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="type">Type</Label>
                      <Select
                        value={form.type}
                        onValueChange={(value: any) => setForm(f => ({ ...f, type: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {announcementTypes.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${type.color}`} />
                                {type.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="audience">Target Audience</Label>
                      <Select
                        value={form.targetAudience}
                        onValueChange={(value: any) => setForm(f => ({ ...f, targetAudience: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select audience" />
                        </SelectTrigger>
                        <SelectContent>
                          {targetAudiences.map(audience => (
                            <SelectItem key={audience.value} value={audience.value}>
                              <div className="flex items-center gap-2">
                                {audience.icon}
                                {audience.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startDate">Start Date</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={form.startDate}
                        onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="endDate">End Date (Optional)</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={form.endDate}
                        onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                        min={form.startDate}
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="sendEmail"
                      checked={form.sendEmail}
                      onCheckedChange={checked => setForm(f => ({ ...f, sendEmail: checked }))}
                    />
                    <Label htmlFor="sendEmail" className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Send as email campaign
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isActive"
                      checked={form.isActive}
                      onCheckedChange={checked => setForm(f => ({ ...f, isActive: checked }))}
                    />
                    <Label htmlFor="isActive">Set as active immediately</Label>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="media" className="space-y-4">
                <div className="space-y-2">
                  <Label>Upload Image</Label>
                  <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    <Input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      id="imageUpload"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadImage(file);
                      }}
                    />
                    <label htmlFor="imageUpload" className="cursor-pointer">
                      {imageUploading ? (
                        <div className="space-y-2">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                          <p className="text-sm text-muted-foreground">Uploading...</p>
                        </div>
                      ) : form.imageUrl ? (
                        <div className="space-y-2">
                          <img src={form.imageUrl} alt="Preview" className="mx-auto max-h-48 rounded-lg" />
                          <Button variant="outline" size="sm" onClick={() => setForm(f => ({ ...f, imageUrl: '' }))}>
                            Remove Image
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Click to upload image</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Upload Video</Label>
                  <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    <Input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      id="videoUpload"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadVideo(file);
                      }}
                    />
                    <label htmlFor="videoUpload" className="cursor-pointer">
                      {videoUploading ? (
                        <div className="space-y-2">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                          <p className="text-sm text-muted-foreground">Uploading...</p>
                        </div>
                      ) : form.videoUrl ? (
                        <div className="space-y-2">
                          <video src={form.videoUrl} controls className="mx-auto max-h-48 rounded-lg" />
                          <Button variant="outline" size="sm" onClick={() => setForm(f => ({ ...f, videoUrl: '' }))}>
                            Remove Video
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Video className="h-8 w-8 mx-auto text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Click to upload video</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Schedule Times</Label>
                  <div className="flex flex-wrap gap-2">
                    {form.scheduleTimes.map((time, index) => (
                      <Badge key={index} variant="secondary" className="gap-1">
                        <Clock className="h-3 w-3" />
                        {time}
                        <button
                          type="button"
                          onClick={() => setForm(f => ({
                            ...f,
                            scheduleTimes: f.scheduleTimes.filter((_, i) => i !== index)
                          }))}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="time"
                      value={selectedTime}
                      onChange={e => setSelectedTime(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (selectedTime && !form.scheduleTimes.includes(selectedTime)) {
                          setForm(f => ({ ...f, scheduleTimes: [...f.scheduleTimes, selectedTime] }));
                          setSelectedTime('');
                        }
                      }}
                    >
                      Add Time
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="preview">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <Badge className="mb-2">
                          {form.type.charAt(0).toUpperCase() + form.type.slice(1)}
                        </Badge>
                        <CardTitle>{form.title || 'Announcement Title'}</CardTitle>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(), 'MMM dd, yyyy')}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {form.imageUrl && (
                      <img src={form.imageUrl} alt="Announcement" className="rounded-lg w-full" />
                    )}
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {form.content || 'Announcement content will appear here...'}
                    </p>
                    {form.videoUrl && (
                      <div className="relative">
                        <video src={form.videoUrl} controls className="rounded-lg w-full" />
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span>Target: {form.targetAudience}</span>
                      </div>
                      {form.sendEmail && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          <span>Email Campaign</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <div className="flex justify-between pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {form.sendEmail && (
                  <div className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    <span>Email enabled</span>
                  </div>
                )}
              </div>
              <Button onClick={(e: any) => handleSubmit(e)} disabled={loading || !superAdminId}>
                {loading ? 'Creating...' : 'Publish Announcement'}
                <Megaphone className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Announcements List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Announcements</CardTitle>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <CardDescription>
              {filteredAnnouncements.length} announcements
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {loading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-24 animate-pulse bg-muted rounded-lg" />
                  ))}
                </div>
              ) : filteredAnnouncements.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Megaphone className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>No announcements found</p>
                </div>
              ) : (
                filteredAnnouncements.map(announcement => {
                  const status = getStatus(announcement);
                  return (
                    <div
                      key={announcement.id}
                      className="group p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className={status.color}>
                              {status.label}
                            </Badge>
                            <Badge variant="secondary" className="capitalize">
                              {announcement.announcement_type}
                            </Badge>
                          </div>
                          <h4 className="font-semibold truncate">{announcement.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {announcement.content}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            {announcement.start_date && (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>{format(new Date(announcement.start_date), 'MMM dd')}</span>
                              </div>
                            )}
                            {announcement.schedule_times?.length > 0 && (
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>{announcement.schedule_times.length} times</span>
                              </div>
                            )}
                            {announcement.send_email && (
                              <div className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                <span>Email</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-40 p-2">
                            <div className="space-y-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start"
                                onClick={() => handleToggleActive(announcement.id, announcement.is_active ?? true)}
                              >
                                {announcement.is_active ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                                {announcement.is_active ? 'Deactivate' : 'Activate'}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start text-destructive hover:text-destructive"
                                onClick={() => handleDelete(announcement.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Engagement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Total Views</span>
                <span className="font-semibold">1,234</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Click Rate</span>
                <span className="font-semibold">12.5%</span>
              </div>
              <Progress value={45} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Upcoming
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {announcements
                .filter(a => a.start_date && new Date(a.start_date) > new Date())
                .slice(0, 2)
                .map(a => (
                  <div key={a.id} className="flex items-center justify-between">
                    <span className="text-sm truncate">{a.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(a.start_date!), 'MMM dd')}
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start">
                <FileText className="h-4 w-4 mr-2" />
                Create Template
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Users className="h-4 w-4 mr-2" />
                Target Groups
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AnnouncementsPage;