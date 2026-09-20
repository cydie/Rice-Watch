import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authRequired } from '../middleware/auth.js';
import { getTechnicianScope } from '../lib/technicianScope.js';

const router = Router();
router.use(authRequired);

router.get('/', async (req, res) => {
  const scope = await getTechnicianScope(req);
  const reportWhere = scope.reportWhere;
  const farmerWhere = scope.barangayId != null ? { barangayId: scope.barangayId } : scope.isTechnician ? { barangayId: { in: [] as number[] } } : {};
  const activityWhere =
    scope.isTechnician && scope.barangayName
      ? { location: { contains: scope.barangayName, mode: 'insensitive' as const } }
      : scope.isTechnician
        ? { id: { in: [] as string[] } }
        : {};

  const barangayListWhere =
    scope.barangayId != null ? { id: scope.barangayId } : scope.isTechnician ? { id: { in: [] as number[] } } : {};

  const [planting, harvest, standing, activities, farmers, barangays] = await Promise.all([
    prisma.plantingReport.findMany({ where: reportWhere, include: { barangay: true } }),
    prisma.harvestReport.findMany({ where: reportWhere, include: { barangay: true } }),
    prisma.standingCropReport.findMany({ where: reportWhere, include: { barangay: true } }),
    prisma.activity.findMany({ where: activityWhere, orderBy: { createdAt: 'desc' }, take: 8 }),
    prisma.farmer.count({ where: farmerWhere }),
    prisma.barangay.findMany({ where: barangayListWhere, orderBy: { name: 'asc' } }),
  ]);

  const totalPlantedArea = planting.reduce((s, r) => s + r.areaPlanted, 0);
  const totalHarvestedArea = harvest.reduce((s, r) => s + r.harvestedArea, 0);
  const totalProduction = harvest.reduce((s, r) => s + r.totalProduction, 0);
  const averageYield = totalHarvestedArea > 0 ? totalProduction / totalHarvestedArea : 0;
  const standingArea = standing.reduce((s, r) => s + r.area, 0);
  const damagedArea = standing.reduce((s, r) => s + r.damagedArea, 0);
  const pestAlertCount = standing.filter(
    (r) => r.pestInfestation && r.pestInfestation.toLowerCase() !== 'none'
  ).length;
  const irrigationIssues = standing.filter(
    (r) => r.irrigationStatus && !['normal', 'adequate', 'ok'].includes(r.irrigationStatus.toLowerCase())
  ).length;
  const remainingStanding = Math.max(0, totalPlantedArea - totalHarvestedArea);
  const harvestCoveragePct =
    totalPlantedArea > 0 ? Math.min(100, (totalHarvestedArea / totalPlantedArea) * 100) : 0;

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyMap = new Map<string, { production: number; area: number }>();
  for (const h of harvest) {
    const m = monthNames[h.harvestDate.getMonth()];
    const cur = monthlyMap.get(m) || { production: 0, area: 0 };
    cur.production += h.totalProduction;
    cur.area += h.harvestedArea;
    monthlyMap.set(m, cur);
  }
  const monthlyProductionData = monthNames.slice(0, 6).map((month) => ({
    month,
    production: monthlyMap.get(month)?.production ?? 0,
    area: monthlyMap.get(month)?.area ?? 0,
  }));

  const irrigationTotals: Record<string, number> = {};
  for (const p of planting) {
    irrigationTotals[p.irrigationType] = (irrigationTotals[p.irrigationType] || 0) + p.areaPlanted;
  }
  const irrigationColors: Record<string, string> = {
    Irrigated: '#2196f3',
    Rainfed: '#4caf50',
    Upland: '#ff9800',
  };
  const irrigationData = Object.entries(irrigationTotals).map(([name, value]) => ({
    name,
    value,
    color: irrigationColors[name] || '#607d8b',
  }));

  const cropStages = ['Newly Planted', 'Vegetative', 'Reproductive', 'Maturing', 'Harvesting'];
  const cropStageData = cropStages.map((stage) => ({
    stage,
    count: standing.filter((r) => r.cropStage === stage).length,
  }));

  const scoreboardMap = new Map<
    string,
    { planted: number; harvested: number; production: number; standing: number }
  >();
  for (const b of barangays) {
    scoreboardMap.set(b.name, { planted: 0, harvested: 0, production: 0, standing: 0 });
  }
  for (const p of planting) {
    const row = scoreboardMap.get(p.barangay.name) || {
      planted: 0,
      harvested: 0,
      production: 0,
      standing: 0,
    };
    row.planted += p.areaPlanted;
    scoreboardMap.set(p.barangay.name, row);
  }
  for (const h of harvest) {
    const row = scoreboardMap.get(h.barangay.name) || {
      planted: 0,
      harvested: 0,
      production: 0,
      standing: 0,
    };
    row.harvested += h.harvestedArea;
    row.production += h.totalProduction;
    scoreboardMap.set(h.barangay.name, row);
  }
  for (const s of standing) {
    const row = scoreboardMap.get(s.barangay.name) || {
      planted: 0,
      harvested: 0,
      production: 0,
      standing: 0,
    };
    row.standing += s.area;
    scoreboardMap.set(s.barangay.name, row);
  }

  const barangayScoreboard = [...scoreboardMap.entries()]
    .map(([name, v]) => ({
      name,
      planted: Math.round(v.planted * 10) / 10,
      harvested: Math.round(v.harvested * 10) / 10,
      production: Math.round(v.production * 10) / 10,
      standing: Math.round(v.standing * 10) / 10,
    }))
    .filter((r) => r.planted > 0 || r.harvested > 0 || r.standing > 0 || r.production > 0)
    .sort((a, b) => b.production - a.production);

  const topBarangays = barangayScoreboard.slice(0, 5).map((r) => ({
    name: r.name,
    production: r.production,
  }));

  const recentActivities = activities.map((a) => {
    const diff = Date.now() - a.createdAt.getTime();
    const hours = Math.floor(diff / 3600000);
    let time = `${hours} hours ago`;
    if (hours >= 24) time = `${Math.floor(hours / 24)} days ago`;
    else if (hours < 1) time = 'Just now';
    return { action: a.action, location: a.location, time };
  });

  const lastSyncedAt = new Date().toISOString();

  res.json({
    scope: {
      level: scope.isTechnician ? 'barangay' : 'municipality',
      barangay: scope.barangayName,
    },
    summary: {
      totalPlantedArea: Math.round(totalPlantedArea * 10) / 10,
      totalHarvestedArea: Math.round(totalHarvestedArea * 10) / 10,
      totalProduction: Math.round(totalProduction * 10) / 10,
      averageYield: Math.round(averageYield * 100) / 100,
      farmerCount: farmers,
      standingArea: Math.round(standingArea * 10) / 10,
      activeReports: planting.length + harvest.length + standing.length,
      remainingStanding: Math.round(remainingStanding * 10) / 10,
      harvestCoveragePct: Math.round(harvestCoveragePct * 10) / 10,
    },
    risks: {
      damagedArea: Math.round(damagedArea * 10) / 10,
      pestAlertCount,
      irrigationIssues,
    },
    coverage: {
      planted: Math.round(totalPlantedArea * 10) / 10,
      harvested: Math.round(totalHarvestedArea * 10) / 10,
      standing: Math.round(remainingStanding * 10) / 10,
    },
    monthlyProductionData,
    irrigationData: irrigationData.length
      ? irrigationData
      : [
          { name: 'Irrigated', value: 0, color: '#2196f3' },
          { name: 'Rainfed', value: 0, color: '#4caf50' },
        ],
    cropStageData,
    barangayScoreboard,
    topBarangays,
    topMunicipalities: topBarangays,
    recentActivities,
    lastSyncedAt,
  });
});

export default router;
