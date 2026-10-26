import { describe, expect, it } from 'vitest';
import type { SeasonSnapshot } from '../api/snapshot';
import franchises from '../data/franchises.json';
import lines2026 from '../data/lines-2026.json';
import season2026 from '../data/season-2026.json';
import { teamGames, teamSeasons } from './advanced';
import type { SeasonLines } from './boxTotals';
import type { FranchiseData } from './franchiseData';
import { championDna, closestChampions, currentDna, restAndTravel, srs, withWithout } from './teamExtras';

const snap = season2026 as unknown as SeasonSnapshot;
const lines = lines2026 as unknown as SeasonLines;
const games = teamGames(lines);
const abbr = new Map(snap.teams.map((t) => [t.id, t.abbr]));
const id = (a: string) => snap.teams.find((t) => t.abbr === a)!.id;

describe('team extras on 2025-26', () => {
  it('rates teams with SRS centred on zero', () => {
    const r = srs(games);
    expect(r.size).toBe(30);
    expect([...r.values()].reduce((s, v) => s + v.srs, 0)).toBeCloseTo(0, 6);
    const okc = r.get(id('OKC'))!;
    expect(okc.srs).toBeGreaterThan(8);
    expect(okc.srs - okc.mov - okc.sos).toBeCloseTo(0, 6);
  });

  it('counts back-to-backs and miles for every team', () => {
    const t = restAndTravel(games, abbr);
    expect(t.length).toBe(30);
    for (const x of t) {
      const b2b = x.byRest[0].w + x.byRest[0].l;
      expect(b2b).toBeGreaterThan(8);
      expect(b2b).toBeLessThan(22);
      expect(x.miles).toBeGreaterThan(25000);
      expect(x.miles).toBeLessThan(75000);
    }
  });

  it('splits a team record by who played', () => {
    const ww = withWithout(lines, id('OKC'));
    expect(ww.length).toBeGreaterThan(8);
    for (const p of ww) expect(p.played.w + p.played.l).toBeGreaterThanOrEqual(5);
  });

  it('finds title teams that look alike', () => {
    const champs = championDna(franchises as unknown as FranchiseData);
    expect(champs.length).toBeGreaterThan(35);
    const okc2025 = champs.find((c) => c.season === 2025)!;
    // A champion is closest to itself.
    expect(closestChampions(okc2025.dna, champs, 1)[0].season).toBe(2025);
    const now = currentDna(teamSeasons(games)).get(id('OKC'))!;
    expect(closestChampions(now, champs, 3).length).toBe(3);
  });
});
