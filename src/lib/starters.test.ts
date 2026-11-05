import { describe, expect, it } from 'vitest';
import type { SeasonLines } from './boxTotals';
import { fives, starterGames, stretches } from './starters';

// [p, home, starter, min, pts, ...]
const line = (p: number, home: number, starter: number, pts: number) => [p, home, starter, 30, pts, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const game = (id: string, date: string, starters: number[], us: number, them: number) => [
  id, date, 2, 'T', 'X', 0,
  [...starters.map((p, i) => line(p, 1, 1, i === 0 ? us : 0)), line(9, 1, 0, 0), line(20, 0, 1, them)],
];

describe('starters', () => {
  it('groups games with the same starting five', () => {
    const lines = {
      year: 2026,
      ids: [],
      games: [game('1', '2026-01-01', [1, 2, 3, 4, 5], 100, 90), game('2', '2026-01-03', [5, 4, 3, 2, 1], 95, 100), game('3', '2026-01-05', [1, 2, 3, 4, 6], 110, 100), game('4', '2026-01-07', [1, 2, 3, 4, 5], 100, 98)],
    } as unknown as SeasonLines;
    const g = starterGames(lines, 'T');
    expect(g.map((x) => x.margin)).toEqual([10, -5, 10, 2]);
    const s = stretches(g);
    expect(s.map((x) => x.games)).toEqual([2, 1, 1]);
    expect(s[0]).toMatchObject({ wins: 1, net: 2.5, from: '2026-01-01', to: '2026-01-03' });
    expect(s[1]).toMatchObject({ in: [6], out: [5] });
    expect(fives(g)[0]).toMatchObject({ five: [1, 2, 3, 4, 5], games: 3, wins: 2 });
  });
});
