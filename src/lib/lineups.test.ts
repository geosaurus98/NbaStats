import { describe, expect, it } from 'vitest';
import type { FeedItem } from '../api/types';
import { gameLineups, LineupAccumulator, type GameInput } from './lineups';

const H = ['h1', 'h2', 'h3', 'h4', 'h5'];
const A = ['a1', 'a2', 'a3', 'a4', 'a5'];
const teamOf: Record<string, string> = Object.fromEntries([...H, 'h6'].map((id) => [id, 'H']).concat([...A, 'a6'].map((id) => [id, 'A'])));
let n = 0;
const play = (period: number, t: number, home: number, away: number, ids: string[] = [], sub = false): FeedItem => ({
  id: String(++n),
  period,
  clock: '',
  t,
  ids,
  sub,
  text: '',
  teamId: '',
  home,
  away,
  scoring: false,
});

describe('gameLineups', () => {
  // Q1: starters play 0-360s, home scores 10, away 4; h6 replaces h5 at 360s; then 0 more points to 720.
  // Q2 (unrecorded change): h5 is back instead of h6 — he appears in a play before any sub.
  const feed = [
    play(1, 100, 6, 2, ['h1']),
    play(1, 360, 10, 4, ['h6', 'h5'], true),
    play(2, 800, 12, 4, ['h5', 'h1']),
  ];
  const input: GameInput = { starters: { H, A }, teamOf, homeId: 'H', awayId: 'A', feed };
  const r = gameLineups(input);

  it('credits time and points to the five on court', () => {
    const starters = r.lineups.H[[...H].sort().join(',')];
    // 0-360 (Q1 starters) + Q2 from 720 to 1440 (inferred: h5 back) = 360 + 720
    expect(starters.sec).toBe(1080);
    expect(starters.pf).toBe(12);
    expect(starters.pa).toBe(4);
    const withH6 = r.lineups.H[['h1', 'h2', 'h3', 'h4', 'h6'].sort().join(',')];
    expect(withH6).toMatchObject({ sec: 360, pf: 0, pa: 0 });
  });

  it('tracks per-player time and team totals', () => {
    expect(r.on.h6.sec).toBe(360);
    expect(r.on.h5.sec).toBe(1080);
    expect(r.team.H).toMatchObject({ sec: 1440, pf: 12, pa: 4 });
    expect(r.on.a1).toMatchObject({ sec: 1440, pf: 4, pa: 12 });
  });

  it('accumulates a season with on/off rows', () => {
    const acc = new LineupAccumulator();
    acc.add(input, r);
    acc.add(input, r);
    const h = acc.result().H;
    expect(h.lineups[0][1]).toBe(2160);
    const h6 = h.onOff.find((x) => x[0] === 'h6')!;
    expect(h6).toEqual(['h6', 720, 0, 0, 2880, 24, 8]);
  });
});
