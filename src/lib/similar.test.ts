import { describe, expect, it } from 'vitest';
import careers from '../data/careers.json';
import teammates from '../data/teammates.json';
import type { CareerData } from './careers';
import { buildSeasonPoints, similarSeasons } from './similar';

describe('similar seasons', () => {
  const points = buildSeasonPoints(careers as unknown as CareerData);
  const players = (teammates as unknown as { players: [string][] }).players;
  const find = (name: string, season: number) => points.find((p) => players[p.player][0] === name && p.season === season)!;

  it('finds like-for-like players from other eras', () => {
    const hakeem = find('Hakeem Olajuwon', 1994);
    const matches = similarSeasons(points, hakeem, 10);
    expect(matches).toHaveLength(10);
    expect(matches.every((m) => m.point.player !== hakeem.player)).toBe(true);
    expect(matches.map((m) => players[m.point.player][0])).toContain('Patrick Ewing');
    // Sorted best first, scores within 0-100.
    expect(matches.map((m) => m.similarity)).toEqual([...matches.map((m) => m.similarity)].sort((a, b) => b - a));
    expect(matches.every((m) => m.similarity >= 0 && m.similarity <= 100)).toBe(true);
  });

  it('a point guard matches guards, not centres', () => {
    const top = similarSeasons(points, find('Chris Paul', 2008), 5).map((m) => m.point);
    expect(top.every((p) => p.perGame.ast > 6)).toBe(true);
  });
});
