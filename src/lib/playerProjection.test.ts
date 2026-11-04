import { describe, expect, it } from 'vitest';
import type { SeasonSnapshot } from '../api/snapshot';
import lines2026 from '../data/lines-2026.json';
import season2026 from '../data/season-2026.json';
import type { SeasonLines } from './boxTotals';
import { allowedFactors, projectTeam } from './playerProjection';

const lines = lines2026 as unknown as SeasonLines;
const snap = season2026 as unknown as SeasonSnapshot;
const id = (abbr: string) => snap.teams.find((t) => t.abbr === abbr)!.id;
const byName = (n: string) => Object.entries(snap.players!).find(([, v]) => v === n)![0];

describe('player projections', () => {
  const factors = allowedFactors(lines);
  it('rates defences around 1', () => {
    const vals = [...factors.values()].map((f) => f.pts);
    expect(vals.length).toBe(30);
    expect(Math.min(...vals)).toBeGreaterThan(0.85);
    expect(Math.max(...vals)).toBeLessThan(1.15);
  });
  it('projects stars sensibly', () => {
    const okc = projectTeam(lines, id('OKC'), id('UTAH'), new Set(), factors);
    const sga = okc.find((p) => p.playerId === byName('Shai Gilgeous-Alexander'))!;
    expect(sga.mean.pts).toBeGreaterThan(24);
    expect(sga.p30).toBeGreaterThan(0.2);
    expect(okc.length).toBeGreaterThanOrEqual(8);
    const den = projectTeam(lines, id('DEN'), id('UTAH'), new Set(), factors);
    const jokic = den.find((p) => /Joki/.test(snap.players![p.playerId] ?? ''))!;
    expect(jokic.pTriple).toBeGreaterThan(0.15);
    expect(jokic.pDouble).toBeGreaterThan(jokic.pTriple);
    console.log(`SGA ${sga.mean.pts.toFixed(1)} p30 ${sga.p30.toFixed(2)}; Jokic ${jokic.mean.pts.toFixed(1)}/${jokic.mean.reb.toFixed(1)}/${jokic.mean.ast.toFixed(1)} DD ${jokic.pDouble.toFixed(2)} TD ${jokic.pTriple.toFixed(2)}`);
  });
  it('leaves out injured players', () => {
    const sga = byName('Shai Gilgeous-Alexander');
    expect(projectTeam(lines, id('OKC'), id('UTAH'), new Set([sga]), factors).some((p) => p.playerId === sga)).toBe(false);
  });
});
