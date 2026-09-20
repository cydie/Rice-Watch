import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { getTechnicianScope } from '../lib/technicianScope.js';
import { buildYieldForecast } from '../lib/yieldForecast.js';

const router = Router();
router.use(authRequired);

router.get('/', async (req, res) => {
  try {
    const scope = await getTechnicianScope(req);
    const result = await buildYieldForecast(scope);
    res.json({
      scope: {
        level: scope.isTechnician ? 'barangay' : 'municipality',
        barangay: scope.barangayName,
      },
      ...result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to build yield forecast' });
  }
});

export default router;
