import { describe, expect, it } from 'vitest';
import type { Game, TeamRef } from '../api/types';
import { rankHistory } from './standingsHistory';

const team = (id: string): TeamRef => ({ id, name: id, shortName: id, abbr: id });
const game = (date: string, home: string, away: string, hs: number, as: number): Game => ({
  id: `${date}${home}`,
  date,
  state: 'post',
  statusDetail: 'Final',
  home: { team: team(home), homeAway: 'home', score: hs, winner: hs > as, linescores: [], leaders: [] },
  away: { team: team(away), homeAway: 'away', score: as, winner: as > hs, linescores: [], leaders: [] },
  broadcasts: [],
});

describe('rankHistory', () => {
  it('ranks each conference at the end of every week', () => {
    const games = [
      game('2026-10-21T23:30Z', 'A', 'B', 110, 100), // Wednesday: A wins
      game('2026-10-28T23:30Z', 'B', 'A', 110, 100), // next week: B wins
      game('2026-10-29T23:30Z', 'B', 'C', 110, 100),
    ];
    const h = rankHistory(games, [['A', 'B', 'C']]);
    expect(h.weeks).toEqual(['2026-10-25', '2026-10-29']);
    expect(h.ranks.get('A')).toEqual([1, 2]);
    expect(h.ranks.get('B')).toEqual([3, 1]);
    expect(h.ranks.get('C')).toEqual([2, 3]);
  });
});
