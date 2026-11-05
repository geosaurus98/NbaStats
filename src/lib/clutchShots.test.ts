import { describe, expect, it } from 'vitest';
import type { FeedItem } from '../api/types';
import { gameClutchShots, shooterTable } from './clutchShots';

const play = (period: number, clock: string, text: string, ids: string[], home: number, away: number): FeedItem =>
  ({ id: '', period, clock, t: 0, ids, sub: false, text, teamId: '', home, away, scoring: false }) as FeedItem;

describe('clutch shots', () => {
  it('logs shots in the last minute that would tie or take the lead', () => {
    const teamOf = { h1: 'H', a1: 'A' };
    const feed = [
      play(4, '1:30', 'h1 makes 2-foot layup', ['h1'], 98, 100), // too early
      play(4, '0:50', 'h1 misses 25-foot three point jumper', ['h1'], 98, 100), // down 2, a three would lead: logged
      play(4, '0:30', 'a1 makes 10-foot jumper', ['a1'], 98, 102), // ahead: not logged
      play(4, '0:10', 'h1 makes 26-foot three point jumper', ['h1'], 101, 102), // down 4: a three can't tie: not logged
      play(4, '0:05', 'h1 makes free throw 1 of 1', ['h1'], 102, 102),
      play(4, '0:01.5', 'a1 makes 18-foot jumper', ['a1'], 102, 104), // tied: go-ahead
    ];
    const shots = gameClutchShots('g', feed, 'H', teamOf, false);
    expect(shots).toEqual([
      ['g', 4, 50, 'h1', 'H', 0, 3, 2, 0],
      ['g', 4, 1.5, 'a1', 'A', 1, 2, 0, 1],
    ]);
    const t = shooterTable(shots);
    expect(t[0]).toMatchObject({ playerId: 'a1', made: 1, attempts: 1, leads: 1, ties: 0, wonAfter: 1 });
  });
});
