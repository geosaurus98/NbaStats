import { describe, expect, it } from 'vitest';
import type { FeedItem } from '../api/types';
import { gameSituations } from './situations';

let n = 0;
const play = (t: number, text: string, ids: string[], home = 0, away = 0): FeedItem => ({ id: String(n++), period: 1, clock: '', t, ids, sub: false, text, teamId: '', home, away, scoring: /makes/.test(text) });

describe('shot situations', () => {
  it('times shots from when the ball changed hands', () => {
    const teamOf = { h: 'H', a: 'A' };
    const shots = gameSituations(
      [
        play(0, 'jump ball', []),
        play(18, 'h makes 20-foot jumper', ['h'], 2, 0), // 18s into the first possession
        play(22, 'a misses three point jumper', ['a'], 2, 0), // 4s after the make: transition
        play(23, 'h defensive rebound', ['h'], 2, 0),
        play(26, 'h misses layup', ['h'], 2, 0), // 3s after the rebound
        play(27, 'h offensive rebound', ['h'], 2, 0),
        play(28, 'h makes tip shot', ['h'], 4, 0), // second chance
        play(30, 'A timeout', [], 4, 0),
        play(45, 'a makes 26-foot three point jumper', ['a'], 4, 3), // after a timeout, 17s in
      ],
      'H',
      teamOf,
    );
    expect(shots.map((s) => s.tags[0])).toEqual(['mid', 'trans', 'trans', 'second', 'mid']);
    expect(shots[4].tags).toContain('ato');
    expect(shots[4].three).toBe(true);
    // Away team trailing 0-4 when it shot: behind by 4+.
    expect(shots[4].tags).toContain('behind');
  });
});
