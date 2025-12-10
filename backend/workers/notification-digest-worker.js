// Notification digest worker: aggregates reaction notifications and sends hourly/daily digests
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
const DIGEST_INTERVAL_MS = parseInt(process.env.NOTIFICATION_DIGEST_MS || String(1000 * 60 * 60), 10); // default hourly

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env. Aborting.');
  process.exit(1);
}

const reactionTypes = new Set(['like','reaction','emoji','love']);
const fs = require('fs');
const path = require('path');

function loadTemplate(name) {
  try {
    const p = path.join(__dirname, 'templates', `${name}.html`);
    return fs.readFileSync(p, 'utf8');
  } catch (e) { return null; }
}

function renderTemplateString(tpl, vars) {
  if (!tpl) return '';
  return tpl.replace(/\{\{\s*([A-Z0-9_.]+)\s*\}\}/g, (_, key) => vars[key] || '');
}

async function fetchJson(url, opts) {
  const resp = await fetchFn(url, opts);
  const text = await resp.text();
  if (!resp.ok) throw new Error(`fetch ${url} failed ${resp.status} ${text}`);
  return JSON.parse(text || '[]');
}

async function sendEmail(email, subject, html) {
  const url = `${EMAIL_BACKEND.replace(/\/$/,'')}/send-notification`;
  const resp = await fetchFn(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, subject, message: html })
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`email backend failed: ${resp.status} ${text}`);
  return text;
}

async function runDigest() {
  try {
    // Find users with pending reaction notifications grouped by user_id
    const url = `${SUPABASE_URL}/rest/v1/notifications?delivered_email=eq.false&limit=1000`;
    const resp = await fetchFn(url, { method: 'GET', headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } });
    const text = await resp.text();
    if (!resp.ok) { console.error('digest fetch failed', resp.status, text); return; }
    const all = JSON.parse(text || '[]');
    if (!all || all.length === 0) return;

    // Group reaction notifications by user
    const reactionNotifs = all.filter(n => reactionTypes.has(n.type));
    const byUser = {};
    for (const n of reactionNotifs) {
      if (!byUser[n.user_id]) byUser[n.user_id] = [];
      byUser[n.user_id].push(n);
    }

    for (const userId of Object.keys(byUser)) {
      try {
        const items = byUser[userId];
        // Skip if user prefers immediate (we only digest non-immediate)
        const prefs = await fetchJson(`${SUPABASE_URL}/rest/v1/notification_preferences?user_id=eq.${encodeURIComponent(userId)}&limit=1`, { method: 'GET', headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } }).catch(()=>[]);
        const pref = (prefs && prefs[0]) || { frequency: 'daily' };
        if (pref.frequency === 'immediate') continue;

  // Fetch full user row and pick available email/name fields
  const users = await fetchJson(`${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(userId)}&select=*&limit=1`, { method: 'GET', headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } });
  const user = users && users[0];
  if (!user || !(user.email || user.user_email)) continue;

        // Build digest content: count reactions and show top actors
        const summary = {};
        const actors = {};
        for (const n of items) {
          summary[n.type] = (summary[n.type] || 0) + 1;
          if (n.actor_id) actors[n.actor_id] = (actors[n.actor_id] || 0) + 1;
        }
        const lines = Object.keys(summary).map(t => `${summary[t]} ${t}(s)`).join(', ');

        // Resolve actor names (top 3)
        const actorIds = Object.keys(actors).slice(0,3);
        const actorNames = [];
        for (const aid of actorIds) {
          const a = await fetchJson(`${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(aid)}&select=*&limit=1`, { method: 'GET', headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } }).catch(()=>[]);
          if (a && a[0]) actorNames.push(a[0].full_name || a[0].username || a[0].name || 'Someone');
        }

        // Render digest template
  const tpl = loadTemplate('digest') || loadTemplate('generic');
  const userName = user.full_name || user.fullName || user.name || user.username || user.email || user.user_email || '';
  const vars = { USER_FULL_NAME: userName || user.email, MESSAGE: `You received ${lines} from ${actorNames.join(', ')}`, URL: '#', SITE_TITLE: 'NexSq', SENDER_NAME: process.env.SENDER_NAME || 'NexSq' };
        const html = renderTemplateString(tpl, vars);
        const subject = `Activity summary: ${lines}`;

        await sendEmail(user.email, subject, html);

        // Mark all those notifications as delivered_email = true
        const ids = items.map(i => encodeURIComponent(i.id)).join(',');
        const patchUrl = `${SUPABASE_URL}/rest/v1/notifications?id=in.(${ids})`;
        await fetchFn(patchUrl, { method: 'PATCH', headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, 'Content-Type':'application/json', Prefer:'return=representation' }, body: JSON.stringify({ delivered_email: true }) });
        console.log('Sent digest to', user.email, 'items', items.length);
      } catch (e) { console.error('digest send error for user', userId, e?.message || e); }
    }
  } catch (e) { console.error('digest worker error', e?.message || e); }
}

function loadTemplate(name) {
  try { return fs.readFileSync(path.join(__dirname, 'templates', `${name}.html`), 'utf8'); } catch (e) { return null; }
}

function renderTemplateString(tpl, vars) {
  if (!tpl) return '';
  return tpl.replace(/\{\{\s*([A-Z0-9_.]+)\s*\}\}/g, (_, key) => vars[key] || '');
}

const fs = require('fs');
const path = require('path');

async function loop() {
  while (true) {
    try { await runDigest(); } catch (e) { console.error(e); }
    await new Promise(r => setTimeout(r, DIGEST_INTERVAL_MS));
  }
}

console.log('Starting notification digest worker: interval ms=', DIGEST_INTERVAL_MS);
loop();
