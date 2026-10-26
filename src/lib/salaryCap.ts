// NBA salary cap thresholds (official league figures) and where a payroll sits.

export interface CapLevels {
  season: number;
  minimum: number;
  cap: number;
  tax: number;
  firstApron: number;
  secondApron: number;
  source: string;
}

export const CAP_LEVELS: Record<number, CapLevels> = {
  2026: { season: 2026, minimum: 139_182_000, cap: 154_647_000, tax: 187_895_000, firstApron: 195_945_000, secondApron: 207_824_000, source: 'https://pr.nba.com/nba-salary-cap-2025-26-season' },
  2027: { season: 2027, minimum: 148_465_000, cap: 164_961_000, tax: 200_428_000, firstApron: 209_015_000, secondApron: 221_686_000, source: 'https://pr.nba.com/2026-27-salary-cap/' },
};

export const LEVEL_LINES: { key: keyof Omit<CapLevels, 'season' | 'source'>; label: string }[] = [
  { key: 'minimum', label: 'Minimum' },
  { key: 'cap', label: 'Cap' },
  { key: 'tax', label: 'Tax' },
  { key: 'firstApron', label: '1st apron' },
  { key: 'secondApron', label: '2nd apron' },
];

export type CapZone = 'below-minimum' | 'under-cap' | 'over-cap' | 'taxpayer' | 'first-apron' | 'second-apron';

export const ZONE_LABELS: Record<CapZone, string> = {
  'below-minimum': 'Below the minimum',
  'under-cap': 'Under the cap',
  'over-cap': 'Over the cap',
  taxpayer: 'Taxpayer',
  'first-apron': 'Above the 1st apron',
  'second-apron': 'Above the 2nd apron',
};

export function capZone(payroll: number, l: CapLevels): CapZone {
  if (payroll >= l.secondApron) return 'second-apron';
  if (payroll >= l.firstApron) return 'first-apron';
  if (payroll >= l.tax) return 'taxpayer';
  if (payroll >= l.cap) return 'over-cap';
  if (payroll >= l.minimum) return 'under-cap';
  return 'below-minimum';
}

/** "$52.6M", or "$28K" for small amounts. */
export const money = (v: number, dp = 1) => (Math.abs(v) < 950_000 ? `$${Math.round(v / 1e3)}K` : `$${(v / 1e6).toFixed(dp)}M`);

/** The nearest threshold above (and how far), for a one-line summary. */
export function nextLevel(payroll: number, l: CapLevels): { label: string; gap: number } | undefined {
  const next = LEVEL_LINES.find((x) => l[x.key] > payroll);
  return next && { label: next.label, gap: l[next.key] - payroll };
}
