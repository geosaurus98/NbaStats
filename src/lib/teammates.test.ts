import { describe, expect, it } from 'vitest';
import { averageDistance, bfs, buildGraph, centrality, findPlayer, normName, pathTo, type TeammateData } from './teammates';

// A–B on team X (2000), B–C on Y (2001), C–D on Z (2002), E alone.
const data: TeammateData = {
  source: 'test',
  generatedAt: '',
  players: [
    ['Alpha One', 1999, 2000],
    ['Bravo Two', 2000, 2001],
    ['Charlie Dončić', 2001, 2002],
    ['Delta Four', 2002, 2002],
    ['Echo Five', 2010, 2010],
  ],
  rosters: [
    [2000, 'NBA', 'X', [0, 1]],
    [2001, 'NBA', 'Y', [1, 2]],
    [2002, 'NBA', 'Z', [2, 3]],
    [2010, 'NBA', 'Q', [4]],
  ],
  central: [],
  stints: [[0], [0, 1], [1, 2], [2], [3]],
};
const g = buildGraph(data);

describe('teammate graph', () => {
  it('measures distances by shared rosters', () => {
    const s = bfs(g, 0);
    expect([...s.dist]).toEqual([0, 1, 2, 3, -1]);
    expect(s.counts).toEqual([1, 1, 1, 1]);
    expect(averageDistance(s)).toBeCloseTo(2);
  });

  it('reconstructs the chain with the linking roster', () => {
    const chain = pathTo(bfs(g, 0), 3);
    expect(chain.map((l) => l.player)).toEqual([0, 1, 2, 3]);
    expect(chain.map((l) => l.roster)).toEqual([undefined, 0, 1, 2]);
    expect(pathTo(bfs(g, 0), 4)).toEqual([]);
  });

  it('ranks the best-connected player first', () => {
    // B and C sit in the middle of the chain.
    expect([1, 2]).toContain(centrality(g, 1)[0][0]);
  });

  it('finds players by accent-free, case-insensitive name', () => {
    expect(normName('Charlie Dončić')).toBe('charlie doncic');
    expect(findPlayer(data, 'charlie doncic')).toBe(2);
    expect(findPlayer(data, 'brav')).toBe(1);
    expect(findPlayer(data, 'nobody')).toBeUndefined();
  });
});
