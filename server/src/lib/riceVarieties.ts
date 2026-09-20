/**
 * Rice varieties planted in Rizal, Palawan — normalized from official
 * DA Dry Season 2026 planting masterlists (data/official/).
 * Keep in sync with src/app/lib/riceVarieties.ts
 */

export type RiceSeedClass = 'HYBRID' | 'CS' | 'FS' | 'RS' | 'GQS' | 'INBRED';

export interface RiceVariety {
  name: string;
  seedClass: RiceSeedClass;
  aliases?: string[];
}

export const RIZAL_RICE_VARIETIES: RiceVariety[] = [
  { name: 'RC 402', seedClass: 'CS', aliases: ['RC402', '402', 'NSIC Rc402'] },
  { name: 'RC 222', seedClass: 'CS', aliases: ['RC222', 'rc222', 'rc22', 'NSIC Rc222'] },
  { name: 'RC 18', seedClass: 'CS', aliases: ['RC18', 'PSB Rc18'] },
  { name: 'RC 216', seedClass: 'CS', aliases: ['RC216', '216', 'NSIC Rc216'] },
  { name: 'RC 218', seedClass: 'CS', aliases: ['rc218'] },
  { name: 'RC 160', seedClass: 'CS', aliases: ['NSIC Rc160'] },
  { name: 'RC 219', seedClass: 'CS' },
  { name: 'RC 220', seedClass: 'CS' },
  { name: 'RC 152', seedClass: 'CS' },
  { name: 'RC 130', seedClass: 'CS', aliases: ['RC130'] },
  { name: 'RC 438', seedClass: 'CS', aliases: ['RC438', '438'] },
  { name: 'Syngenta', seedClass: 'HYBRID', aliases: ['SYGENTA', 'sygenta'] },
  { name: 'Habilis', seedClass: 'HYBRID', aliases: ['JHABILIS'] },
  { name: 'NK5017', seedClass: 'HYBRID', aliases: ['NK 5017'] },
  { name: 'Longping', seedClass: 'HYBRID' },
  { name: 'SL-19H', seedClass: 'HYBRID', aliases: ['SL 19', 'SL19', 'sl-19', 'SL-19'] },
  { name: 'SL 20', seedClass: 'HYBRID' },
  { name: 'Jackpot', seedClass: 'HYBRID', aliases: ['JACK POT'] },
  { name: 'AZ 8433', seedClass: 'HYBRID', aliases: ['AZ8433', 'EZ8433', '8433'] },
  { name: 'Bigante', seedClass: 'HYBRID' },
  { name: 'TH 82', seedClass: 'HYBRID', aliases: ['TH82'] },
  { name: 'Blonde', seedClass: 'FS', aliases: ['BLONDE', 'BLANDE', 'BLANDI', 'BLANDIE'] },
  { name: 'Speed', seedClass: 'FS' },
  { name: 'B-4', seedClass: 'FS', aliases: ['B4', 'b-4'] },
  { name: 'C4', seedClass: 'FS' },
  { name: 'Kanadoy', seedClass: 'FS', aliases: ['KINADOY', 'CANADOY'] },
  { name: 'Bullrice', seedClass: 'FS', aliases: ['BULRICE', 'BULL RICE'] },
  { name: 'Jasmine', seedClass: 'FS', aliases: ['JASMIN'] },
  { name: 'Dinorado', seedClass: 'FS' },
  { name: 'GSR', seedClass: 'FS' },
  { name: 'Redrice', seedClass: 'FS' },
  { name: 'Thailand', seedClass: 'FS' },
  { name: 'Bulao', seedClass: 'FS' },
  { name: 'Macarina', seedClass: 'FS' },
  { name: 'Aroma', seedClass: 'FS' },
  { name: 'ST 25', seedClass: 'FS' },
  { name: 'Millenia', seedClass: 'FS' },
  { name: 'SR', seedClass: 'FS' },
  { name: '352', seedClass: 'FS' },
];

export const RICE_VARIETY_NAMES: string[] = RIZAL_RICE_VARIETIES.map((v) => v.name);

export const TOP_RICE_VARIETIES = [
  'RC 402',
  'Syngenta',
  'RC 18',
  'RC 222',
  'Habilis',
  'NK5017',
  'Blonde',
  'Longping',
  'SL-19H',
] as const;

const ALIAS_INDEX: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const v of RIZAL_RICE_VARIETIES) {
    map.set(v.name.toUpperCase().replace(/\s+/g, ' ').trim(), v.name);
    for (const a of v.aliases ?? []) {
      map.set(a.toUpperCase().replace(/\s+/g, ' ').trim(), v.name);
    }
  }
  return map;
})();

export function normalizeRiceVariety(raw: string): string {
  const cleaned = String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!cleaned) return cleaned;
  return ALIAS_INDEX.get(cleaned.toUpperCase()) ?? cleaned;
}

/** Suggest variety name for a DA seed-type code (used by filled masterlists). */
export function varietyForSeedType(seed: string): string {
  const u = seed.toUpperCase();
  if (u.includes('HYBRID') || u === 'H') return 'Syngenta';
  if (u === 'CS' || u.includes('CERTIF')) return 'RC 402';
  if (u === 'RS' || u.includes('REGISTER')) return 'RC 18';
  if (u.includes('GQS') || u.includes('GOOD')) return 'RC 222';
  return 'Blonde';
}
