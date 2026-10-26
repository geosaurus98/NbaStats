import { describe, expect, it } from 'vitest';
import type { FeedItem } from '../api/types';
import { gameRuns } from './runs';
import { gameWpa } from './wpa';

let n = 0;
const play = (wp: number | undefined, text: string, ids: string[], home = 0, away = 0): FeedItem => ({ id: String(n++), period: 4, clock: '', t: 0, ids, sub: false, text, teamId: '', home, away, scoring: false, wp });

describe('win probability added', () => {
  it('credits shooters, passers and defenders from their own side', () => {
    const teamOf = { h1: 'H', h2: 'H', a1: 'A' };
    const w = gameWpa(
      [
        play(0.5, 'jump ball', ['h1', 'a1']),
        play(0.62, 'h1 makes three (h2 assists)', ['h1', 'h2']),
        play(0.5, 'a1 makes layup', ['a1']),
        play(0.58, 'a1 bad pass (h1 steals)', ['a1', 'h1']),
      ],
      'H',
      teamOf,
    );
    expect(w.get('h1')).toBeCloseTo(0.08 + 0.04, 6);
    expect(w.get('h2')).toBeCloseTo(0.04, 6);
    expect(w.get('a1')).toBeCloseTo(0.12 - 0.04, 6);
  });

  it('ignores the pre-game probability on the opening play', () => {
    const w = gameWpa([play(0.83, 'h1 vs. a1 (h2 gains possession)', ['h1', 'a1', 'h2']), play(0.86, 'h2 makes three', ['h2'])], 'H', { h1: 'H', h2: 'H', a1: 'A' });
    expect(w.get('h1')).toBeUndefined();
    expect(w.get('h2')).toBeCloseTo(0.03, 6);
  });

  it('charges most of a defensive rebound to the missed shot', () => {
    const w = gameWpa([play(0.5, 'start', []), play(0.5, 'a1 misses jumper', ['a1']), play(0.6, 'h1 defensive rebound', ['h1'])], 'H', { h1: 'H', a1: 'A' });
    expect(w.get('h1')).toBeCloseTo(0.03, 6);
    expect(w.get('a1')).toBeCloseTo(-0.07, 6);
  });
});

describe('scoring runs', () => {
  it('splits the score into unanswered stretches', () => {
    const s = (home: number, away: number, period = 1) => ({ period, home, away });
    expect(gameRuns([s(2, 0), s(5, 0), s(5, 2), s(5, 4), s(5, 7, 2), s(7, 7, 2)])).toEqual([
      [true, 5, 1],
      [false, 7, 1],
      [true, 2, 2],
    ]);
  });
});
