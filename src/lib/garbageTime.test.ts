import { describe, expect, it } from 'vitest';
import type { FeedItem } from '../api/types';
import { G, GarbageAccumulator } from './garbageTime';
import { gameLineups, isGarbageTime } from './lineups';
import { QuarterAccumulator } from './quarters';

let n = 0;
const play = (period: number, t: number, home: number, away: number, text: string, ids: string[] = [], scoring = false, sub = false): FeedItem => ({ id: String(n++), period, clock: '', t, ids, sub, text, teamId: '', home, away, scoring });

describe('garbage time', () => {
  it('uses the fourth-quarter margins', () => {
    expect(isGarbageTime(3, 2000, 40)).toBe(false);
    expect(isGarbageTime(4, 2160 + 60, 24)).toBe(false); // 11 minutes left, up 24
    expect(isGarbageTime(4, 2160 + 60, -25)).toBe(true);
    expect(isGarbageTime(4, 2880 - 400, 20)).toBe(true); // 6:40 left
    expect(isGarbageTime(4, 2880 - 300, 10)).toBe(true);
    expect(isGarbageTime(5, 2950, 30)).toBe(false); // overtime is never garbage time
  });

  it('credits only what happens after the game is decided', () => {
    const homeFive = ['h1', 'h2', 'h3', 'h4', 'h5'];
    const awayFive = ['a1', 'a2', 'a3', 'a4', 'a5'];
    const bench = ['h6', 'h7', 'h8', 'h9', 'h10', 'a6', 'a7', 'a8', 'a9'];
    const teamOf = Object.fromEntries([...homeFive, ...awayFive, ...bench].map((id) => [id, id[0].toUpperCase()]));
    const sub = (inId: string, outId: string) => play(4, 2161, 2, 0, `${inId} enters the game for ${outId}`, [inId, outId], false, true);
    const feed = [
      play(1, 10, 2, 0, 'h1 makes layup', ['h1'], true),
      // Starters still on: h1 and a5 only.
      sub('h7', 'h2'), sub('h8', 'h3'), sub('h9', 'h4'), sub('h10', 'h5'), sub('a6', 'a1'), sub('a7', 'a2'), sub('a8', 'a3'), sub('a9', 'a4'),
      play(4, 2170, 98, 70, 'timeout'),
      play(4, 2200, 100, 70, 'h1 makes 3-foot layup (h7 assists)', ['h1', 'h7'], true),
      play(4, 2400, 100, 70, 'h6 enters the game for h1', ['h6', 'h1'], false, true),
      play(4, 2500, 103, 70, 'h6 makes 25-foot three point jumper', ['h6'], true),
      play(4, 2600, 103, 70, 'a1 misses jumper', ['a1']),
      play(4, 2601, 103, 70, 'h6 defensive rebound', ['h6']),
    ];
    const input = { starters: { H: homeFive, A: awayFive }, teamOf, homeId: 'H', awayId: 'A', feed };
    const r = gameLineups(input);
    const acc = new GarbageAccumulator();
    acc.add(feed, teamOf, r);
    const res = acc.result();
    const row = (id: string) => res.players.find((p) => p[0] === id)!;
    // h1's first-quarter basket isn't garbage time; the 4th-quarter one (up 28, two starters on) is.
    expect(row('h1')[G.pts]).toBe(2);
    expect(row('h7')[G.ast]).toBe(1);
    expect(row('h6')[G.tpm]).toBe(1);
    expect(row('h6')[G.reb]).toBe(1);
    expect(row('h6')[G.sec]).toBe(2880 - 2400);
    const home = res.teams.find((t) => t[0] === 'H')!;
    expect(home[1]).toBe(1);
    expect(home[2]).toBe(2880 - 2170);
  });

  it('is never garbage time with three or more starters on', () => {
    expect(isGarbageTime(4, 2700, 30, 3)).toBe(false);
    expect(isGarbageTime(4, 2700, 30, 2)).toBe(true);
  });
});

describe('QuarterAccumulator', () => {
  it('sums quarters and tracks blown leads', () => {
    const q = new QuarterAccumulator();
    q.add('X', [30, 30, 20, 15], [20, 25, 25, 40]); // up 15 at half, lost
    q.add('X', [20, 20, 30, 30, 10], [25, 25, 25, 25, 5]); // down 10 at half, won in OT
    const x = q.result().X;
    expect(x.games).toBe(2);
    expect(x.pf).toEqual([50, 50, 50, 45, 10]);
    expect(x.won).toEqual([1, 1, 1, 1]);
    expect(x.lost).toEqual([1, 1, 1, 1]);
    expect(x.leadHalf).toEqual([0, 1]);
    expect(x.trailHalf).toEqual([1, 0]);
    expect(x.ot).toBe(1);
  });
});
