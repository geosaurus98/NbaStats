import { describe, expect, it } from 'vitest';
import careers from '../data/careers.json';
import teammates from '../data/teammates.json';
import type { BoxTotals } from './boxTotals';
import type { CareerData } from './careers';
import { milestones } from './milestones';
import { buildGraph, type TeammateData } from './teammates';

describe('milestones', () => {
  const graph = buildGraph(teammates as unknown as TeammateData);
  const lebronEspn = Object.entries(graph.data.espn ?? {}).find(([, p]) => graph.data.players[p][0] === 'LeBron James')?.[0] ?? '1966';
  const lebron = graph.data.players.findIndex((p) => p[0] === 'LeBron James');
  // A one-game season for LeBron: 25 points, 8 rebounds, 7 assists.
  const box: BoxTotals = { players: [[lebronEspn, '20', 1, 1, 35, 25, 10, 20, 2, 6, 3, 4, 1, 7, 7, 1, 1, 3, 2, 5]], teams: [] };
  const graphWithLink = { ...graph, data: { ...graph.data, espn: { ...graph.data.espn, [lebronEspn]: lebron } } };
  const ms = milestones(careers as unknown as CareerData, graphWithLink, box, 200);

  it('adds this season to the career total', () => {
    const pts = ms.find((m) => m.stat === 'pts')!;
    const career = (careers as unknown as CareerData).seasons[lebron].reduce((a, r) => a + r[5], 0);
    expect(pts.total).toBe(career + 25);
    expect(pts.target).toBeGreaterThan(pts.total);
  });

  it('is sorted soonest first and only looks ahead', () => {
    expect(ms.length).toBeGreaterThan(0);
    expect(ms.map((m) => m.gamesAway)).toEqual([...ms.map((m) => m.gamesAway)].sort((a, b) => a - b));
    expect(ms.every((m) => m.remaining > 0 && m.gamesAway >= 1)).toBe(true);
  });
});
