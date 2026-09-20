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
  cropStage: string;
  area: number;
  cropCondition: string;
  damagedArea: number;
  pestInfestation: string;
  irrigationStatus: string;
  lastUpdated: Date;
  barangay: { name: string };
}) {
  return {
    id: report.id,
    municipality: report.municipality,
    barangay: report.barangay.name,
    barangayId: report.barangayId,
    sitio: report.sitio,
    cropStage: report.cropStage,
    area: report.area,
    cropCondition: report.cropCondition,
    damagedArea: report.damagedArea,
    pestInfestation: report.pestInfestation,
    irrigationStatus: report.irrigationStatus,
    lastUpdated: report.lastUpdated.toISOString().split('T')[0],
  };
}

router.get('/', async (req, res) => {
  const scope = await technicianBarangayWhere(req);
  const reports = await prisma.standingCropReport.findMany({
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
    cropStage: z.string(),
    area: z.number().positive(),
    cropCondition: z.string(),
    damagedArea: z.number().nonnegative().default(0),
    pestInfestation: z.string(),
    irrigationStatus: z.string(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid standing crop report' });

  const denied = await assertTechnicianBarangayAccess(req, parsed.data.barangay);
  if (denied) return res.status(403).json({ error: denied });

  const barangayId = await getBarangayIdByName(parsed.data.barangay);
  if (!barangayId) return res.status(400).json({ error: 'Barangay not found' });

  const today = new Date();
  const report = await prisma.standingCropReport.create({
    data: {
      municipality: parsed.data.municipality,
      barangayId,
      sitio: parsed.data.sitio,
      cropStage: parsed.data.cropStage,
      area: parsed.data.area,
      cropCondition: parsed.data.cropCondition,
      damagedArea: parsed.data.damagedArea,
      pestInfestation: parsed.data.pestInfestation,
      irrigationStatus: parsed.data.irrigationStatus,
      lastUpdated: today,
    },
    include: { barangay: true },
  });

  await prisma.activity.create({
    data: {
      action: 'Standing crop monitoring completed',
      location: `Brgy. ${parsed.data.barangay}`,
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
    cropStage: z.string().optional(),
    area: z.number().positive().optional(),
    cropCondition: z.string().optional(),
    damagedArea: z.number().nonnegative().optional(),
    pestInfestation: z.string().optional(),
    irrigationStatus: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success || isNaN(id)) return res.status(400).json({ error: 'Invalid data' });

  const existing = await prisma.standingCropReport.findUnique({
    where: { id },
    include: { barangay: true },
  });
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const targetBarangay = parsed.data.barangay || existing.barangay.name;
  const denied = await assertTechnicianBarangayAccess(req, targetBarangay);
  if (denied) return res.status(403).json({ error: denied });

  const data: Record<string, unknown> = { ...parsed.data, lastUpdated: new Date() };
  if (parsed.data.barangay) {
    const barangayId = await getBarangayIdByName(parsed.data.barangay);
    if (!barangayId) return res.status(400).json({ error: 'Barangay not found' });
    data.barangayId = barangayId;
    delete data.barangay;
  }

  const report = await prisma.standingCropReport.update({
    where: { id },
    data,
    include: { barangay: true },
  });
  res.json(serialize(report));
});

router.delete('/:id', requireRole('admin', 'technician'), async (req, res) => {
  const id = parseId(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  const existing = await prisma.standingCropReport.findUnique({
    where: { id },
    include: { barangay: true },
  });
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const denied = await assertTechnicianBarangayAccess(req, existing.barangay.name);
  if (denied) return res.status(403).json({ error: denied });

  await prisma.standingCropReport.delete({ where: { id } });
  res.json({ success: true });
});

export default router;
