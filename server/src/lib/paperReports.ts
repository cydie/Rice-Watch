import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import XLSX from 'xlsx';
import { prisma } from './prisma.js';
import { normalizeBarangayName } from './helpers.js';
import { normalizeRiceVariety } from './riceVarieties.js';
import { getDaLogoPath, getRizalLogoPath } from './reportLogos.js';

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

function mapCropping(raw: string): string {
  const u = raw.trim().toUpperCase();
  if (u === '1' || u.startsWith('1ST') || u.includes('FIRST')) return '1st';
  if (u === '2' || u.startsWith('2ND') || u.includes('SECOND')) return '2nd';
  if (u === '3' || u.startsWith('3RD') || u.includes('THIRD')) return '3rd';
  if (u.includes('DRY')) return '1st';
  if (u.includes('WET')) return '2nd';
  return raw.trim() || '1st';
}

async function ingestPlanting(
  rows: Record<string, unknown>[],
  options: { forcedBarangay?: string | null; replaceBarangay: boolean }
) {
  const prepared: {
    barangay: string;
    irrigation: string;
    variety: string;
    area: number;
    date: Date;
    cropping: string;
    farmerName: string;
  }[] = [];

  for (const r of rows) {
    const loc = options.forcedBarangay || String(r['FARM LOCATION (Barangay)'] || r['FARM LOCATION'] || '');
    if (!String(loc).trim()) continue;
    const barangay = normalizeBarangayName(String(loc));
    if (options.forcedBarangay && barangay !== normalizeBarangayName(options.forcedBarangay)) {
      continue;
    }
    const irrigation = mapIrrigation(String(r['IRRIGATION (IRRIGATED/RAINFED)'] || r.IRRIGATION || ''));
    const seed = mapSeedType(String(r['SEED TYPE (HYBRID/RS/CS/GQS/FS)'] || r['SEED TYPE'] || 'FS'));
    const area = Number(r['AREA PLANTED (HECTARE)'] || r['AREA PLANTED(HECTARE)'] || r['AREA (Ha.)'] || 0) || 0;
    if (area <= 0) continue;
    const variety = normalizeRiceVariety(String(r.VARIETY || r['VARIETY PLANTED'] || seed).trim() || seed);
    const date = parseDate(r['DATE PLANTED (YYYY-MM-DD)'] || r['DATE PLANTED'], new Date());
    const cropping = mapCropping(String(r['CROPPING / SEASON'] || r.CROPPING || r['CROPPING (1st, 2nd, 3rd)'] || '1st'));
    const first = String(r['FARMER FIRST NAME'] || '').trim();
    const last = String(r['FARMER LAST NAME'] || '').trim();
    const farmerName =
      String(r['NAME OF FARMERS'] || r['NAME OF FARMER'] || '').trim() ||
      [first, last].filter(Boolean).join(' ');
    prepared.push({ barangay, irrigation, variety, area, date, cropping, farmerName });
  }

  const touched = [...new Set(prepared.map((p) => p.barangay))];
  if (options.replaceBarangay) {
    for (const name of touched) {
      const b = await resolveBarangayId(name);
      await prisma.plantingReport.deleteMany({ where: { barangayId: b.id } });
    }
  }

  let created = 0;
  for (const row of prepared) {
    const b = await resolveBarangayId(row.barangay);
    const expected = new Date(row.date);
    expected.setDate(expected.getDate() + 120);
    await prisma.plantingReport.create({
      data: {
        municipality: 'Rizal',
        barangayId: b.id,
        sitio: '-',
        farmerName: row.farmerName,
        farmerCount: 1,
        seedVariety: row.variety,
        areaPlanted: round2(row.area),
        datePlanted: row.date,
        irrigationType: row.irrigation,
        season: row.cropping,
        expectedHarvest: expected,
      },
    });
    created += 1;
  }

  return { created, barangays: touched, rows: rows.length };
}

