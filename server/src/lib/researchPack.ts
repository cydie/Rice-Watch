import XLSX from 'xlsx';
import { prisma } from './prisma.js';
import type { TechnicianScope } from './technicianScope.js';
import { normalizeRiceVariety } from './riceVarieties.js';
import { buildYieldForecast } from './yieldForecast.js';
import { computeRiskAlerts } from './riskAlerts.js';

function sheetFromRows(rows: Record<string, unknown>[], name: string) {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ note: 'No rows' }]);
  return { ws, name };
}

/** Multi-sheet NRS Research Pack for symposium evidence. */
export async function buildResearchPackBuffer(scope: TechnicianScope): Promise<Buffer> {
  const reportWhere = scope.reportWhere;
  const [planting, harvest, standing, forecast, alerts] = await Promise.all([
    prisma.plantingReport.findMany({ where: reportWhere, include: { barangay: true } }),
    prisma.harvestReport.findMany({ where: reportWhere, include: { barangay: true } }),
    prisma.standingCropReport.findMany({ where: reportWhere, include: { barangay: true } }),
    buildYieldForecast(scope),
    computeRiskAlerts(scope),
  ]);

  const totalPlanted = planting.reduce((s, p) => s + p.areaPlanted, 0);
  const totalHarvested = harvest.reduce((s, h) => s + h.harvestedArea, 0);
  const totalProd = harvest.reduce((s, h) => s + h.totalProduction, 0);
  const meanYield = totalHarvested > 0 ? totalProd / totalHarvested : 0;

  const methods = [
    {
      section: 'Title',
      content:
        'RiceWatch: Digitizing DA Rizal, Palawan rice field papers into municipal spatial monitoring and evaluable yield forecasts',
    },
    {
      section: 'Municipality',
      content: 'Rizal, Palawan, Philippines (11 barangays)',
    },
    {
      section: 'Data sources',
      content:
        'Official DA Dry Season 2026 planting/harvest/standing papers (data/official/); technician masterlist uploads; RIZAL FIMS farmer registry',
    },
    {
      section: 'Methods — Analytics',
      content:
        'Seasonal and barangay aggregates from PostgreSQL planting/harvest/standing tables; variety names normalized to DS 2026 catalog; yield trends by harvest YYYY-MM (no synthetic years)',
    },
    {
      section: 'Methods — Spatial',
      content:
        'Choropleth of approximate Rizal barangay polygons (public/geo/rizal-barangays.geojson) colored by planted/harvested/standing hectares',
    },
    {
      section: 'Methods — Forecast',
      content: forecast.model.description,
    },
    {
      section: 'Model metrics',
      content: `MAE=${forecast.model.mae} MT/ha; MAPE=${forecast.model.mape}%; RMSE=${forecast.model.rmse}; train n=${forecast.model.trainedOn}; holdout n=${forecast.model.holdoutSize}`,
    },
    {
      section: 'Limitations',
      content: forecast.model.limitations,
    },
    {
      section: 'Early warning rules',
      content:
        'Damaged % of standing, pest severity, irrigation stress, planted-but-unaccounted lag, poor/critical crop condition → severity score 0–100',
    },
    {
      section: 'Generated at',
      content: new Date().toISOString(),
    },
  ];

  const aggregates = [
    {
      metric: 'totalPlantedHa',
      value: Math.round(totalPlanted * 100) / 100,
    },
    {
      metric: 'totalHarvestedHa',
      value: Math.round(totalHarvested * 100) / 100,
    },
    {
      metric: 'totalProductionMt',
      value: Math.round(totalProd * 100) / 100,
    },
    {
      metric: 'meanYieldMtHa',
      value: Math.round(meanYield * 100) / 100,
    },
    {
      metric: 'plantingRecords',
      value: planting.length,
    },
    {
      metric: 'harvestRecords',
      value: harvest.length,
    },
    {
      metric: 'standingRecords',
      value: standing.length,
    },
    {
      metric: 'municipalityMeanYieldForecast',
      value: forecast.municipalityMeanYield,
    },
  ];

  const varietyRows: Record<string, unknown>[] = [];
  const vMap = new Map<string, number>();
  for (const p of planting) {
    const n = normalizeRiceVariety(p.seedVariety);
    vMap.set(n, (vMap.get(n) || 0) + p.areaPlanted);
  }
  for (const [name, area] of [...vMap.entries()].sort((a, b) => b[1] - a[1])) {
    varietyRows.push({ variety: name, plantedHa: Math.round(area * 100) / 100 });
  }

  const barangayRows: Record<string, unknown>[] = [];
  const bMap = new Map<string, { planted: number; harvested: number; prod: number; farmers: number }>();
  for (const p of planting) {
    const n = p.barangay.name;
    const cur = bMap.get(n) || { planted: 0, harvested: 0, prod: 0, farmers: 0 };
    cur.planted += p.areaPlanted;
    cur.farmers += p.farmerCount;
    bMap.set(n, cur);
  }
  for (const h of harvest) {
    const n = h.barangay.name;
    const cur = bMap.get(n) || { planted: 0, harvested: 0, prod: 0, farmers: 0 };
    cur.harvested += h.harvestedArea;
    cur.prod += h.totalProduction;
    bMap.set(n, cur);
  }
  for (const [name, v] of bMap) {
    barangayRows.push({
      barangay: name,
      plantedHa: Math.round(v.planted * 100) / 100,
      harvestedHa: Math.round(v.harvested * 100) / 100,
      productionMt: Math.round(v.prod * 100) / 100,
      yieldMtHa: v.harvested > 0 ? Math.round((v.prod / v.harvested) * 100) / 100 : 0,
      farmers: v.farmers,
    });
  }

  const forecastRows = forecast.predictions.map((p) => ({ ...p }));
  const alertRows = alerts.map((a) => ({
    barangay: a.barangay,
    severity: a.severity,
    score: a.score,
    flags: a.flags.join(' | '),
    damagedAreaHa: a.damagedAreaHa,
    standingAreaHa: a.standingAreaHa,
  }));
  const modelCard = [
    { field: 'name', value: forecast.model.name },
    { field: 'type', value: forecast.model.type },
    { field: 'mae', value: forecast.model.mae },
    { field: 'mape', value: forecast.model.mape },
    { field: 'rmse', value: forecast.model.rmse },
    { field: 'trainedOn', value: forecast.model.trainedOn },
    { field: 'holdoutSize', value: forecast.model.holdoutSize },
    { field: 'features', value: forecast.model.features.join(', ') },
    { field: 'description', value: forecast.model.description },
    { field: 'limitations', value: forecast.model.limitations },
  ];
  const citations = [
    {
      source: 'Planting Report DS 2026 Rizal, Palawan',
      path: 'data/official/Planting Report DS 2026 Rizal, Palawan (2).xlsx',
    },
    {
      source: 'Harvesting Report DS 2026 Rizal, Palawan',
      path: 'data/official/Harvesting Report DS 2026 Rizal, Palawan (1).xlsx',
    },
    {
      source: 'Rice Standing Crop 2026',
      path: 'data/official/RICE STANDING CROP 2026 (1).xlsx',
    },
    { source: 'RIZAL FIMS', path: 'data/RIZAL FIMS.xlsx' },
    {
      source: 'Barangay GeoJSON (approximate polygons for demo map)',
      path: 'public/geo/rizal-barangays.geojson',
    },
  ];

  const wb = XLSX.utils.book_new();
  const sheets = [
    sheetFromRows(methods, 'Methods'),
    sheetFromRows(aggregates, 'Aggregates'),
    sheetFromRows(barangayRows, 'Barangay'),
    sheetFromRows(varietyRows, 'Varieties'),
    sheetFromRows(modelCard, 'ModelCard'),
    sheetFromRows(forecastRows, 'Forecast'),
    sheetFromRows(alertRows, 'EarlyWarnings'),
    sheetFromRows(citations, 'Citations'),
  ];
  for (const { ws, name } of sheets) {
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
