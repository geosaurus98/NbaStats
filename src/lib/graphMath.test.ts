import { describe, expect, it } from 'vitest';
import type { SeasonSnapshot } from '../api/snapshot';
import { usageRows } from '../components/MoreGraphs';
import { pointsBySource } from '../components/ShotGraphs';
import season2026 from '../data/season-2026.json';

const snap = season2026 as unknown as SeasonSnapshot;

describe('graph maths on the 2025-26 snapshot', () => {
  it('splits every team’s scoring into sources that add up', () => {
    const rows = pointsBySource(snap, 2);
    expect(rows.length).toBe(30);
    for (const r of rows) {
      expect(r.paint + r.mid + r.three + r.ft).toBeCloseTo(r.total, 6);
      expect(r.paint).toBeGreaterThan(30);
      expect(r.mid).toBeGreaterThan(0);
    }
    expect(pointsBySource(snap, 3)).toEqual([]);
  });

  it('puts usage near a fifth of team possessions on average', () => {
    const rows = usageRows(snap.box!['2'], snap.players ?? {});
    expect(rows.length).toBeGreaterThan(150);
    const avg = rows.reduce((a, r) => a + r.usage, 0) / rows.length;
    expect(avg).toBeGreaterThan(0.17);
    expect(avg).toBeLessThan(0.24);
    for (const r of rows) expect(r.ts).toBeGreaterThan(0.3);
  });
});
