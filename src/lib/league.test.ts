import { describe, expect, it } from 'vitest';
import type { Game, TeamRef } from '../api/types';
import { addStrengthOfSchedule, buildBracket, raceSeries, teamRecords } from './league';

const team = (id: string): TeamRef => ({ id, name: `Team ${id}`, shortName: id, abbr: id });

let seq = 0;
function game(home: string, away: string, hs?: number, as?: number, note?: string): Game {
  seq++;
  const final = hs != null && as != null;
  const side = (id: string, homeAway: 'home' | 'away', score?: number, other?: number) => ({
    team: team(id),
    homeAway,
    score,
    winner: final ? score! > other! : undefined,
    linescores: [],
    leaders: [],
  });
  return {
    id: String(seq),
    date: `2026-01-${String(seq).padStart(2, '0')}T00:00Z`,
    state: final ? 'post' : 'pre',
    statusDetail: '',
    home: side(home, 'home', hs, as),
    away: side(away, 'away', as, hs),
    broadcasts: [],
    note,
  };
}

describe('teamRecords', () => {
  it('counts wins, splits, close games and streaks', () => {
    const games = [game('A', 'B', 100, 90), game('B', 'A', 101, 99), game('A', 'B', 110, 108), game('A', 'B', 120, 100), game('B', 'A')];
    const [a, b] = teamRecords([team('A'), team('B')], games);
    expect(a).toMatchObject({ gp: 4, wins: 3, losses: 1, homeW: 3, roadL: 1, closeW: 1, closeL: 1, longestWin: 2, remaining: 1 });
    expect(a.pf).toBe(100 + 99 + 110 + 120);
    expect(b).toMatchObject({ wins: 1, losses: 3, last10: '1-3' });
  });
});

describe('countsInStandings', () => {
  it('leaves the NBA Cup Championship out of records', () => {
    const games = [game('A', 'B', 100, 90), game('A', 'B', 100, 90, 'NBA Cup Championship'), game('B', 'A', 100, 90, 'NBA Cup - Semifinals')];
    const [a] = teamRecords([team('A')], games);
    expect(a).toMatchObject({ wins: 1, losses: 1, gp: 2 });
    expect(raceSeries(games, 'A')).toEqual([1, 0]);
  });
});

describe('addStrengthOfSchedule', () => {
  it('averages opponent win % over played and remaining games', () => {
    const games = [game('A', 'B', 100, 90), game('C', 'A', 100, 90), game('B', 'C', 100, 90), game('A', 'C')];
    const recs = addStrengthOfSchedule(teamRecords([team('A'), team('B'), team('C')], games), games);
    const a = recs.find((r) => r.team.id === 'A')!;
    // B is 1-1 (.5), C is 1-1 (.5)
    expect(a.sosPlayed).toBeCloseTo(0.5);
    expect(a.sosRemaining).toBeCloseTo(0.5);
  });
});

describe('raceSeries', () => {
  it('tracks games above .500', () => {
    const games = [game('A', 'B', 1, 0), game('A', 'B', 1, 0), game('A', 'B', 0, 1)];
    expect(raceSeries(games, 'A')).toEqual([1, 2, 1]);
    expect(raceSeries(games, 'B')).toEqual([-1, -2, -1]);
  });
});

describe('buildBracket', () => {
  it('infers rounds, winners and the Finals; skips play-in', () => {
    const conf = new Map([
      ['E1', 'East'],
      ['E8', 'East'],
      ['E4', 'East'],
      ['E5', 'East'],
      ['W1', 'West'],
      ['W8', 'West'],
    ]);
    const seeds = new Map([
      ['E1', 1],
      ['E8', 8],
      ['E4', 4],
      ['E5', 5],
      ['W1', 1],
      ['W8', 8],
    ]);
    const sweep = (h: string, a: string) => [1, 2, 3, 4].map(() => game(h, a, 110, 100));
    const games = [
      game('E8', 'E9', 100, 90, 'East Play-In'),
      ...sweep('E1', 'E8'),
      ...sweep('E5', 'E4'),
      ...sweep('W1', 'W8'),
      ...sweep('E1', 'E5'),
      ...sweep('W1', 'E1'),
    ];
    const series = buildBracket(games, seeds, conf);
    expect(series).toHaveLength(5);
    const r1 = series.filter((s) => s.round === 1 && s.conference === 'East');
    expect(r1.map((s) => s.winner?.id)).toEqual(['E1', 'E5']);
    const semi = series.find((s) => s.round === 2)!;
    expect(semi.teams.map((t) => t.id).sort()).toEqual(['E1', 'E5']);
    const finals = series.find((s) => s.round === 4)!;
    expect(finals.winner?.id).toBe('W1');
  });
});

import { mergeResults } from './league';

describe('mergeResults', () => {
  it('takes newer scores for known games and ignores unknown ones', () => {
    const team = (id: string) => ({ id, name: id, shortName: id, abbr: id });
    const g = (id: string, hs?: number, as?: number, note?: string) => ({
      id,
      date: '2026-10-22T23:00Z',
      state: (hs == null ? 'pre' : 'post') as 'pre' | 'post',
      statusDetail: '',
      note,
      home: { team: team('A'), homeAway: 'home' as const, score: hs, winner: hs != null ? hs > as! : undefined, linescores: [], leaders: [] },
      away: { team: team('B'), homeAway: 'away' as const, score: as, winner: hs != null ? as! > hs : undefined, linescores: [], leaders: [] },
      broadcasts: [],
    });
    const merged = mergeResults([g('1', undefined, undefined, 'Emirates NBA Cup'), g('2', 100, 90)], [g('1', 110, 105), g('99', 1, 0)]);
    expect(merged).toHaveLength(2);
    expect([merged[0].state, merged[0].home.score, merged[0].note]).toEqual(['post', 110, 'Emirates NBA Cup']);
    expect(merged[1].home.score).toBe(100);
  });
});
