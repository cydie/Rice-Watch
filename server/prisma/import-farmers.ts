import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { normalizeBarangayName } from '../src/lib/helpers.js';

const prisma = new PrismaClient();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_FILE = path.resolve(__dirname, '../../data/RIZAL FIMS.xlsx');

type ExcelRow = Record<string, string | number>;

function parseYesNo(value: unknown): boolean {
  return String(value ?? '').trim().toUpperCase() === 'YES';
}

function isValidBirthdate(d: Date): boolean {
  const year = d.getFullYear();
  return !isNaN(d.getTime()) && year >= 1900 && year <= new Date().getFullYear();
}

function parseExcelSerial(serial: number): Date | null {
  const utcDays = serial - 25569;
  const d = new Date(utcDays * 86400 * 1000);
  return isValidBirthdate(d) ? d : null;
}

function parseDate(value: unknown): Date | null {
  if (!value && value !== 0) return null;
  if (value instanceof Date) return isValidBirthdate(value) ? value : null;
  if (typeof value === 'number') return parseExcelSerial(value);

  const str = String(value).trim();
  if (!str) return null;

  const numeric = Number(str);
  if (!isNaN(numeric) && numeric > 1000) return parseExcelSerial(numeric);

  const parts = str.split(/[/-]/);
  if (parts.length === 3) {
    const [mm, dd, yyyy] = parts.map((p) => parseInt(p, 10));
    if (!isNaN(mm) && !isNaN(dd) && !isNaN(yyyy) && yyyy >= 1900 && yyyy <= 2100) {
      const d = new Date(yyyy, mm - 1, dd);
      return isValidBirthdate(d) ? d : null;
    }
  }

  const d = new Date(str);
  return isValidBirthdate(d) ? d : null;
}

function parseFloatOrNull(value: unknown): number | null {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return isNaN(n) ? null : n;
}

function toString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

async function ensureBarangays(rows: ExcelRow[]) {
  const names = new Set(rows.map((r) => normalizeBarangayName(toString(r['FARMER ADDRESS 1']))));
  for (const name of names) {
    const existing = await prisma.barangay.findFirst({ where: { name } });
    if (!existing) {
      await prisma.barangay.create({
        data: { name, area: 0, classification: 'Rainfed' },
      });
      console.log(`Created barangay: ${name}`);
    }
  }
}

async function main() {
  const filePath = process.argv[2] || DEFAULT_FILE;
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  console.log(`Reading ${filePath}...`);
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet, { defval: '' });

  console.log(`Found ${rows.length} farmer records.`);
  await ensureBarangays(rows);

  const barangays = await prisma.barangay.findMany();
  const barangayMap = new Map(barangays.map((b) => [b.name.toLowerCase(), b.id]));

  let processed = 0;
  let skipped = 0;

  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const ops = batch.flatMap((row) => {
      const rsbsaNumber = toString(row['SYSTEM_GENERATED_RSBSA_NUMBER']);
      if (!rsbsaNumber) {
        skipped++;
        return [];
      }

      const barangayName = normalizeBarangayName(toString(row['FARMER ADDRESS 1']));
      const barangayId = barangayMap.get(barangayName.toLowerCase()) ?? null;

      const data = {
        lastName: toString(row['LAST NAME']),
        firstName: toString(row['FIRST NAME']),
        middleName: toString(row['MIDDLE NAME']),
        suffix: toString(row['SUFFIX AND EXTENSION']),
        farmerAddress1: toString(row['FARMER ADDRESS 1']),
        farmerAddress2: toString(row['FARMER ADDRESS 2']),
        farmerAddress3: toString(row['FARMER ADDRESS 3']),
        farmAddress2: toString(row['FARM ADDRESS 2']),
        farmAddress3: toString(row['FARM ADDRESS 3']),
        birthdate: parseDate(row['BIRTHDATE']),
        sex: toString(row['SEX']),
        contactNo: toString(row['CONTACT NO']),
        fourPs: parseYesNo(row['4Ps']),
        indigenous: parseYesNo(row['Indegenous']),
        pwd: parseYesNo(row['PWD']),
        farmArea: parseFloatOrNull(row['FARM AREA']) ?? 0,
        areaPlanted: parseFloatOrNull(row['AREA PLANTED']),
        commodity: toString(row['COMMODITY']) || 'Rice/Palay',
        farmerGeoCode: toString(row['Farmer GeoCode']) || null,
        farmGeoCode: toString(row[' Farm GeoCode']) || null,
        barangayId,
      };

      return [
        prisma.farmer.upsert({
          where: { rsbsaNumber },
          create: { rsbsaNumber, ...data },
          update: data,
        }),
      ];
    });

    if (ops.length) await prisma.$transaction(ops);
    processed += batch.length;
    process.stdout.write(`\rProcessed ${processed} / ${rows.length}`);
  }

  const total = await prisma.farmer.count();
  console.log(`\nImport complete. Total farmers in database: ${total}`);
  if (skipped) console.log(`Skipped ${skipped} rows without RSBSA number.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
