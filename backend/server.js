const express = require('express');
const cors = require('cors');
const aramexRoutes = require('./routes/aramex');
const livepeerRoutes = require('./routes/livepeer');
const syncSounds = require('./routes/sync-sounds');
const notificationsRoutes = require('./routes/notifications');
const storesRoutes = require('./routes/stores');
const removeBgRoutes = require('./routes/removebg');
const currencyRoutes = require('./routes/currency');
const promoRoutes = require('./routes/promo');
const usersRoutes = require('./routes/users');
const campaignsRoutes = require('./routes/campaigns');
const showsRoutes = require('./routes/shows');
const linkPreview = require('./routes/link-preview');
const organizationsRoutes = require('./routes/organizations');

const app = express();

// CORS: allow credentials and only permit configured origins (do not use '*')
// Set env var CORS_ALLOWED_ORIGINS to a comma-separated list, e.g.:
// CORS_ALLOWED_ORIGINS=http://localhost:3000
const allowed = (process.env.CORS_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
	origin: function(origin, callback) {
		// allow non-browser requests (e.g. curl, server-to-server) with no origin
		if (!origin) return callback(null, true);
		if (allowed.length === 0) {
			// if no allowed list provided, default to allowing same-host frontend during development
			// (best-effort) — permit localhost:3000
			const devDefault = ['http://localhost:3000'];
			if (devDefault.includes(origin)) return callback(null, true);
			return callback(new Error('Not allowed by CORS'));
		}
		if (allowed.indexOf(origin) !== -1) return callback(null, true);
		return callback(new Error('Not allowed by CORS'));
	},
	credentials: true,
}));

app.use(express.json());

app.use('/api/aramex', aramexRoutes);
app.use('/api/livepeer', livepeerRoutes);
app.use('/api/admin', syncSounds);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/stores', storesRoutes);
app.use('/api/removebg', removeBgRoutes);
app.use('/api/currency', currencyRoutes);
app.use('/api/promo', promoRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/organizations', organizationsRoutes);
// Shows and episodes management (admin endpoints)
app.use('/api/shows', showsRoutes);
app.use('/api/link-preview', linkPreview);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
