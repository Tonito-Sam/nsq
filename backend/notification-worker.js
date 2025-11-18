// backend/notification-worker.js
/*
  Notification worker
  - Listens for inserts into the `notifications` table via Supabase realtime
  - Sends email via the repo's email-backend (configurable via EMAIL_BACKEND_URL)
  - Marks notification record as email_sent in the `data` JSON when an email was attempted

  Usage (PowerShell):
    $env:SUPABASE_URL = 'https://your-project.supabase.co'
    $env:SUPABASE_SERVICE_ROLE_KEY = 'your-service-role-key'
    $env:EMAIL_BACKEND_URL = 'http://localhost:4000' # or your email backend endpoint
    node backend/notification-worker.js

  Notes:
  - Use the Service Role key for the Supabase client so the worker can read profiles and notifications regardless of RLS.
  - The worker is simple and intended for development / small production usage. For heavy load, run behind a queue (BullMQ, RabbitMQ) or serverless function.
*/

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const EMAIL_BACKEND_URL = process.env.EMAIL_BACKEND_URL;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables. Aborting.');
  process.exit(1);
}
if (!EMAIL_BACKEND_URL) {
  console.warn('EMAIL_BACKEND_URL not set. Emails will not be sent (worker will still log).');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: { params: { eventsPerSecond: 10 } },
});

async function handleInsert(payload) {
  try {
    const note = payload.new;
    if (!note || !note.user_id) return;

    console.log('[notification-worker] new notification', note.id, note.type, 'for', note.user_id);

    // Fetch recipient email and preference
    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('id, email, notify_by_email')
      .eq('id', note.user_id)
      .maybeSingle();

    if (userErr) {
      console.error('[notification-worker] error fetching user:', userErr);
      return;
    }
    if (!userRow) {
      console.warn('[notification-worker] no user found for id', note.user_id);
      return;
    }

    const shouldEmail = !!userRow.notify_by_email;

    // Prepare email subject/body from notification payload
    const actor = note.actor_id || note.data?.actor_name || 'Someone';
    const preview = note.data?.preview || '';
    const subject = note.type === 'comment' ? `${actor} commented on your reel` : `New activity on your content`;
    const html = `
      <p>${actor} performed <strong>${note.type}</strong> on your ${note.reference_type || 'item'}.</p>
      <p style="color:#666">${preview}</p>
      <p><a href="${note.data?.url || '/'}">View on NexSq</a></p>
    `;

    let emailSent = false;
    if (shouldEmail && EMAIL_BACKEND_URL) {
      // Try multiple common payload shapes to accommodate different email backends.
      const endpointBase = EMAIL_BACKEND_URL.replace(/\/$/, '');
      const candidatePayloads = [
        // Default: { to, subject, html }
        { to: userRow.email, subject, html },
        // Alternate: { recipient, subject, html }
        { recipient: userRow.email, subject, html },
        // Array style: { to: [email], subject, html }
        { to: [userRow.email], subject, html },
        // SendGrid-like: personalizations + content
        {
          personalizations: [{ to: [{ email: userRow.email }] }],
          subject,
          content: [{ type: 'text/html', value: html }]
        },
        // Generic envelope/content
        { envelope: { to: userRow.email }, content: { subject, html } }
      ];

      const maxAttempts = 3;
      let attempt = 0;
      let lastErr = null;

      // We will try payloads in order; for each payload, attempt up to maxAttempts with backoff
      for (const payload of candidatePayloads) {
        attempt = 0;
        while (attempt < maxAttempts) {
          attempt += 1;
          try {
            const res = await fetch(`${endpointBase}/send`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            if (!res.ok) {
              const bodyText = await res.text().catch(() => '');
              lastErr = new Error(`email backend responded ${res.status} ${bodyText}`);
              console.error('[notification-worker] payload attempt', attempt, 'failed for payload shape', Object.keys(payload), lastErr.message || lastErr);
            } else {
              console.log('[notification-worker] email sent to', userRow.email, 'using payload shape', Object.keys(payload));
              emailSent = true;
              break;
            }
          } catch (err) {
            lastErr = err;
            console.error('[notification-worker] payload attempt', attempt, 'error sending email:', err?.message || err);
          }

          // exponential backoff (ms)
          const backoff = Math.pow(2, attempt) * 250;
          await new Promise(r => setTimeout(r, backoff));
        }

        if (emailSent) break;
      }

      if (!emailSent) {
        console.error('[notification-worker] all attempts failed to send email for notification', note.id, 'last error:', lastErr && (lastErr.message || lastErr));
      }
    } else {
      console.log('[notification-worker] skipping email (preference or backend not set) for', userRow.email);
    }

    // Update notification record to mark email_sent when appropriate
    try {
      const updates = { updated_at: new Date().toISOString() };
      if (emailSent) {
        updates.email_sent = true;
      }
      // Also keep a lightweight audit in data if desired
      const patchedData = { ...(note.data || {}), last_email_attempt_at: new Date().toISOString(), last_email_attempt_success: !!emailSent };
      updates.data = patchedData;
      await supabase.from('notifications').update(updates).eq('id', note.id);
    } catch (err) {
      console.error('[notification-worker] failed to update notification record', err);
    }
  } catch (err) {
    console.error('[notification-worker] unexpected error handling insert:', err);
  }
}

async function start() {
  console.log('[notification-worker] starting...');

  const chan = supabase
    .channel('public:notifications')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, handleInsert)
    .subscribe((status) => {
      console.log('[notification-worker] subscription status:', status);
    });

  process.on('SIGINT', async () => {
    console.log('Shutting down worker...');
    try { await supabase.removeChannel(chan); } catch (e) { /* ignore */ }
    process.exit(0);
  });
}

start().catch(err => {
  console.error('Failed to start notification worker:', err);
  process.exit(1);
});
