// debug-supabase-fetch.js
// Loads backend/.env and performs a simple Supabase REST fetch to show URL, status and body.
require('dotenv').config();
(async () => {
  try {
    const url = (process.env.SUPABASE_URL || '') + '/rest/v1/notifications?limit=1';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) {
      console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY not found in environment. Check backend/.env');
      process.exit(2);
    }
    if (!url || url === '/rest/v1/notifications?limit=1') {
      console.error('ERROR: SUPABASE_URL not set in environment. Check backend/.env');
      process.exit(2);
    }
    // Node 18+ has global fetch. If not available, this will throw.
    const r = await fetch(url, {
      method: 'GET',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json'
      }
    });
    const text = await r.text();
    console.log('=> URL:', url);
    console.log('=> STATUS:', r.status);
    console.log('=> BODY:', text);
  } catch (e) {
    console.error('FETCH ERROR', e && e.message ? e.message : e);
    if (e && e.stack) console.error(e.stack);
  }
})();
