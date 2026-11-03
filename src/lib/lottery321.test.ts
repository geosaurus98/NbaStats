import { describe, expect, it } from 'vitest';
import { draw321, lotteryField, lotteryFormat, lotteryOdds, seeded, type LotteryCandidate } from './lottery';

// Two 15-team conferences; key = win %, team "E1" best in the East … "E15" worst.
const teams: LotteryCandidate[] = ['E', 'W'].flatMap((c, ci) =>
  Array.from({ length: 15 }, (_, i) => ({ id: `${c}${i + 1}`, conference: c, key: 0.8 - i * 0.04 - ci * 0.01 })),
);

describe('3-2-1 lottery', () => {
  it('starts with the 2027 draft', () => {
    expect(lotteryFormat(2026)).toBe('classic');
    expect(lotteryFormat(2027)).toBe('321');
  });
  it('builds the 16-team, 37-ball field', () => {
    const { lottery, rest } = lotteryField(teams, '321');
    expect(lottery).toHaveLength(16);
    expect(rest).toHaveLength(14);
    expect(lottery.reduce((s, t) => s + t.weight, 0)).toBe(37);
    expect(lottery.filter((t) => t.relegated).map((t) => t.id).sort()).toEqual(['E15', 'W14', 'W15']);
    expect(lottery.find((t) => t.id === 'E8')?.weight).toBe(1);
    expect(lottery.find((t) => t.id === 'W10')?.weight).toBe(2);
    expect(lottery.some((t) => t.id === 'E7')).toBe(false);
    expect(lottery.find((t) => t.id === 'E11')?.weight).toBe(3);
  });
  it('matches the NBA chart', () => {
    const { lottery } = lotteryField(teams, '321');
    const odds = lotteryOdds(lottery, '321', 60_000);
    const row = (id: string) => odds[lottery.findIndex((t) => t.id === id)];
    const sum = (r: number[], n: number) => r.slice(0, n).reduce((a, b) => a + b, 0);
    expect(row('E11')[0]).toBeCloseTo(3 / 37, 2); // 8.1%
    expect(row('W15')[0]).toBeCloseTo(2 / 37, 2); // 5.4%
    expect(row('E8')[0]).toBeCloseTo(1 / 37, 2); // 2.7%
    expect(sum(row('E11'), 10)).toBeCloseTo(0.73, 1);
    expect(sum(row('E8'), 10)).toBeCloseTo(0.35, 1);
    // Relegated teams never fall below 12th.
    for (const t of lottery.filter((s) => s.relegated)) expect(sum(row(t.id), 12)).toBeCloseTo(1, 10);
  });
  it('draws every lottery pick once', () => {
    const { lottery } = lotteryField(teams, '321');
    const order = draw321(lottery, seeded(1));
    expect([...order].sort((a, b) => a - b)).toEqual(lottery.map((_, i) => i));
  });
  it('keeps the classic format for earlier drafts', () => {
    const { lottery } = lotteryField(teams, 'classic');
    expect(lottery).toHaveLength(14);
    expect(lottery[0].weight).toBe(140);
  });
});