async function ingestHarvest(
  rows: Record<string, unknown>[],
  options: { forcedBarangay?: string | null; replaceBarangay: boolean }
) {
  const prepared: {
    barangay: string;
    irrigation: string;
    area: number;
    bags: number;
    weight: number;
    production: number;
    variety: string;
    date: Date;
    farmerName: string;
    remarks: string;
  }[] = [];

  for (const r of rows) {
    const loc = options.forcedBarangay || String(r['FARM LOCATION (Barangay)'] || '');
    if (!String(loc).trim()) continue;
    const barangay = normalizeBarangayName(String(loc));
    if (options.forcedBarangay && barangay !== normalizeBarangayName(options.forcedBarangay)) continue;
    const irrigation = mapIrrigation(String(r['IRRIGATION (IRRIGATED/RAINFED)'] || r['Irrigated/Rainfed'] || ''));
    const area = Number(r['AREA HARVESTED (HECTARE)'] || r['AREA (HA.)'] || 0) || 0;
    if (area <= 0) continue;
    const bags = Number(r['NO. OF BAGS'] || r['total # of bags harvested'] || 0) || 0;
    const weight = Number(r['WEIGHT PER BAG (KG)'] || r['HARVESTED WEIGHT PER bag (Kilos per bag)'] || 50) || 50;
    const production = (bags * weight) / 1000;
    const variety = normalizeRiceVariety(String(r.VARIETY || r['VARIETY PLANTED'] || 'Various'));
    const date = parseDate(r['HARVEST DATE (YYYY-MM-DD)'] || r['Date harvested'], new Date());
    const first = String(r['FARMER FIRST NAME'] || '').trim();
    const last = String(r['FARMER LAST NAME'] || '').trim();
    const farmerName =
      String(r['NAME OF FARMERS'] || r['NAME OF FARMER'] || '').trim() ||
      [first, last].filter(Boolean).join(' ');
    const remarks = String(r.REMARKS || r.Remarks || '').trim();
    prepared.push({
      barangay,
      irrigation,
      area,
      bags,
      weight,
      production,
      variety,
      date,
      farmerName,
      remarks,
    });
  }

  const touched = [...new Set(prepared.map((p) => p.barangay))];
  if (options.replaceBarangay) {
    for (const name of touched) {
      const b = await resolveBarangayId(name);
      await prisma.harvestReport.deleteMany({ where: { barangayId: b.id } });
    }
  }

  let created = 0;
  for (const row of prepared) {
    const b = await resolveBarangayId(row.barangay);
    await prisma.harvestReport.create({
      data: {
        municipality: 'Rizal',
        barangayId: b.id,
        sitio: '-',
        farmerName: row.farmerName,
        harvestDate: row.date,
        harvestedArea: round2(row.area),
        totalProduction: round2(row.production),
        averageYield: row.area ? round2(row.production / row.area) : 0,
        riceVariety: row.variety,
        irrigationType: row.irrigation,
        bagsHarvested: row.bags,
        weightPerBag: row.weight,
        remarks: row.remarks,
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

async function applyExcelBranding(
  workbook: ExcelJS.Workbook,
  worksheet: ExcelJS.Worksheet,
  options: {
    title: string;
    subtitle: string;
    columnCount: number;
  }
) {
  worksheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };

  worksheet.mergeCells(1, 1, 1, options.columnCount);
  worksheet.mergeCells(2, 1, 2, options.columnCount);
  worksheet.mergeCells(3, 1, 3, options.columnCount);
  worksheet.mergeCells(4, 1, 4, options.columnCount);
  worksheet.mergeCells(5, 1, 5, options.columnCount);

  worksheet.getRow(1).height = 16;
  worksheet.getRow(2).height = 16;
  worksheet.getRow(3).height = 14;
  worksheet.getRow(4).height = 14;
  worksheet.getRow(5).height = 18;
  worksheet.getRow(6).height = 14;
  worksheet.getRow(7).height = 8;

  const center = {
    vertical: 'middle' as const,
    horizontal: 'center' as const,
  };

  worksheet.getCell('A1').value = 'Republic of the Philippines';
  worksheet.getCell('A1').font = { name: 'Calibri', size: 11, bold: true };
  worksheet.getCell('A1').alignment = center;

  worksheet.getCell('A2').value = 'Department of Agriculture';
  worksheet.getCell('A2').font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF1B5E20' } };
  worksheet.getCell('A2').alignment = center;

  worksheet.getCell('A3').value = 'REGIONAL FIELD OFFICE MIMAROPA · Rice Program';
  worksheet.getCell('A3').font = { name: 'Calibri', size: 10 };
  worksheet.getCell('A3').alignment = center;

  worksheet.getCell('A4').value = 'Municipality of Dr. Jose P. Rizal, Palawan';
  worksheet.getCell('A4').font = { name: 'Calibri', size: 11, bold: true };
  worksheet.getCell('A4').alignment = center;

  worksheet.getCell('A5').value = options.title;
  worksheet.getCell('A5').font = { name: 'Calibri', size: 14, bold: true, underline: true };
  worksheet.getCell('A5').alignment = center;

  worksheet.getCell('A6').value = options.subtitle;
  worksheet.getCell('A6').font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF555555' } };
  worksheet.mergeCells(6, 1, 6, options.columnCount);

  const daLogo = getDaLogoPath();
  const rizalLogo = getRizalLogoPath();
  if (daLogo) {
    const imageId = workbook.addImage({ filename: daLogo, extension: 'png' });
    worksheet.addImage(imageId, {
      tl: { col: 0.15, row: 0.15 },
      ext: { width: 78, height: 78 },
    });
  }
  if (rizalLogo) {
    const imageId = workbook.addImage({ filename: rizalLogo, extension: 'png' });
    const rightCol = Math.max(options.columnCount - 1.2, 3);
    worksheet.addImage(imageId, {
      tl: { col: rightCol, row: 0.15 },
      ext: { width: 78, height: 78 },
    });
  }
}

function setRowValues(row: ExcelJS.Row, values: (string | number)[]) {
  // ExcelJS row.values is 1-indexed; index 0 is ignored.
  row.values = [undefined, ...values];
}

function styleHeaderRow(row: ExcelJS.Row, columnCount: number) {
  row.height = 28;
  for (let col = 1; col <= columnCount; col++) {
    const cell = row.getCell(col);
    cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2E7D32' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF1B5E20' } },
      left: { style: 'thin', color: { argb: 'FF1B5E20' } },
      bottom: { style: 'thin', color: { argb: 'FF1B5E20' } },
      right: { style: 'thin', color: { argb: 'FF1B5E20' } },
    };
  }
}

function styleDataRow(row: ExcelJS.Row, columnCount: number, emphasize = false) {
  for (let col = 1; col <= columnCount; col++) {
    const cell = row.getCell(col);
    cell.font = { name: 'Calibri', size: 10, bold: emphasize };
    cell.alignment = {
      vertical: 'middle',
      horizontal: col === 1 ? 'left' : 'center',
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFBDBDBD' } },
      left: { style: 'thin', color: { argb: 'FFBDBDBD' } },
      bottom: { style: 'thin', color: { argb: 'FFBDBDBD' } },
      right: { style: 'thin', color: { argb: 'FFBDBDBD' } },
    };
    if (emphasize) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8F5E9' },
      };
    }
  }
}

