import { toISODate, usDate } from './dates';

// ESPN identifies a season by the year it ends in: 2026 = the 2025-26 season.
export interface Season {
  year: number;
  label: string;
  start: string; // first regular-season day (YYYY-MM-DD)
  regularEnd: string; // last regular-season day
  end: string; // after the Finals
}

/** Official dates where we have them; later seasons are estimated until added here. */
const KNOWN: Record<number, Pick<Season, 'start' | 'regularEnd' | 'end'>> = {
  2027: { start: '2026-10-20', regularEnd: '2027-04-11', end: '2027-06-30' },
  2026: { start: '2025-10-21', regularEnd: '2026-04-12', end: '2026-06-30' },
  2025: { start: '2024-10-22', regularEnd: '2025-04-13', end: '2025-06-30' },
};
const FIRST_SEASON = 2025;

/** The season a date belongs to: from September on, it's the next one. */
export function seasonYearFor(today: string): number {
  const [y, m] = today.split('-').map(Number);
  return m >= 9 ? y + 1 : y;
}

export function seasonInfo(year: number): Season {
  const known = KNOWN[year];
  return { year, label: `${year - 1}-${String(year).slice(2)}`, ...(known ?? { start: `${year - 1}-10-21`, regularEnd: `${year}-04-12`, end: `${year}-06-30` }) };
}

/** Every season the site covers, newest first, up to the one in progress on `today`. */
export function seasonsFor(today: string): Season[] {
  const latest = Math.max(FIRST_SEASON, ...Object.keys(KNOWN).map(Number), seasonYearFor(today));
  return Array.from({ length: latest - FIRST_SEASON + 1 }, (_, i) => seasonInfo(latest - i));
}

export const SEASONS: Season[] = seasonsFor(toISODate(new Date()));

/** The season in progress (or the one about to start). */
export const DEFAULT_SEASON = SEASONS[0].year;

export function getSeason(year: number): Season {
  return SEASONS.find((s) => s.year === year) ?? SEASONS.find((s) => s.year === DEFAULT_SEASON)!;
}

/** The date the scores page opens on for a season. */
/** Today's NBA game day (US Eastern), so viewers ahead of the US see the games being played now. */
export function defaultDate(season: Season, today = usDate()): string {
  if (today >= season.start && today <= season.end) return today;
  return today > season.end ? season.regularEnd : season.start;
}
