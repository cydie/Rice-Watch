/**
 * Import official DA Dry Season 2026 municipal papers into RiceWatch.
 *
 * Usage:
 *   npx tsx prisma/import-official-papers.ts
 */
import 'dotenv/config';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { normalizeBarangayName } from '../src/lib/helpers.js';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const PLANTING = path.join(ROOT, 'data/official/Planting Report DS 2026 Rizal, Palawan (2).xlsx');
const HARVEST = path.join(ROOT, 'data/official/Harvesting Report DS 2026 Rizal, Palawan (1).xlsx');
const STANDING = path.join(ROOT, 'data/official/RICE STANDING CROP 2026 (1).xlsx');

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

async function ensureBarangay(name: string, classification: string) {
  const existing = await prisma.barangay.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.barangay.create({ data: { name, area: 0, classification } });
}

async function importPlanting() {
  const wb = XLSX.readFile(PLANTING);
  const raw = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets['DS 2026 Cumulative'], {
    header: 1,
    defval: '',
  });

  let created = 0;
  const season = 'Dry Season';
  const datePlanted = new Date('2025-10-15');
  const expectedHarvest = new Date('2026-03-15');

  for (let i = 11; i <= 21; i++) {
    const label = String(raw[i]?.[0] || '').trim();
    if (!label || /^rizal$/i.test(label)) continue;
    const barangayName = normalizeBarangayName(label);
    const farmers = Math.round(n(raw[i][1]));
    const irrigated = n(raw[i][7]);
    const rainfed = n(raw[i][16]);
    const total = irrigated + rainfed;
    if (total <= 0) continue;

    await ensureBarangay(barangayName, irrigated >= rainfed ? 'Irrigated' : 'Rainfed');
    const barangay = await prisma.barangay.findFirst({ where: { name: barangayName } });
    if (!barangay) continue;

    const farmerIrr = total > 0 ? Math.round(farmers * (irrigated / total)) : 0;
    const farmerRf = Math.max(0, farmers - farmerIrr);

    if (irrigated > 0) {
      await prisma.plantingReport.create({
        data: {
          municipality: 'Rizal',
          barangayId: barangay.id,
          sitio: '-',
          farmerCount: farmerIrr || farmers,
          seedVariety: 'Official DS2026 (Irrigated mix)',
          areaPlanted: round2(irrigated),
          datePlanted,
          irrigationType: 'Irrigated',
          season,
          expectedHarvest,
        },
      });
      created += 1;
    }
    if (rainfed > 0) {
      await prisma.plantingReport.create({
        data: {
          municipality: 'Rizal',
          barangayId: barangay.id,
          sitio: '-',
          farmerCount: farmerRf || farmers,
          seedVariety: 'Official DS2026 (Rainfed mix)',
          areaPlanted: round2(rainfed),
          datePlanted,
          irrigationType: 'Rainfed',
          season,
          expectedHarvest,
        },
      });
      created += 1;
    }
  }
  console.log(`Planting reports created: ${created}`);
}

