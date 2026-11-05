import { describe, expect, it } from 'vitest';
import type { SeasonLines } from './boxTotals';
import { refereeTable } from './referees';

// Line: [p, home, starter, min, pts, fgm, fga, tpm, tpa, ftm, fta, oreb, dreb, ast, stl, blk, tov, pf, pm]
const line = (home: number, pts: number, fta: number, pf: number) => [0, home, 1, 30, pts, 0, 0, 0, 0, 0, fta, 0, 0, 0, 0, 0, 0, pf, 0];

describe('referees', () => {
  it('totals each official’s games', () => {
    const lines = {
      year: 2026,
      ids: ['a'],
      games: [
        ['g1', '2026-01-01', 2, 'H', 'A', 0, [line(1, 100, 20, 18), line(0, 90, 25, 22)]],
        ['g2', '2026-01-02', 2, 'H', 'A', 0, [line(1, 80, 10, 20), line(0, 95, 12, 16)]],
      ],
    } as unknown as SeasonLines;
    const { refs, league } = refereeTable(lines, { g1: ['Foster', 'Brothers'], g2: ['Foster'] }, 1);
    const foster = refs.find((r) => r.name === 'Foster')!;
    expect(foster).toMatchObject({ games: 2, fouls: 38, fta: 33.5, points: 182.5, homeWins: 1, foulGap: 0 });
    expect(refs.find((r) => r.name === 'Brothers')).toMatchObject({ games: 1, foulGap: 4 });
    expect(league.games).toBe(2);
  });
});
