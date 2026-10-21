import { describe, expect, it } from 'vitest';
import type { SeasonSnapshot } from '../api/snapshot';
import lines2026 from '../data/lines-2026.json';
import season2026 from '../data/season-2026.json';
import { P, type SeasonLines } from './boxTotals';
import { form, nightlyBest, totalsBefore, usDay } from './gameLines';

const lines = lines2026 as unknown as SeasonLines;
const snap = season2026 as unknown as SeasonSnapshot;

describe('game lines', () => {
  it('season totals from lines match the snapshot box totals', () => {
    const ours = totalsBefore(lines, '9999');
    const theirs = snap.box!['2'];
    expect(ours.players.length).toBe(theirs.players.length);
    const sga = (rows: typeof ours.players) => rows.find((r) => r[0] === '4278073')!;
    for (const k of ['gp', 'pts', 'ast', 'fga', 'tpm'] as const) expect(sga(ours.players)[P[k]]).toBe(sga(theirs.players)[P[k]]);
    expect(ours.teams.map((t) => t[1]).every((g) => g === 82)).toBe(true);
  });

  it('dates games on the US evening they were played', () => {
    expect(usDay('2025-10-22T02:00Z')).toBe('2025-10-21');
    expect(usDay('2025-10-21T23:30Z')).toBe('2025-10-21');
  });

  it("picks each night's best lines", () => {
    const nights = nightlyBest(lines);
    expect(nights[0].day > nights[nights.length - 1].day).toBe(true);
    for (const n of nights.slice(0, 20)) {
      expect(n.best.length).toBeGreaterThan(0);
      expect(n.best[0].gmsc).toBeGreaterThanOrEqual(n.best[n.best.length - 1].gmsc);
    }
  });

  it('compares recent form with the season', () => {
    const f = form(lines);
    expect(f.length).toBeGreaterThan(100);
    expect(f.every((s) => s.games >= 20 && s.season.min >= 20)).toBe(true);
  });
});
