import { describe, expect, it } from 'vitest';
import careers from '../data/careers.json';
import franchises from '../data/franchises.json';
import teammates from '../data/teammates.json';
import type { CareerData } from './careers';
import type { FranchiseData } from './franchiseData';
import { dailyKey, franchiseSets, inEra, makeConnect, makeGrid, MODERN_FROM, seededRandom } from './games';
import { buildGraph, findPlayer, type TeammateData } from './teammates';
import { makeQuiz } from './trivia';

const graph = buildGraph(teammates as unknown as TeammateData);
const id = (name: string) => findPlayer(graph.data, name)!;

describe('since-2000 games', () => {
  it('tells modern players from older ones', () => {
    expect(inEra(graph, id('LeBron James'), 'modern')).toBe(true);
    expect(inEra(graph, id('Larry Bird'), 'modern')).toBe(false);
    // Most of Jordan's seasons are before 2000-01.
    expect(inEra(graph, id('Michael Jordan'), 'modern')).toBe(false);
    expect(inEra(graph, id('Larry Bird'), 'all')).toBe(true);
  });
  it('builds grids and connect puzzles from modern players only', () => {
    const sets = franchiseSets(graph, 'modern');
    for (const seed of [1, 7, 2026]) {
      const grid = makeGrid(graph, seededRandom(seed), sets);
      for (const row of grid.answers) for (const cell of row) for (const p of cell) expect(inEra(graph, p, 'modern')).toBe(true);
      const c = makeConnect(graph, seededRandom(seed), 'modern');
      expect(inEra(graph, c.start, 'modern') && inEra(graph, c.target, 'modern')).toBe(true);
    }
  });
  it('asks trivia about 2000-01 onwards only', () => {
    for (const seed of [1, 2, 3]) {
      const q = makeQuiz(franchises as unknown as FranchiseData, careers as unknown as CareerData, graph, seededRandom(seed), MODERN_FROM);
      expect(q).toHaveLength(5);
      for (const x of q) for (const y of x.text.match(/\b(19|20)\d\d-\d\d\b/g) ?? []) expect(Number(y.slice(0, 4))).toBeGreaterThanOrEqual(MODERN_FROM - 1);
    }
  });
  it('keeps all-time daily keys as they were', () => {
    expect(dailyKey('grid', 'all', '2026-11-05')).toBe('grid-2026-11-05');
    expect(dailyKey('grid', 'modern', '2026-11-05')).toBe('grid-since2000-2026-11-05');
  });
});
