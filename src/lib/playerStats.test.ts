import { describe, expect, it } from 'vitest';
import type { GameLogEntry } from '../api/types';
import { averages, isTripleDouble, seasonHighs } from './playerStats';

const g = (id: string, stats: Record<string, string>): GameLogEntry => ({
  gameId: id,
  date: `2026-01-0${id}`,
  opponent: { id: 'x', name: 'X', shortName: 'X', abbr: 'X' },
  atVs: 'vs',
  result: 'W',
  score: '1-0',
  seasonType: 'regular',
  stats,
});

const games = [
  g('1', { PTS: '30', REB: '10', AST: '10', FG: '10-20', '3PT': '4-8', FT: '6-6', MIN: '36' }),
  g('2', { PTS: '20', REB: '4', AST: '6', FG: '8-20', '3PT': '2-8', FT: '2-4', MIN: '34' }),
];

describe('playerStats', () => {
  it('averages counting stats and pools shooting', () => {
    const a = averages(games);
    expect(a).toMatchObject({ gp: 2, pts: 25, reb: 7, ast: 8, min: 35 });
    expect(a.fgPct).toBeCloseTo(18 / 40);
    expect(a.threePct).toBeCloseTo(6 / 16);
    expect(a.ftPct).toBeCloseTo(8 / 10);
  });

  it('detects triple-doubles', () => {
    expect(isTripleDouble(games[0])).toBe(true);
    expect(isTripleDouble(games[1])).toBe(false);
  });

  it('ranks single-game highs across players', () => {
    const highs = seasonHighs([
      { athleteId: 'a', athlete: 'A', team: 'T', games },
      { athleteId: 'b', athlete: 'B', team: 'U', games: [g('3', { PTS: '50', '3PT': '9-12' })] },
    ]);
    expect(highs.byCategory.PTS.map((h) => h.value)).toEqual([50, 30, 20]);
    expect(highs.byCategory['3PM'][0]).toMatchObject({ athlete: 'B', value: 9 });
    expect(highs.tripleDoubles).toEqual([{ athleteId: 'a', athlete: 'A', team: 'T', count: 1 }]);
  });
});
