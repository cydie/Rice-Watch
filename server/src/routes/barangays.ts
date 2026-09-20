import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { parseId } from '../lib/helpers.js';
import { getTechnicianScope } from '../lib/technicianScope.js';

const router = Router();
router.use(authRequired);

router.get('/', async (req, res) => {
  const scope = await getTechnicianScope(req);
  const where =
    scope.barangayId != null
      ? { id: scope.barangayId }
      : scope.isTechnician
        ? { id: { in: [] as number[] } }
        : {};

  const barangays = await prisma.barangay.findMany({
    where,
    include: { sitios: true },
    orderBy: { name: 'asc' },
  });
  res.json(barangays);
});

router.post('/', requireRole('admin'), async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    area: z.number().positive(),
    classification: z.enum(['Irrigated', 'Rainfed', 'Upland']),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid barangay data' });

  const barangay = await prisma.barangay.create({ data: parsed.data, include: { sitios: true } });
  res.status(201).json(barangay);
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  const id = parseId(req.params.id);
  const schema = z.object({
    name: z.string().min(1).optional(),
    area: z.number().positive().optional(),
    classification: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success || isNaN(id)) return res.status(400).json({ error: 'Invalid data' });

  const barangay = await prisma.barangay.update({
    where: { id },
    data: parsed.data,
    include: { sitios: true },
  });
  res.json(barangay);
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  const id = parseId(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  await prisma.barangay.delete({ where: { id } });
  res.json({ success: true });
});

export default router;
