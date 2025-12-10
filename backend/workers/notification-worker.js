// Notification worker: polls notifications table and sends immediate emails via email-backend
const dotenv = require('dotenv');
dotenv.config();

let fetchFn;
if (typeof fetch !== 'undefined') fetchFn = fetch;
else {
  try {
    const nf = require('node-fetch');
    fetchFn = nf && nf.default ? nf.default : nf;
  } catch (e) {
    console.error('node-fetch is required in this runtime. Install it or run on Node 18+');
    process.exit(1);
  }
}

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/,'');
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL_BACKEND = process.env.EMAIL_BACKEND_URL || 'http://localhost:4000';
const POLL_MS = parseInt(process.env.NOTIFICATION_WORKER_POLL_MS || '8000', 10);
const BATCH_SIZE = parseInt(process.env.NOTIFICATION_WORKER_BATCH || '300', 10);

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env. Aborting.');
  process.exit(1);
}

// Basic validation to catch placeholder values and obvious misconfiguration early
const placeholderPatterns = ["your-supabase", "your-supabase-url", "example", "replace-me"];
for (const p of placeholderPatterns) {
  if (SUPABASE_URL.includes(p) || (SERVICE_ROLE && SERVICE_ROLE.includes(p))) {
    console.error(`SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY appears to be a placeholder ('${p}'). Please set real values in environment before running the worker.`);
    console.error('Example (PowerShell):');
    console.error("$env:SUPABASE_URL='https://<project-ref>.supabase.co'");
    console.error("$env:SUPABASE_SERVICE_ROLE_KEY='<service-role-key>'");
    process.exit(1);
  }
}

if (!/^https?:\/\/.+\..+/.test(SUPABASE_URL)) {
  console.error('SUPABASE_URL does not look like a valid URL. Ensure it includes protocol and domain (https://...). Aborting.');
  process.exit(1);
}

const immediateTypes = new Set(['comment','mention','message','reply','follow']);
const reactionTypes = new Set(['like','reaction','emoji','love']);

const fs = require('fs');
const path = require('path');

function loadTemplate(name) {
  try {
    const p = path.join(__dirname, 'templates', `${name}.html`);
    return fs.readFileSync(p, 'utf8');
  } catch (e) {
    return null;
  }
}

function renderTemplateString(tpl, vars) {
  if (!tpl) return '';
  return tpl.replace(/\{\{\s*([A-Z0-9_.]+)\s*\}\}/g, (_, key) => {
    const val = vars[key] || '';
    return String(val);
  });
}

