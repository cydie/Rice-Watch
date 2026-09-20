/**
 * Import planting, harvest, and standing-crop Excel files into RiceWatch.
 * Creates one technician account per barangay (designated assignment) and
 * loads report data scoped to those barangays.
 *
 * Usage:
 *   npx tsx prisma/import-field-reports.ts
 *   npx tsx prisma/import-field-reports.ts "C:/path/planting.xlsx" "C:/path/standing.xlsx"
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { normalizeBarangayName } from '../src/lib/helpers.js';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_PLANTING = path.resolve(
  'C:/Users/Cydric Vincent/Downloads/PLANTING REPORT WS 2026 (Responses) (2).xlsx'
);
const DEFAULT_STANDING = path.resolve(
  'C:/Users/Cydric Vincent/Downloads/STANDING CROP DS 2026 - Copy (2).xlsx'
);

type Row = Record<string, unknown>;

function toStr(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

function toNum(v: unknown): number {
  if (v === '' || v == null) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function excelSerialToDate(serial: number): Date {
  const utcDays = Math.floor(serial - 25569);
  return new Date(utcDays * 86400 * 1000);
}

function parseDate(value: unknown, fallback: Date): Date {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (typeof value === 'number' && value > 1000) return excelSerialToDate(value);
  const str = toStr(value);
  if (!str) return fallback;
  const asNum = Number(str);
  if (!isNaN(asNum) && asNum > 1000) return excelSerialToDate(asNum);
  const d = new Date(str);
  return isNaN(d.getTime()) ? fallback : d;
}

function mapIrrigation(raw: string): string {
  const u = raw.toUpperCase();
  if (u.includes('RAIN') || u === 'RF') return 'Rainfed';
  if (u.includes('UP')) return 'Upland';
  return 'Irrigated';
}

function mapSeason(cropping: string): string {
  const u = cropping.toUpperCase();
  if (u.includes('3')) return 'Wet Season';
  if (u.includes('2')) return 'Dry Season';
  return 'Dry Season';
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(poblacion\)/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

function parseStandingLabel(label: string): { barangay: string; irrigation: string } | null {
  const cleaned = label.trim();
  if (!cleaned || /TOTAL|FARMERS|OCT|SEPT|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|NOV|DEC|HYBRID|^#/i.test(cleaned)) {
    return null;
  }
  const m = cleaned.match(/^(.+?)\s*[\\/]\s*(IR|RF|UP|IRRIGATED|RAINFED|UPLAND)\s*$/i);
  if (!m) return null;
  return {
    barangay: normalizeBarangayName(m[1]),
    irrigation: mapIrrigation(m[2]),
  };
}

async function ensureBarangay(name: string, classification = 'Rainfed') {
  const existing = await prisma.barangay.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.barangay.create({
    data: { name, area: 0, classification },
  });
}

async function createTechnicians(
  assignments: Map<string, string>
): Promise<Map<string, string>> {
  const passwordHash = await bcrypt.hash('tech123', 10);
  const byBarangay = new Map<string, string>();

  for (const [barangay, techName] of assignments) {
    const email = `tech.${slugify(barangay)}@da.gov.ph`;
    const fullName = `${techName} (${barangay})`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        fullName,
        role: 'technician',
        municipality: barangay,
        office: 'Department of Agriculture - Rizal',
        passwordHash,
      },
      create: {
        email,
        passwordHash,
        fullName,
        role: 'technician',
        municipality: barangay,
        office: 'Department of Agriculture - Rizal',
      },
    });
    byBarangay.set(barangay, user.id);
    console.log(`Technician: ${email} → ${barangay} (${techName})`);
  }

  return byBarangay;
}

function pickPrimaryTechnicians(plantingRows: Row[]): Map<string, string> {
  const counts = new Map<string, Map<string, number>>();
  for (const r of plantingRows) {
    const barangay = normalizeBarangayName(toStr(r['FARM LOCATION']));
    const tech = toStr(r['NAME OF TECHNICIAN/ENCODER']) || 'Field Technician';
    if (!barangay) continue;
    if (!counts.has(barangay)) counts.set(barangay, new Map());
    const m = counts.get(barangay)!;
    m.set(tech, (m.get(tech) || 0) + 1);
  }

  const primary = new Map<string, string>();
  for (const [barangay, techs] of counts) {
    let best = 'Field Technician';
    let bestN = 0;
    for (const [tech, n] of techs) {
      if (n > bestN) {
        best = tech;
        bestN = n;
      }
    }
    primary.set(barangay, best);
  }
  return primary;
}

async function importPlanting(filePath: string) {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: '' }).filter(
    (r) => toStr(r['FARM LOCATION']) && toStr(r['FIRST NAME(FARMER)'])
  );

  console.log(`Planting source rows: ${rows.length}`);

  // Aggregate by barangay + irrigation + season
  type Agg = {
    barangay: string;
    irrigation: string;
    season: string;
    farmerCount: number;
    areaPlanted: number;
    varieties: Map<string, number>;
    dates: Date[];
  };
  const groups = new Map<string, Agg>();
  const fallbackDate = new Date('2026-01-15');

  for (const r of rows) {
    const barangay = normalizeBarangayName(toStr(r['FARM LOCATION']));
    const irrigation = mapIrrigation(toStr(r.IRRIGATION));
    const season = mapSeason(toStr(r.CROPPING));
    const key = `${barangay}|${irrigation}|${season}`;
    const area = toNum(r['AREA PLANTED(HECTARE)']);
    const variety = toStr(r.VARIETY) || 'Various';
    const datePlanted = parseDate(r['DATE PLANTED'], fallbackDate);

    if (!groups.has(key)) {
      groups.set(key, {
        barangay,
        irrigation,
        season,
        farmerCount: 0,
        areaPlanted: 0,
        varieties: new Map(),
        dates: [],
      });
    }
    const g = groups.get(key)!;
    g.farmerCount += 1;
    g.areaPlanted += area;
    g.varieties.set(variety, (g.varieties.get(variety) || 0) + area);
    g.dates.push(datePlanted);
  }

  let created = 0;
  for (const g of groups.values()) {
    if (g.areaPlanted <= 0) continue;
    await ensureBarangay(g.barangay, g.irrigation);
    const barangay = await prisma.barangay.findFirst({ where: { name: g.barangay } });
    if (!barangay) continue;

    let seedVariety = 'Various';
    let best = 0;
    for (const [v, a] of g.varieties) {
      if (a > best) {
        seedVariety = v;
        best = a;
      }
    }

    const datePlanted = new Date(Math.min(...g.dates.map((d) => d.getTime())));
    await prisma.plantingReport.create({
      data: {
        municipality: 'Rizal',
        barangayId: barangay.id,
        sitio: '-',
        farmerCount: g.farmerCount,
        seedVariety,
        areaPlanted: Math.round(g.areaPlanted * 100) / 100,
        datePlanted,
        irrigationType: g.irrigation,
        season: g.season,
        expectedHarvest: addDays(datePlanted, 120),
      },
    });
    created += 1;
  }

  console.log(`Created ${created} planting report aggregates`);
  return rows;
}

async function importHarvest(standingPath: string) {
  const wb = XLSX.readFile(standingPath);
  if (!wb.Sheets.harvest) {
    console.log('No harvest sheet found — skipped');
    return 0;
  }
  const rows = XLSX.utils.sheet_to_json<Row>(wb.Sheets.harvest, { defval: '' }).filter(
    (r) => toStr(r.farmer_address_bgy) && toNum(r.AREA) > 0
  );

  type Agg = {
    barangay: string;
    irrigation: string;
    area: number;
    production: number;
    varieties: Map<string, number>;
    dates: Date[];
  };
  const groups = new Map<string, Agg>();
  const fallbackDate = new Date('2026-03-15');

  for (const r of rows) {
    const barangay = normalizeBarangayName(toStr(r.farmer_address_bgy));
    const irrigation = mapIrrigation(toStr(r['Land category(IR/RF)']));
    const area = toNum(r.AREA);
    const bags = toNum(r['# of bags']);
    const weight = toNum(r['weight per bags']) || 50;
    const productionMt = (bags * weight) / 1000;
    const variety = toStr(r.VARIETY) || 'Various';
    const harvestDate = parseDate(r['harvest date'], fallbackDate);
    const key = `${barangay}|${irrigation}`;

    if (!groups.has(key)) {
      groups.set(key, {
        barangay,
        irrigation,
        area: 0,
        production: 0,
        varieties: new Map(),
        dates: [],
      });
    }
    const g = groups.get(key)!;
    g.area += area;
    g.production += productionMt;
    g.varieties.set(variety, (g.varieties.get(variety) || 0) + area);
    g.dates.push(harvestDate);
  }

  let created = 0;
  for (const g of groups.values()) {
    if (g.area <= 0) continue;
    await ensureBarangay(g.barangay, g.irrigation);
    const barangay = await prisma.barangay.findFirst({ where: { name: g.barangay } });
    if (!barangay) continue;

    let riceVariety = 'Various';
    let best = 0;
    for (const [v, a] of g.varieties) {
      if (a > best) {
        riceVariety = v;
        best = a;
      }
    }

    const harvestDate = new Date(Math.max(...g.dates.map((d) => d.getTime())));
    await prisma.harvestReport.create({
      data: {
        municipality: 'Rizal',
        barangayId: barangay.id,
        sitio: '-',
        harvestDate,
        harvestedArea: Math.round(g.area * 100) / 100,
        totalProduction: Math.round(g.production * 100) / 100,
        averageYield: Math.round((g.production / g.area) * 100) / 100,
        riceVariety,
        irrigationType: g.irrigation,
      },
    });
    created += 1;
  }

  console.log(`Created ${created} harvest report aggregates from ${rows.length} rows`);
  return created;
}

async function importStanding(standingPath: string) {
  const wb = XLSX.readFile(standingPath);
  const sheetName =
    wb.SheetNames.find((n) => /planting\s*DS|standing/i.test(n)) || wb.SheetNames[0];
  const raw = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[sheetName], {
    header: 1,
    defval: '',
  });

  // First monitoring period only (until next period header / second BUNOG block)
  const periodRows: { barangay: string; irrigation: string; farmers: number; area: number }[] = [];
  for (let i = 0; i < Math.min(raw.length, 34); i++) {
    const label = toStr(raw[i]?.[0]);
    const parsed = parseStandingLabel(label);
    if (!parsed) continue;
    const farmers = toNum(raw[i][1]);
    const area = toNum(raw[i][9]) || toNum(raw[i][13]);
    if (area <= 0 && farmers <= 0) continue;
    periodRows.push({
      barangay: parsed.barangay,
      irrigation: parsed.irrigation,
      farmers,
      area: area || 0,
    });
  }

  // Aggregate IR+RF per barangay for standing crop summary
  const byBarangay = new Map<
    string,
    { area: number; farmers: number; irrigated: number; rainfed: number }
  >();
  for (const r of periodRows) {
    const cur = byBarangay.get(r.barangay) || { area: 0, farmers: 0, irrigated: 0, rainfed: 0 };
    cur.area += r.area;
    cur.farmers += r.farmers;
    if (r.irrigation === 'Irrigated') cur.irrigated += r.area;
    else cur.rainfed += r.area;
    byBarangay.set(r.barangay, cur);
  }

  let created = 0;
  const lastUpdated = new Date('2026-01-15');
  for (const [barangayName, v] of byBarangay) {
    if (v.area <= 0) continue;
    const irrigation = v.irrigated >= v.rainfed ? 'Irrigated' : 'Rainfed';
    await ensureBarangay(barangayName, irrigation);
    const barangay = await prisma.barangay.findFirst({ where: { name: barangayName } });
    if (!barangay) continue;

    await prisma.standingCropReport.create({
      data: {
        municipality: 'Rizal',
        barangayId: barangay.id,
        sitio: '-',
        cropStage: 'Vegetative',
        area: Math.round(v.area * 100) / 100,
        cropCondition: 'Good',
        damagedArea: 0,
        pestInfestation: 'None',
        irrigationStatus: 'Normal',
        lastUpdated,
      },
    });
    created += 1;
  }

  console.log(`Created ${created} standing crop reports from period snapshot`);
  return created;
}

async function main() {
  const plantingPath = process.argv[2] || DEFAULT_PLANTING;
  const standingPath = process.argv[3] || DEFAULT_STANDING;

  if (!fs.existsSync(plantingPath)) throw new Error(`Planting file not found: ${plantingPath}`);
  if (!fs.existsSync(standingPath)) throw new Error(`Standing file not found: ${standingPath}`);

  console.log('Importing field reports…');
  console.log('Planting:', plantingPath);
  console.log('Standing:', standingPath);

  // Replace prior report data with Excel import (keep farmers / barangays / users)
  await prisma.plantingReport.deleteMany();
  await prisma.harvestReport.deleteMany();
  await prisma.standingCropReport.deleteMany();
  console.log('Cleared existing planting / harvest / standing reports');

  const plantingRows = await importPlanting(plantingPath);
  await importHarvest(standingPath);
  await importStanding(standingPath);

  const techMap = pickPrimaryTechnicians(plantingRows);
  // Ensure barangays with standing data also get a technician
  for (const name of [
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
  ]) {
    if (!techMap.has(name)) techMap.set(name, 'Field Technician');
  }

  await createTechnicians(techMap);

  await prisma.activity.create({
    data: {
      action: 'Imported planting, harvest, and standing crop Excel data',
      location: 'Municipal Agriculture Office - Rizal',
    },
  });

  const [p, h, s, techs] = await Promise.all([
    prisma.plantingReport.count(),
    prisma.harvestReport.count(),
    prisma.standingCropReport.count(),
    prisma.user.count({ where: { role: 'technician' } }),
  ]);
  console.log(`Done. Planting=${p}, Harvest=${h}, Standing=${s}, Technicians=${techs}`);
  console.log('Technician password for all new accounts: tech123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
