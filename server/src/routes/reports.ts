import { Router } from 'express';
import multer from 'multer';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { authRequired, requireRole } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import {
  TEMPLATES_DIR,
  UploadType,
  buildTechnicianTemplates,
  generateMunicipalPaper,
  ingestTechnicianMasterlist,
} from '../lib/paperReports.js';
import {
  buildFilledWorkbookBuffer,
  getOfficialTargets,
  getTargetsForBarangay,
} from '../lib/officialTargets.js';
import { getTechnicianScope } from '../lib/technicianScope.js';
import { normalizeBarangayName } from '../lib/helpers.js';

const router = Router();
router.use(authRequired);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

function asType(value: string): UploadType | null {
  if (value === 'planting' || value === 'harvest' || value === 'standing') return value;
  return null;
}

function ensureTemplates() {
  const planting = path.join(TEMPLATES_DIR, 'technician-planting-masterlist.xlsx');
  if (!fs.existsSync(planting)) buildTechnicianTemplates();
}

router.get('/templates/:type', (req, res) => {
  const type = asType(String(req.params.type));
  if (!type) return res.status(400).json({ error: 'Invalid template type' });
  ensureTemplates();
  const file = path.join(TEMPLATES_DIR, `technician-${type}-masterlist.xlsx`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Template not found' });
  res.download(file, `ricewatch-${type}-masterlist-template.xlsx`);
});

/** Technician / admin guide: columns, allowed values, official DS 2026 targets. */
router.get('/technician-guide', async (req, res) => {
  const scope = await getTechnicianScope(req);
  const qBarangay = typeof req.query.barangay === 'string' ? req.query.barangay.trim() : '';
  const barangay = scope.isTechnician
    ? scope.barangayName
    : qBarangay
      ? normalizeBarangayName(qBarangay)
      : null;

  if (barangay) {
    return res.json(getTargetsForBarangay(barangay));
  }

  const all = getOfficialTargets();
  return res.json({
    season: all.season,
    asOf: all.asOf,
    municipal: all.municipal,
    barangays: all.planting.map((p) => p.barangay),
    planting: all.planting,
    harvest: all.harvest,
    standing: all.standing,
    workflow: getTargetsForBarangay(all.planting[0]?.barangay || 'Iraan').workflow,
    columns: getTargetsForBarangay(all.planting[0]?.barangay || 'Iraan').columns,
    allowedValues: getTargetsForBarangay(all.planting[0]?.barangay || 'Iraan').allowedValues,
  });
});

/** Official-paper-aligned filled masterlist for one barangay (technician = own barangay). */
router.get('/filled-template/:type', async (req, res) => {
  const type = asType(String(req.params.type));
  if (!type) return res.status(400).json({ error: 'Invalid template type' });

  const scope = await getTechnicianScope(req);
  const qBarangay = typeof req.query.barangay === 'string' ? req.query.barangay.trim() : '';
  const barangay = scope.isTechnician
    ? scope.barangayName
    : qBarangay
      ? normalizeBarangayName(qBarangay)
      : null;

  if (!barangay) {
    return res.status(400).json({
      error: 'Barangay is required (technicians use assigned barangay; admin pass ?barangay=Iraan)',
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { fullName: true },
    });
    const techName = user?.fullName || 'Technician';
    const buffer = buildFilledWorkbookBuffer(type, barangay, techName);
    const slug = barangay.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const filename = `ricewatch-${slug}-${type}-official-aligned.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(404).json({
      error: err instanceof Error ? err.message : 'Filled template not available',
    });
  }
});

router.post(
  '/upload/:type',
  requireRole('admin', 'technician', 'encoder'),
  upload.single('file'),
  async (req, res) => {
    const type = asType(String(req.params.type));
    if (!type) return res.status(400).json({ error: 'Invalid upload type' });
    if (!req.file?.buffer) return res.status(400).json({ error: 'Excel file is required' });

    const scope = await getTechnicianScope(req);
    const forcedBarangay = scope.isTechnician ? scope.barangayName : null;
    if (scope.isTechnician && !forcedBarangay) {
      return res.status(403).json({ error: 'Technician has no assigned barangay' });
    }

    try {
      const result = await ingestTechnicianMasterlist(type, req.file.buffer, {
        forcedBarangay,
        replaceBarangay: true,
      });

      await prisma.activity.create({
        data: {
          action: `Uploaded ${type} masterlist (${result.rows} rows → ${result.created} reports)`,
          location: forcedBarangay
            ? `Brgy. ${forcedBarangay}`
            : 'Municipal Agriculture Office - Rizal',
          userId: req.user!.userId,
        },
      });

      await prisma.notification.create({
        data: {
          title: `${type[0].toUpperCase()}${type.slice(1)} data uploaded`,
          message: forcedBarangay
            ? `Technician updated ${type} data for Brgy. ${forcedBarangay}. Municipal paper can be regenerated.`
            : `${type} masterlist imported for ${result.barangays.join(', ') || 'selected barangays'}.`,
          read: false,
        },
      });

      res.json({
        message: 'Upload processed and reports updated',
        ...result,
        barangayScope: forcedBarangay,
      });
    } catch (err) {
      console.error(err);
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to process Excel upload',
      });
    }
  }
);

router.get('/generate/:type', async (req, res) => {
  const type = asType(String(req.params.type));
  if (!type) return res.status(400).json({ error: 'Invalid report type' });

  try {
    const buffer = await generateMunicipalPaper(type);
    const filename = `RiceWatch-DS2026-${type}-paper.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate municipal paper' });
  }
});

export default router;
