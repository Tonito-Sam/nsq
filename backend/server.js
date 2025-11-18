const express = require('express');
const cors = require('cors');
const aramexRoutes = require('./routes/aramex');
const livepeerRoutes = require('./routes/livepeer');
const syncSounds = require('./routes/sync-sounds');
const notificationsRoutes = require('./routes/notifications');
const storesRoutes = require('./routes/stores');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/aramex', aramexRoutes);
app.use('/api/livepeer', livepeerRoutes);
app.use('/api/admin', syncSounds);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/stores', storesRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
