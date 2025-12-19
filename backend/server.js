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

const app = express();
app.use(cors());
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
// Shows and episodes management (admin endpoints)
app.use('/api/shows', showsRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
