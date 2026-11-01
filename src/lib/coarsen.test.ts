import { describe, expect, it } from 'vitest';
import { coarsenCells, type ShotCell } from './pbpStats';

const cell = (x: number, y: number, att: number, made: number, league: number, value = 2): ShotCell => ({ x, y, size: 2, value, att, made, pct: made / att, diff: made / att - league });

describe('bigger shot zones', () => {
  it('merges neighbouring bins and keeps the league comparison', () => {
    const merged = coarsenCells([cell(1, 1, 10, 5, 0.4), cell(3, 1, 30, 12, 0.5), cell(1, 3, 10, 6, 0.4), cell(5, 1, 20, 8, 0.4)], 2);
    expect(merged).toHaveLength(2);
    const big = merged.find((c) => c.att === 50)!;
    expect(big.size).toBe(4);
    expect(big.made).toBe(23);
    // Expected FG% = (10×.4 + 30×.5 + 10×.4) / 50 = .46
    expect(big.diff).toBeCloseTo(23 / 50 - 0.46, 10);
  });
  it('keeps twos and threes apart', () => {
    expect(coarsenCells([cell(1, 1, 10, 5, 0.4, 2), cell(3, 1, 10, 4, 0.35, 3)], 2)).toHaveLength(2);
  });
});
