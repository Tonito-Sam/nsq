// backend/cors.cjs
module.exports = function (req, res, next) {
  // Allowed origins can be provided as a comma-separated env var.
  // In development, default to http://localhost:3000 so the frontend dev server works.
  const raw = process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000';
  const allowed = raw.split(',').map((s) => s.trim()).filter(Boolean);
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
