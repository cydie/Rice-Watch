import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from './prisma.js';
import { normalizeBarangayName } from './helpers.js';
import {
  buildHarvestMasterlistRows,
  buildPlantingMasterlistRows,
} from './officialTargets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_CANDIDATES = [
  path.resolve(__dirname, '../assets/logo-rizal.png'),
  path.resolve(__dirname, '../../assets/logo-rizal.png'),
  path.resolve(__dirname, '../../../public/logo-rizal.png'),
];

export type BarangayPaperType = 'planting' | 'harvest';
export type BarangayPaperSource = 'blank' | 'data' | 'official';

export type PaperRow = {
  farmerName: string;
  irrigation: string;
  areaHa: string;
  variety: string;
  date: string;
  cropping?: string;
  bags?: string;
  weightPerBag?: string;
  remarks?: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDisplayDate(d?: Date | null) {
  if (!d || isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function loadLogoDataUri(): string {
  for (const candidate of LOGO_CANDIDATES) {
    if (fs.existsSync(candidate)) {
      const buf = fs.readFileSync(candidate);
      return `data:image/png;base64,${buf.toString('base64')}`;
    }
  }
  return '';
}

function padRows(rows: PaperRow[], minRows: number): PaperRow[] {
  const out = [...rows];
  while (out.length < minRows) {
    out.push({
      farmerName: '',
      irrigation: '',
      areaHa: '',
      variety: '',
      date: '',
      cropping: '',
      bags: '',
      weightPerBag: '',
      remarks: '',
    });
  }
  return out;
}

async function buildPlantingRowsFromDb(barangayId: number): Promise<PaperRow[]> {
  const reports = await prisma.plantingReport.findMany({
    where: { barangayId },
    orderBy: [{ datePlanted: 'asc' }, { id: 'asc' }],
  });

  return reports.map((r) => {
    const cropping = r.season.includes('1')
      ? '1st'
      : r.season.includes('2')
        ? '2nd'
        : r.season.includes('3')
          ? '3rd'
          : r.season.replace(' Season', '') || r.season;
    return {
      farmerName: r.farmerName || (r.farmerCount > 1 ? `(${r.farmerCount} farmers)` : ''),
      irrigation: r.irrigationType,
      areaHa: String(r.areaPlanted),
      variety: r.seedVariety,
      date: formatDisplayDate(r.datePlanted),
      cropping,
    };
  });
}

async function buildHarvestRowsFromDb(barangayId: number): Promise<PaperRow[]> {
  const reports = await prisma.harvestReport.findMany({
    where: { barangayId },
    orderBy: [{ harvestDate: 'asc' }, { id: 'asc' }],
  });

  return reports.map((r) => {
    const weightPerBag = r.weightPerBag || 50;
    const bags =
      r.bagsHarvested > 0
        ? r.bagsHarvested
        : Math.max(0, Math.round((r.totalProduction * 1000) / weightPerBag));
    return {
      farmerName: r.farmerName || '',
      irrigation: r.irrigationType,
      areaHa: String(r.harvestedArea),
      variety: r.riceVariety,
      date: formatDisplayDate(r.harvestDate),
      bags: bags ? String(bags) : '',
      weightPerBag: bags ? String(weightPerBag) : '',
      remarks: r.remarks || '',
    };
  });
}

function buildPlantingRowsFromOfficial(barangay: string, technicianName: string): PaperRow[] {
  const aoa = buildPlantingMasterlistRows(barangay, technicianName);
  return aoa.slice(1).map((row) => ({
    farmerName: `${row[7] || ''} ${row[8] || ''}`.trim(),
    irrigation: String(row[2] || ''),
    areaHa: String(row[1] ?? ''),
    variety: String(row[4] || ''),
    date: String(row[5] || ''),
    cropping: String(row[6] || '').includes('Dry')
      ? '1st'
      : String(row[6] || '').includes('Wet')
        ? '2nd'
        : String(row[6] || ''),
  }));
}

function buildHarvestRowsFromOfficial(barangay: string, technicianName: string): PaperRow[] {
  const aoa = buildHarvestMasterlistRows(barangay, technicianName);
  return aoa.slice(1).map((row) => ({
    farmerName: `${row[8] || ''} ${row[9] || ''}`.trim(),
    irrigation: String(row[2] || ''),
    areaHa: String(row[1] ?? ''),
    variety: String(row[4] || ''),
    date: String(row[5] || ''),
    bags: String(row[6] ?? ''),
    weightPerBag: String(row[7] ?? ''),
    remarks: '',
  }));
}

function renderPlantingTable(rows: PaperRow[]) {
  const body = rows
    .map(
      (r, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td class="name">${escapeHtml(r.farmerName)}</td>
        <td>${escapeHtml(r.irrigation)}</td>
        <td class="num">${escapeHtml(r.areaHa)}</td>
        <td>${escapeHtml(r.variety)}</td>
        <td>${escapeHtml(r.date)}</td>
        <td>${escapeHtml(r.cropping || '')}</td>
      </tr>`
    )
    .join('');

  return `
    <table class="grid">
      <thead>
        <tr>
          <th style="width:4%">NO.</th>
          <th style="width:26%">NAME OF FARMERS</th>
          <th style="width:14%">IRRIGATED / RAINFED</th>
          <th style="width:10%">AREA (Ha.)</th>
          <th style="width:16%">VARIETY PLANTED</th>
          <th style="width:14%">DATE PLANTED</th>
          <th style="width:16%">CROPPING (1st, 2nd, 3rd)</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>`;
}

function renderHarvestTable(rows: PaperRow[]) {
  const body = rows
    .map(
      (r, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td class="name">${escapeHtml(r.farmerName)}</td>
        <td>${escapeHtml(r.irrigation)}</td>
        <td class="num">${escapeHtml(r.areaHa)}</td>
        <td>${escapeHtml(r.date)}</td>
        <td>${escapeHtml(r.variety)}</td>
        <td class="num">${escapeHtml(r.bags || '')}</td>
        <td class="num">${escapeHtml(r.weightPerBag || '')}</td>
        <td>${escapeHtml(r.remarks || '')}</td>
      </tr>`
    )
    .join('');

  return `
    <table class="grid">
      <thead>
        <tr>
          <th style="width:4%">NO.</th>
          <th style="width:18%">NAME OF FARMERS</th>
          <th style="width:10%">Irrigated/<br/>Rainfed</th>
          <th style="width:8%">AREA<br/>(HA.)</th>
          <th style="width:11%">Date<br/>harvested</th>
          <th style="width:12%">VARIETY<br/>PLANTED</th>
          <th style="width:10%">Total # of<br/>bags harvested</th>
          <th style="width:12%">HARVESTED WEIGHT<br/>PER bag<br/>(Kilos per bag)</th>
          <th style="width:15%">REMARKS</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>`;
}

function renderSignatures(preparedBy: string) {
  return `
    <div class="signatures">
      <div class="sig">
        <div class="sig-line">${escapeHtml(preparedBy || '')}</div>
        <div class="sig-label">Prepared by:</div>
        <div class="sig-role">Local Farmers Technician</div>
      </div>
      <div class="sig">
        <div class="sig-line"></div>
        <div class="sig-label">Recommending Approval:</div>
        <div class="sig-role">Agricultural Technician</div>
      </div>
      <div class="sig">
        <div class="sig-line"></div>
        <div class="sig-label">Approved by:</div>
        <div class="sig-role">Rice Report Officer</div>
      </div>
    </div>`;
}

export async function buildBarangayPaperHtml(options: {
  type: BarangayPaperType;
  barangay: string;
  preparedBy?: string;
  source?: BarangayPaperSource;
  asOf?: string;
  dateSubmitted?: string;
}): Promise<string> {
  const barangay = normalizeBarangayName(options.barangay);
  const source = options.source || 'data';
  const preparedBy = options.preparedBy || '';
  const asOf = options.asOf || formatDisplayDate(new Date());
  const dateSubmitted = options.dateSubmitted || formatDisplayDate(new Date());
  const title = options.type === 'planting' ? 'PLANTING REPORT' : 'HARVESTING REPORT';
  const minRows = options.type === 'planting' ? 30 : 25;
  const logo = loadLogoDataUri();

  let rows: PaperRow[] = [];
  if (source === 'official') {
    rows =
      options.type === 'planting'
        ? buildPlantingRowsFromOfficial(barangay, preparedBy || 'Technician')
        : buildHarvestRowsFromOfficial(barangay, preparedBy || 'Technician');
  } else if (source === 'data') {
    const b = await prisma.barangay.findFirst({
      where: {
        OR: [{ name: barangay }, { name: { equals: barangay, mode: 'insensitive' } }],
      },
    });
    if (b) {
      rows =
        options.type === 'planting'
          ? await buildPlantingRowsFromDb(b.id)
          : await buildHarvestRowsFromDb(b.id);
    }
  }

  rows = padRows(rows, minRows);
  const table =
    options.type === 'planting' ? renderPlantingTable(rows) : renderHarvestTable(rows);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)} — ${escapeHtml(barangay)}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Times New Roman", Times, serif;
      color: #111;
      margin: 0;
      background: #fff;
    }
    .sheet {
      width: 100%;
      max-width: 297mm;
      margin: 0 auto;
      padding: 8mm 8mm 6mm;
    }
    .toolbar {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-bottom: 10px;
    }
    .toolbar button {
      font-family: Arial, sans-serif;
      font-size: 13px;
      padding: 8px 14px;
      border: 1px solid #2e7d32;
      background: #2e7d32;
      color: #fff;
      border-radius: 6px;
      cursor: pointer;
    }
    .toolbar button.secondary {
      background: #fff;
      color: #2e7d32;
    }
    .header {
      text-align: center;
      margin-bottom: 8px;
    }
    .logo {
      width: 78px;
      height: 78px;
      object-fit: contain;
      margin: 0 auto 4px;
      display: block;
    }
    .gov {
      font-size: 13px;
      line-height: 1.25;
      margin: 0;
    }
    .muni {
      font-size: 14px;
      font-weight: bold;
      margin: 0;
    }
    .title {
      margin: 10px 0 8px;
      font-size: 22px;
      font-weight: bold;
      letter-spacing: 0.5px;
      text-decoration: underline;
    }
    .meta {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      font-size: 13px;
      margin-bottom: 8px;
    }
    .meta span {
      border-bottom: 1px solid #333;
      min-width: 140px;
      display: inline-block;
      padding: 0 4px;
    }
    table.grid {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 11px;
    }
    table.grid th, table.grid td {
      border: 1px solid #222;
      padding: 3px 4px;
      vertical-align: middle;
      height: 22px;
    }
    table.grid th {
      background: #f3f3f3;
      font-weight: bold;
      text-align: center;
      line-height: 1.15;
    }
    td.num { text-align: center; }
    td.name { text-align: left; }
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 24px;
      margin-top: 28px;
      text-align: center;
      font-size: 12px;
    }
    .sig-line {
      min-height: 18px;
      border-bottom: 1px solid #111;
      margin: 0 18px 4px;
      font-weight: bold;
    }
    .sig-label { font-weight: bold; }
    .sig-role { font-style: italic; margin-top: 2px; }
    .footnote {
      margin-top: 10px;
      font-size: 10px;
      color: #555;
      font-family: Arial, sans-serif;
    }
    @media print {
      .toolbar { display: none !important; }
      .sheet { padding: 0; max-width: none; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="toolbar">
      <button class="secondary" type="button" onclick="window.close()">Close</button>
      <button type="button" onclick="window.print()">Print / Save as PDF</button>
    </div>
    <div class="header">
      ${logo ? `<img class="logo" src="${logo}" alt="Municipality of Dr. Jose P. Rizal seal" />` : ''}
      <p class="gov">Republic of the Philippines</p>
      <p class="gov">Province of Palawan</p>
      <p class="muni">Municipality of Dr. Jose P. Rizal</p>
      <h1 class="title">${escapeHtml(title)}</h1>
    </div>
    <div class="meta">
      <div>Barangay: <span>${escapeHtml(barangay)}</span></div>
      <div>As of: <span>${escapeHtml(asOf)}</span></div>
      <div>Date submitted: <span>${escapeHtml(dateSubmitted)}</span></div>
    </div>
    ${table}
    ${renderSignatures(preparedBy)}
    <div class="footnote">Generated by RiceWatch · scoped to Brgy. ${escapeHtml(barangay)}</div>
  </div>
</body>
</html>`;
}
