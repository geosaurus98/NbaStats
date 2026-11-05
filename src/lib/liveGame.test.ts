import { describe, expect, it } from 'vitest';
import type { FeedItem, TeamBox } from '../api/types';
import { currentRun, fouledOut, foulTrouble, onCourt, teamFouls } from './liveGame';

const box = (team: string, ids: string[]): TeamBox => ({
  team: { id: team, abbr: team, name: team, shortName: team } as TeamBox['team'],
  labels: [],
  totals: [],
  teamStats: [],
  players: ids.map((id, i) => ({ id, name: id, starter: i < 5, dnp: false, stats: [] })),
});
let n = 0;
const play = (p: Partial<FeedItem>): FeedItem => ({ id: String(n++), period: 1, clock: '', t: n, ids: [], sub: false, text: '', teamId: '', home: 0, away: 0, scoring: false, ...p });

describe('live game', () => {
  const teams = [box('H', ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7']), box('A', ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'])];
  it('follows substitutions and fills in unlogged changes', () => {
    const feed = [play({ ids: ['h1'] }), play({ sub: true, ids: ['h6', 'h2'] }), play({ ids: ['h3', 'h4', 'h5'] }), play({ ids: ['h7'] })];
    const court = onCourt(teams, feed);
    expect([...court.get('H')!].sort()).toEqual(['h3', 'h4', 'h5', 'h6', 'h7']);
    expect(court.get('A')).toEqual(['a1', 'a2', 'a3', 'a4', 'a5']);
  });
  it('finds the run still going', () => {
    const feed = [play({ t: 0, home: 2 }), play({ t: 30, home: 2, away: 3 }), play({ t: 60, home: 4, away: 3 }), play({ t: 90, home: 7, away: 3 }), play({ t: 120, home: 7, away: 5 }), play({ t: 150, home: 11, away: 5 })];
    expect(currentRun(feed, 'H', 'A')).toEqual({ teamId: 'H', for: 9, against: 2, seconds: 90 });
    expect(currentRun(feed.slice(0, 3), 'H', 'A')).toBeUndefined();
  });
  it('counts team fouls towards the bonus', () => {
    const feed = [play({ teamId: 'H', text: 'X personal foul' }), play({ teamId: 'H', text: 'X offensive foul' }), play({ teamId: 'A', text: 'Y shooting foul' }), play({ teamId: 'A', period: 2, text: 'Y shooting foul' })];
    expect(teamFouls(feed, 1)).toEqual(new Map([['H', 1], ['A', 1]]));
    expect(foulTrouble(2, 1)).toBe(true);
    expect(foulTrouble(3, 3)).toBe(false);
  });
  it('treats a sixth foul as fouled out, not foul trouble', () => {
    expect(fouledOut(6)).toBe(true);
    expect(fouledOut(5)).toBe(false);
    expect(foulTrouble(6, 4)).toBe(false);
    expect(foulTrouble(5, 4)).toBe(true);
    expect(foulTrouble(5, 5)).toBe(true); // overtime
  });
});
