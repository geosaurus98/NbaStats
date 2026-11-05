import { describe, expect, it } from 'vitest';
import type { SeasonLines } from './boxTotals';
import { availability, vsTeams } from './playerHistory';

// [p, home, starter, min, pts, fgm, fga, tpm, tpa, ftm, fta, oreb, dreb, ast, stl, blk, tov, pf, pm]
const line = (p: number, home: number, pts: number) => [p, home, 1, 30, pts, 5, 10, 0, 0, 0, 0, 1, 4, 3, 0, 0, 0, 0, 0];
const game = (id: string, date: string, home: string, away: string, gl: number[][]) => [id, date, 2, home, away, 0, gl];

describe('player history', () => {
  // Player 0 plays for T; T plays X, Y, X, Y, X. Player misses games 2 and 3, then is traded to X after game 4.
  const lines = {
    year: 2026,
    ids: ['me', 'opp'],
    games: [
      game('1', '2026-01-01', 'T', 'X', [line(0, 1, 20), line(1, 0, 30)]),
      game('2', '2026-01-02', 'Y', 'T', [line(1, 1, 10)]),
      game('3', '2026-01-03', 'T', 'X', [line(1, 0, 40)]),
      game('4', '2026-01-04', 'Y', 'T', [line(0, 0, 25)]),
      game('5', '2026-01-05', 'X', 'Z', [line(0, 1, 10), line(1, 0, 5)]),
      game('6', '2026-01-06', 'T', 'Z', [line(1, 1, 5)]),
    ],
  } as unknown as SeasonLines;
  it('totals games against each opponent', () => {
    const r = vsTeams([lines], 'me');
    expect(r.find((x) => x.teamId === 'X')).toMatchObject({ games: 1, wins: 0, pts: 20 });
    expect(r.find((x) => x.teamId === 'Y')).toMatchObject({ games: 1, wins: 1, pts: 25 });
    expect(r.find((x) => x.teamId === 'Z')).toMatchObject({ games: 1, wins: 1, best: { gameId: '5', pts: 10 } });
  });
  it('counts missed games per team, stopping at a trade', () => {
    const a = availability(lines, 'me');
    expect(a.find((x) => x.teamId === 'T')).toMatchObject({ teamGames: 4, played: 2, missed: 2, longest: { games: 2, from: '2026-01-02', to: '2026-01-03' } });
    expect(a.find((x) => x.teamId === 'X')).toMatchObject({ teamGames: 1, played: 1, missed: 0 });
  });
});
