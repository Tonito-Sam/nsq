// backend/cors.cjs
module.exports = function (req, res, next) {
  // Keep the production app origins enabled and allow deployments to add their own origins.
  const defaults = [
    'https://nexsq.com',
    'https://www.nexsq.com',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'http://localhost:3000',
  ];
  const configured = (process.env.CORS_ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const allowed = [...new Set([...defaults, ...configured])];
  const origin = req.headers.origin;

  if (origin) {
    if (allowed.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    } else {
      // Origin is present but not in the allow list. Deny explicitly.
      return res.status(403).json({ error: 'CORS origin not allowed', origin });
    }
  } else {
    // No Origin header (non-browser or same-origin requests) — allow by default.
    res.header('Access-Control-Allow-Origin', '*');
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Sync-Secret, ApiKey, X-Requested-With, Accept'
  );

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
};
