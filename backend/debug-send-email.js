// debug-send-email.js
require('dotenv').config();
(async () => {
  try {
    const EMAIL_BACKEND = process.env.EMAIL_BACKEND_URL || 'http://localhost:4000';
    const url = `${EMAIL_BACKEND.replace(/\/$/, '')}/send-notification`;
    console.log('POST ->', url);
    const body = { email: process.env.SENDER_EMAIL || 'test@example.com', subject: 'Debug test', message: 'This is a test from debug-send-email' };
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const text = await r.text();
    console.log('STATUS', r.status);
    console.log('BODY', text);
  } catch (e) {
    console.error('ERROR', e && e.message ? e.message : e);
    if (e && e.stack) console.error(e.stack);
  }
})();
