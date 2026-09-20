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
      ? { barangayId: scope.barangayId }
      : scope.isTechnician
        ? { barangayId: { in: [] as number[] } }
        : {};

  const sitios = await prisma.sitio.findMany({
    where,
    include: { barangay: true },
    orderBy: { id: 'asc' },
  });
  res.json(sitios);
});

router.post('/', requireRole('admin'), async (req, res) => {
  const schema = z.object({
    barangayId: z.number().int().positive(),
    name: z.string().min(1),
    type: z.enum(['Sitio', 'Purok']),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid sitio data' });

  const sitio = await prisma.sitio.create({ data: parsed.data });
  res.status(201).json(sitio);
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  const id = parseId(req.params.id);
  const schema = z.object({
    barangayId: z.number().int().positive().optional(),
    name: z.string().min(1).optional(),
    type: z.enum(['Sitio', 'Purok']).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success || isNaN(id)) return res.status(400).json({ error: 'Invalid data' });

  const sitio = await prisma.sitio.update({ where: { id }, data: parsed.data });
  res.json(sitio);
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  const id = parseId(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  await prisma.sitio.delete({ where: { id } });
  res.json({ success: true });
});

export default router;
