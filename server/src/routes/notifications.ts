import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authRequired } from '../middleware/auth.js';
import { parseId } from '../lib/helpers.js';

const router = Router();
router.use(authRequired);

router.get('/', async (_req, res) => {
  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  res.json(notifications);
});

router.patch('/:id/read', async (req, res) => {
  const id = parseId(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  const notification = await prisma.notification.update({
    where: { id },
    data: { read: true },
  });
  res.json(notification);
});

router.patch('/read-all', async (_req, res) => {
  await prisma.notification.updateMany({ data: { read: true } });
  res.json({ success: true });
});

export default router;
