import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import barangayRoutes from './routes/barangays.js';
import sitioRoutes from './routes/sitios.js';
import plantingRoutes from './routes/planting.js';
import harvestRoutes from './routes/harvest.js';
import standingCropRoutes from './routes/standingCrop.js';
import dashboardRoutes from './routes/dashboard.js';
import analyticsRoutes from './routes/analytics.js';
import notificationRoutes from './routes/notifications.js';
import exportRoutes from './routes/export.js';
import farmerRoutes from './routes/farmers.js';
import reportRoutes from './routes/reports.js';
import mapRoutes from './routes/map.js';
import forecastRoutes from './routes/forecast.js';
import alertRoutes from './routes/alerts.js';

const app = express();
const PORT = parseInt(process.env.PORT || '4001', 10);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  })
);
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'RiceWatch API' });
});

app.use('/api/auth', authRoutes);
app.use('/api/barangays', barangayRoutes);
app.use('/api/sitios', sitioRoutes);
app.use('/api/planting-reports', plantingRoutes);
app.use('/api/harvest-reports', harvestRoutes);
app.use('/api/standing-crop-reports', standingCropRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/farmers', farmerRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/map', mapRoutes);
app.use('/api/forecast', forecastRoutes);
app.use('/api/alerts', alertRoutes);

app.listen(PORT, () => {
  console.log(`RiceWatch API running at http://localhost:${PORT}`);
}).on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `Port ${PORT} is already in use. Stop the other service or set PORT in server/.env (e.g. 4001).`
    );
  } else {
    console.error('Failed to start API:', err.message);
  }
  process.exit(1);
});
