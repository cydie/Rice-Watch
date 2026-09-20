import { Router } from 'express';
import { authRequired, requireRole } from '../middleware/auth.js';
import { getTechnicianScope } from '../lib/technicianScope.js';
import { computeRiskAlerts, syncRiskNotifications } from '../lib/riskAlerts.js';
import { toCsv } from '../lib/helpers.js';

const router = Router();
router.use(authRequired);

router.get('/', async (req, res) => {
  const scope = await getTechnicianScope(req);
  const alerts = await computeRiskAlerts(scope);
  res.json({
    scope: {
      level: scope.isTechnician ? 'barangay' : 'municipality',
      barangay: scope.barangayName,
    },
    generatedAt: new Date().toISOString(),
    summary: {
      total: alerts.length,
      critical: alerts.filter((a) => a.severity === 'critical').length,
      high: alerts.filter((a) => a.severity === 'high').length,
      moderate: alerts.filter((a) => a.severity === 'moderate').length,
      low: alerts.filter((a) => a.severity === 'low').length,
    },
    alerts,
  });
});

router.post('/sync-notifications', requireRole('admin', 'encoder'), async (req, res) => {
  const scope = await getTechnicianScope(req);
  const result = await syncRiskNotifications(scope);
  res.json({
    message: 'Risk notifications synced for high/critical barangays',
    notified: result.notified,
    alerts: result.alerts,
  });
});

router.get('/export', async (req, res) => {
  const scope = await getTechnicianScope(req);
  const alerts = await computeRiskAlerts(scope);
  const rows = alerts.map((a) => ({
    barangay: a.barangay,
    severity: a.severity,
    score: a.score,
    flags: a.flags.join(' | '),
    damagedAreaHa: a.damagedAreaHa,
    standingAreaHa: a.standingAreaHa,
    plantedHa: a.plantedHa,
    harvestedHa: a.harvestedHa,
  }));
  const csv = toCsv(rows);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="ricewatch-early-warnings.csv"');
  res.send(csv);
});

export default router;
