import { describe, expect, it } from 'vitest';
import type { SeasonSnapshot } from '../api/snapshot';
import lines2026 from '../data/lines-2026.json';
import season2026 from '../data/season-2026.json';
import type { SeasonLines } from './boxTotals';
import { archetypes, comboTotals, streaks } from './playerExtras';

const snap = season2026 as unknown as SeasonSnapshot;
const lines = lines2026 as unknown as SeasonLines;
const byName = (n: string) => Object.entries(snap.players!).find(([, v]) => v === n)![0];

describe('player extras on 2025-26', () => {
  it('finds streaks', () => {
    const s = streaks(lines, 'pts20');
    const sga = s.find((x) => x.id === byName('Shai Gilgeous-Alexander'))!;
    expect(sga.longest).toBeGreaterThan(20);
    expect(s.every((x) => x.active <= x.longest)).toBe(true);
  });

  it('gives every rotation player an archetype that makes sense', () => {
    const a = archetypes(snap.box!['2'], snap.shotSplits?.['2']);
    const of = (n: string) => a.find((x) => x.id === byName(n))?.archetype;
    const counts = new Map<string, number>();
    for (const x of a) counts.set(x.archetype, (counts.get(x.archetype) ?? 0) + 1);
    expect(of('Shai Gilgeous-Alexander')).toBe('creator');
    expect(of('Rudy Gobert')).toMatch(/protector|roller/);
    expect(of('Trae Young')).toBe('playmaker');
    expect(counts.size).toBe(8);
  });

  it('sums lineup minutes for any group', () => {
    const okc = snap.lineups!['2'][snap.teams.find((t) => t.abbr === 'OKC')!.id];
    const [a, b, c] = okc.lineups[0][0];
    const two = comboTotals(okc, [a, b]);
    const three = comboTotals(okc, [a, b, c]);
    expect(two.sec).toBeGreaterThanOrEqual(three.sec);
    expect(three.sec).toBeGreaterThanOrEqual(okc.lineups[0][1]);
  });
});

describe('award odds', async () => {
  const { awardOdds, candidates, rankAward } = await import('./awards');
  it('add up to one and trust last season early on', () => {
    const now = candidates(snap);
    const ranked = rankAward('mvp', now.list, now.leagueDrtg);
    // Pretend only 5 games are played: one player's great start shouldn't outweigh a former MVP.
    const early = ranked.map((r) => ({ ...r, c: { ...r.c, teamGames: 5 } }));
    const leader = [...ranked].sort((a, b) => b.score - a.score)[0].c.id;
    const odds = awardOdds(early, 'mvp', new Map([[leader, 10]]));
    expect([...odds.values()].reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    const full = awardOdds(ranked.map((r) => ({ ...r, c: { ...r.c, teamGames: 82 } })), 'mvp');
    expect([...full.values()]).toEqual([1]);
    expect(odds.get(leader) ?? 0).toBeLessThan(0.5);
  });
});
