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
