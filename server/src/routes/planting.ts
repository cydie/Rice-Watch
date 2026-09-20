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
  farmerCount: number;
  seedVariety: string;
  areaPlanted: number;
  datePlanted: Date;
  irrigationType: string;
  season: string;
  expectedHarvest: Date;
  barangay: { name: string };
}) {
  return {
    id: report.id,
    municipality: report.municipality,
    barangay: report.barangay.name,
    barangayId: report.barangayId,
    sitio: report.sitio,
    farmerCount: report.farmerCount,
    seedVariety: report.seedVariety,
    areaPlanted: report.areaPlanted,
    datePlanted: report.datePlanted.toISOString().split('T')[0],
    irrigationType: report.irrigationType,
    season: report.season,
    expectedHarvest: report.expectedHarvest.toISOString().split('T')[0],
  };
}

router.get('/', async (req, res) => {
  const scope = await technicianBarangayWhere(req);
  const reports = await prisma.plantingReport.findMany({
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
    farmerCount: z.number().int().nonnegative(),
    seedVariety: z.string(),
    areaPlanted: z.number().positive(),
    datePlanted: z.string(),
    irrigationType: z.string(),
    season: z.string(),
    expectedHarvest: z.string(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid planting report' });

  const denied = await assertTechnicianBarangayAccess(req, parsed.data.barangay);
  if (denied) return res.status(403).json({ error: denied });

  const barangayId = await getBarangayIdByName(parsed.data.barangay);
  if (!barangayId) return res.status(400).json({ error: 'Barangay not found' });

  const report = await prisma.plantingReport.create({
    data: {
      municipality: parsed.data.municipality,
      barangayId,
      sitio: parsed.data.sitio,
      farmerCount: parsed.data.farmerCount,
      seedVariety: parsed.data.seedVariety,
      areaPlanted: parsed.data.areaPlanted,
      datePlanted: new Date(parsed.data.datePlanted),
      irrigationType: parsed.data.irrigationType,
      season: parsed.data.season,
      expectedHarvest: new Date(parsed.data.expectedHarvest),
    },
    include: { barangay: true },
  });

  await prisma.activity.create({
    data: {
      action: 'New planting report submitted',
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
    farmerCount: z.number().int().nonnegative().optional(),
    seedVariety: z.string().optional(),
    areaPlanted: z.number().positive().optional(),
    datePlanted: z.string().optional(),
    irrigationType: z.string().optional(),
    season: z.string().optional(),
    expectedHarvest: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success || isNaN(id)) return res.status(400).json({ error: 'Invalid data' });

  const existing = await prisma.plantingReport.findUnique({
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
  if (parsed.data.datePlanted) data.datePlanted = new Date(parsed.data.datePlanted);
  if (parsed.data.expectedHarvest) data.expectedHarvest = new Date(parsed.data.expectedHarvest);

  const report = await prisma.plantingReport.update({
    where: { id },
    data,
    include: { barangay: true },
  });
  res.json(serialize(report));
});

router.delete('/:id', requireRole('admin', 'technician'), async (req, res) => {
  const id = parseId(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  const existing = await prisma.plantingReport.findUnique({
    where: { id },
    include: { barangay: true },
  });
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const denied = await assertTechnicianBarangayAccess(req, existing.barangay.name);
  if (denied) return res.status(403).json({ error: denied });

  await prisma.plantingReport.delete({ where: { id } });
  res.json({ success: true });
});

export default router;