/** Build municipal DA-style paper from DB aggregates (with DA + Rizal logos). */
export async function generateMunicipalPaper(type: UploadType): Promise<Buffer> {
  const barangays = await prisma.barangay.findMany({ orderBy: { name: 'asc' } });
  const names = barangays.length ? barangays.map((b) => b.name) : BARANGAYS;
  const asOf = new Date().toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RiceWatch';
  workbook.created = new Date();

  if (type === 'planting') {
    const reports = await prisma.plantingReport.findMany({ include: { barangay: true } });
    const sheet = workbook.addWorksheet('DS Cumulative', {
      views: [{ state: 'frozen', ySplit: 8 }],
    });
    const headers = [
      'MUNICIPALITY / BARANGAY',
      'NO. OF FARMER PLANTED',
      'IRRIGATED (ha)',
      'RAINFED (ha)',
      'TOTAL PLANTED (ha)',
    ];
    await applyExcelBranding(workbook, sheet, {
      title: 'DRY SEASON 2026 PLANTING REPORT',
      subtitle: `As of ${asOf} · Auto-generated by RiceWatch`,
      columnCount: headers.length,
    });

    setRowValues(sheet.getRow(8), headers);
    styleHeaderRow(sheet.getRow(8), headers.length);
    sheet.columns = [
      { width: 28 },
      { width: 18 },
      { width: 14 },
      { width: 14 },
      { width: 16 },
    ];

    let tf = 0;
    let ti = 0;
    let tr = 0;
    const munRows: (string | number)[][] = [];
    for (const name of names) {
      const rows = reports.filter((r) => r.barangay.name === name);
      const farmers = rows.reduce((s, r) => s + r.farmerCount, 0);
      const irrigated = rows
        .filter((r) => r.irrigationType === 'Irrigated')
        .reduce((s, r) => s + r.areaPlanted, 0);
      const rainfed = rows
        .filter((r) => r.irrigationType !== 'Irrigated')
        .reduce((s, r) => s + r.areaPlanted, 0);
      const total = irrigated + rainfed;
      if (total <= 0 && farmers <= 0) continue;
      tf += farmers;
      ti += irrigated;
      tr += rainfed;
      munRows.push([name, farmers, round2(irrigated), round2(rainfed), round2(total)]);
    }

    let rowNum = 9;
    setRowValues(sheet.getRow(rowNum), ['Rizal', tf, round2(ti), round2(tr), round2(ti + tr)]);
    styleDataRow(sheet.getRow(rowNum), headers.length, true);
    rowNum += 1;
    for (const values of munRows) {
      setRowValues(sheet.getRow(rowNum), values);
      styleDataRow(sheet.getRow(rowNum), headers.length);
      rowNum += 1;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  if (type === 'harvest') {
    const reports = await prisma.harvestReport.findMany({ include: { barangay: true } });
    const sheet = workbook.addWorksheet('Cumulative', {
      views: [{ state: 'frozen', ySplit: 8 }],
    });
    const headers = [
      'MUNICIPALITY / BARANGAY',
      'IRRIGATED AREA (ha)',
      'IRRIGATED PRODUCTION (mt)',
      'IRRIGATED YIELD (mt/ha)',
      'RAINFED AREA (ha)',
      'RAINFED PRODUCTION (mt)',
      'RAINFED YIELD (mt/ha)',
      'TOTAL AREA (ha)',
      'TOTAL PRODUCTION (mt)',
    ];
    await applyExcelBranding(workbook, sheet, {
      title: 'DRY SEASON 2026 HARVESTING REPORT',
      subtitle: `As of ${asOf} · Auto-generated by RiceWatch`,
      columnCount: headers.length,
    });

    setRowValues(sheet.getRow(8), headers);
    styleHeaderRow(sheet.getRow(8), headers.length);
    sheet.columns = [
      { width: 26 },
      { width: 14 },
      { width: 16 },
      { width: 14 },
      { width: 14 },
      { width: 16 },
      { width: 14 },
      { width: 14 },
      { width: 16 },
    ];

    let tiA = 0;
    let tiP = 0;
    let trA = 0;
    let trP = 0;
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
      tiA += iA;
      tiP += iP;
      trA += rA;
      trP += rP;
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

    let rowNum = 9;
    setRowValues(sheet.getRow(rowNum), [
      'Rizal',
      round2(tiA),
      round2(tiP),
      tiA ? round2(tiP / tiA) : 0,
      round2(trA),
      round2(trP),
      trA ? round2(trP / trA) : 0,
      round2(tiA + trA),
      round2(tiP + trP),
    ]);
    styleDataRow(sheet.getRow(rowNum), headers.length, true);
    rowNum += 1;
    for (const values of munRows) {
      setRowValues(sheet.getRow(rowNum), values);
      styleDataRow(sheet.getRow(rowNum), headers.length);
      rowNum += 1;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // standing
  const reports = await prisma.standingCropReport.findMany({ include: { barangay: true } });
  const stages = ['Newly Planted', 'Vegetative', 'Reproductive', 'Maturing'] as const;
  const sheet = workbook.addWorksheet('Standing Crop', {
    views: [{ state: 'frozen', ySplit: 8 }],
  });
  const headers = [
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
  ];
  await applyExcelBranding(workbook, sheet, {
    title: 'STANDING CROP REPORT 2026',
    subtitle: `As of ${asOf} · Auto-generated by RiceWatch`,
    columnCount: headers.length,
  });

  setRowValues(sheet.getRow(8), headers);
  styleHeaderRow(sheet.getRow(8), headers.length);
  sheet.columns = [
    { width: 26 },
    { width: 11 },
    { width: 12 },
    { width: 13 },
    { width: 12 },
    { width: 11 },
    { width: 11 },
    { width: 12 },
    { width: 13 },
    { width: 12 },
    { width: 11 },
    { width: 12 },
  ];

  const stageArea = (name: string, sitio: string, stage: string) =>
    reports
      .filter((r) => r.barangay.name === name && r.sitio === sitio && r.cropStage === stage)
      .reduce((s, r) => s + r.area, 0);

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

  const gIr = [0, 0, 0, 0];
  const gRf = [0, 0, 0, 0];
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

  let rowNum = 9;
  setRowValues(sheet.getRow(rowNum), [
    'Rizal',
    ...gIr.map(round2),
    gIrT,
    ...gRf.map(round2),
    gRfT,
    round2(gIrT + gRfT),
  ]);
  styleDataRow(sheet.getRow(rowNum), headers.length, true);
  rowNum += 1;
  for (const values of munRows) {
    setRowValues(sheet.getRow(rowNum), values);
    styleDataRow(sheet.getRow(rowNum), headers.length);
    rowNum += 1;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
