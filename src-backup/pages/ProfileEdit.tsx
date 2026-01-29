import React, { useState } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export const ProfileEdit: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [birthday, setBirthday] = useState('');
  const [anniversaries, setAnniversaries] = useState([
    { date: '', label: '' },
    { date: '', label: '' },
    { date: '', label: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load current values (fetch only needed columns from supabase)
  React.useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('birthday, anniversary1_date, anniversary1_label, anniversary2_date, anniversary2_label, anniversary3_date, anniversary3_label')
        .eq('id', user.id)
        .single();
      if (error) {
        setError(error.message || 'Failed to load profile');
        setLoading(false);
        return;
      }
      if (data) {
        setBirthday(data.birthday || '');
        setAnniversaries([
          { date: data.anniversary1_date || '', label: data.anniversary1_label || '' },
          { date: data.anniversary2_date || '', label: data.anniversary2_label || '' },
          { date: data.anniversary3_date || '', label: data.anniversary3_label || '' },
        ]);
      }
      setLoading(false);
    })();
  }, [user]);

  const handleAnniversaryChange = (idx: number, field: 'date' | 'label', value: string) => {
    setAnniversaries(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const updates: any = {
        birthday: birthday || null,
        anniversary1_date: anniversaries[0].date || null,
        anniversary1_label: anniversaries[0].label || null,
        anniversary2_date: anniversaries[1].date || null,
        anniversary2_label: anniversaries[1].label || null,
        anniversary3_date: anniversaries[2].date || null,
        anniversary3_label: anniversaries[2].label || null,
      };
      console.log('Profile update payload:', updates);
      const { error } = await supabase.from('users').update(updates).eq('id', user.id);
      if (error) throw error;
      setSuccess(true);
      // Do not navigate away, stay on edit page for debugging
      // setTimeout(() => setSuccess(false), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // --- Birthdays & Anniversaries Card State ---
  const [extraBirthdays, setExtraBirthdays] = useState<{ name: string; date: string }[]>([]);
  const handleAddBirthday = () => setExtraBirthdays([...extraBirthdays, { name: '', date: '' }]);
  const handleBirthdayChange = (idx: number, field: 'name' | 'date', value: string) => {
    setExtraBirthdays(prev => prev.map((b, i) => i === idx ? { ...b, [field]: value } : b));
  };
  const handleRemoveBirthday = (idx: number) => setExtraBirthdays(prev => prev.filter((_, i) => i !== idx));

  // --- PGP Card State ---
  const [minors, setMinors] = useState<{ username: string; timeSpent: number; timeLimit: number; flagged: boolean }[]>([]);
  const [newMinor, setNewMinor] = useState('');
  const handleAddMinor = () => {
    if (newMinor.trim()) {
      setMinors([...minors, { username: newMinor.trim(), timeSpent: 0, timeLimit: 60, flagged: false }]);
      setNewMinor('');
    }
  };
  const handleRemoveMinor = (idx: number) => setMinors(prev => prev.filter((_, i) => i !== idx));
  const handleTimeLimitChange = (idx: number, value: number) => {
    setMinors(prev => prev.map((m, i) => i === idx ? { ...m, timeLimit: value } : m));
  };

  return (
    <Layout hideRightSidebar>
      <div className="max-w-lg mx-auto py-8 px-4 space-y-8">
        {/* Profile Edit Card (existing) */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Edit Profile</h2>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading profile...</div>
          ) : error ? (
            <div className="text-destructive mb-2 text-sm">{error}</div>
          ) : (
            <>
              {/* Birthday Section */}
              <div className="mb-6">
                <h3 className="font-semibold mb-2">Birthday</h3>
                <Input
                  type="date"
                  value={birthday}
                  onChange={e => setBirthday(e.target.value)}
                  className="w-full"
                />
              </div>
              {/* Anniversaries Section */}
              <div className="mb-6">
                <h3 className="font-semibold mb-2 mt-4">Anniversaries (max 3)</h3>
                {anniversaries.map((a, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <Input
                      type="date"
                      value={a.date}
                      onChange={e => handleAnniversaryChange(i, 'date', e.target.value)}
                      placeholder="Date"
                      className="flex-1"
                    />
                    <Input
                      type="text"
                      value={a.label}
                      onChange={e => handleAnniversaryChange(i, 'label', e.target.value)}
                      placeholder="Label (e.g. Wedding, Graduation)"
                      maxLength={32}
                      className="flex-1"
                    />
                  </div>
                ))}
                <div className="text-xs text-muted-foreground">You can only add up to 3 anniversaries.</div>
              </div>
              {/* Error and Success Messages */}
              {success && <div className="text-green-600 mb-2 text-sm">Saved!</div>}
              {/* Action Buttons */}
              <div className="space-y-2">
                <Button 
                  className="w-full" 
                  onClick={handleSave} 
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save'}
                </Button>
                <Button 
                  className="w-full" 
                  variant="outline" 
                  onClick={() => navigate(-1)}
                >
                  Cancel
                </Button>
              </div>
            </>
          )}
        </Card>

        {/* Birthdays & Anniversaries Card */}
        <Card className="p-6">
          <h2 className="text-lg font-bold mb-4">Birthdays & Anniversaries</h2>
          <div className="mb-4">
            <h3 className="font-semibold mb-2">Add Loved Ones' Birthdays</h3>
            {extraBirthdays.map((b, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <Input
                  type="text"
                  value={b.name}
                  onChange={e => handleBirthdayChange(i, 'name', e.target.value)}
                  placeholder="Name (e.g. Mom, Best Friend)"
                  className="flex-1"
                />
                <Input
                  type="date"
                  value={b.date}
                  onChange={e => handleBirthdayChange(i, 'date', e.target.value)}
                  className="flex-1"
                />
                <Button variant="outline" size="sm" onClick={() => handleRemoveBirthday(i)}>
                  Remove
                </Button>
              </div>
            ))}
            <Button size="sm" onClick={handleAddBirthday} className="mt-2">Add Birthday</Button>
          </div>
          <div className="mb-2">
            <h3 className="font-semibold mb-2">Add Anniversaries</h3>
            <div className="text-xs text-muted-foreground mb-2">Add any special dates (e.g. Wedding, Graduation, etc.)</div>
            {/* You can reuse the anniversaries section above or add more here if needed */}
          </div>
        </Card>

        {/* Parental Guidance Portal (PGP) Card */}
        <Card className="p-6">
          <h2 className="text-lg font-bold mb-4">Parental Guidance Portal (PGP)</h2>
          <div className="mb-4">
            <h3 className="font-semibold mb-2">Add Minor's Account (Ages 13-18)</h3>
            <div className="flex gap-2 mb-2">
              <Input
                type="text"
                value={newMinor}
                onChange={e => setNewMinor(e.target.value)}
                placeholder="Minor's Username"
                className="flex-1"
              />
              <Button size="sm" onClick={handleAddMinor}>Add</Button>
            </div>
            {minors.length === 0 && <div className="text-xs text-muted-foreground mb-2">No minors added yet.</div>}
            {minors.map((m, i) => (
              <div key={i} className="border rounded p-2 mb-2 flex flex-col gap-1 bg-gray-50 dark:bg-gray-800">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">{m.username}</span>
                  <Button variant="outline" size="sm" onClick={() => handleRemoveMinor(i)}>Remove</Button>
                </div>
                <div className="text-xs">Time Spent: {m.timeSpent} min</div>
                <div className="flex items-center gap-2">
                  <span className="text-xs">Time Limit:</span>
                  <Input
                    type="number"
                    min={10}
                    max={240}
                    value={m.timeLimit}
                    onChange={e => handleTimeLimitChange(i, Number(e.target.value))}
                    className="w-20"
                  />
                  <span className="text-xs">min/day</span>
                </div>
                <div className={`text-xs ${m.flagged ? 'text-red-600' : 'text-green-600'}`}>Flagged: {m.flagged ? 'Yes' : 'No'}</div>
                {/* Future: Show conversations, red flag alerts, reports, etc. */}
              </div>
            ))}
          </div>
          <div className="text-xs text-muted-foreground">Add minors to supervise their activity, set time limits, and receive alerts for flagged conversations.</div>
        </Card>
      </div>
    </Layout>
  );
};

export default ProfileEdit;
