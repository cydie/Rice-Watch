import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { toCsv } from '../lib/helpers.js';
import { getTechnicianScope } from '../lib/technicianScope.js';
import { buildResearchPackBuffer } from '../lib/researchPack.js';

const router = Router();
router.use(authRequired);

router.get('/research-pack', requireRole('admin', 'encoder'), async (req, res) => {
  try {
    const scope = await getTechnicianScope(req);
    const buffer = await buildResearchPackBuffer(scope);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="RiceWatch-NRS-Rizal-DS2026-ResearchPack.xlsx"'
    );
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to build research pack' });
  }
});

router.get('/:type', async (req, res) => {
  const scope = await getTechnicianScope(req);
  const reportWhere = scope.reportWhere;
  const farmerWhere =
    scope.barangayId != null
      ? { barangayId: scope.barangayId }
      : scope.isTechnician
        ? { barangayId: { in: [] as number[] } }
        : {};

  const type = req.params.type;
  let rows: Record<string, unknown>[] = [];
  let filename = 'export.csv';

  if (type === 'planting') {
    const data = await prisma.plantingReport.findMany({ where: reportWhere, include: { barangay: true } });
    rows = data.map((r) => ({
      municipality: r.municipality,
      barangay: r.barangay.name,
      sitio: r.sitio,
      farmerCount: r.farmerCount,
      seedVariety: r.seedVariety,
      areaPlanted: r.areaPlanted,
      datePlanted: r.datePlanted.toISOString().split('T')[0],
      irrigationType: r.irrigationType,
      season: r.season,
      expectedHarvest: r.expectedHarvest.toISOString().split('T')[0],
    }));
    filename = 'planting-reports.csv';
  } else if (type === 'harvest') {
    const data = await prisma.harvestReport.findMany({ where: reportWhere, include: { barangay: true } });
    rows = data.map((r) => ({
      municipality: r.municipality,
      barangay: r.barangay.name,
      sitio: r.sitio,
      harvestDate: r.harvestDate.toISOString().split('T')[0],
      harvestedArea: r.harvestedArea,
      totalProduction: r.totalProduction,
      averageYield: r.averageYield,
      riceVariety: r.riceVariety,
      irrigationType: r.irrigationType,
    }));
    filename = 'harvest-reports.csv';
  } else if (type === 'standing-crop') {
    const data = await prisma.standingCropReport.findMany({
      where: reportWhere,
      include: { barangay: true },
    });
    rows = data.map((r) => ({
      municipality: r.municipality,
      barangay: r.barangay.name,
      sitio: r.sitio,
      cropStage: r.cropStage,
      area: r.area,
      cropCondition: r.cropCondition,
      damagedArea: r.damagedArea,
      pestInfestation: r.pestInfestation,
      irrigationStatus: r.irrigationStatus,
      lastUpdated: r.lastUpdated.toISOString().split('T')[0],
    }));
    filename = 'standing-crop-reports.csv';
  } else if (type === 'farmers') {
    const data = await prisma.farmer.findMany({
      where: farmerWhere,
      include: { barangay: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    rows = data.map((r) => ({
      'SYSTEM_GENERATED_RSBSA_NUMBER': r.rsbsaNumber,
      'LAST NAME': r.lastName,
      'FIRST NAME': r.firstName,
      'MIDDLE NAME': r.middleName,
      'SUFFIX AND EXTENSION': r.suffix,
      'FARMER ADDRESS 1': r.farmerAddress1,
      'FARMER ADDRESS 2': r.farmerAddress2,
      'FARMER ADDRESS 3': r.farmerAddress3,
      'FARM ADDRESS 2': r.farmAddress2,
      'FARM ADDRESS 3': r.farmAddress3,
      BIRTHDATE: r.birthdate?.toISOString().split('T')[0] ?? '',
      SEX: r.sex,
      'CONTACT NO': r.contactNo,
      '4Ps': r.fourPs ? 'YES' : 'NO',
      Indegenous: r.indigenous ? 'YES' : 'NO',
      PWD: r.pwd ? 'YES' : 'NO',
      'FARM AREA': r.farmArea,
      'AREA PLANTED': r.areaPlanted ?? '',
      COMMODITY: r.commodity,
      'Farmer GeoCode': r.farmerGeoCode ?? '',
      'Farm GeoCode': r.farmGeoCode ?? '',
    }));
    filename = 'rizal-fims-farmers.csv';
  } else if (type === 'analytics' || type === 'production') {
    const data = await prisma.harvestReport.findMany({ where: reportWhere, include: { barangay: true } });
    rows = data.map((r) => ({
      barangay: r.barangay.name,
      harvestDate: r.harvestDate.toISOString().split('T')[0],
      harvestedArea: r.harvestedArea,
      totalProduction: r.totalProduction,
      averageYield: r.averageYield,
    }));
    filename = 'production-analytics.csv';
  } else {
    return res.status(400).json({ error: 'Unknown export type' });
  }

  const csv = toCsv(rows);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});

export default router;
