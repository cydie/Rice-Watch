import { prisma } from './prisma.js';

export function parseId(param: string | string[]): number {
  const id = parseInt(Array.isArray(param) ? param[0] : param, 10);
  return id;
}

const BARANGAY_ALIASES: Record<string, string> = {
  BUNOG: 'Bunog',
  'CAMPONG ULAY': 'Campong Ulay',
  'C-ULAY': 'Campong Ulay',
  'C ULAY': 'Campong Ulay',
  CULAY: 'Campong Ulay',
  CANDAWAGA: 'Candawaga',
  CANDA: 'Candawaga',
  CANIPAAN: 'Canipaan',
  CULASIAN: 'Culasian',
  IRAAN: 'Iraan',
  LATUD: 'Latud',
  PANALINGAAN: 'Panalingaan',
  PANALI: 'Panalingaan',
  'PUNTA BAJA': 'Punta Baja (Poblacion)',
  'PUNTA BAJA (POBLACION)': 'Punta Baja (Poblacion)',
  PBAJA: 'Punta Baja (Poblacion)',
  RANSANG: 'Ransang',
  TABURI: 'Taburi',
};

export function normalizeBarangayName(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/\s*[\\/]\s*(IR|RF|UP|IRRIGATED|RAINFED|UPLAND).*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  const key = cleaned.toUpperCase();
  return BARANGAY_ALIASES[key] ?? cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function getBarangayIdByName(name: string): Promise<number | null> {
  const normalized = normalizeBarangayName(name);
  const b = await prisma.barangay.findFirst({
    where: {
      OR: [{ name: normalized }, { name: { equals: name, mode: 'insensitive' } }],
    },
  });
  return b?.id ?? null;
}

export function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      headers.map((h) => {
        const val = row[h];
        const str = val == null ? '' : String(val);
        return str.includes(',') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(',')
    ),
  ];
  return lines.join('\n');
}
