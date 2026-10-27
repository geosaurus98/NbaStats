import { describe, expect, it } from 'vitest';
import type { Shot } from '../api/types';
import { HotHandAccumulator, hotHandRow } from './hotHand';

const shot = (made: boolean, text = 'p1 makes 15-foot jumper', id = 'p1'): Shot => ({ teamId: 'T', athleteId: id, x: 25, y: 20, made, value: /three/.test(text) ? 3 : 2, text, period: 1, clock: '' });

describe('hot hand', () => {
  it('sorts each shot by the result of the one before it, game by game', () => {
    const acc = new HotHandAccumulator();
    // make, make, miss, make  → after make: 2 shots (1 made), after miss: 1 (made), after two makes: 1 (missed)
    acc.add([shot(true), shot(true), shot(false), shot(true)]);
    // A new game starts fresh: its first shot follows nothing.
    acc.add([shot(false)]);
    const p = acc.result(1).players.p1;
    const make = hotHandRow(p, 'make');
    const miss = hotHandRow(p, 'miss');
    const make2 = hotHandRow(p, 'make2');
    expect([make.att, make.pct]).toEqual([2, 0.5]);
    expect([miss.att, miss.pct]).toEqual([1, 1]);
    expect([make2.att, make2.pct]).toEqual([1, 0]);
  });

  it('expects lower FG% when the shot diet gets tougher', () => {
    const acc = new HotHandAccumulator();
    // After makes this player only takes threes (made 1 of 3); after misses, layups.
    acc.add([shot(true, 'p1 makes layup'), shot(false, 'p1 misses 26-foot three point jumper'), shot(true, 'p1 makes layup'), shot(true, 'p1 makes 26-foot three point jumper'), shot(false, 'p1 misses 26-foot three point jumper')]);
    const p = acc.result(1).players.p1;
    const make = hotHandRow(p, 'make');
    expect(make.threeShare).toBe(1);
    expect(make.expected).toBeCloseTo(1 / 3, 6);
  });
});