function renderEmailTemplate(notification, user, actor) {
  const payload = notification.payload || {};
  const extractName = (u) => {
    if (!u) return '';
    return u.full_name || u.fullName || u.name || u.username || (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || u.email || '';
  };

  const vars = {
    USER_FULL_NAME: extractName(user) || user?.email || '',
    ACTOR_NAME: extractName(actor) || actor?.username || 'Someone',
    OBJECT_TYPE: notification.object_type || '',
    OBJECT_ID: notification.object_id || '',
    MESSAGE: payload.message || payload.comment || '',
    URL: payload.url || '#',
    SITE_TITLE: 'NexSq',
    SENDER_NAME: process.env.SENDER_NAME || process.env.SENDER_EMAIL || 'NexSq'
  };

  const tplName = (notification.type === 'comment' || notification.type === 'reply') ? 'comment' :
    (notification.type === 'mention' ? 'mention' :
      (notification.type === 'message' ? 'message' :
        (reactionTypes.has(notification.type) ? 'reaction' : 'generic')));

  const tpl = loadTemplate(tplName) || loadTemplate('generic');
  const html = renderTemplateString(tpl, vars);
  const subject = `${vars.ACTOR_NAME} ${notification.type} on ${vars.OBJECT_TYPE || 'your content'}`;
  return { subject, html };
}

async function fetchJson(url, opts) {
  try {
    const resp = await fetchFn(url, opts);
    const text = await resp.text();
    if (!resp.ok) {
      console.error(`fetchJson ERROR: ${url} returned ${resp.status} - ${text}`);
      throw new Error(`fetch ${url} failed ${resp.status} ${text}`);
    }
    try {
      return JSON.parse(text || '[]');
    } catch (e) {
      console.error('fetchJson parse error for', url, 'body:', text);
      throw e;
    }
  } catch (e) {
    console.error('fetchJson network/error for', url, e && e.message ? e.message : e);
    throw e;
  }
}

function supabaseAuthHeaders(extra) {
  return Object.assign({ apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` }, extra || {});
}

// Try several common tables for user/profile rows since projects vary
async function getUserById(id) {
  if (!id) return null;
  const tables = ['users', 'profiles', 'auth.users'];
  for (const t of tables) {
    try {
      const uUrl = `${SUPABASE_URL}/rest/v1/${t}?id=eq.${encodeURIComponent(id)}&select=*&limit=1`;
      const res = await fetchJson(uUrl, { method: 'GET', headers: supabaseAuthHeaders() });
      if (res && res.length) return res[0];
    } catch (e) {
      // ignore and try next
    }
  }
  return null;
}

async function sendEmail(email, subject, html) {
  const url = `${EMAIL_BACKEND.replace(/\/$/,'')}/send-notification`;
  try {
    const resp = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, subject, message: html })
    });
    const text = await resp.text();
    if (!resp.ok) {
      console.error(`sendEmail ERROR: ${url} returned ${resp.status} - ${text}`);
      throw new Error(`email backend failed: ${resp.status} ${text}`);
    }
    return text;
  } catch (e) {
    // Improve logging for network errors (ECONNREFUSED, ENOTFOUND, TLS errors etc.)
    const code = e && (e.code || (e.cause && e.cause.code));
    const name = e && e.name;
    const msg = e && e.message;
    console.error('sendEmail network/error for', url, 'name=', name, 'code=', code, 'message=', msg);
    if (e && e.stack) console.error(e.stack);
    throw e;
  }
}

// Ping the email backend once to ensure it's reachable before attempting sends
async function isEmailBackendReachable() {
  const url = `${EMAIL_BACKEND.replace(/\/$/,'')}/health`;
  try {
    const r = await fetchFn(url, { method: 'GET', headers: { Accept: 'application/json' }, /* no auth */ });
    // Consider reachable only if we get a 2xx
    return r.ok;
  } catch (e) {
    const code = e && (e.code || (e.cause && e.cause.code));
    console.warn('Email backend health check failed:', code || e && e.message || e);
    return false;
  }
}

async function processBatch() {
  try {
    // fetch undelivered notifications up to batch, handle both false and null delivered_email
    const url = `${SUPABASE_URL}/rest/v1/notifications?or=(delivered_email.eq.false,delivered_email.is.null)&order=created_at.asc&limit=${BATCH_SIZE}`;
    let resp;
    let text = '';
    try {
      resp = await fetchFn(url, { method: 'GET', headers: supabaseAuthHeaders() });
      text = await resp.text();
    } catch (e) {
      const code = e && (e.code || (e.cause && e.cause.code));
      const name = e && e.name;
      const msg = e && e.message;
      console.error('Failed to fetch notifications from', url, 'name=', name, 'code=', code, 'message=', msg);
      if (e && e.stack) console.error(e.stack);
      return;
    }
    if (!resp.ok) {
      console.error('Failed to fetch notifications', resp.status, text);
      return;
    }
    const notifs = JSON.parse(text || '[]');
    if (!notifs || notifs.length === 0) return;

    // If email backend is down/unreachable, skip sending for now to avoid repeated network errors
    const emailBackendOk = await isEmailBackendReachable();
    if (!emailBackendOk) {
      console.warn('Email backend unreachable — skipping this batch of', notifs.length, 'notifications');
      return;
    }

    const now = Date.now();
    for (const n of notifs) {
      try {
        const userId = n.user_id;

        // Backoff/attempt eligibility
        const attempts = Number(n.email_attempts || 0);
        const lastAttempt = n.last_email_attempt_at ? new Date(n.last_email_attempt_at).getTime() : 0;
        const maxAttempts = 5;
        if (attempts >= maxAttempts) {
          console.warn('Max attempts reached for', n.id); continue;
        }
        // exponential backoff base 60s
        const backoffMs = Math.pow(2, attempts) * 60 * 1000;
        if (lastAttempt && (now - lastAttempt) < backoffMs) {
          // not yet time to retry
          continue;
        }

        // Fetch preferences
        const prefUrl = `${SUPABASE_URL}/rest/v1/notification_preferences?user_id=eq.${encodeURIComponent(userId)}&limit=1`;
        let prefs = [];
        try { prefs = await fetchJson(prefUrl, { method: 'GET', headers: supabaseAuthHeaders() }); } catch (e) { /* ignore */ }
        const pref = (prefs && prefs[0]) || { frequency: 'immediate', email_preferences: {} };

        // Skip reaction types for non-immediate frequencies (digest handling later)
        if (reactionTypes.has(n.type) && pref.frequency && pref.frequency !== 'immediate') {
          continue;
        }

        // Fetch user email
  // Request the full user row and pick available fields (some projects store different column names)
        // Resolve user row from common tables
        const user = await getUserById(userId);
        if (!user || !user.email) {
          console.warn('No email for user', userId);
          // mark as attempted to avoid tight retry loops
          await fetchFn(`${SUPABASE_URL}/rest/v1/notifications?id=eq.${encodeURIComponent(n.id)}`, { method: 'PATCH', headers: supabaseAuthHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ email_attempts: attempts + 1, last_email_attempt_at: new Date().toISOString(), last_email_error: 'no user email' }) });
          continue;
        }

        // Optionally fetch actor info for nicer subject
        let actor = null;
        if (n.actor_id) {
          try {
            actor = await getUserById(n.actor_id);
          } catch (e) { /* ignore actor lookup errors */ }
        }

        const { subject, html } = renderEmailTemplate(n, user, actor);

        try {
          await sendEmail(user.email, subject, html);
          // Mark as delivered (delivered_email true)
          const patchUrl = `${SUPABASE_URL}/rest/v1/notifications?id=eq.${encodeURIComponent(n.id)}`;
          const pr = await fetchFn(patchUrl, {
            method: 'PATCH',
            headers: supabaseAuthHeaders({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
            body: JSON.stringify({ delivered_email: true, email_attempts: attempts + 1, last_email_attempt_at: new Date().toISOString() })
          });
          const ptext = await pr.text();
          if (!pr.ok) console.warn('Failed to mark notification delivered', pr.status, ptext);
          else console.log('Emailed notification', n.id, 'to', user.email);
        } catch (err) {
          const errMsg = (err && err.message) ? err.message : String(err);
          console.error('Failed to send email for', n.id, errMsg);
          // update attempts and last error
          await fetchFn(`${SUPABASE_URL}/rest/v1/notifications?id=eq.${encodeURIComponent(n.id)}`, { method: 'PATCH', headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email_attempts: attempts + 1, last_email_attempt_at: new Date().toISOString(), last_email_error: errMsg }) });
        }
      } catch (err) {
        console.error('Failed to process notification', n.id, err?.message || err);
      }
    }
  } catch (err) {
    console.error('notification worker error', err && err.message ? err.message : err);
    if (err && err.stack) console.error(err.stack);
  }
}

async function loop() {
  while (true) {
    try { await processBatch(); } catch (e) { console.error(e); }
    await new Promise(r => setTimeout(r, POLL_MS));
  }
}

console.log('Starting notification worker: poll ms=', POLL_MS, 'batch=', BATCH_SIZE, 'email backend=', EMAIL_BACKEND);
loop();
