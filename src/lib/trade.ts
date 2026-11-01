// Trade machine: does a two-team trade work under the salary-matching rules
// of the 2023 collective bargaining agreement, and what does it do to each
// team's payroll?
import type { CapLevels } from './salaryCap';

export interface TradeSide {
  /** Payroll before the trade. */
  before: number;
  /** This season's salary going out and coming in. */
  out: number;
  in: number;
}

export interface TradeVerdict {
  ok: boolean;
  after: number;
  /** Most incoming salary allowed for this outgoing salary. */
  maxIn: number;
  rule: string;
}

/**
 * Salary matching (simplified): a team under the cap after the trade can take
 * anything; above the first apron afterwards it can take back no more than it
 * sends out; otherwise the usual bands apply (200% + $250K for small outgoing
 * salary, + $7.5M in the middle, 125% + $250K at the top). Band edges grow
 * with the cap from their 2023-24 values.
 */
export function checkSide(s: TradeSide, l: CapLevels): TradeVerdict {
  const after = s.before - s.out + s.in;
  if (s.in === 0 || s.in <= s.out) return { ok: true, after, maxIn: Infinity, rule: s.in === 0 ? 'Only sending salary out' : 'Taking back no more than it sends' };
  if (after <= l.cap) return { ok: true, after, maxIn: l.cap - s.before + s.out, rule: 'Fits under the cap' };
  if (after > l.firstApron) return { ok: false, after, maxIn: s.out, rule: 'Above the first apron afterwards, so it can take back at most 100% of what it sends' };
  const grow = l.cap / 140_588_000; // 2023-24 cap
  const small = 7_500_000 * grow;
  const big = 29_000_000 * grow;
  const cushion = 250_000 * grow;
  const maxIn = s.out <= small ? 2 * s.out + cushion : s.out <= big ? s.out + small : 1.25 * s.out + cushion;
  return s.in <= maxIn
    ? { ok: true, after, maxIn, rule: 'Salaries match' }
    : { ok: false, after, maxIn, rule: 'Takes back too much salary for what it sends out' };
}
