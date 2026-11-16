import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RIZAL_CANDIDATES = [
  path.resolve(__dirname, '../assets/logo-rizal.png'),
  path.resolve(__dirname, '../../assets/logo-rizal.png'),
  path.resolve(__dirname, '../../../public/logo-rizal.png'),
];

const DA_CANDIDATES = [
  path.resolve(__dirname, '../assets/logo-da.png'),
  path.resolve(__dirname, '../../assets/logo-da.png'),
  path.resolve(__dirname, '../../../public/logo-da.png'),
];

function firstExisting(candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export function getRizalLogoPath(): string | null {
  return firstExisting(RIZAL_CANDIDATES);
}

export function getDaLogoPath(): string | null {
  return firstExisting(DA_CANDIDATES);
}

export function loadLogoDataUri(filePath: string | null): string {
  if (!filePath || !fs.existsSync(filePath)) return '';
  const buf = fs.readFileSync(filePath);
  return `data:image/png;base64,${buf.toString('base64')}`;
}

export function getReportLogos() {
  const rizalPath = getRizalLogoPath();
  const daPath = getDaLogoPath();
  return {
    rizalPath,
    daPath,
    rizalDataUri: loadLogoDataUri(rizalPath),
    daDataUri: loadLogoDataUri(daPath),
  };
}
