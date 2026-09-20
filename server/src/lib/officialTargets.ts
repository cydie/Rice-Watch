/**
 * Reads official DA DS 2026 municipal papers and builds technician-ready
 * masterlists + target summaries that match those papers.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';
import { normalizeBarangayName } from './helpers.js';
import { varietyForSeedType } from './riceVarieties.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const OFFICIAL_DIR = path.join(ROOT, 'data/official');

export const FILLED_TEMPLATES_DIR = path.join(ROOT, 'data/templates/filled');

const PLANTING_FILE = path.join(OFFICIAL_DIR, 'Planting Report DS 2026 Rizal, Palawan (2).xlsx');
const HARVEST_FILE = path.join(OFFICIAL_DIR, 'Harvesting Report DS 2026 Rizal, Palawan (1).xlsx');
const STANDING_FILE = path.join(OFFICIAL_DIR, 'RICE STANDING CROP 2026 (1).xlsx');

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

function round3(v: number) {
  return Math.round(v * 1000) / 1000;
}

export type SeedCode = 'HYBRID' | 'RS' | 'CS' | 'GQS' | 'FS';

export interface PlantingSeedSlice {
  irrigation: 'IRRIGATED' | 'RAINFED';
  seedType: SeedCode;
  areaHa: number;
}

export interface OfficialPlantingTarget {
  barangay: string;
  farmers: number;
  irrigatedHa: number;
  rainfedHa: number;
  totalHa: number;
  slices: PlantingSeedSlice[];
}

export interface OfficialHarvestTarget {
  barangay: string;
  farmers: number;
  irrigatedHa: number;
  irrigatedProdMt: number;
  rainfedHa: number;
  rainfedProdMt: number;
  totalHa: number;
  totalProdMt: number;
}

export interface StandingStageSlice {
  irrigation: 'IRRIGATED' | 'RAINFED';
  stage: 'Newly Planted' | 'Vegetative' | 'Reproductive' | 'Maturing';
  areaHa: number;
}

export interface OfficialStandingTarget {
  barangay: string;
  irrigatedHa: number;
  rainfedHa: number;
  totalHa: number;
  slices: StandingStageSlice[];
}

export interface OfficialTargetsBundle {
  season: 'Dry Season';
  asOf: {
    planting: string;
    harvest: string;
    standing: string;
  };
  planting: OfficialPlantingTarget[];
  harvest: OfficialHarvestTarget[];
  standing: OfficialStandingTarget[];
  municipal: {
    plantingFarmers: number;
    plantingHa: number;
    harvestFarmers: number;
    harvestHa: number;
    harvestProdMt: number;
    standingHa: number;
  };
}

const PLANTING_SLICE_DEFS: { irrigation: 'IRRIGATED' | 'RAINFED'; seedType: SeedCode; col: number }[] = [
  { irrigation: 'IRRIGATED', seedType: 'HYBRID', col: 2 },
  { irrigation: 'IRRIGATED', seedType: 'RS', col: 3 },
  { irrigation: 'IRRIGATED', seedType: 'CS', col: 4 },
  { irrigation: 'IRRIGATED', seedType: 'GQS', col: 5 },
  { irrigation: 'IRRIGATED', seedType: 'FS', col: 6 },
  { irrigation: 'RAINFED', seedType: 'HYBRID', col: 8 },
  { irrigation: 'RAINFED', seedType: 'RS', col: 9 },
  { irrigation: 'RAINFED', seedType: 'CS', col: 10 },
  { irrigation: 'RAINFED', seedType: 'GQS', col: 11 },
  { irrigation: 'RAINFED', seedType: 'FS', col: 12 },
  // Rainfed upland CS/GQS/FS fold into rainfed for technician uploads
  { irrigation: 'RAINFED', seedType: 'CS', col: 13 },
  { irrigation: 'RAINFED', seedType: 'GQS', col: 14 },
  { irrigation: 'RAINFED', seedType: 'FS', col: 15 },
];

function loadPlantingTargets(): OfficialPlantingTarget[] {
  if (!fs.existsSync(PLANTING_FILE)) return [];
  const wb = XLSX.readFile(PLANTING_FILE);
  const raw = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets['DS 2026 Cumulative'], {
    header: 1,
    defval: '',
  });
  const out: OfficialPlantingTarget[] = [];
  for (let i = 11; i <= 21; i++) {
    const label = String(raw[i]?.[0] || '').trim();
    if (!label || /^rizal$/i.test(label)) continue;
    const barangay = normalizeBarangayName(label);
    const farmers = Math.round(n(raw[i][1]));
    const irrigatedHa = round2(n(raw[i][7]));
    const rainfedHa = round2(n(raw[i][16]));
    const sliceMap = new Map<string, PlantingSeedSlice>();
    for (const def of PLANTING_SLICE_DEFS) {
      const areaHa = round3(n(raw[i][def.col]));
      if (areaHa <= 0) continue;
      const key = `${def.irrigation}|${def.seedType}`;
      const existing = sliceMap.get(key);
      if (existing) existing.areaHa = round3(existing.areaHa + areaHa);
      else sliceMap.set(key, { irrigation: def.irrigation, seedType: def.seedType, areaHa });
    }
    out.push({
      barangay,
      farmers,
      irrigatedHa,
      rainfedHa,
      totalHa: round2(irrigatedHa + rainfedHa),
      slices: [...sliceMap.values()],
    });
  }
  return out;
}

function loadHarvestTargets(): OfficialHarvestTarget[] {
  if (!fs.existsSync(HARVEST_FILE)) return [];
  const wb = XLSX.readFile(HARVEST_FILE);
  const raw = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets.Commulative, {
    header: 1,
    defval: '',
  });
  const out: OfficialHarvestTarget[] = [];
  for (let i = 12; i <= 22; i++) {
    const label = String(raw[i]?.[0] || '').trim();
    if (!label || /^rizal$/i.test(label)) continue;
    const barangay = normalizeBarangayName(label);
    const farmers = Math.round(n(raw[i][1]));
    const irrigatedHa = round2(n(raw[i][17]));
    const irrigatedProdMt = round2(n(raw[i][19]));
    const rainfedHa = round2(n(raw[i][44]));
    const rainfedProdMt = round2(n(raw[i][46]));
    out.push({
      barangay,
      farmers,
      irrigatedHa,
      irrigatedProdMt,
      rainfedHa,
      rainfedProdMt,
      totalHa: round2(irrigatedHa + rainfedHa),
      totalProdMt: round2(irrigatedProdMt + rainfedProdMt),
    });
  }
  return out;
}

function loadStandingTargets(): OfficialStandingTarget[] {
  if (!fs.existsSync(STANDING_FILE)) return [];
  const wb = XLSX.readFile(STANDING_FILE);
  const sheet = wb.Sheets['Mar 16-31'] || wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, defval: '' });
  const stages: OfficialStandingTarget['slices'][number]['stage'][] = [
    'Newly Planted',
    'Vegetative',
    'Reproductive',
    'Maturing',
  ];
  const out: OfficialStandingTarget[] = [];
  for (let i = 9; i <= 19; i++) {
    const label = String(raw[i]?.[0] || '').trim();
    if (!label || /^rizal$/i.test(label)) continue;
    const barangay = normalizeBarangayName(label);
    const slices: StandingStageSlice[] = [];
    for (let s = 0; s < stages.length; s++) {
      const ir = round2(n(raw[i][1 + s]));
      const rf = round2(n(raw[i][6 + s]));
      if (ir > 0) slices.push({ irrigation: 'IRRIGATED', stage: stages[s], areaHa: ir });
      if (rf > 0) slices.push({ irrigation: 'RAINFED', stage: stages[s], areaHa: rf });
    }
    const irrigatedHa = round2(n(raw[i][5]));
    const rainfedHa = round2(n(raw[i][10]));
    out.push({
      barangay,
      irrigatedHa,
      rainfedHa,
      totalHa: round2(irrigatedHa + rainfedHa),
      slices,
    });
  }
  return out;
}

let cached: OfficialTargetsBundle | null = null;

export function getOfficialTargets(forceReload = false): OfficialTargetsBundle {
  if (cached && !forceReload) return cached;
  const planting = loadPlantingTargets();
  const harvest = loadHarvestTargets();
  const standing = loadStandingTargets();
  cached = {
    season: 'Dry Season',
    asOf: {
      planting: 'DS 2026 Cumulative (terminal planting)',
      harvest: 'DS 2026 Cumulative',
      standing: 'as of March 31, 2026',
    },
    planting,
    harvest,
    standing,
    municipal: {
      plantingFarmers: planting.reduce((s, r) => s + r.farmers, 0),
      plantingHa: round2(planting.reduce((s, r) => s + r.totalHa, 0)),
      harvestFarmers: harvest.reduce((s, r) => s + r.farmers, 0),
      harvestHa: round2(harvest.reduce((s, r) => s + r.totalHa, 0)),
      harvestProdMt: round2(harvest.reduce((s, r) => s + r.totalProdMt, 0)),
      standingHa: round2(standing.reduce((s, r) => s + r.totalHa, 0)),
    },
  };
  return cached;
}

export function getTargetsForBarangay(barangay: string) {
  const bundle = getOfficialTargets();
  const name = normalizeBarangayName(barangay);
  return {
    season: bundle.season,
    asOf: bundle.asOf,
    barangay: name,
    planting: bundle.planting.find((r) => r.barangay === name) ?? null,
    harvest: bundle.harvest.find((r) => r.barangay === name) ?? null,
    standing: bundle.standing.find((r) => r.barangay === name) ?? null,
    municipal: bundle.municipal,
    columns: {
      planting: [
        'FARM LOCATION (Barangay)',
        'AREA PLANTED (HECTARE)',
        'IRRIGATION (IRRIGATED/RAINFED)',
        'SEED TYPE (HYBRID/RS/CS/GQS/FS)',
        'VARIETY',
        'DATE PLANTED (YYYY-MM-DD)',
        'CROPPING / SEASON',
        'FARMER FIRST NAME',
        'FARMER LAST NAME',
        'NAME OF TECHNICIAN',
      ],
      harvest: [
        'FARM LOCATION (Barangay)',
        'AREA HARVESTED (HECTARE)',
        'IRRIGATION (IRRIGATED/RAINFED)',
        'SEED TYPE (HYBRID/RS/CS/GQS/FS)',
        'VARIETY',
        'HARVEST DATE (YYYY-MM-DD)',
        'NO. OF BAGS',
        'WEIGHT PER BAG (KG)',
        'FARMER FIRST NAME',
        'FARMER LAST NAME',
        'NAME OF TECHNICIAN',
      ],
      standing: [
        'FARM LOCATION (Barangay)',
        'IRRIGATION (IRRIGATED/RAINFED)',
        'CROP STAGE (Newly Planted/Vegetative/Reproductive/Maturing)',
        'AREA (HECTARE)',
        'CROP CONDITION',
        'DAMAGED AREA',
        'PEST INFESTATION',
        'AS OF DATE (YYYY-MM-DD)',
        'NAME OF TECHNICIAN',
      ],
    },
    allowedValues: {
      irrigation: ['IRRIGATED', 'RAINFED'],
      seedType: ['HYBRID', 'RS', 'CS', 'GQS', 'FS'],
      season: ['Dry Season', 'Wet Season'],
      cropStage: ['Newly Planted', 'Vegetative', 'Reproductive', 'Maturing'],
      cropCondition: ['Excellent', 'Good', 'Fair', 'Poor', 'Critical'],
      pest: ['None', 'Mild', 'Moderate', 'Severe'],
    },
    workflow: [
      'Download blank template OR download official-aligned filled starter for your barangay.',
      'Keep FARM LOCATION exactly your assigned barangay name.',
      'Use IRRIGATED or RAINFED and seed codes HYBRID / RS / CS / GQS / FS only.',
      'Upload the Excel in Paper Reports — RiceWatch replaces only your barangay rows.',
      'Department Head generates municipal paper to rebuild Rizal cumulative totals.',
    ],
  };
}

function varietyForSeed(seed: SeedCode): string {
  return varietyForSeedType(seed);
}

function distributeRows(
  totalFarmers: number,
  slices: { key: string; areaHa: number }[]
): { key: string; areaHa: number; farmers: number }[] {
  const totalArea = slices.reduce((s, x) => s + x.areaHa, 0);
  if (totalArea <= 0 || totalFarmers <= 0) {
    return slices.map((s) => ({ ...s, farmers: s.areaHa > 0 ? 1 : 0 }));
  }
  const allocated = slices.map((s) => ({
    ...s,
    farmers: Math.max(1, Math.round((totalFarmers * s.areaHa) / totalArea)),
  }));
  let diff = totalFarmers - allocated.reduce((s, x) => s + x.farmers, 0);
  let i = 0;
  while (diff !== 0 && allocated.length > 0) {
    const idx = i % allocated.length;
    if (diff > 0) {
      allocated[idx].farmers += 1;
      diff -= 1;
    } else if (allocated[idx].farmers > 1) {
      allocated[idx].farmers -= 1;
      diff += 1;
    }
    i += 1;
    if (i > allocated.length * 20) break;
  }
  return allocated;
}

/** Build planting masterlist rows that sum to official seed-type / irrigation totals. */
export function buildPlantingMasterlistRows(barangay: string, technicianName = 'Technician') {
  const target = getOfficialTargets().planting.find(
    (r) => r.barangay === normalizeBarangayName(barangay)
  );
  if (!target) return [];
  const header = [
    'FARM LOCATION (Barangay)',
    'AREA PLANTED (HECTARE)',
    'IRRIGATION (IRRIGATED/RAINFED)',
    'SEED TYPE (HYBRID/RS/CS/GQS/FS)',
    'VARIETY',
    'DATE PLANTED (YYYY-MM-DD)',
    'CROPPING / SEASON',
    'FARMER FIRST NAME',
    'FARMER LAST NAME',
    'NAME OF TECHNICIAN',
  ];
  const dist = distributeRows(
    target.farmers,
    target.slices.map((s) => ({ key: `${s.irrigation}|${s.seedType}`, areaHa: s.areaHa }))
  );
  const rows: (string | number)[][] = [header];
  let farmerIdx = 1;
  for (const d of dist) {
    const [irrigation, seedType] = d.key.split('|') as ['IRRIGATED' | 'RAINFED', SeedCode];
    const per = d.farmers > 0 ? d.areaHa / d.farmers : d.areaHa;
    let remaining = d.areaHa;
    for (let f = 0; f < d.farmers; f++) {
      const area = f === d.farmers - 1 ? round3(remaining) : round3(per);
      remaining = round3(remaining - area);
      if (area <= 0) continue;
      rows.push([
        target.barangay,
        area,
        irrigation,
        seedType,
        varietyForSeed(seedType),
        '2025-10-15',
        'Dry Season',
        `Farmer${farmerIdx}`,
        target.barangay.replace(/[^A-Za-z]/g, '').slice(0, 8) || 'Rizal',
        technicianName,
      ]);
      farmerIdx += 1;
    }
  }
  return rows;
}

