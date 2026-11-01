import { describe, expect, it } from 'vitest';
import lines2026 from '../data/lines-2026.json';
import type { SeasonLines } from './boxTotals';
import { fantasyPoints, fantasyTable, fantasyWeeks, gamesInWeek } from './fantasy';

describe('fantasy', () => {
  it('scores a line in each format', () => {
    // [p, home, starter, min, pts, fgm, fga, tpm, tpa, ftm, fta, oreb, dreb, ast, stl, blk, tov, pf, pm]
    const l = [0, 1, 1, 36, 30, 11, 20, 3, 7, 5, 6, 2, 8, 10, 2, 1, 3, 2, 10];
    expect(fantasyPoints(l, 'yahoo')).toBeCloseTo(30 + 12 + 15 + 6 + 3 - 3, 6);
    // ESPN: 30 + 3 - 20 + 22 - 6 + 5 + 10 + 20 + 8 + 4 - 6
    expect(fantasyPoints(l, 'espn')).toBe(70);
    // DraftKings with a triple-double bonus (30 pts, 10 reb, 10 ast).
    expect(fantasyPoints(l, 'dk')).toBeCloseTo(30 + 1.5 + 12.5 + 15 + 4 + 2 - 1.5 + 1.5 + 3, 6);
  });

  it('ranks the 2025-26 season with stars on top', () => {
    const rows = fantasyTable(lines2026 as unknown as SeasonLines, 'espn');
    const top = [...rows].filter((r) => r.games >= 40).sort((a, b) => b.fppg - a.fppg).slice(0, 5);
    expect(top[0].fppg).toBeGreaterThan(45);
    const nine = [...rows].sort((a, b) => b.nineCat - a.nineCat)[0];
    expect(nine.nineCat).toBeGreaterThan(8);
  });

  it('counts games in a Monday-Sunday week', () => {
    expect(fantasyWeeks('2026-11-05')).toEqual([['2026-11-02', '2026-11-08'], ['2026-11-09', '2026-11-15']]);
    const g = gamesInWeek([['1', '2026-11-03T00:00Z', 'A', 'B', null, null, null, null], ['2', '2026-11-04T00:00Z', 'A', 'C', null, null, null, null], ['3', '2026-11-20T00:00Z', 'A', 'B', null, null, null, null]], '2026-11-02', '2026-11-08');
    expect(g.get('A')).toEqual({ games: 2, b2b: 1, days: ['2026-11-02', '2026-11-03'] });
  });
});
