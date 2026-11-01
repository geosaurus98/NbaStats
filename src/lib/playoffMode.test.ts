import { describe, expect, it } from 'vitest';
import type { Game, TeamRef } from '../api/types';
import type { Series } from './league';
import { oddsPath, scoreBracket, seriesProb } from './playoffMode';

const team = (id: string) => ({ id, abbr: id, name: id }) as TeamRef;
const game = (id: string, home: string, away: string, hs: number, as: number, day: number): Game =>
  ({ id, date: `2026-04-${String(day).padStart(2, '0')}T23:00Z`, state: 'post', home: { team: team(home), score: hs }, away: { team: team(away), score: as } }) as unknown as Game;

describe('playoff mode', () => {
  it('works out series odds', () => {
    expect(seriesProb(1500, 1500, true)).toBeGreaterThan(0.53);
    expect(seriesProb(1500, 1500, false)).toBeCloseTo(1 - seriesProb(1500, 1500, true), 10);
    expect(seriesProb(1600, 1500, true, 3, 0)).toBeGreaterThan(0.97);
    expect(seriesProb(1500, 1500, true, 0, 3)).toBeLessThan(0.15);
    expect(seriesProb(1500, 1500, true, 4, 2)).toBe(1);
  });
  it('re-works the odds after every game', () => {
    const s: Series = { key: 'A-B', round: 1, teams: [team('A'), team('B')], wins: [1, 1], seeds: [1, 8], games: [game('1', 'A', 'B', 110, 100, 20), game('2', 'A', 'B', 95, 101, 22)] };
    const path = oddsPath(s, () => 1500);
    expect(path).toHaveLength(3);
    expect(path[1]).toBeGreaterThan(path[0]);
    expect(path[2]).toBeLessThan(path[1]);
  });
  it('scores a bracket', () => {
    const s = (key: string, round: number, winner?: string): Series => ({ key, round, teams: [team('A'), team('B')], wins: [0, 0], seeds: [1, 2], games: [], winner: winner ? team(winner) : undefined });
    expect(scoreBracket({ series: { a: 'A', b: 'B', c: 'A' }, champion: 'A' }, [s('a', 1, 'A'), s('b', 2, 'A'), s('c', 3), s('f', 4, 'A')])).toEqual({ points: 11, right: 2, decided: 3 });
  });
});