export function buildHarvestMasterlistRows(barangay: string, technicianName = 'Technician') {
  const target = getOfficialTargets().harvest.find(
    (r) => r.barangay === normalizeBarangayName(barangay)
  );
  if (!target) return [];
  const header = [
    'FARM LOCATION (Barangay)',
    'AREA HARVESTED (HECTARE)',
    'IRRIGATION (IRRIGATED/RAINFED)',
    'SEED TYPE (HYBRID/RS/CS/GQS/FS)',
    'VARIETY',
    'HARVEST DATE (YYYY-MM-DD)',
    'NO. OF BAGS',
    'WEIGHT PER BAG (KG)',
    'FARMER FIRST NAME',
    'FARMER LAST NAME',
    'NAME OF TECHNICIAN',
  ];
  const rows: (string | number)[][] = [header];
  const parts: {
    irrigation: 'IRRIGATED' | 'RAINFED';
    area: number;
    prod: number;
  }[] = [];
  if (target.irrigatedHa > 0) {
    parts.push({
      irrigation: 'IRRIGATED',
      area: target.irrigatedHa,
      prod: target.irrigatedProdMt,
    });
  }
  if (target.rainfedHa > 0) {
    parts.push({ irrigation: 'RAINFED', area: target.rainfedHa, prod: target.rainfedProdMt });
  }
  const farmerShares = distributeRows(
    Math.max(target.farmers, parts.length),
    parts.map((p) => ({ key: p.irrigation, areaHa: p.area }))
  );
  let farmerIdx = 1;
  for (const share of farmerShares) {
    const part = parts.find((p) => p.irrigation === share.key)!;
    const perArea = share.farmers > 0 ? part.area / share.farmers : part.area;
    const perProd = share.farmers > 0 ? part.prod / share.farmers : part.prod;
    let remArea = part.area;
    let remProd = part.prod;
    for (let f = 0; f < share.farmers; f++) {
      const area = f === share.farmers - 1 ? round3(remArea) : round3(perArea);
      const prod = f === share.farmers - 1 ? round3(remProd) : round3(perProd);
      remArea = round3(remArea - area);
      remProd = round3(remProd - prod);
      if (area <= 0) continue;
      const bags = Math.max(1, Math.round((prod * 1000) / 50));
      rows.push([
        target.barangay,
        area,
        share.key,
        share.key === 'IRRIGATED' ? 'CS' : 'FS',
        share.key === 'IRRIGATED' ? 'RC 402' : 'Blonde',
        '2026-03-15',
        bags,
        50,
        `Farmer${farmerIdx}`,
        target.barangay.replace(/[^A-Za-z]/g, '').slice(0, 8) || 'Rizal',
        technicianName,
      ]);
      farmerIdx += 1;
    }
  }
  return rows;
}

