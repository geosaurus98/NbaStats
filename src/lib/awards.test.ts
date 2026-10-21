import { describe, expect, it } from 'vitest';
import type { SeasonSnapshot } from '../api/snapshot';
import season2025 from '../data/season-2025.json';
import { nameKey } from './boxTotals';
import { actualVotes, candidates, rankAward } from './awards';

const snap = season2025 as unknown as SeasonSnapshot;

describe('awards model on 2024-25', () => {
  const { list, leagueDrtg } = candidates(snap);
  const top = (award: 'mvp' | 'dpoy' | 'roy', n: number) => rankAward(award, list, leagueDrtg).slice(0, n).map((r) => nameKey(r.c.name));

  it('has the real winners at or near the top', () => {
    expect(top('mvp', 1)).toEqual([nameKey('Shai Gilgeous-Alexander')]);
    expect(top('mvp', 2)).toContain(nameKey('Nikola Jokić'));
    expect(top('roy', 1)).toEqual([nameKey('Stephon Castle')]);
    expect(top('dpoy', 7)).toContain(nameKey('Evan Mobley'));
  });

  it('finds most real vote-getters in its top ten', () => {
    for (const award of ['mvp', 'dpoy', 'roy'] as const) {
      const real = [...actualVotes(2025, award)!.keys()].slice(0, 5);
      const hits = real.filter((k) => top(award, 10).includes(k)).length;
      expect(hits, award).toBeGreaterThanOrEqual(4);
    }
  });
});
