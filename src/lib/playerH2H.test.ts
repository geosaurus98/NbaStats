import { describe, expect, it } from 'vitest';
import type { SeasonSnapshot } from '../api/snapshot';
import lines2026 from '../data/lines-2026.json';
import season2026 from '../data/season-2026.json';
import type { SeasonLines } from './boxTotals';
import { headToHead } from './playerH2H';

const snap = season2026 as unknown as SeasonSnapshot;
const byName = (n: string) => Object.entries(snap.players!).find(([, v]) => v === n)![0];

describe('player head-to-head', () => {
  it('finds the games two players met', () => {
    const r = headToHead([lines2026 as unknown as SeasonLines], byName('Shai Gilgeous-Alexander'), byName('Luka Doncic'));
    expect(r.summary[0].games).toBe(r.summary[1].games);
    expect(r.summary[0].wins + r.summary[1].wins).toBe(r.games.length);
    expect(r.games.length).toBeGreaterThan(0);
    expect(r.games.length).toBeLessThanOrEqual(8);
  });
  it('ignores teammates', () => {
    const r = headToHead([lines2026 as unknown as SeasonLines], byName('Shai Gilgeous-Alexander'), byName('Jalen Williams'));
    expect(r.games).toHaveLength(0);
  });
});
