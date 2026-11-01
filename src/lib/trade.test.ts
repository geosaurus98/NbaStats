import { describe, expect, it } from 'vitest';
import { CAP_LEVELS } from './salaryCap';
import { checkSide } from './trade';

const l = CAP_LEVELS[2027];
const M = 1e6;

describe('trade machine', () => {
  it('lets a team under the cap absorb salary', () => {
    expect(checkSide({ before: 120 * M, out: 0, in: 30 * M }, l)).toMatchObject({ ok: true, rule: 'Fits under the cap' });
  });
  it('applies the matching bands over the cap', () => {
    expect(checkSide({ before: 180 * M, out: 5 * M, in: 10 * M }, l).ok).toBe(true);
    expect(checkSide({ before: 180 * M, out: 5 * M, in: 12 * M }, l).ok).toBe(false);
    expect(checkSide({ before: 180 * M, out: 20 * M, in: 28 * M }, l).ok).toBe(true);
    expect(checkSide({ before: 170 * M, out: 40 * M, in: 50 * M }, l).ok).toBe(true);
  });
  it('holds apron teams to 100%', () => {
    const v = checkSide({ before: 215 * M, out: 20 * M, in: 21 * M }, l);
    expect(v.ok).toBe(false);
    expect(v.maxIn).toBe(20 * M);
    expect(checkSide({ before: 215 * M, out: 20 * M, in: 19 * M }, l).ok).toBe(true);
  });
});
