import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authRequired } from '../middleware/auth.js';
import { getTechnicianScope } from '../lib/technicianScope.js';
import { normalizeRiceVariety } from '../lib/riceVarieties.js';

const router = Router();
router.use(authRequired);

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

router.get('/', async (req, res) => {
  const scope = await getTechnicianScope(req);
  const reportWhere = scope.reportWhere;

  const [planting, harvest, standing] = await Promise.all([
    prisma.plantingReport.findMany({ where: reportWhere, include: { barangay: true } }),
    prisma.harvestReport.findMany({ where: reportWhere, include: { barangay: true } }),
    prisma.standingCropReport.findMany({ where: reportWhere, include: { barangay: true } }),
  ]);

  const seasonMap = new Map<
    string,
    { planted: number; harvested: number; production: number; farmers: number }
  >();
  for (const p of planting) {
    const key = p.season || 'Unspecified';
    const cur = seasonMap.get(key) || { planted: 0, harvested: 0, production: 0, farmers: 0 };
    cur.planted += p.areaPlanted;
    cur.farmers += p.farmerCount;
    seasonMap.set(key, cur);
  }
  // Attribute harvest to seasons by share of planted area (real aggregate, not invented years)
  const plantedTotal = planting.reduce((s, p) => s + p.areaPlanted, 0) || 1;
  const harvestArea = harvest.reduce((s, h) => s + h.harvestedArea, 0);
  const harvestProd = harvest.reduce((s, h) => s + h.totalProduction, 0);
  for (const [key, cur] of seasonMap) {
    const share = cur.planted / plantedTotal;
    cur.harvested = harvestArea * share;
    cur.production = harvestProd * share;
  }
  if (seasonMap.size === 0 && harvest.length > 0) {
    seasonMap.set('Current Season', {
      planted: 0,
      harvested: harvestArea,
      production: harvestProd,
      farmers: 0,
    });
  }
  const seasonalData = [...seasonMap.entries()].map(([season, v]) => ({
    season,
    planted: round1(v.planted),
    harvested: round1(v.harvested),
    production: round1(v.production),
    farmers: Math.round(v.farmers),
  }));

  const barangayStats = new Map<
    string,
    {
      planted: number;
      harvested: number;
      production: number;
      yieldSum: number;
      yieldCount: number;
      farmers: number;
    }
  >();
  for (const p of planting) {
    const n = p.barangay.name;
    const cur = barangayStats.get(n) || {
      planted: 0,
      harvested: 0,
      production: 0,
      yieldSum: 0,
      yieldCount: 0,
      farmers: 0,
    };
    cur.planted += p.areaPlanted;
    cur.farmers += p.farmerCount;
    barangayStats.set(n, cur);
  }
  for (const h of harvest) {
    const n = h.barangay.name;
    const cur = barangayStats.get(n) || {
      planted: 0,
      harvested: 0,
      production: 0,
      yieldSum: 0,
      yieldCount: 0,
      farmers: 0,
    };
    cur.harvested += h.harvestedArea;
    cur.production += h.totalProduction;
    cur.yieldSum += h.averageYield;
    cur.yieldCount += 1;
    barangayStats.set(n, cur);
  }

  const municipalityComparison = [...barangayStats.entries()]
    .map(([name, v]) => {
      const meanYield =
        v.harvested > 0 ? v.production / v.harvested : v.yieldCount ? v.yieldSum / v.yieldCount : 0;
      return {
        name,
        planted: round1(v.planted),
        harvested: round1(v.harvested),
        production: round1(v.production),
        yield: round1(meanYield),
        farmers: Math.round(v.farmers),
        areaGapHa: round1(Math.max(v.planted - v.harvested, 0)),
      };
    })
    .sort((a, b) => b.planted - a.planted);

  const varietyMap = new Map<string, number>();
  for (const p of planting) {
    const name = normalizeRiceVariety(p.seedVariety);
    varietyMap.set(name, (varietyMap.get(name) || 0) + p.areaPlanted);
  }
  const colors = ['#4caf50', '#2196f3', '#ff9800', '#9c27b0', '#607d8b', '#e91e63', '#00bcd4', '#8bc34a'];
  const varietyDistribution = [...varietyMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name, value], i) => ({
      name,
      value: round1(value),
      color: colors[i % colors.length],
    }));

  // Real period yield: group harvest by YYYY-MM of harvestDate
  const periodMap = new Map<string, { prod: number; area: number }>();
  for (const h of harvest) {
    const period = h.harvestDate.toISOString().slice(0, 7);
    const cur = periodMap.get(period) || { prod: 0, area: 0 };
    cur.prod += h.totalProduction;
    cur.area += h.harvestedArea;
    periodMap.set(period, cur);
  }
  const yieldTrends = [...periodMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, v]) => ({
      period,
      year: period,
      avgYield: v.area > 0 ? round2(v.prod / v.area) : 0,
      harvestedArea: round1(v.area),
      production: round1(v.prod),
    }));

  const irrigationMap = new Map<string, { planted: number; harvested: number; production: number }>();
  for (const p of planting) {
    const k = p.irrigationType || 'Unknown';
    const cur = irrigationMap.get(k) || { planted: 0, harvested: 0, production: 0 };
    cur.planted += p.areaPlanted;
    irrigationMap.set(k, cur);
  }
  for (const h of harvest) {
    const k = h.irrigationType || 'Unknown';
    const cur = irrigationMap.get(k) || { planted: 0, harvested: 0, production: 0 };
    cur.harvested += h.harvestedArea;
    cur.production += h.totalProduction;
    irrigationMap.set(k, cur);
  }
  const irrigationSplit = [...irrigationMap.entries()].map(([type, v]) => ({
    type,
    planted: round1(v.planted),
    harvested: round1(v.harvested),
    production: round1(v.production),
    yield: v.harvested > 0 ? round2(v.production / v.harvested) : 0,
  }));

  const totalPlanted = planting.reduce((s, p) => s + p.areaPlanted, 0);
  const totalHarvested = harvest.reduce((s, h) => s + h.harvestedArea, 0);
  const totalProduction = harvest.reduce((s, h) => s + h.totalProduction, 0);
  const totalFarmers = planting.reduce((s, p) => s + p.farmerCount, 0);
  const standingArea = standing.reduce((s, r) => s + r.area, 0);
  const meanYield = totalHarvested > 0 ? totalProduction / totalHarvested : 0;

  res.json({
    scope: {
      level: scope.isTechnician ? 'barangay' : 'municipality',
      barangay: scope.barangayName,
    },
    meta: {
      municipality: 'Rizal',
      province: 'Palawan',
      dataPeriodLabel: yieldTrends.length
        ? `${yieldTrends[0].period} → ${yieldTrends[yieldTrends.length - 1].period}`
        : seasonalData.map((s) => s.season).join(', ') || 'No harvest periods yet',
      generatedAt: new Date().toISOString(),
      recordCounts: {
        planting: planting.length,
        harvest: harvest.length,
        standing: standing.length,
      },
    },
    researchMetrics: {
      meanYieldMtHa: round2(meanYield),
      totalPlantedHa: round2(totalPlanted),
      totalHarvestedHa: round2(totalHarvested),
      plantedVsHarvestedGapHa: round2(Math.max(totalPlanted - totalHarvested, 0)),
      totalProductionMt: round2(totalProduction),
      totalFarmers,
      standingAreaHa: round2(standingArea),
      barangayCount: municipalityComparison.length,
    },
    seasonalData,
    municipalityComparison,
    varietyDistribution,
    yieldTrends,
    irrigationSplit,
  });
});

export default router;
