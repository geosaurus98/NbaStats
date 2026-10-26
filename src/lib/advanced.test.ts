import { describe, expect, it } from 'vitest';
import type { SeasonSnapshot } from '../api/snapshot';
import lines2026 from '../data/lines-2026.json';
import season2026 from '../data/season-2026.json';
import { factorEdges, factorSpread, fourFactors, playerAdvanced, pythagWins, teamGames, teamSeasons } from './advanced';
import type { SeasonLines } from './boxTotals';

const snap = season2026 as unknown as SeasonSnapshot;
const games = teamGames(lines2026 as unknown as SeasonLines);
const seasons = teamSeasons(games);

describe('advanced stats on the 2025-26 season', () => {
  it('builds both sides of every game', () => {
    expect(seasons.size).toBe(30);
    const wins = [...seasons.values()].reduce((s, t) => s + t.wins, 0);
    expect(wins).toBe(games.length / 2);
    const lg = [...seasons.values()].map((t) => fourFactors(t.own, t.opp));
    const avg = (k: 'efg' | 'tov' | 'orb' | 'ftr') => lg.reduce((s, f) => s + f[k], 0) / lg.length;
    expect(avg('efg')).toBeGreaterThan(0.5);
    expect(avg('efg')).toBeLessThan(0.6);
    expect(avg('tov')).toBeGreaterThan(0.1);
    expect(avg('tov')).toBeLessThan(0.16);
    expect(avg('orb')).toBeGreaterThan(0.2);
    expect(avg('orb')).toBeLessThan(0.35);
  });

  it('gives a game-deciding factor to the winner overall', () => {
    const spread = factorSpread(games);
    let agree = 0;
    for (const g of games) {
      const e = factorEdges(g.own, g.opp, spread);
      if (e.efg + e.tov + e.orb + e.ftr > 0 === g.own.pts > g.opp.pts) agree++;
    }
    expect(agree / games.length).toBeGreaterThan(0.85);
  });

  it('expects about as many wins as were played', () => {
    const exp = [...seasons.values()].reduce((s, t) => s + pythagWins(t.own.pts, t.opp.pts, t.wins + t.losses), 0);
    expect(Math.abs(exp - games.length / 2)).toBeLessThan(15);
  });

  it('puts PER at 15 on average and Win Shares near the wins total', () => {
    const adv = playerAdvanced(snap.box!['2'], seasons);
    const minutes = adv.reduce((s, p) => s + p.min, 0);
    expect(adv.reduce((s, p) => s + p.per * p.min, 0) / minutes).toBeCloseTo(15, 5);
    const ws = adv.reduce((s, p) => s + p.ws, 0);
    expect(ws).toBeGreaterThan(1050);
    expect(ws).toBeLessThan(1400);
    const top = [...adv].sort((a, b) => b.ws - a.ws).slice(0, 5).map((p) => snap.players?.[p.id]);
    expect(top.some((n) => /Jokic|Gilgeous/.test(n ?? ''))).toBe(true);
  });
});
