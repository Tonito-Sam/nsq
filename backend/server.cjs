const express = require('express');
const dotenv = require('dotenv');
const path = require('path');

// Load env variables from backend/.env
dotenv.config({ path: path.resolve(__dirname, '.env') });

console.log('✅ LIVEPEER_API_KEY:', process.env.LIVEPEER_API_KEY);

// Init app
const app = express();
const PORT = process.env.PORT || 5000;

// Custom CORS middleware (for dev, allows all origins)
app.use(require('./cors.cjs')); // ✅ moved here (AFTER app is created)

// Parse JSON
app.use(express.json());

// ROUTES
const livepeerRoutes = require('./routes/livepeer.cjs');
app.use('/api/livepeer', livepeerRoutes);

// Aramex routes (prefer .cjs, fallback to .js)
try {
  const aramex = require('./routes/aramex.cjs');
  app.use('/api/aramex', aramex);
  console.log('✅ Mounted /api/aramex (aramex.cjs)');
} catch (e) {
  try {
    const aramex = require('./routes/aramex');
    app.use('/api/aramex', aramex);
    console.log('✅ Mounted /api/aramex (aramex.js)');
  } catch (err) {
    console.warn('⚠️ aramex route not available:', err?.message || err);
  }
}

// Admin routes (sync sounds)
try {
  const adminSyncRoutes = require('./routes/sync-sounds');
  app.use('/api/admin', adminSyncRoutes);
  console.log('✅ Mounted /api/admin (sync-sounds) route');
} catch (e) {
  console.warn('⚠️ sync-sounds route not available:', e?.message || e);
}

// Notifications
try {
  const notifications = require('./routes/notifications');
  app.use('/api/notifications', notifications);
  console.log('✅ Mounted /api/notifications');
} catch (e) {
  console.warn('⚠️ notifications route not available:', e?.message || e);
}

// Stores (WhatsApp opt-in validation + user_stores updates)
try {
  const stores = require('./routes/stores');
  app.use('/api/stores', stores);
  console.log('✅ Mounted /api/stores');
} catch (e) {
  console.warn('⚠️ stores route not available:', e?.message || e);
}

// WebRTC -> RTMP bridge route
const webrtcBridgeRoutes = require('./routes/webrtc-bridge.cjs');
app.use('/api/webrtc-bridge', webrtcBridgeRoutes);

// TURN credentials endpoint (ephemeral creds)
const turnRoutes = require('./routes/turn.cjs');
app.use('/api/turn', turnRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
});
