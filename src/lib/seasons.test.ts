import { describe, expect, it } from 'vitest';
import { addDays, espnDate } from './dates';
import { DEFAULT_SEASON, defaultDate, getSeason } from './seasons';

describe('seasons', () => {
  it('defaults to the season in progress, 2026-27', () => {
    expect(getSeason(DEFAULT_SEASON).label).toBe('2026-27');
  });

  it('opens a finished season on its last regular-season day', () => {
    expect(defaultDate(getSeason(2026), '2026-10-20')).toBe('2026-04-12');
  });

  it('opens the in-progress season on today', () => {
    expect(defaultDate(getSeason(2027), '2026-10-25')).toBe('2026-10-25');
  });
});

describe('dates', () => {
  it('steps across month boundaries', () => {
    expect(addDays('2026-03-31', 1)).toBe('2026-04-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('formats for ESPN', () => {
    expect(espnDate('2026-04-12')).toBe('20260412');
  });
});

describe('season rollover', async () => {
  const { seasonsFor, seasonYearFor, seasonInfo } = await import('./seasons');
  const { capLevels } = await import('./salaryCap');
  it('moves to the next season in September with no code change', () => {
    expect(seasonYearFor('2027-08-31')).toBe(2027);
    expect(seasonYearFor('2027-09-01')).toBe(2028);
    const s = seasonsFor('2027-10-20');
    expect(s[0]).toEqual({ year: 2028, label: '2027-28', start: '2027-10-21', regularEnd: '2028-04-12', end: '2028-06-30' });
    expect(s.map((x) => x.year)).toEqual([2028, 2027, 2026, 2025]);
    expect(seasonInfo(2027).start).toBe('2026-10-20');
  });

  it('estimates the cap for a season the league has not published', () => {
    const next = capLevels(2028);
    expect(next.estimated).toBe(true);
    expect(next.cap).toBeGreaterThan(capLevels(2027).cap);
    expect(capLevels(2027).estimated).toBeUndefined();
  });
});
