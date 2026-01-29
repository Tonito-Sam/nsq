// Simple local tester for email-backend /test-email
const url = process.env.URL || 'http://localhost:3001/test-email';
(async () => {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'officialtonitosamuel@gmail.com', subject: 'Local Test', message: 'Testing Ethereal fallback' })
    });
    const text = await res.text();
    console.log('STATUS', res.status);
    console.log('BODY', text);
  } catch (err) {
    console.error('ERROR', err);
    process.exitCode = 1;
  }
})();
