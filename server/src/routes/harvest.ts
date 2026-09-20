import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { getBarangayIdByName, parseId } from '../lib/helpers.js';
import { assertTechnicianBarangayAccess, technicianBarangayWhere } from '../lib/technicianScope.js';

const router = Router();
router.use(authRequired);

function serialize(report: {
  id: number;
  municipality: string;
  barangayId: number;
  sitio: string;
  harvestDate: Date;
  harvestedArea: number;
  totalProduction: number;
  averageYield: number;
  riceVariety: string;
  irrigationType: string;
  barangay: { name: string };
}) {
  return {
    id: report.id,
    municipality: report.municipality,
    barangay: report.barangay.name,
    barangayId: report.barangayId,
    sitio: report.sitio,
    harvestDate: report.harvestDate.toISOString().split('T')[0],
    harvestedArea: report.harvestedArea,
    totalProduction: report.totalProduction,
    averageYield: report.averageYield,
    riceVariety: report.riceVariety,
    irrigationType: report.irrigationType,
  };
}

router.get('/', async (req, res) => {
  const scope = await technicianBarangayWhere(req);
  const reports = await prisma.harvestReport.findMany({
    where: scope,
    include: { barangay: true },
    orderBy: { id: 'desc' },
  });
  res.json(reports.map(serialize));
});

router.post('/', requireRole('admin', 'technician', 'encoder'), async (req, res) => {
  const schema = z.object({
    municipality: z.string().default('Rizal'),
    barangay: z.string(),
    sitio: z.string().default('-'),
    harvestDate: z.string(),
    harvestedArea: z.number().positive(),
    totalProduction: z.number().nonnegative(),
    riceVariety: z.string(),
    irrigationType: z.string(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid harvest report' });

  const denied = await assertTechnicianBarangayAccess(req, parsed.data.barangay);
  if (denied) return res.status(403).json({ error: denied });

  const barangayId = await getBarangayIdByName(parsed.data.barangay);
  if (!barangayId) return res.status(400).json({ error: 'Barangay not found' });

  const averageYield = parsed.data.totalProduction / parsed.data.harvestedArea;
  const report = await prisma.harvestReport.create({
    data: {
      municipality: parsed.data.municipality,
      barangayId,
      sitio: parsed.data.sitio,
      harvestDate: new Date(parsed.data.harvestDate),
      harvestedArea: parsed.data.harvestedArea,
      totalProduction: parsed.data.totalProduction,
      averageYield,
      riceVariety: parsed.data.riceVariety,
      irrigationType: parsed.data.irrigationType,
    },
    include: { barangay: true },
  });

  await prisma.activity.create({
    data: {
      action: 'Harvest data updated',
      location: `Brgy. ${parsed.data.barangay}, ${parsed.data.sitio}`,
    },
  });

  res.status(201).json(serialize(report));
});

router.put('/:id', requireRole('admin', 'technician', 'encoder'), async (req, res) => {
  const id = parseId(req.params.id);
  const schema = z.object({
    municipality: z.string().optional(),
    barangay: z.string().optional(),
    sitio: z.string().optional(),
    harvestDate: z.string().optional(),
    harvestedArea: z.number().positive().optional(),
    totalProduction: z.number().nonnegative().optional(),
    riceVariety: z.string().optional(),
    irrigationType: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success || isNaN(id)) return res.status(400).json({ error: 'Invalid data' });

  const existing = await prisma.harvestReport.findUnique({
    where: { id },
    include: { barangay: true },
  });
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const targetBarangay = parsed.data.barangay || existing.barangay.name;
  const denied = await assertTechnicianBarangayAccess(req, targetBarangay);
  if (denied) return res.status(403).json({ error: denied });

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.barangay) {
    const barangayId = await getBarangayIdByName(parsed.data.barangay);
    if (!barangayId) return res.status(400).json({ error: 'Barangay not found' });
    data.barangayId = barangayId;
    delete data.barangay;
  }
  if (parsed.data.harvestDate) data.harvestDate = new Date(parsed.data.harvestDate);

  const harvestedArea = (parsed.data.harvestedArea ?? existing.harvestedArea) as number;
  const totalProduction = (parsed.data.totalProduction ?? existing.totalProduction) as number;
  data.averageYield = totalProduction / harvestedArea;

  const report = await prisma.harvestReport.update({
    where: { id },
    data,
    include: { barangay: true },
  });
  res.json(serialize(report));
});

router.delete('/:id', requireRole('admin', 'technician'), async (req, res) => {
  const id = parseId(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  const existing = await prisma.harvestReport.findUnique({
    where: { id },
    include: { barangay: true },
  });
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const denied = await assertTechnicianBarangayAccess(req, existing.barangay.name);
  if (denied) return res.status(403).json({ error: denied });

  await prisma.harvestReport.delete({ where: { id } });
  res.json({ success: true });
});

export default router;
