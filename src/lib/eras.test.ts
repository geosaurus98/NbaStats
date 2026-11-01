import { describe, expect, it } from 'vitest';
import careers from '../data/careers.json';
import franchises from '../data/franchises.json';
import type { CareerData } from './careers';
import { adjustedSeasons, careerAverage, eraContexts } from './eras';
import type { FranchiseData } from './franchiseData';
import teammates from '../data/teammates.json';

const data = careers as unknown as CareerData;
const eras = eraContexts(data, franchises as unknown as FranchiseData);
const idx = (name: string) => (teammates as unknown as { players: [string][] }).players.findIndex((p) => p[0] === name);

describe('era adjustment', () => {
  it('finds a faster pace in the 1960s than today', () => {
    expect(eras.get(1962)!.pace).toBeGreaterThan(115);
    expect(eras.get(2000)!.pace).toBeLessThan(96);
    expect(eras.get(2026)!.pace).toBeGreaterThan(95);
  });

  it("rescales Wilt's 1961-62 (fewer rebounds to go round) and leaves recent seasons alone", () => {
    const ref = eras.get(2026)!;
    const wilt = adjustedSeasons(data.seasons[idx('Wilt Chamberlain')], eras, ref).find((s) => s.season === 1962)!;
    expect(wilt.raw.pts).toBeGreaterThan(50);
    // Faster pace but less efficient scoring: league points per game were close to today's.
    expect(wilt.adj.pts).toBeLessThan(wilt.raw.pts);
    expect(wilt.adj.trb).toBeLessThan(wilt.raw.trb * 0.85);
    const recent = adjustedSeasons(data.seasons[idx('Nikola Jokić')] ?? data.seasons[idx('Nikola Jokic')], eras, ref);
    const last = recent[recent.length - 1];
    expect(Math.abs(last.adj.pts - last.raw.pts)).toBeLessThan(2);
    expect(careerAverage(recent).g).toBeGreaterThan(600);
  });
});
