import { describe, expect, it } from 'vitest';
import type { FlowPoint, PlayByPlay, Shot } from '../api/types';
import { BinCounter, binIndex, gameDrama } from './pbpStats';

const pbp = (flow: Partial<FlowPoint>[]): PlayByPlay => ({
  feed: [],
  assists: [],
  shots: [],
  names: {},
  flow: flow.map((f, i) => ({ t: i * 300, period: 1, clock: '', home: 0, away: 0, ...f })),
});

describe('gameDrama', () => {
  it('measures comeback, lead changes and win-probability swing', () => {
    const flow: Partial<FlowPoint>[] = [
      { home: 0, away: 0, homeWin: 0.5 },
      { home: 0, away: 10, homeWin: 0.2 }, // home down 10
      { home: 12, away: 10, homeWin: 0.7 }, // lead change
      { home: 12, away: 14, homeWin: 0.4 }, // lead change
      ...Array.from({ length: 5 }, () => ({ home: 12, away: 14, homeWin: 0.4 })),
      { home: 16, away: 14, homeWin: 1, t: 2880, period: 4 }, // late winner
    ];
    const [id, swing, comeback, changes, late, periods] = gameDrama('g', pbp(flow))!;
    expect(id).toBe('g');
    expect(comeback).toBe(10);
    expect(changes).toBe(3);
    expect(swing).toBeCloseTo(0.3 + 0.5 + 0.3 + 0.6);
    expect(late).toBeCloseTo(0.6);
    expect(periods).toBe(4);
  });

  it('skips games without enough play-by-play', () => {
    expect(gameDrama('g', pbp([{}, {}]))).toBeUndefined();
  });
});

describe('BinCounter', () => {
  const shot = (x: number, y: number, made: boolean): Shot => ({ teamId: 't', athleteId: 'a', x, y, made, value: 2, text: '', period: 1, clock: '' });
  it('keeps 2s and 3s in the same bin apart', () => {
    const b = new BinCounter(2);
    b.add({ ...shot(48, 6, true), value: 3 });
    b.add(shot(48.5, 6.5, false));
    expect(b.rows().map((r) => r[3])).toEqual([2, 3]);
  });

  it('counts attempts and makes per court bin, ignoring heaves', () => {
    const b = new BinCounter(2);
    b.add(shot(25, 5, true));
    b.add(shot(25.5, 5.5, false));
    b.add(shot(1, 1, true));
    b.add(shot(25, 80, false)); // back court
    expect(b.attempts).toBe(3);
    expect(b.rows()).toEqual([
      [binIndex({ x: 1, y: 1 }, 2), 1, 1, 2],
      [binIndex({ x: 25, y: 5 }, 2), 2, 1, 2],
    ]);
  });
});
