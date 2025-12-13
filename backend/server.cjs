const express = require('express');
const dotenv = require('dotenv');
const path = require('path');

// Load env variables from backend/.env
dotenv.config({ path: path.resolve(__dirname, '.env') });

console.log('✅ LIVEPEER_API_KEY:', process.env.LIVEPEER_API_KEY);

// Log Supabase env status (masked) to help debug invalid-api-key issues in dev
try {
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || '';
  const supaUrl = process.env.SUPABASE_URL || '';
  const masked = srk ? `${srk.slice(0,4)}...${srk.slice(-4)}` : '(not set)';
  console.log('✅ SUPABASE_URL:', supaUrl ? supaUrl : '(not set)');
  console.log('✅ SUPABASE_SERVICE_ROLE_KEY (masked):', masked);
} catch (e) {
  console.warn('Could not read SUPABASE env vars', e && e.message);
}

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

// Post views route (records when a user views a post)
try {
  const postViews = require('./routes/post-views');
  app.use('/api/post-views', postViews);
  console.log('✅ Mounted /api/post-views');
} catch (e) {
  console.warn('⚠️ post-views route not available:', e?.message || e);
}

// Stores (WhatsApp opt-in validation + user_stores updates)
try {
  const stores = require('./routes/stores');
  app.use('/api/stores', stores);
  console.log('✅ Mounted /api/stores');
} catch (e) {
  console.warn('⚠️ stores route not available:', e?.message || e);
}

// Health probe (checks Supabase connectivity)
try {
  const health = require('./routes/health');
  app.use('/api/health', health);
  console.log('✅ Mounted /api/health');
} catch (e) {
  console.warn('⚠️ health route not available:', e?.message || e);
}

  // remove.bg proxy
  try {
    const removeBg = require('./routes/removebg');
    app.use('/api/removebg', removeBg);
    console.log('✅ Mounted /api/removebg');
  } catch (e) {
    console.warn('⚠️ removebg route not available:', e?.message || e);
  }

// Currency rates route (added to expose /api/currency)
try {
  const currency = require('./routes/currency');
  app.use('/api/currency', currency);
  console.log('✅ Mounted /api/currency');
} catch (e) {
  console.warn('⚠️ currency route not available:', e?.message || e);
}

// Promo route (promo_transfers)
try {
  const promo = require('./routes/promo');
  app.use('/api/promo', promo);
  console.log('✅ Mounted /api/promo');
} catch (e) {
  console.warn('⚠️ promo route not available:', e?.message || e);
}

// Campaigns (ads & boosting)
try {
  const campaigns = require('./routes/campaigns');
  app.use('/api/campaigns', campaigns);
  console.log('✅ Mounted /api/campaigns');
} catch (e) {
  console.warn('⚠️ campaigns route not available:', e?.message || e);
}

// Ads serving route (minimal delivery API)
try {
  const ads = require('./routes/ads');
  app.use('/api/ads', ads);
  console.log('✅ Mounted /api/ads');
} catch (e) {
  console.warn('⚠️ ads route not available:', e?.message || e);
}

// Users search route (service-role search)
try {
  const users = require('./routes/users');
  app.use('/api/users', users);
  console.log('✅ Mounted /api/users');
} catch (e) {
  console.warn('⚠️ users route not available:', e?.message || e);
}

// Payments (dev-safe webhooks for Flutterwave / Paystack)
try {
  const payments = require('./routes/payments');
  app.use('/api/payments', payments);
  console.log('✅ Mounted /api/payments');
} catch (e) {
  console.warn('⚠️ payments route not available:', e?.message || e);
}

// WebRTC -> RTMP bridge route
const webrtcBridgeRoutes = require('./routes/webrtc-bridge.cjs');
app.use('/api/webrtc-bridge', webrtcBridgeRoutes);

// TURN credentials endpoint (ephemeral creds)
const turnRoutes = require('./routes/turn.cjs');
app.use('/api/turn', turnRoutes);

// Start server and print helpful debug info (PID + address)
const server = app.listen(PORT, () => {
  try {
    const addr = server.address && typeof server.address === 'function' ? server.address() : { port: PORT };
    console.log('✅ Backend running on port', addr && addr.port ? addr.port : PORT);
  } catch (e) {
    console.log(`✅ Backend running on port ${PORT}`);
  }
  console.log('ℹ️ PID:', process.pid);
});
