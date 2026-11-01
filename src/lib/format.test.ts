import { describe, expect, it } from 'vitest';
import { oddsPct, ordinal, pct1, signed } from './format';

describe('format', () => {
  it('formats numbers', () => {
    expect(pct1(0.4567)).toBe('45.7%');
    expect(oddsPct(0.999)).toBe('>99%');
    expect(oddsPct(0.001)).toBe('<1%');
    expect(oddsPct(0)).toBe('0%');
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st', '111th']);
    expect(signed(2.345)).toBe('+2.3');
    expect(signed(-1)).toBe('-1.0');
    expect(signed(0)).toBe('0.0');
  });
});