export function buildStandingMasterlistRows(barangay: string, technicianName = 'Technician') {
  const target = getOfficialTargets().standing.find(
    (r) => r.barangay === normalizeBarangayName(barangay)
  );
  if (!target) return [];
  const header = [
    'FARM LOCATION (Barangay)',
    'IRRIGATION (IRRIGATED/RAINFED)',
    'CROP STAGE (Newly Planted/Vegetative/Reproductive/Maturing)',
    'AREA (HECTARE)',
    'CROP CONDITION',
    'DAMAGED AREA',
    'PEST INFESTATION',
    'AS OF DATE (YYYY-MM-DD)',
    'NAME OF TECHNICIAN',
  ];
  const rows: (string | number)[][] = [header];
  for (const s of target.slices) {
    rows.push([
      target.barangay,
      s.irrigation,
      s.stage,
      s.areaHa,
      'Good',
      0,
      'None',
      '2026-03-31',
      technicianName,
    ]);
  }
  return rows;
}

export type FilledType = 'planting' | 'harvest' | 'standing';

export function buildFilledWorkbookBuffer(
  type: FilledType,
  barangay: string,
  technicianName = 'Technician'
): Buffer {
  const sheetName =
    type === 'planting'
      ? 'Planting Masterlist'
      : type === 'harvest'
        ? 'Harvest Masterlist'
        : 'Standing Masterlist';
  const aoa =
    type === 'planting'
      ? buildPlantingMasterlistRows(barangay, technicianName)
      : type === 'harvest'
        ? buildHarvestMasterlistRows(barangay, technicianName)
        : buildStandingMasterlistRows(barangay, technicianName);
  if (aoa.length <= 1) {
    throw new Error(`No official DS 2026 ${type} targets found for barangay "${barangay}"`);
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/** Write filled starters for all barangays under data/templates/filled. */
export function buildAllFilledTemplates() {
  if (!fs.existsSync(FILLED_TEMPLATES_DIR)) {
    fs.mkdirSync(FILLED_TEMPLATES_DIR, { recursive: true });
  }
  const bundle = getOfficialTargets(true);
  const names = bundle.planting.map((p) => p.barangay);
  for (const name of names) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    for (const type of ['planting', 'harvest', 'standing'] as FilledType[]) {
      const buf = buildFilledWorkbookBuffer(type, name);
      fs.writeFileSync(path.join(FILLED_TEMPLATES_DIR, `${slug}-${type}-masterlist.xlsx`), buf);
    }
  }
  return { barangays: names, dir: FILLED_TEMPLATES_DIR };
}
