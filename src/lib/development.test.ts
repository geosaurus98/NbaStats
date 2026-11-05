import { describe, expect, it } from 'vitest';
import type { SeasonSnapshot } from '../api/snapshot';
import s2025 from '../data/season-2025.json';
import s2026 from '../data/season-2026.json';
import { changes, fromCareer } from './development';

describe('development', () => {
  it('reads a career row', () => {
    // [season, lg, age, g, mp, pts, trb, ast, stl, blk, fg, fga, 3p, 3pa, ft, fta]
    const p = fromCareer([2026, 0, 25, 50, 1800, 1000, 300, 200, 50, 20, 380, 800, 100, 300, 140, 200])!;
    expect(p.mpg).toBe(36);
    expect(p.pts36).toBe(20);
    expect(p.threeRate).toBeCloseTo(0.375, 10);
    expect(p.ts).toBeCloseTo(1000 / (2 * (800 + 88)), 10);
    expect(fromCareer([1970, 1, 25, 50, 1800, 1000, 300, 200, -1, -1, 380, 800, -1, -1, 140, 200])).toBeUndefined();
  });
  it('finds 2025-26’s biggest jumps in minutes', () => {
    const now = (s2026 as unknown as SeasonSnapshot).box!['2'].players;
    const prev = (s2025 as unknown as SeasonSnapshot).box!['2'].players;
    const rows = changes(now, prev, 2026, 'mpg', 82);
    expect(rows.length).toBeGreaterThan(150);
    expect(rows[0].change).toBeGreaterThan(rows[rows.length - 1].change);
    expect(rows.every((r) => r.before.g >= 20 && r.now.g >= 10)).toBe(true);
  });
});
