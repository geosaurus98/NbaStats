import { describe, expect, it } from 'vitest';
import franchises from '../data/franchises.json';
import type { FranchiseData } from './franchiseData';
import { biggestJumps, lotteryHistory } from './lotteryHistory';

const years = lotteryHistory(franchises as unknown as FranchiseData);

describe('lottery history', () => {
  it('ranks the non-playoff teams and finds famous jumps', () => {
    const y2014 = years.find((y) => y.year === 2014)!;
    expect(y2014.order.length).toBe(14);
    const first = y2014.picks[0];
    expect(first.team).toBe('CLE');
    expect(first.rank).toBe(9);
    // Chicago won the 2008 lottery from ninth, Orlando the 1993 one from eleventh.
    const jumps = biggestJumps(years, 20).map((j) => `${j.year} ${j.team}`);
    expect(jumps).toContain('1993 ORL');
    expect(jumps).toContain('2008 CHI');
  });
});
