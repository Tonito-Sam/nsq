import React from 'react';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Settings as SettingsIcon, Bell, Shield, User, Palette, Globe } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const Settings = () => {
  const { user, signOut } = useAuth();
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [deleteReason, setDeleteReason] = React.useState('');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a]">
      <Header />
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Settings</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your account preferences</p>
        </div>



        <div className="space-y-6">

         

          {/* Privacy Settings */}
          <Card className="dark:bg-[#161616]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Privacy & Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Private Account</Label>
                  <p className="text-sm text-gray-500">Only approved followers can see your posts</p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Two-Factor Authentication</Label>
                  <p className="text-sm text-gray-500">Add an extra layer of security</p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Show Online Status</Label>
                  <p className="text-sm text-gray-500">Let others see when you're online</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card className="dark:bg-[#161616]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Push Notifications</Label>
                  <p className="text-sm text-gray-500">Receive notifications on your device</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-gray-500">Receive notifications via email</p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Like Notifications</Label>
                  <p className="text-sm text-gray-500">Get notified when someone likes your post</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Comment Notifications</Label>
                  <p className="text-sm text-gray-500">Get notified when someone comments</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          {/* Appearance Settings */}
          <Card className="dark:bg-[#161616]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Appearance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Dark Mode</Label>
                  <p className="text-sm text-gray-500">Switch to dark theme</p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto Theme</Label>
                  <p className="text-sm text-gray-500">Follow system preference</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          {/* Language Settings */}
          <Card className="dark:bg-[#161616]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Language & Region
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="language">Language</Label>
                <Input id="language" value="English (US)" readOnly />
              </div>
              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <Input id="timezone" value="UTC-5 (Eastern Time)" readOnly />
              </div>
            </CardContent>
          </Card>


           {/* Account Management (now at the bottom) */}
          <Card className="dark:bg-[#161616] mt-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5" />
                Account Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-destructive text-sm mb-2">
                <strong>Danger Zone:</strong> Deleting your account is permanent and cannot be undone.
              </div>
              {deleteError && <div className="text-destructive text-xs mb-2">{deleteError}</div>}
              <Button variant="destructive" className="w-full" disabled={deleting} onClick={() => setShowDeleteModal(true)}>
                {deleting ? 'Deleting Account...' : 'Delete Account'}
              </Button>

              <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete Account</DialogTitle>
                    <DialogDescription>This will permanently delete your account. Please tell us why (optional).</DialogDescription>
                  </DialogHeader>

                  <div className="mt-2">
                    <Label htmlFor="delete-reason">Reason for deleting (optional)</Label>
                    <Textarea id="delete-reason" value={deleteReason} onChange={e => setDeleteReason(e.target.value)} rows={4} />
                  </div>

                  <DialogFooter>
                    <div className="flex w-full gap-2">
                      <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
                      <Button variant="destructive" className="ml-auto" disabled={deleting} onClick={async () => {
                        if (!user) return;
                        setDeleting(true);
                        setDeleteError(null);
                        try {
                          // Call backend endpoint that uses service role to delete auth user and users table
                          const resp = await fetch('/api/users/delete', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: user.id, reason: deleteReason })
                          });
                          if (!resp.ok) {
                            const body = await resp.json().catch(() => ({}));
                            throw new Error(body && body.error ? body.error : 'Deletion failed');
                          }

                          // Also attempt to remove any client-side profile rows (best-effort)
                          try {
                            await supabase.from('users').delete().eq('id', user.id);
                          } catch (e) {
                            // ignore client-side deletion errors
                          }

                          await signOut();
                          // Redirect to external about page as requested
                          window.location.href = 'https://nexsq.com/about';
                        } catch (err: any) {
                          setDeleteError(err.message || 'Failed to delete account. Please contact support.');
                        } finally {
                          setDeleting(false);
                          setShowDeleteModal(false);
                        }
                      }}>Confirm Delete</Button>
                    </div>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Settings;
