// Safe test script: fetch user emails from Supabase and optionally send a test announcement
// Usage:
//  node scripts/test-send-announcement.js           -> dry-run (lists count + sample emails)
//  CONFIRM_SEND=yes node scripts/test-send-announcement.js --send [--subject "Sub"] [--message "Msg"] [--limit N]

const SUPABASE_URL = "https://pfemdshixllwqqajsxxp.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmZW1kc2hpeGxsd3FxYWpzeHhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzMTU2MDcsImV4cCI6MjA2Mzg5MTYwN30.eXXVNv9p4qMkkS8gr5YZrgaGRqwY5TI2X9F8CUu6lEk";
const EMAIL_BACKEND = process.env.EMAIL_BACKEND || 'http://localhost:3001/send-bulk';

async function fetchUserEmails() {
  const url = `${SUPABASE_URL}/rest/v1/users?select=email`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept: 'application/json'
    }
  });
  if (!res.ok) throw new Error(`Supabase request failed: ${res.status} ${res.statusText}`);
  const data = await res.json();
  return data.map(u => u.email).filter(Boolean);
}

async function sendBulk(emails, subject, message) {
  const res = await fetch(EMAIL_BACKEND, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emails, subject, message })
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Email backend failed: ${res.status} ${res.statusText} - ${txt}`);
  }
  return res.json();
}

(async () => {
  try {
    console.log('Fetching user emails (dry-run by default)...');
    const emails = await fetchUserEmails();
    console.log(`Found ${emails.length} users with emails.`);
    const sample = emails.slice(0, 10);
    console.log('Sample emails:', sample);

    const args = process.argv.slice(2);
    const shouldSend = args.includes('--send') && process.env.CONFIRM_SEND === 'yes';
    const subjectIdx = args.indexOf('--subject');
    const messageIdx = args.indexOf('--message');
    const limitIdx = args.indexOf('--limit');
    const toIdx = args.indexOf('--to');
    const subject = subjectIdx !== -1 ? args[subjectIdx + 1] : 'Test Announcement';
    const message = messageIdx !== -1 ? args[messageIdx + 1] : 'This is a test announcement triggered from scripts/test-send-announcement.js';
    const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : null;
    const toArg = toIdx !== -1 ? args[toIdx + 1] : null;

    // If --to is provided, use that list instead of fetching from Supabase.
    const explicitRecipients = toArg ? toArg.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean) : null;

    if (!shouldSend && !explicitRecipients) {
      console.log('\nDRY RUN: No emails were sent.');
      console.log('To perform a controlled send, re-run with PowerShell like:');
      console.log("  $env:CONFIRM_SEND='yes'; node scripts/test-send-announcement.js --send --subject \"Your sub\" --message \"Your msg\" --limit 50");
      console.log('Or send to explicit recipients without Supabase using:');
      console.log("  $env:CONFIRM_SEND='yes'; node scripts/test-send-announcement.js --send --to 'test@example.com' --subject 'Hi' --message 'Hello'");
      return;
    }

    const toSend = explicitRecipients ? explicitRecipients : (limit ? emails.slice(0, limit) : emails);
    if (toSend.length === 0) {
      console.log('No emails to send.');
      return;
    }

    console.log(`Sending announcement to ${toSend.length} emails...`);
    const resp = await sendBulk(toSend, subject, message);
    console.log('Email backend response:', resp);
  } catch (err) {
    console.error('Error:', err);
    process.exitCode = 1;
  }
})();
