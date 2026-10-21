import { describe, expect, it } from 'vitest';
import { eraMatchup, normalCdf, seriesWinProb } from './eraMatchup';

describe('eraMatchup', () => {
  it('normal CDF', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-1)).toBeCloseTo(0.1587, 3);
  });

  it('series odds', () => {
    expect(seriesWinProb(0.5)).toBeCloseTo(0.5, 6);
    expect(seriesWinProb(1)).toBe(1);
    expect(seriesWinProb(0.6)).toBeCloseTo(0.71, 2);
    expect(seriesWinProb(0.6, 1)).toBeCloseTo(0.6, 6);
  });

  it('even teams are a coin flip; better SRS is favoured', () => {
    expect(eraMatchup(5, 5).seriesProb).toBeCloseTo(0.5, 6);
    const m = eraMatchup(11.8, 11.35); // 1995-96 Bulls vs 2016-17 Warriors
    expect(m.margin).toBeCloseTo(0.45, 2);
    expect(m.gameProb).toBeGreaterThan(0.5);
    expect(m.seriesProb).toBeGreaterThan(m.gameProb);
  });
});
