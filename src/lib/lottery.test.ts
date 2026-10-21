import { describe, expect, it } from 'vitest';
import { seededRandom } from './games';
import { COMBOS, drawLottery, pickOdds, shareTies } from './lottery';

describe('draft lottery', () => {
  const odds = pickOdds(COMBOS);

  it('matches the NBA’s published odds', () => {
    // Worst team: 14.0% for #1, 52.1% top four, can't fall below #5.
    expect(odds[0][0]).toBeCloseTo(0.14, 3);
    expect(odds[0].slice(0, 4).reduce((a, b) => a + b, 0)).toBeCloseTo(0.521, 3);
    expect(odds[0][4]).toBeCloseTo(0.479, 3);
    expect(odds[0].slice(5).every((p) => p === 0)).toBe(true);
    // 14th team: 0.5% for #1, 2.4% top four, otherwise #14.
    expect(odds[13][0]).toBeCloseTo(0.005, 4);
    expect(odds[13][13]).toBeCloseTo(0.976, 3);
  });

  it('every team and every pick sums to one', () => {
    for (const row of odds) expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    for (let k = 0; k < 14; k++) expect(odds.reduce((a, r) => a + r[k], 0)).toBeCloseTo(1, 9);
  });

  it('splits ties', () => {
    expect(shareTies([20, 20, 22])).toEqual([140, 140, 140]);
    expect(shareTies([10, 12, 15, 15, 16])).toEqual([140, 140, 132.5, 132.5, 105]);
  });

  it('draws a valid order', () => {
    const order = drawLottery(COMBOS, seededRandom(1));
    expect([...order].sort((a, b) => a - b)).toEqual([...Array(14).keys()]);
    // Teams not drawn stay in order.
    const rest = order.slice(4);
    expect(rest).toEqual([...rest].sort((a, b) => a - b));
  });
});
