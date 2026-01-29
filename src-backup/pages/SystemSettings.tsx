import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/Header';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { Settings, Megaphone, Upload, Plus, X } from 'lucide-react';

interface PlatformSettings {
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  maxFileSize: number;
  allowedFileTypes: string[];
  defaultCurrency: string;
  supportEmail: string;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  announcement_type: 'info' | 'warning' | 'success' | 'error';
  target_audience: 'all' | 'users' | 'admins' | 'verified';
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const SystemSettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<PlatformSettings>({
    maintenanceMode: false,
    registrationEnabled: true,
    maxFileSize: 10,
    allowedFileTypes: ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx'],
    defaultCurrency: 'USD',
    supportEmail: 'support@1voice.com'
  });
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    content: '',
    announcement_type: 'info' as const,
    target_audience: 'all' as const,
    start_date: '',
    end_date: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchAnnouncements();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*');

      if (error) throw error;

      // Convert database settings to our settings object
      if (data && data.length > 0) {
        const settingsObj: Partial<PlatformSettings> = {};
        data.forEach((setting) => {
          // @ts-ignore - We know the structure but TypeScript doesn't
          settingsObj[setting.setting_key] = setting.setting_value;
        });
        setSettings(prev => ({ ...prev, ...settingsObj }));
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast({
        title: "Error",
        description: "Failed to load system settings",
        variant: "destructive"
      });
    }
  };

  const fetchAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnnouncements(data as Announcement[] || []);
    } catch (error) {
      console.error('Error fetching announcements:', error);
      toast({
        title: "Error",
        description: "Failed to load announcements",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!user) return;

    setSaving(true);
    try {
      // Convert settings object to individual database entries
      const settingsEntries = Object.entries(settings).map(([key, value]) => ({
        setting_key: key,
        setting_value: value,
        updated_by: user.id
      }));

      // Upsert each setting
      for (const entry of settingsEntries) {
        await supabase
          .from('system_settings')
          .upsert(entry, { onConflict: 'setting_key' });
      }

      // Log admin action - fix the type issue
      await supabase
        .from('admin_actions')
        .insert({
          admin_id: user.id,
          action_type: 'system_settings',
          description: 'Updated platform settings',
          metadata: { settings: JSON.parse(JSON.stringify(settings)) }
        });

      toast({
        title: "Success",
        description: "Settings saved successfully"
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const createAnnouncement = async () => {
    if (!user || !newAnnouncement.title || !newAnnouncement.content) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('platform_announcements')
        .insert({
          ...newAnnouncement,
          start_date: newAnnouncement.start_date || null,
          end_date: newAnnouncement.end_date || null,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;

      setAnnouncements(prev => [data as Announcement, ...prev]);
      setNewAnnouncement({
        title: '',
        content: '',
        announcement_type: 'info',
        target_audience: 'all',
        start_date: '',
        end_date: ''
      });

      toast({
        title: "Success",
        description: "Announcement created successfully"
      });
    } catch (error) {
      console.error('Error creating announcement:', error);
      toast({
        title: "Error",
        description: "Failed to create announcement",
        variant: "destructive"
      });
    }
  };

  const toggleAnnouncement = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('platform_announcements')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;

      setAnnouncements(prev => 
        prev.map(announcement => 
          announcement.id === id 
            ? { ...announcement, is_active: isActive }
            : announcement
        )
      );

      toast({
        title: "Success",
        description: `Announcement ${isActive ? 'activated' : 'deactivated'}`
      });
    } catch (error) {
      console.error('Error toggling announcement:', error);
      toast({
        title: "Error",
        description: "Failed to update announcement",
        variant: "destructive"
      });
    }
  };

  const deleteAnnouncement = async (id: string) => {
    try {
      const { error } = await supabase
        .from('platform_announcements')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setAnnouncements(prev => prev.filter(announcement => announcement.id !== id));

      toast({
        title: "Success",
        description: "Announcement deleted successfully"
      });
    } catch (error) {
      console.error('Error deleting announcement:', error);
      toast({
        title: "Error",
        description: "Failed to delete announcement",
        variant: "destructive"
      });
    }
  };

  const getAnnouncementColor = (type: string) => {
    switch (type) {
      case 'info':
        return 'bg-blue-100 text-blue-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a]">
        <Header />
        <div className="flex items-center justify-center py-20">
          <div className="text-gray-600 dark:text-gray-400">Loading...</div>
        </div>
        <MobileBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a]">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">System Settings</h1>
          <p className="text-gray-600 dark:text-gray-400">Configure platform settings and announcements</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Platform Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>Platform Settings</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <Label htmlFor="maintenance">Maintenance Mode</Label>
                <Switch
                  id="maintenance"
                  checked={settings.maintenanceMode}
                  onCheckedChange={(checked) => 
                    setSettings(prev => ({ ...prev, maintenanceMode: checked }))
                  }
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="registration">User Registration</Label>
                <Switch
                  id="registration"
                  checked={settings.registrationEnabled}
                  onCheckedChange={(checked) => 
                    setSettings(prev => ({ ...prev, registrationEnabled: checked }))
                  }
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="fileSize">Max File Size (MB)</Label>
                <Input
                  id="fileSize"
                  type="number"
                  min="1"
                  max="100"
                  value={settings.maxFileSize}
                  onChange={(e) => 
                    setSettings(prev => ({ ...prev, maxFileSize: parseInt(e.target.value) }))
                  }
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="currency">Default Currency</Label>
                <Select 
                  value={settings.defaultCurrency} 
                  onValueChange={(value) => 
                    setSettings(prev => ({ ...prev, defaultCurrency: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="ZAR">ZAR</SelectItem>
                    <SelectItem value="NGN">NGN</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="supportEmail">Support Email</Label>
                <Input
                  id="supportEmail"
                  type="email"
                  value={settings.supportEmail}
                  onChange={(e) => 
                    setSettings(prev => ({ ...prev, supportEmail: e.target.value }))
                  }
                />
              </div>
              
              <Button onClick={saveSettings} disabled={saving} className="w-full">
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </CardContent>
          </Card>

          {/* Platform Announcements */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Megaphone className="h-5 w-5" />
                <span>Platform Announcements</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Create New Announcement */}
              <div className="space-y-4 p-4 border rounded-lg">
                <h3 className="font-medium">Create New Announcement</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Type</Label>
                    <Select 
                      value={newAnnouncement.announcement_type} 
                      onValueChange={(value: any) => 
                        setNewAnnouncement(prev => ({ ...prev, announcement_type: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Audience</Label>
                    <Select 
                      value={newAnnouncement.target_audience} 
                      onValueChange={(value: any) => 
                        setNewAnnouncement(prev => ({ ...prev, target_audience: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users</SelectItem>
                        <SelectItem value="users">Regular Users</SelectItem>
                        <SelectItem value="admins">Admins Only</SelectItem>
                        <SelectItem value="verified">Verified Users</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div>
                  <Label>Title</Label>
                  <Input
                    value={newAnnouncement.title}
                    onChange={(e) => 
                      setNewAnnouncement(prev => ({ ...prev, title: e.target.value }))
                    }
                    placeholder="Announcement title..."
                  />
                </div>
                
                <div>
                  <Label>Content</Label>
                  <Textarea
                    value={newAnnouncement.content}
                    onChange={(e) => 
                      setNewAnnouncement(prev => ({ ...prev, content: e.target.value }))
                    }
                    placeholder="Announcement content..."
                    rows={3}
                  />
                </div>
                
                <Button onClick={createAnnouncement} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Announcement
                </Button>
              </div>

              {/* Existing Announcements */}
              <div className="space-y-3">
                <h3 className="font-medium">Active Announcements</h3>
                {announcements.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No announcements yet</p>
                ) : (
                  announcements.map((announcement) => (
                    <div key={announcement.id} className="p-3 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Badge className={getAnnouncementColor(announcement.announcement_type)}>
                            {announcement.announcement_type}
                          </Badge>
                          <Badge variant="outline">
                            {announcement.target_audience}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={announcement.is_active}
                            onCheckedChange={(checked) => 
                              toggleAnnouncement(announcement.id, checked)
                            }
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteAnnouncement(announcement.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <h4 className="font-medium">{announcement.title}</h4>
                      <p className="text-sm text-gray-600">{announcement.content}</p>
                      
                      <p className="text-xs text-gray-500">
                        Created: {new Date(announcement.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <MobileBottomNav />
    </div>
  );
};

export default SystemSettings;
