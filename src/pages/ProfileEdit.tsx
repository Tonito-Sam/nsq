import React, { useState } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { OrganizationsTab } from '@/components/OrganizationsTab';
import { useOrganizations } from '@/hooks/useOrganizations';

export const ProfileEdit: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'profile' | 'birthdays' | 'pgp' | 'organizations'>('profile');
  const location = useLocation();
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

  // If a `tab` query param is present, switch to that tab (e.g. ?tab=organizations)
  React.useEffect(() => {
    try {
      const qp = new URLSearchParams(location.search).get('tab');
      if (qp === 'organizations' || qp === 'birthdays' || qp === 'pgp' || qp === 'profile') {
        setActiveTab(qp as any);
      }
    } catch (e) {
      // ignore
    }
  }, [location.search]);

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

  // Organizations preview (for Profile Edit main column)
  const { organizations, loading: orgsLoading, fetchOrganizations } = useOrganizations();

  React.useEffect(() => {
    // fetch organizations for preview
    fetchOrganizations();
  }, [fetchOrganizations]);

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
        {/* Tabs Navigation */}
        <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'profile'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab('birthdays')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'birthdays'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            Birthdays & Anniversaries
          </button>
          <button
            onClick={() => setActiveTab('pgp')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'pgp'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            PGP
          </button>
          <button
            onClick={() => setActiveTab('organizations')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'organizations'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            Organizations
          </button>
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <>
            {/* Profile Edit Card */}
            <Card className="p-6 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-white to-blue-50 dark:from-gray-900 dark:to-blue-950/20">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold">Edit Profile</h2>
              </div>
              {loading ? (
                <div className="text-center py-8 text-gray-500">Loading profile...</div>
              ) : error ? (
                <div className="text-destructive mb-4 text-sm p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">{error}</div>
              ) : (
                <>
                  {/* Birthday Section */}
                  <div className="mb-6">
                    <label className="block text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">🎂 Birthday</label>
                    <Input
                      type="date"
                      value={birthday}
                      onChange={e => setBirthday(e.target.value)}
                      className="w-full border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    />
                  </div>
                  {/* Anniversaries Section */}
                  <div className="mb-6">
                    <label className="block text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">💍 Anniversaries (max 3)</label>
                    <div className="space-y-3">
                      {anniversaries.map((a, i) => (
                        <div key={i} className="flex gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                          <Input
                            type="date"
                            value={a.date}
                            onChange={e => handleAnniversaryChange(i, 'date', e.target.value)}
                            placeholder="Date"
                            className="flex-1 border border-gray-300 dark:border-gray-600"
                          />
                          <Input
                            type="text"
                            value={a.label}
                            onChange={e => handleAnniversaryChange(i, 'label', e.target.value)}
                            placeholder="Label (e.g. Wedding)"
                            maxLength={32}
                            className="flex-1 border border-gray-300 dark:border-gray-600"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">ℹ️ You can only add up to 3 anniversaries.</div>
                  </div>
                  {/* Error and Success Messages */}
                  {success && <div className="text-green-600 mb-4 text-sm p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">✓ Saved successfully!</div>}
                  {/* Action Buttons */}
                  <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Button 
                      className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600" 
                      onClick={handleSave} 
                      disabled={saving}
                    >
                      {saving ? 'Saving...' : '💾 Save Changes'}
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

            {/* PGP Card */}
            <Card className="p-6 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-white to-orange-50 dark:from-gray-900 dark:to-orange-950/20">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold">Parental Guidance Portal (PGP)</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4 p-3 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-lg">
                🛡️ Monitor and manage minor accounts (ages 13-18) under your supervision
              </p>
              <div className="mb-6">
                <h3 className="font-semibold mb-3 text-gray-700 dark:text-gray-300">Add Minor's Account</h3>
                <div className="flex gap-2 mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <Input
                    type="text"
                    value={newMinor}
                    onChange={e => setNewMinor(e.target.value)}
                    placeholder="Minor's Username"
                    className="flex-1 border border-gray-300 dark:border-gray-600"
                  />
                  <Button size="sm" onClick={handleAddMinor} className="bg-orange-600 hover:bg-orange-700">Add</Button>
                </div>
                {minors.length === 0 && <div className="text-xs text-muted-foreground mb-2">No minors added yet.</div>}
                <div className="space-y-3">
                  {minors.map((m, i) => (
                    <div key={i} style={{borderLeft: '4px solid rgb(251, 146, 60)'}} className="rounded-r-lg p-3 mb-2 flex flex-col gap-2 bg-orange-50 dark:bg-orange-950/20 border-r border-b border-t border-gray-200 dark:border-gray-700">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">{m.username}</span>
                        <Button variant="outline" size="sm" onClick={() => handleRemoveMinor(i)} className="text-red-600 border-red-300 hover:bg-red-50">Remove</Button>
                      </div>
                      <div className="text-xs">⏱️ Time Spent: {m.timeSpent} min</div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs">⏲️ Time Limit:</span>
                        <Input
                          type="number"
                          min={10}
                          max={240}
                          value={m.timeLimit}
                          onChange={e => handleTimeLimitChange(i, Number(e.target.value))}
                          className="w-20 border border-gray-300 dark:border-gray-600"
                        />
                        <span className="text-xs">min/day</span>
                      </div>
                      <div className={`text-xs font-semibold ${m.flagged ? 'text-red-600' : 'text-green-600'}`}>
                        {m.flagged ? '🚩 Flagged: Yes' : '✓ Flagged: No'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="text-xs text-muted-foreground p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                ℹ️ Add minors to supervise their activity, set time limits, and receive alerts for flagged conversations.
              </div>
            </Card>
          </>
        )}

        {/* Organizations Card - ALWAYS VISIBLE (outside all tabs) */}
        <Card className="p-6 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-white to-purple-50 dark:from-gray-900 dark:to-purple-950/20">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold">Organizations</h2>
          </div>
          {orgsLoading ? (
            <div className="text-sm text-gray-500">Loading organizations...</div>
          ) : organizations && organizations.length > 0 ? (
            <div className="space-y-3">
              {organizations.slice(0, 3).map((o) => (
                <div key={o.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 transition-colors">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">{o.name}</div>
                    {o.description && <div className="text-xs text-muted-foreground">{o.description}</div>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/org/${o.slug || o.id}`)}>View</Button>
                </div>
              ))}
              {organizations.length > 3 && (
                <div className="text-xs text-muted-foreground p-2">And {organizations.length - 3} more...</div>
              )}
              <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <Button onClick={() => setActiveTab('organizations')} className="w-full bg-purple-600 hover:bg-purple-700">📋 Manage Organizations</Button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500 p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg text-center">
              <p className="mb-3">You don't have any organizations yet.</p>
              <Button onClick={() => setActiveTab('organizations')} className="w-full bg-purple-600 hover:bg-purple-700">🏢 Create Organization</Button>
            </div>
          )}
        </Card>

        {/* Bank Account Details Card - ALWAYS VISIBLE */}
        <Card className="p-6 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-white to-cyan-50 dark:from-gray-900 dark:to-cyan-950/20">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
            <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
              <svg className="w-5 h-5 text-cyan-600 dark:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold">Bank Account Details</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">🌍 Country</label>
              <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-cyan-500 dark:focus:ring-cyan-400 focus:border-transparent">
                <option>South Africa</option>
                <option>United States</option>
                <option>United Kingdom</option>
                <option>Canada</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">🗺️ State/Province</label>
              <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-cyan-500 dark:focus:ring-cyan-400 focus:border-transparent">
                <option>Gauteng</option>
                <option>Western Cape</option>
                <option>KwaZulu-Natal</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">🏦 Bank</label>
              <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-cyan-500 dark:focus:ring-cyan-400 focus:border-transparent">
                <option>First National Bank</option>
                <option>Standard Bank</option>
                <option>ABSA</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">🔢 Account Number</label>
              <Input type="text" placeholder="Enter account number" className="w-full border border-gray-300 dark:border-gray-600" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">👤 Account Holder Name</label>
              <Input type="text" placeholder="Enter account holder name" className="w-full border border-gray-300 dark:border-gray-600" />
            </div>
            <Button className="w-full bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-500 dark:hover:bg-cyan-600">💾 Save Bank Details</Button>
          </div>
        </Card>

        {/* Birthdays & Anniversaries Tab */}
        {activeTab === 'birthdays' && (
          <Card className="p-6 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-white to-green-50 dark:from-gray-900 dark:to-green-950/20">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold">Birthdays & Anniversaries</h2>
            </div>
            <div className="mb-6">
              <h3 className="font-semibold mb-3 text-gray-700 dark:text-gray-300">🎉 Add Loved Ones' Birthdays</h3>
              <div className="space-y-3">
                {extraBirthdays.map((b, i) => (
                  <div key={i} className="flex gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <Input
                      type="text"
                      value={b.name}
                      onChange={e => handleBirthdayChange(i, 'name', e.target.value)}
                      placeholder="Name (e.g. Mom, Best Friend)"
                      className="flex-1 border border-gray-300 dark:border-gray-600"
                    />
                    <Input
                      type="date"
                      value={b.date}
                      onChange={e => handleBirthdayChange(i, 'date', e.target.value)}
                      className="flex-1 border border-gray-300 dark:border-gray-600"
                    />
                    <Button variant="outline" size="sm" onClick={() => handleRemoveBirthday(i)} className="border-gray-300 dark:border-gray-600">
                      ✕
                    </Button>
                  </div>
                ))}
              </div>
              <Button size="sm" onClick={handleAddBirthday} className="mt-3 bg-green-600 hover:bg-green-700">+ Add Birthday</Button>
            </div>
          </Card>
        )}

        {/* Organizations Tab */}
        {activeTab === 'organizations' && (
          <OrganizationsTab />
        )}
      </div>
    </Layout>
  );
};

export default ProfileEdit;