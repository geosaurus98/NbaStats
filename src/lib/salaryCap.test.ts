import { describe, expect, it } from 'vitest';
import { CAP_LEVELS, capZone, money, nextLevel } from './salaryCap';

describe('salary cap', () => {
  const l = CAP_LEVELS[2027];
  it('places payrolls in the right zone', () => {
    expect(capZone(140e6, l)).toBe('below-minimum');
    expect(capZone(160e6, l)).toBe('under-cap');
    expect(capZone(180e6, l)).toBe('over-cap');
    expect(capZone(205e6, l)).toBe('taxpayer');
    expect(capZone(215e6, l)).toBe('first-apron');
    expect(capZone(230e6, l)).toBe('second-apron');
  });
  it('levels rise together year to year (the CBA ties them to the cap)', () => {
    const a = CAP_LEVELS[2026];
    const r = l.cap / a.cap;
    for (const k of ['tax', 'firstApron', 'secondApron'] as const) expect(l[k] / a[k]).toBeCloseTo(r, 3);
  });
  it('formats and finds the next line', () => {
    expect(money(52_627_153)).toBe('$52.6M');
    expect(money(28_000)).toBe('$28K');
    expect(nextLevel(205e6, l)).toEqual({ label: '1st apron', gap: 4_015_000 });
    expect(nextLevel(230e6, l)).toBeUndefined();
  });
});
