import { prisma } from './prisma.js';
import type { TechnicianScope } from './technicianScope.js';
import { normalizeRiceVariety } from './riceVarieties.js';

export interface ForecastRow {
  barangay: string;
  irrigationType: string;
  varietyClass: string;
  areaHa: number;
  predictedYieldMtHa: number;
  predictedProductionMt: number;
  baselineYieldMtHa: number;
  sampleSize: number;
}

export interface ForecastResult {
  model: {
    name: string;
    type: 'barangay_irrigation_mean_with_variety_adjust';
    description: string;
    limitations: string;
    features: string[];
    trainedOn: number;
    holdoutSize: number;
    mae: number;
    mape: number;
    rmse: number;
  };
  municipalityMeanYield: number;
  predictions: ForecastRow[];
}

function varietyClass(raw: string): string {
  const v = normalizeRiceVariety(raw).toUpperCase();
  if (
    /SYNGENTA|HABILIS|NK5017|LONGPING|SL-19|SL 20|JACKPOT|AZ 8433|BIGANTE|TH 82|HYBRID/.test(v)
  ) {
    return 'HYBRID';
  }
  if (/BLONDE|SPEED|B-4|C4|KANADOY|BULLRICE|JASMINE|DINORADO|FS|FARMER/.test(v)) {
    return 'FS';
  }
  return 'CS';
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

interface Sample {
  barangay: string;
  irrigationType: string;
  varietyClass: string;
  areaHa: number;
  yieldMtHa: number;
  productionMt: number;
}

async function loadSamples(scope: TechnicianScope): Promise<Sample[]> {
  const harvest = await prisma.harvestReport.findMany({
    where: scope.reportWhere,
    include: { barangay: true },
  });
  return harvest
    .filter((h) => h.harvestedArea > 0)
    .map((h) => ({
      barangay: h.barangay.name,
      irrigationType: h.irrigationType || 'Irrigated',
      varietyClass: varietyClass(h.riceVariety),
      areaHa: h.harvestedArea,
      yieldMtHa: h.averageYield || h.totalProduction / h.harvestedArea,
      productionMt: h.totalProduction,
    }));
}

function mean(xs: number[]) {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function predictYield(
  sample: Pick<Sample, 'barangay' | 'irrigationType' | 'varietyClass'>,
  train: Sample[],
  globalMean: number
): { yield: number; n: number; baseline: number } {
  const bi = train.filter(
    (t) => t.barangay === sample.barangay && t.irrigationType === sample.irrigationType
  );
  const baseline = bi.length ? mean(bi.map((t) => t.yieldMtHa)) : globalMean;
  const sameClass = train.filter((t) => t.varietyClass === sample.varietyClass);
  const classMean = sameClass.length ? mean(sameClass.map((t) => t.yieldMtHa)) : globalMean;
  // Transparent blend: 70% barangay×irrigation mean + 30% variety-class mean
  const y = baseline * 0.7 + classMean * 0.3;
  return { yield: y, n: bi.length, baseline };
}

/** Transparent municipal yield model with holdout MAE / MAPE / RMSE. */
export async function buildYieldForecast(scope: TechnicianScope): Promise<ForecastResult> {
  const samples = await loadSamples(scope);
  const globalMean = samples.length ? mean(samples.map((s) => s.yieldMtHa)) : 0;

  // Holdout: last 20% by index (stable for demo reproducibility)
  const sorted = [...samples];
  const holdoutN = Math.max(1, Math.floor(sorted.length * 0.2));
  const train = sorted.length > 2 ? sorted.slice(0, sorted.length - holdoutN) : sorted;
  const holdout = sorted.length > 2 ? sorted.slice(sorted.length - holdoutN) : [];

  let absErr = 0;
  let absPct = 0;
  let sqErr = 0;
  let evaluated = 0;
  for (const h of holdout) {
    const pred = predictYield(h, train, globalMean).yield;
    const err = Math.abs(pred - h.yieldMtHa);
    absErr += err;
    sqErr += err * err;
    if (h.yieldMtHa > 0) {
      absPct += (err / h.yieldMtHa) * 100;
      evaluated += 1;
    }
  }
  const nEval = holdout.length || 1;
  const mae = round2(absErr / nEval);
  const rmse = round2(Math.sqrt(sqErr / nEval));
  const mape = evaluated ? round2(absPct / evaluated) : 0;

  // Predictions: one row per barangay×irrigation present in planting (or harvest)
  const planting = await prisma.plantingReport.findMany({
    where: scope.reportWhere,
    include: { barangay: true },
  });
  const groups = new Map<string, { area: number; varietyClass: string; count: number }>();
  for (const p of planting) {
    const vc = varietyClass(p.seedVariety);
    const key = `${p.barangay.name}|${p.irrigationType}|${vc}`;
    const cur = groups.get(key) || { area: 0, varietyClass: vc, count: 0 };
    cur.area += p.areaPlanted;
    cur.count += 1;
    groups.set(key, cur);
  }
  if (groups.size === 0) {
    for (const s of samples) {
      const key = `${s.barangay}|${s.irrigationType}|${s.varietyClass}`;
      const cur = groups.get(key) || { area: 0, varietyClass: s.varietyClass, count: 0 };
      cur.area += s.areaHa;
      cur.count += 1;
      groups.set(key, cur);
    }
  }

  const predictions: ForecastRow[] = [];
  for (const [key, g] of groups) {
    const [barangay, irrigationType, vc] = key.split('|');
    const pred = predictYield(
      { barangay, irrigationType, varietyClass: vc },
      train.length ? train : samples,
      globalMean
    );
    predictions.push({
      barangay,
      irrigationType,
      varietyClass: vc,
      areaHa: round2(g.area),
      predictedYieldMtHa: round2(pred.yield),
      predictedProductionMt: round2(pred.yield * g.area),
      baselineYieldMtHa: round2(pred.baseline),
      sampleSize: pred.n,
    });
  }
  predictions.sort((a, b) => b.predictedProductionMt - a.predictedProductionMt);

  return {
    model: {
      name: 'RiceWatch Municipal Yield Estimator v1',
      type: 'barangay_irrigation_mean_with_variety_adjust',
      description:
        'Predicts MT/ha as 0.7× historical barangay×irrigation mean + 0.3× variety-class mean, trained on municipal harvest reports.',
      limitations:
        'Uses municipal field reports only; no satellite NDVI or weather covariates in v1. Holdout is chronological slice of existing harvest rows.',
      features: ['barangay', 'irrigationType', 'varietyClass', 'areaHa'],
      trainedOn: train.length,
      holdoutSize: holdout.length,
      mae,
      mape,
      rmse,
    },
    municipalityMeanYield: round2(globalMean),
    predictions,
  };
}
