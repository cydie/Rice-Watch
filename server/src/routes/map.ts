import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authRequired } from '../middleware/auth.js';
import { getTechnicianScope } from '../lib/technicianScope.js';
import { normalizeBarangayName } from '../lib/helpers.js';
import { normalizeRiceVariety } from '../lib/riceVarieties.js';
import { computeRiskAlerts } from '../lib/riskAlerts.js';

const router = Router();
router.use(authRequired);

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

router.get('/barangay-metrics', async (req, res) => {
  const scope = await getTechnicianScope(req);
  const reportWhere = scope.reportWhere;

  const [planting, harvest, standing] = await Promise.all([
    prisma.plantingReport.findMany({ where: reportWhere, include: { barangay: true } }),
    prisma.harvestReport.findMany({ where: reportWhere, include: { barangay: true } }),
    prisma.standingCropReport.findMany({ where: reportWhere, include: { barangay: true } }),
  ]);

  const map = new Map<
    string,
    {
      name: string;
      plantedHa: number;
      harvestedHa: number;
      standingHa: number;
      productionMt: number;
      farmers: number;
      irrigatedHa: number;
      rainfedHa: number;
      varieties: Map<string, number>;
    }
  >();

  const ensure = (name: string) => {
    const n = normalizeBarangayName(name);
    if (!map.has(n)) {
      map.set(n, {
        name: n,
        plantedHa: 0,
        harvestedHa: 0,
        standingHa: 0,
        productionMt: 0,
        farmers: 0,
        irrigatedHa: 0,
        rainfedHa: 0,
        varieties: new Map(),
      });
    }
    return map.get(n)!;
  };

  for (const p of planting) {
    const row = ensure(p.barangay.name);
    row.plantedHa += p.areaPlanted;
    row.farmers += p.farmerCount;
    if (p.irrigationType === 'Irrigated') row.irrigatedHa += p.areaPlanted;
    else row.rainfedHa += p.areaPlanted;
    const v = normalizeRiceVariety(p.seedVariety);
    row.varieties.set(v, (row.varieties.get(v) || 0) + p.areaPlanted);
  }
  for (const h of harvest) {
    const row = ensure(h.barangay.name);
    row.harvestedHa += h.harvestedArea;
    row.productionMt += h.totalProduction;
  }
  for (const s of standing) {
    const row = ensure(s.barangay.name);
    row.standingHa += s.area;
  }

  const risks = await computeRiskAlerts(scope);
  const riskByBarangay = new Map(risks.map((r) => [r.barangay, r]));

  const barangays = [...map.values()].map((r) => {
    const topVariety =
      [...r.varieties.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    const risk = riskByBarangay.get(r.name);
    return {
      name: r.name,
      plantedHa: round1(r.plantedHa),
      harvestedHa: round1(r.harvestedHa),
      standingHa: round1(r.standingHa),
      productionMt: round1(r.productionMt),
      farmers: Math.round(r.farmers),
      irrigatedHa: round1(r.irrigatedHa),
      rainfedHa: round1(r.rainfedHa),
      topVariety,
      yieldMtHa: r.harvestedHa > 0 ? round1(r.productionMt / r.harvestedHa) : 0,
      riskLevel: risk?.severity || 'none',
      riskScore: risk?.score || 0,
      riskFlags: risk?.flags || [],
    };
  });

  res.json({
    scope: {
      level: scope.isTechnician ? 'barangay' : 'municipality',
      barangay: scope.barangayName,
    },
    municipality: 'Rizal',
    province: 'Palawan',
    center: [8.52, 117.34],
    metricOptions: ['plantedHa', 'harvestedHa', 'standingHa'],
    barangays,
  });
});

export default router;
