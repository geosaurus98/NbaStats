import { toISODate } from './dates';

// ESPN identifies a season by the year it ends in: 2026 = the 2025-26 season.
export interface Season {
  year: number;
  label: string;
  start: string; // first regular-season day (YYYY-MM-DD)
  regularEnd: string; // last regular-season day
  end: string; // after the Finals
}

export const SEASONS: Season[] = [
  { year: 2027, label: '2026-27', start: '2026-10-20', regularEnd: '2027-04-11', end: '2027-06-30' },
  { year: 2026, label: '2025-26', start: '2025-10-21', regularEnd: '2026-04-12', end: '2026-06-30' },
  { year: 2025, label: '2024-25', start: '2024-10-22', regularEnd: '2025-04-13', end: '2025-06-30' },
];

export const DEFAULT_SEASON = 2027;

export function getSeason(year: number): Season {
  return SEASONS.find((s) => s.year === year) ?? SEASONS.find((s) => s.year === DEFAULT_SEASON)!;
}

/** The date the scores page opens on for a season. */
export function defaultDate(season: Season, today = toISODate(new Date())): string {
  if (today >= season.start && today <= season.end) return today;
  return today > season.end ? season.regularEnd : season.start;
}
