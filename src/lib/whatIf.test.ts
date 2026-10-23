import { describe, expect, it } from 'vitest';
import type { Game, TeamRef } from '../api/types';
import { applyPicks, whatIfStandings } from './whatIf';

const team = (id: string): TeamRef => ({ id, name: id, shortName: id, abbr: id });
const game = (id: string, home: string, away: string, hs?: number, as?: number): Game => ({
  id,
  date: '2026-11-01T23:00Z',
  state: hs == null ? 'pre' : 'post',
  statusDetail: '',
  home: { team: team(home), homeAway: 'home', score: hs, winner: hs != null ? hs > as! : undefined, linescores: [], leaders: [] },
  away: { team: team(away), homeAway: 'away', score: as, winner: hs != null ? as! > hs : undefined, linescores: [], leaders: [] },
  broadcasts: [],
});

describe('what if', () => {
  const teams = ['A', 'B', 'C'].map(team);
  const games = [game('1', 'A', 'B', 100, 90), game('2', 'B', 'C'), game('3', 'C', 'A'), game('4', 'A', 'B')];
  const conf = new Map([['A', 'East'], ['B', 'East'], ['C', 'East']]);

  it('turns picks into results and ignores finished games', () => {
    const out = applyPicks(games, { 1: 'B', 2: 'C', 3: 'nobody' });
    expect(out[0].home.score).toBe(100); // already final: unchanged
    expect([out[1].state, out[1].away.winner]).toEqual(['post', true]);
    expect(out[2].state).toBe('pre'); // invalid pick
  });

  it('re-ranks the conference', () => {
    const before = whatIfStandings(teams, games, {}, conf).get('East')!.map((s) => s.record.team.id);
    expect(before[0]).toBe('A');
    const after = whatIfStandings(teams, games, { 2: 'C', 3: 'C', 4: 'B' }, conf).get('East')!;
    expect(after[0].record.team.id).toBe('C'); // 2-0
    expect(after.find((s) => s.record.team.id === 'A')!.record.wins).toBe(1);
  });
});
