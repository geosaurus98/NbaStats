import { describe, expect, it } from 'vitest';
import type { SeasonSnapshot } from '../api/snapshot';
import season2026 from '../data/season-2026.json';
import { cupGames, cupGroups, rankGroup, wildcards } from './nbaCup';

const snap = season2026 as unknown as SeasonSnapshot;
const conf = new Map(snap.standings.flatMap((c) => c.rows.map((r) => [r.team.id, /east/i.test(c.name) ? 'East' : 'West'] as [string, string])));

describe('NBA Cup', () => {
  it('rebuilds the six groups of five from the 2025-26 group games', () => {
    const { group, knockout } = cupGames(snap.games['2']);
    const groups = cupGroups(group, conf);
    expect(groups.length).toBe(6);
    expect(groups.every((g) => g.rows.length === 5 && g.rows.every((r) => r.played === 4))).toBe(true);
    expect(wildcards(groups).size).toBe(2);
    expect(knockout.filter((k) => k.round === 'Quarterfinals').length).toBe(4);
    expect(knockout.filter((k) => k.round === 'Championship').length).toBe(1);
    // Every quarterfinalist is a group winner or a wildcard.
    const qualified = new Set([...groups.map((g) => g.rows[0].teamId), ...wildcards(groups).values()]);
    for (const k of knockout.filter((x) => x.round === 'Quarterfinals')) {
      expect(qualified.has(k.homeId)).toBe(true);
      expect(qualified.has(k.awayId)).toBe(true);
    }
  });

  it('breaks a two-way tie by head-to-head', () => {
    const g = (h: string, a: string, hs: number, as: number) => ['x', '2025-11-01', h, a, hs, as, 'NBA Cup - Group Play', null] as never;
    // C 2-0; A and B both 1-1 (A beat B by one, but B has the much better point differential); D 0-2.
    const rows = rankGroup(['A', 'B', 'C', 'D'], [g('A', 'B', 101, 100), g('C', 'A', 110, 100), g('B', 'D', 150, 100), g('C', 'D', 110, 100)]);
    expect(rows.map((r) => r.teamId)).toEqual(['C', 'A', 'B', 'D']);
    // Three teams level on record go to point differential instead.
    const three = rankGroup(['A', 'B', 'C'], [g('A', 'B', 100, 99), g('B', 'C', 130, 90), g('C', 'A', 110, 100)]);
    expect(three.map((r) => r.teamId)).toEqual(['B', 'A', 'C']);
  });
});
