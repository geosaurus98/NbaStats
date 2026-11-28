import { describe, expect, it } from 'vitest';
import careers from '../data/careers.json';
import teammates from '../data/teammates.json';
import type { CareerData } from './careers';
import { seededRandom } from './games';
import { card, deck, playSeason, rate, type Card, type Slot } from './perfectSeason';
import { buildGraph, findPlayer, type TeammateData } from './teammates';
import { franchiseOf } from './franchises';

const fr = (code: string) => franchiseOf(code)?.id;

const graph = buildGraph(teammates as unknown as TeammateData);
const data = careers as unknown as CareerData;
const pick = (name: string, season: number) => {
  const p = findPlayer(graph.data, name)!;
  return card(data.seasons[p], p, season, '', data.pos?.[p] ?? '')!;
};

describe('perfect season', () => {
  it('rolls a franchise and an era, each player once at their best season there', () => {
    const d = deck(graph, data, 2001, fr);
    // 30 franchises × the 2000s, 2010s and 2020s.
    expect(d.length).toBe(90);
    expect(d.every((x) => x.decade >= 2000 && x.cards.length >= 5)).toBe(true);
    const bulls90s = deck(graph, data, 1974, fr).find((x) => x.franchise === 'CHI' && x.decade === 1990)!;
    const jordan = bulls90s.cards.filter((c) => c.player === findPlayer(graph.data, 'Michael Jordan'));
    expect(jordan).toHaveLength(1);
    expect(jordan[0].season).toBeGreaterThanOrEqual(1991);
    expect(jordan[0].season).toBeLessThanOrEqual(2000);
    expect(bulls90s.cards[0].player).toBe(findPlayer(graph.data, 'Michael Jordan'));
  });
  it('rates an all-time five far above a random one, and can go 82-0 only rarely', () => {
    const greats: Record<Slot, Card> = { PG: pick('Stephen Curry', 2016), SG: pick('Michael Jordan', 1996), SF: pick('LeBron James', 2013), PF: pick('Giannis Antetokounmpo', 2020), C: pick('Nikola Jokić', 2024) };
    const r = rate(greats);
    const d = deck(graph, data, 1974, fr);
    const rand = seededRandom(5);
    const randoms = Array.from({ length: 200 }, () => {
      const team: Partial<Record<Slot, Card>> = {};
      for (const s of ['PG', 'SG', 'SF', 'PF', 'C'] as Slot[]) {
        const deal = d[Math.floor(rand() * d.length)];
        team[s] = deal.cards[Math.floor(rand() * deal.cards.length)];
      }
      return playSeason(rate(team).net, seededRandom(Math.floor(rand() * 1e6))).wins;
    });
    const avg = randoms.reduce((a, b) => a + b, 0) / randoms.length;
    const best = Array.from({ length: 100 }, (_, i) => playSeason(r.net, seededRandom(i)));
    const perfect = best.filter((s) => s.wins === 82).length;
    console.log({ net: r.net.toFixed(1), parts: r.parts.map((p) => `${p.label} ${p.value.toFixed(1)}`), randomAvg: avg.toFixed(1), bestAvg: (best.reduce((a, s) => a + s.wins, 0) / 100).toFixed(1), perfect });
    expect(avg).toBeGreaterThan(25);
    expect(avg).toBeLessThan(55);
    expect(perfect).toBeGreaterThan(0);
    expect(perfect).toBeLessThan(100);
  });
});
