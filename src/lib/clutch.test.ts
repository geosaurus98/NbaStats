import { describe, expect, it } from 'vitest';
import type { FeedItem } from '../api/types';
import { C, ClutchAccumulator } from './clutch';

let n = 0;
const play = (period: number, clock: string, home: number, away: number, text: string, ids: string[] = [], scoring = false): FeedItem => ({
  id: String(n++),
  period,
  clock,
  t: 0,
  ids,
  sub: false,
  text,
  teamId: '',
  home,
  away,
  scoring,
});

describe('ClutchAccumulator', () => {
  it('counts only the last five minutes of close games', () => {
    const acc = new ClutchAccumulator();
    acc.add({
      homeId: 'H',
      awayId: 'A',
      teamOf: { h1: 'H', a1: 'A' },
      homeScore: 103,
      awayScore: 100,
      feed: [
        play(4, '6:30', 90, 90, 'timeout'),
        play(4, '6:00', 92, 90, 'h1 makes 20-foot jumper', ['h1'], true),
        play(4, '4:30', 95, 90, 'h1 makes 26-foot three point jumper', ['h1'], true),
        play(4, '2:00', 95, 90, 'a1 misses 3-foot layup', ['a1']),
        play(4, '1:00', 95, 92, 'a1 makes driving layup', ['a1'], true),
        play(4, '0:30', 96, 92, 'h1 makes free throw 1 of 2', ['h1'], true),
        play(4, '0:30', 96, 92, 'h1 misses free throw 2 of 2', ['h1']),
        play(4, '0:10', 103, 100, 'end of game'),
      ],
    });
    const r = acc.result();
    const h1 = r.players.find((p) => p[0] === 'h1')!;
    // The 6:00 jumper is outside the window; the three, then 1-of-2 free throws, are in it.
    expect([h1[C.pts], h1[C.fgm], h1[C.fga], h1[C.tpm], h1[C.ftm], h1[C.fta]]).toEqual([4, 1, 1, 1, 1, 2]);
    const a1 = r.players.find((p) => p[0] === 'a1')!;
    expect([a1[C.pts], a1[C.fgm], a1[C.fga]]).toEqual([2, 1, 2]);
    const home = r.teams.find((t) => t[0] === 'H')!;
    expect(home.slice(1, 4)).toEqual([1, 1, 0]);
  });

  it('ignores blowouts', () => {
    const acc = new ClutchAccumulator();
    acc.add({ homeId: 'H', awayId: 'A', teamOf: { h1: 'H' }, homeScore: 120, awayScore: 90, feed: [play(4, '5:30', 116, 90, 'timeout'), play(4, '3:00', 118, 90, 'h1 makes layup', ['h1'], true)] });
    expect(acc.result().teams).toEqual([]);
  });
});