async function importHarvest() {
  const wb = XLSX.readFile(HARVEST);
  const raw = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets.Commulative, {
    header: 1,
    defval: '',
  });

  let created = 0;
  const harvestDate = new Date('2026-03-31');

  for (let i = 12; i <= 22; i++) {
    const label = String(raw[i]?.[0] || '').trim();
    if (!label || /^rizal$/i.test(label)) continue;
    const barangayName = normalizeBarangayName(label);
    const irrigatedArea = n(raw[i][17]);
    const irrigatedProd = n(raw[i][19]);
    const rainfedArea = n(raw[i][44]);
    const rainfedProd = n(raw[i][46]);

    await ensureBarangay(barangayName, irrigatedArea >= rainfedArea ? 'Irrigated' : 'Rainfed');
    const barangay = await prisma.barangay.findFirst({ where: { name: barangayName } });
    if (!barangay) continue;

    if (irrigatedArea > 0) {
      await prisma.harvestReport.create({
        data: {
          municipality: 'Rizal',
          barangayId: barangay.id,
          sitio: '-',
          harvestDate,
          harvestedArea: round2(irrigatedArea),
          totalProduction: round2(irrigatedProd),
          averageYield: round2(irrigatedProd / irrigatedArea),
          riceVariety: 'Official DS2026 (Irrigated mix)',
          irrigationType: 'Irrigated',
        },
      });
      created += 1;
    }
    if (rainfedArea > 0) {
      await prisma.harvestReport.create({
        data: {
          municipality: 'Rizal',
          barangayId: barangay.id,
          sitio: '-',
          harvestDate,
          harvestedArea: round2(rainfedArea),
          totalProduction: round2(rainfedProd),
          averageYield: round2(rainfedProd / rainfedArea),
          riceVariety: 'Official DS2026 (Rainfed mix)',
          irrigationType: 'Rainfed',
        },
      });
      created += 1;
    }
  }
  console.log(`Harvest reports created: ${created}`);
}

async function importStanding() {
  const wb = XLSX.readFile(STANDING);
  const raw = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets['Mar 16-31'], {
    header: 1,
    defval: '',
  });

  const stages = [
    { name: 'Newly Planted', ir: 1, rf: 6 },
    { name: 'Vegetative', ir: 2, rf: 7 },
    { name: 'Reproductive', ir: 3, rf: 8 },
    { name: 'Maturing', ir: 4, rf: 9 },
  ] as const;

  let created = 0;
  const lastUpdated = new Date('2026-03-31');

  for (let i = 9; i <= 19; i++) {
    const label = String(raw[i]?.[0] || '').trim();
    if (!label || /^rizal$/i.test(label)) continue;
    const barangayName = normalizeBarangayName(label);
    await ensureBarangay(barangayName, 'Irrigated');
    const barangay = await prisma.barangay.findFirst({ where: { name: barangayName } });
    if (!barangay) continue;

    for (const stage of stages) {
      const ir = n(raw[i][stage.ir]);
      const rf = n(raw[i][stage.rf]);
      if (ir > 0) {
        await prisma.standingCropReport.create({
          data: {
            municipality: 'Rizal',
            barangayId: barangay.id,
            sitio: 'Irrigated',
            cropStage: stage.name,
            area: round2(ir),
            cropCondition: 'Good',
            damagedArea: 0,
            pestInfestation: 'None',
            irrigationStatus: 'Normal',
            lastUpdated,
          },
        });
        created += 1;
      }
      if (rf > 0) {
        await prisma.standingCropReport.create({
          data: {
            municipality: 'Rizal',
            barangayId: barangay.id,
            sitio: 'Rainfed',
            cropStage: stage.name,
            area: round2(rf),
            cropCondition: 'Good',
            damagedArea: 0,
            pestInfestation: 'None',
            irrigationStatus: 'Normal',
            lastUpdated,
          },
        });
        created += 1;
      }
    }
  }
  console.log(`Standing crop reports created: ${created}`);
}

async function main() {
  console.log('Importing official DA DS 2026 papers…');
  await prisma.plantingReport.deleteMany();
  await prisma.harvestReport.deleteMany();
  await prisma.standingCropReport.deleteMany();
  console.log('Cleared previous planting / harvest / standing rows');

  await importPlanting();
  await importHarvest();
  await importStanding();

  await prisma.activity.create({
    data: {
      action: 'Imported official DS 2026 planting, harvest, and standing crop papers',
      location: 'Municipal Agriculture Office - Rizal',
    },
  });

  const [p, h, s] = await Promise.all([
    prisma.plantingReport.count(),
    prisma.harvestReport.count(),
    prisma.standingCropReport.count(),
  ]);
  console.log(`Done. Planting=${p}, Harvest=${h}, Standing=${s}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
