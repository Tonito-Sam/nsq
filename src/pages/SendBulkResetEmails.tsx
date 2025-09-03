// filepath: src/pages/SendBulkResetEmails.tsx
import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

const SendBulkResetEmails = () => {
  const [sending, setSending] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [tab, setTab] = useState<'reset-all' | 'reset-selected' | 'reset-single' | 'announce-all' | 'announce-single'>('reset-all');
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [singleEmail, setSingleEmail] = useState('');
  const [announcement, setAnnouncement] = useState({ subject: '', message: '' });
  const [users, setUsers] = useState<{ email: string }[]>([]);

  // Fetch all users for selection
  React.useEffect(() => {
    supabase.from('users').select('email').then(({ data }) => {
      if (data) setUsers(data);
    });
  }, []);

  const sendReset = async (emails: string[]) => {
    for (const email of emails) {
      if (!email) continue;
      try {
        // @ts-ignore
        const { error: resetError } = await supabase.auth.api.resetPasswordForEmail(email, {
          redirectTo: 'https://1voicesquare.com/reset-password',
        });
        if (resetError) {
          setLog(prev => [...prev, `Failed to send reset email to ${email}: ${resetError.message}`]);
        } else {
          setLog(prev => [...prev, `Reset email sent to ${email}`]);
        }
        await new Promise(res => setTimeout(res, 2000));
      } catch (err: any) {
        setLog(prev => [...prev, `Error for ${email}: ${err.message}`]);
      }
    }
  };

  // Simulate announcement email sending (replace with backend API for real email sending)
  const sendAnnouncement = async (emails: string[]) => {
    for (const email of emails) {
      setLog(prev => [...prev, `Announcement sent to ${email} (subject: ${announcement.subject})`]);
      await new Promise(res => setTimeout(res, 500));
    }
  };

  const handleSend = async () => {
    setSending(true);
    setLog([]);
    setDone(false);
    if (tab === 'reset-all') {
      await sendReset(users.map(u => u.email));
    } else if (tab === 'reset-selected') {
      await sendReset(selectedEmails);
    } else if (tab === 'reset-single') {
      await sendReset([singleEmail]);
    } else if (tab === 'announce-all') {
      await sendAnnouncement(users.map(u => u.email));
    } else if (tab === 'announce-single') {
      await sendAnnouncement([singleEmail]);
    }
    setSending(false);
    setDone(true);
  };

  return (
    <div className="max-w-xl mx-auto py-12">
      <h1 className="text-2xl font-bold mb-6">Admin: Bulk Email & Announcements</h1>
      <div className="flex space-x-2 mb-4">
        <Button variant={tab === 'reset-all' ? 'default' : 'outline'} onClick={() => setTab('reset-all')}>Reset All</Button>
        <Button variant={tab === 'reset-selected' ? 'default' : 'outline'} onClick={() => setTab('reset-selected')}>Reset Selected</Button>
        <Button variant={tab === 'reset-single' ? 'default' : 'outline'} onClick={() => setTab('reset-single')}>Reset Single</Button>
        <Button variant={tab === 'announce-all' ? 'default' : 'outline'} onClick={() => setTab('announce-all')}>Announce All</Button>
        <Button variant={tab === 'announce-single' ? 'default' : 'outline'} onClick={() => setTab('announce-single')}>Announce Single</Button>
      </div>
      {tab === 'reset-selected' && (
        <div className="mb-4">
          <label className="block mb-2 font-medium">Select users:</label>
          <select multiple className="w-full border rounded p-2" value={selectedEmails} onChange={e => setSelectedEmails(Array.from(e.target.selectedOptions, o => o.value))}>
            {users.map(u => (
              <option key={u.email} value={u.email}>{u.email}</option>
            ))}
          </select>
        </div>
      )}
      {(tab === 'reset-single' || tab === 'announce-single') && (
        <div className="mb-4">
          <label className="block mb-2 font-medium">User email:</label>
          <input type="email" className="w-full border rounded p-2" value={singleEmail} onChange={e => setSingleEmail(e.target.value)} placeholder="user@example.com" />
        </div>
      )}
      {(tab === 'announce-all' || tab === 'announce-single') && (
        <div className="mb-4">
          <label className="block mb-2 font-medium">Subject:</label>
          <input type="text" className="w-full border rounded p-2 mb-2" value={announcement.subject} onChange={e => setAnnouncement(a => ({ ...a, subject: e.target.value }))} placeholder="Announcement subject" />
          <label className="block mb-2 font-medium">Message:</label>
          <textarea className="w-full border rounded p-2" rows={4} value={announcement.message} onChange={e => setAnnouncement(a => ({ ...a, message: e.target.value }))} placeholder="Announcement message" />
        </div>
      )}
      <Button onClick={handleSend} disabled={sending} className="mb-4">
        {sending ? 'Sending...' : 'Send'}
      </Button>
      <div className="bg-gray-100 rounded p-4 text-sm h-64 overflow-y-auto">
        {log.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
        {done && <div className="mt-4 text-green-600 font-bold">All done!</div>}
      </div>
      <div className="mt-4 text-xs text-gray-500">
        <strong>Note:</strong> For real announcement emails, use a backend service or SMTP provider.<br />
        This page is for admin use only.
      </div>
    </div>
  );
};

export default SendBulkResetEmails;
