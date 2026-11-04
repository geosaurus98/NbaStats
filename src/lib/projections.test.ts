import { describe, expect, it } from 'vitest';

import { eloForWins } from './projections';
describe('Elo for wins', () => {
  it('turns wins into rating points', () => {
    expect(eloForWins(0, 10)).toBe(0);
    expect(eloForWins(5, 50)).toBeCloseTo(69.5, 0);
    expect(eloForWins(-40, 40)).toBe(-250);
    expect(eloForWins(3, 0)).toBe(0);
  });
});
