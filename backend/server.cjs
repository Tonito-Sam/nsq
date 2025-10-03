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
app.use(require('./cors.cjs'));

// Parse JSON
app.use(express.json());

// ROUTES
const livepeerRoutes = require('./routes/livepeer.cjs');
app.use('/api/livepeer', livepeerRoutes);

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

