import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';
import { prisma } from './prisma.js';
import { normalizeBarangayName } from './helpers.js';
import { normalizeRiceVariety } from './riceVarieties.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const TEMPLATES_DIR = path.resolve(__dirname, '../../../data/templates');

const BARANGAYS = [
  'Bunog',
  'Campong Ulay',
  'Candawaga',
  'Canipaan',
  'Culasian',
  'Iraan',
  'Latud',
  'Panalingaan',
  'Punta Baja (Poblacion)',
  'Ransang',
  'Taburi',
];

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** Technician masterlist templates (upload format). */
export function buildTechnicianTemplates() {
  ensureDir(TEMPLATES_DIR);

  const planting = XLSX.utils.aoa_to_sheet([
    [
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
    ['Iraan', 1.5, 'IRRIGATED', 'CS', 'RC 402', '2025-10-15', 'Dry Season', 'Juan', 'Dela Cruz', 'Technician'],
    ['Iraan', 0.8, 'RAINFED', 'FS', 'Blonde', '2025-10-20', 'Dry Season', 'Maria', 'Santos', 'Technician'],
    ['Iraan', 1.0, 'IRRIGATED', 'HYBRID', 'Syngenta', '2025-11-01', 'Dry Season', 'Pedro', 'Reyes', 'Technician'],
  ]);
  const plantingWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(plantingWb, planting, 'Planting Masterlist');
  XLSX.writeFile(plantingWb, path.join(TEMPLATES_DIR, 'technician-planting-masterlist.xlsx'));

  const harvest = XLSX.utils.aoa_to_sheet([
    [
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
    ['Iraan', 1.2, 'IRRIGATED', 'CS', 'RC 402', '2026-03-15', 180, 50, 'Juan', 'Dela Cruz', 'Technician'],
    ['Iraan', 0.9, 'IRRIGATED', 'HYBRID', 'Syngenta', '2026-03-20', 140, 50, 'Pedro', 'Reyes', 'Technician'],
    ['Iraan', 0.7, 'RAINFED', 'FS', 'Blonde', '2026-03-18', 90, 50, 'Maria', 'Santos', 'Technician'],
  ]);
  const harvestWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(harvestWb, harvest, 'Harvest Masterlist');
  XLSX.writeFile(harvestWb, path.join(TEMPLATES_DIR, 'technician-harvest-masterlist.xlsx'));

  const standing = XLSX.utils.aoa_to_sheet([
    [
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
    ['Iraan', 'IRRIGATED', 'Vegetative', 12.5, 'Good', 0, 'None', '2026-03-31', 'Technician'],
    ['Iraan', 'RAINFED', 'Maturing', 8.0, 'Good', 0, 'None', '2026-03-31', 'Technician'],
  ]);
  const standingWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(standingWb, standing, 'Standing Masterlist');
  XLSX.writeFile(standingWb, path.join(TEMPLATES_DIR, 'technician-standing-masterlist.xlsx'));
}

function mapIrrigation(raw: string): 'Irrigated' | 'Rainfed' | 'Upland' {
  const u = raw.toUpperCase();
  if (u.includes('RAIN') || u === 'RF') return 'Rainfed';
  if (u.includes('UP')) return 'Upland';
  return 'Irrigated';
}

function mapSeedType(raw: string): string {
  const u = raw.toUpperCase();
  if (u.includes('HYBRID') || u === 'H') return 'HYBRID';
  if (u === 'RS' || u.includes('REGISTER')) return 'RS';
  if (u === 'CS' || u.includes('CERTIF')) return 'CS';
  if (u.includes('GQS') || u.includes('GOOD')) return 'GQS';
  return 'FS';
}

function mapStage(raw: string): string {
  const u = raw.toUpperCase();
  if (u.includes('NEW') || u.includes('SEEDLING')) return 'Newly Planted';
  if (u.includes('VEG')) return 'Vegetative';
  if (u.includes('REPRO')) return 'Reproductive';
  if (u.includes('MATUR') || u.includes('HARVEST')) return 'Maturing';
  return 'Vegetative';
}

function parseDate(value: unknown, fallback: Date): Date {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (typeof value === 'number' && value > 1000) {
    return new Date(Math.floor(value - 25569) * 86400 * 1000);
  }
  const str = String(value ?? '').trim();
  if (!str) return fallback;
  const d = new Date(str);
  return isNaN(d.getTime()) ? fallback : d;
}

export type UploadType = 'planting' | 'harvest' | 'standing';

export async function ingestTechnicianMasterlist(
  type: UploadType,
  buffer: Buffer,
  options: { forcedBarangay?: string | null; replaceBarangay: boolean }
) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  if (type === 'planting') return ingestPlanting(rows, options);
  if (type === 'harvest') return ingestHarvest(rows, options);
  return ingestStanding(rows, options);
}

async function resolveBarangayId(name: string) {
  const normalized = normalizeBarangayName(name);
  let b = await prisma.barangay.findFirst({ where: { name: normalized } });
  if (!b) {
    b = await prisma.barangay.create({
      data: { name: normalized, area: 0, classification: 'Rainfed' },
    });
  }
  return b;
}

async function ingestPlanting(
  rows: Record<string, unknown>[],
  options: { forcedBarangay?: string | null; replaceBarangay: boolean }
) {
  type Key = string;
  const groups = new Map<
    Key,
    { barangay: string; irrigation: string; seed: string; area: number; count: number; variety: string; dates: Date[] }
  >();

  for (const r of rows) {
    const loc = options.forcedBarangay || String(r['FARM LOCATION (Barangay)'] || r['FARM LOCATION'] || '');
    if (!String(loc).trim()) continue;
    const barangay = normalizeBarangayName(String(loc));
    if (options.forcedBarangay && barangay !== normalizeBarangayName(options.forcedBarangay)) {
      continue;
    }
    const irrigation = mapIrrigation(String(r['IRRIGATION (IRRIGATED/RAINFED)'] || r.IRRIGATION || ''));
    const seed = mapSeedType(String(r['SEED TYPE (HYBRID/RS/CS/GQS/FS)'] || r['SEED TYPE'] || 'FS'));
    const area = Number(r['AREA PLANTED (HECTARE)'] || r['AREA PLANTED(HECTARE)'] || 0) || 0;
    if (area <= 0) continue;
    const variety = normalizeRiceVariety(String(r.VARIETY || seed).trim() || seed);
    const date = parseDate(r['DATE PLANTED (YYYY-MM-DD)'] || r['DATE PLANTED'], new Date());
    const season = String(r['CROPPING / SEASON'] || r.CROPPING || 'Dry Season');
    const key = `${barangay}|${irrigation}|${seed}|${season}`;
    if (!groups.has(key)) {
      groups.set(key, { barangay, irrigation, seed, area: 0, count: 0, variety, dates: [] });
    }
    const g = groups.get(key)!;
    g.area += area;
    g.count += 1;
    g.dates.push(date);
    g.variety = variety;
  }

  const touched = new Set<string>();
  for (const g of groups.values()) touched.add(g.barangay);

  if (options.replaceBarangay) {
    for (const name of touched) {
      const b = await resolveBarangayId(name);
      await prisma.plantingReport.deleteMany({ where: { barangayId: b.id } });
    }
  }

  let created = 0;
  for (const g of groups.values()) {
    const b = await resolveBarangayId(g.barangay);
    const datePlanted = new Date(Math.min(...g.dates.map((d) => d.getTime())));
    const expected = new Date(datePlanted);
    expected.setDate(expected.getDate() + 120);
    const seasonRow = rows.find((r) => {
      const loc = options.forcedBarangay || String(r['FARM LOCATION (Barangay)'] || r['FARM LOCATION'] || '');
      return normalizeBarangayName(String(loc)) === g.barangay;
    });
    const season = String(seasonRow?.['CROPPING / SEASON'] || seasonRow?.CROPPING || 'Dry Season');
    await prisma.plantingReport.create({
      data: {
        municipality: 'Rizal',
        barangayId: b.id,
        sitio: '-',
        farmerCount: g.count,
        seedVariety: `${g.seed} / ${g.variety}`,
        areaPlanted: round2(g.area),
        datePlanted,
        irrigationType: g.irrigation,
        season,
        expectedHarvest: expected,
      },
    });
    created += 1;
  }

  return { created, barangays: [...touched], rows: rows.length };
}

async function ingestHarvest(
  rows: Record<string, unknown>[],
  options: { forcedBarangay?: string | null; replaceBarangay: boolean }
) {
  const groups = new Map<
    string,
    { barangay: string; irrigation: string; area: number; production: number; variety: string; dates: Date[] }
  >();

  for (const r of rows) {
    const loc = options.forcedBarangay || String(r['FARM LOCATION (Barangay)'] || '');
    if (!String(loc).trim()) continue;
    const barangay = normalizeBarangayName(String(loc));
    if (options.forcedBarangay && barangay !== normalizeBarangayName(options.forcedBarangay)) continue;
    const irrigation = mapIrrigation(String(r['IRRIGATION (IRRIGATED/RAINFED)'] || ''));
    const area = Number(r['AREA HARVESTED (HECTARE)'] || 0) || 0;
    if (area <= 0) continue;
    const bags = Number(r['NO. OF BAGS'] || 0) || 0;
    const weight = Number(r['WEIGHT PER BAG (KG)'] || 50) || 50;
    const production = (bags * weight) / 1000;
    const variety = normalizeRiceVariety(String(r.VARIETY || 'Various'));
    const date = parseDate(r['HARVEST DATE (YYYY-MM-DD)'], new Date());
    const key = `${barangay}|${irrigation}`;
    if (!groups.has(key)) {
      groups.set(key, { barangay, irrigation, area: 0, production: 0, variety, dates: [] });
    }
    const g = groups.get(key)!;
    g.area += area;
    g.production += production;
    g.variety = variety;
    g.dates.push(date);
  }

  const touched = [...new Set([...groups.values()].map((g) => g.barangay))];
  if (options.replaceBarangay) {
    for (const name of touched) {
      const b = await resolveBarangayId(name);
      await prisma.harvestReport.deleteMany({ where: { barangayId: b.id } });
    }
  }

  let created = 0;
  for (const g of groups.values()) {
    const b = await resolveBarangayId(g.barangay);
    const harvestDate = new Date(Math.max(...g.dates.map((d) => d.getTime())));
    await prisma.harvestReport.create({
      data: {
        municipality: 'Rizal',
        barangayId: b.id,
        sitio: '-',
        harvestDate,
        harvestedArea: round2(g.area),
        totalProduction: round2(g.production),
        averageYield: round2(g.production / g.area),
        riceVariety: g.variety,
        irrigationType: g.irrigation,
      },
    });
    created += 1;
  }
  return { created, barangays: touched, rows: rows.length };
}

async function ingestStanding(
  rows: Record<string, unknown>[],
  options: { forcedBarangay?: string | null; replaceBarangay: boolean }
) {
  const groups = new Map<
    string,
    {
      barangay: string;
      irrigation: string;
      stage: string;
      area: number;
      damaged: number;
      condition: string;
      pest: string;
      date: Date;
    }
  >();

  for (const r of rows) {
    const loc = options.forcedBarangay || String(r['FARM LOCATION (Barangay)'] || '');
    if (!String(loc).trim()) continue;
    const barangay = normalizeBarangayName(String(loc));
    if (options.forcedBarangay && barangay !== normalizeBarangayName(options.forcedBarangay)) continue;
    const irrigation = mapIrrigation(String(r['IRRIGATION (IRRIGATED/RAINFED)'] || ''));
    const stage = mapStage(String(r['CROP STAGE (Newly Planted/Vegetative/Reproductive/Maturing)'] || r['CROP STAGE'] || ''));
    const area = Number(r['AREA (HECTARE)'] || r.AREA || 0) || 0;
    if (area <= 0) continue;
    const key = `${barangay}|${irrigation}|${stage}`;
    if (!groups.has(key)) {
      groups.set(key, {
        barangay,
        irrigation,
        stage,
        area: 0,
        damaged: 0,
        condition: 'Good',
        pest: 'None',
        date: parseDate(r['AS OF DATE (YYYY-MM-DD)'], new Date()),
      });
    }
    const g = groups.get(key)!;
    g.area += area;
    g.damaged += Number(r['DAMAGED AREA'] || 0) || 0;
    g.condition = String(r['CROP CONDITION'] || g.condition || 'Good');
    g.pest = String(r['PEST INFESTATION'] || g.pest || 'None');
  }

  const touched = [...new Set([...groups.values()].map((g) => g.barangay))];
  if (options.replaceBarangay) {
    for (const name of touched) {
      const b = await resolveBarangayId(name);
      await prisma.standingCropReport.deleteMany({ where: { barangayId: b.id } });
    }
  }

  let created = 0;
  for (const g of groups.values()) {
    const b = await resolveBarangayId(g.barangay);
    await prisma.standingCropReport.create({
      data: {
        municipality: 'Rizal',
        barangayId: b.id,
        sitio: g.irrigation,
        cropStage: g.stage,
        area: round2(g.area),
        cropCondition: g.condition,
        damagedArea: round2(g.damaged),
        pestInfestation: g.pest,
        irrigationStatus: 'Normal',
        lastUpdated: g.date,
      },
    });
    created += 1;
  }
  return { created, barangays: touched, rows: rows.length };
}

/** Build municipal DA-style paper from DB aggregates. */
export async function generateMunicipalPaper(type: UploadType): Promise<Buffer> {
  const barangays = await prisma.barangay.findMany({ orderBy: { name: 'asc' } });
  const names = barangays.length ? barangays.map((b) => b.name) : BARANGAYS;

  if (type === 'planting') {
    const reports = await prisma.plantingReport.findMany({ include: { barangay: true } });
    const aoa: (string | number)[][] = [
      ['Department of Agriculture'],
      ['REGIONAL FIELD OFFICE MIMAROPA'],
      ['Rice Program'],
      [],
      ['DRY SEASON 2026 Planting Report — Auto-generated by RiceWatch'],
      [],
      ['MUNICIPALITY / BARANGAY', 'NO. OF FARMER PLANTED', 'IRRIGATED (ha)', 'RAINFED (ha)', 'TOTAL PLANTED (ha)'],
    ];
    let tf = 0, ti = 0, tr = 0;
    const munRows: (string | number)[][] = [];
    for (const name of names) {
      const rows = reports.filter((r) => r.barangay.name === name);
      const farmers = rows.reduce((s, r) => s + r.farmerCount, 0);
      const irrigated = rows.filter((r) => r.irrigationType === 'Irrigated').reduce((s, r) => s + r.areaPlanted, 0);
      const rainfed = rows.filter((r) => r.irrigationType !== 'Irrigated').reduce((s, r) => s + r.areaPlanted, 0);
      const total = irrigated + rainfed;
      if (total <= 0 && farmers <= 0) continue;
      tf += farmers; ti += irrigated; tr += rainfed;
      munRows.push([name, farmers, round2(irrigated), round2(rainfed), round2(total)]);
    }
    aoa.push(['Rizal', tf, round2(ti), round2(tr), round2(ti + tr)], ...munRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'DS Cumulative');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  if (type === 'harvest') {
    const reports = await prisma.harvestReport.findMany({ include: { barangay: true } });
    const aoa: (string | number)[][] = [
      ['Department of Agriculture'],
      ['REGIONAL FIELD OFFICE MIMAROPA'],
      ['Rice Program'],
      [],
      ['DRY SEASON 2026 Harvesting Report — Auto-generated by RiceWatch'],
      [],
      [
        'MUNICIPALITY / BARANGAY',
        'IRRIGATED AREA (ha)',
        'IRRIGATED PRODUCTION (mt)',
        'IRRIGATED YIELD (mt/ha)',
        'RAINFED AREA (ha)',
        'RAINFED PRODUCTION (mt)',
        'RAINFED YIELD (mt/ha)',
        'TOTAL AREA (ha)',
        'TOTAL PRODUCTION (mt)',
      ],
    ];
    let tiA = 0, tiP = 0, trA = 0, trP = 0;
    const munRows: (string | number)[][] = [];
    for (const name of names) {
      const rows = reports.filter((r) => r.barangay.name === name);
      const ir = rows.filter((r) => r.irrigationType === 'Irrigated');
      const rf = rows.filter((r) => r.irrigationType !== 'Irrigated');
      const iA = ir.reduce((s, r) => s + r.harvestedArea, 0);
      const iP = ir.reduce((s, r) => s + r.totalProduction, 0);
      const rA = rf.reduce((s, r) => s + r.harvestedArea, 0);
      const rP = rf.reduce((s, r) => s + r.totalProduction, 0);
      if (iA + rA <= 0) continue;
      tiA += iA; tiP += iP; trA += rA; trP += rP;
      munRows.push([
        name,
        round2(iA),
        round2(iP),
        iA ? round2(iP / iA) : 0,
        round2(rA),
        round2(rP),
        rA ? round2(rP / rA) : 0,
        round2(iA + rA),
        round2(iP + rP),
      ]);
    }
    aoa.push([
      'Rizal',
      round2(tiA),
      round2(tiP),
      tiA ? round2(tiP / tiA) : 0,
      round2(trA),
      round2(trP),
      trA ? round2(trP / trA) : 0,
      round2(tiA + trA),
      round2(tiP + trP),
    ], ...munRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Commulative');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  // standing
  const reports = await prisma.standingCropReport.findMany({ include: { barangay: true } });
  const stages = ['Newly Planted', 'Vegetative', 'Reproductive', 'Maturing'] as const;
  const aoa: (string | number)[][] = [
    ['Rice'],
    ['Standing Crop 2026'],
    [`as of ${new Date().toLocaleDateString()} — Auto-generated by RiceWatch`],
    [],
    [
      'MUNICIPALITY / BARANGAY',
      'IR Newly',
      'IR Vegetative',
      'IR Reproductive',
      'IR Maturing',
      'IR TOTAL',
      'RF Newly',
      'RF Vegetative',
      'RF Reproductive',
      'RF Maturing',
      'RF TOTAL',
      'GRAND TOTAL',
    ],
  ];

  // Simpler aggregation by sitio tag
  const stageArea = (name: string, sitio: string, stage: string) =>
    reports
      .filter((r) => r.barangay.name === name && r.sitio === sitio && r.cropStage === stage)
      .reduce((s, r) => s + r.area, 0);

  // Also include records with sitio '-' by treating as irrigated if only one bucket
  const stageAreaFlex = (name: string, sitio: string, stage: string) => {
    const exact = stageArea(name, sitio, stage);
    if (exact > 0) return exact;
    if (sitio === 'Irrigated') {
      return reports
        .filter((r) => r.barangay.name === name && r.sitio === '-' && r.cropStage === stage)
        .reduce((s, r) => s + r.area, 0);
    }
    return 0;
  };

  let gIr = [0, 0, 0, 0];
  let gRf = [0, 0, 0, 0];
  const munRows: (string | number)[][] = [];
  for (const name of names) {
    const ir = stages.map((st) => round2(stageAreaFlex(name, 'Irrigated', st)));
    const rf = stages.map((st) => round2(stageAreaFlex(name, 'Rainfed', st)));
    const irT = round2(ir.reduce((a, b) => a + b, 0));
    const rfT = round2(rf.reduce((a, b) => a + b, 0));
    if (irT + rfT <= 0) continue;
    ir.forEach((v, i) => (gIr[i] += v));
    rf.forEach((v, i) => (gRf[i] += v));
    munRows.push([name, ...ir, irT, ...rf, rfT, round2(irT + rfT)]);
  }
  const gIrT = round2(gIr.reduce((a, b) => a + b, 0));
  const gRfT = round2(gRf.reduce((a, b) => a + b, 0));
  aoa.push([
    'Rizal',
    ...gIr.map(round2),
    gIrT,
    ...gRf.map(round2),
    gRfT,
    round2(gIrT + gRfT),
  ], ...munRows);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Standing Crop');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
