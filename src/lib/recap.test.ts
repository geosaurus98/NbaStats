import { describe, expect, it } from 'vitest';
import { expandGame, type SeasonSnapshot } from '../api/snapshot';
import lines2026 from '../data/lines-2026.json';
import season2026 from '../data/season-2026.json';
import type { SeasonLines } from './boxTotals';
import { bestGames, newSeasonHighs, playersOfWeek, standingsMovers, weekRecords, weekStart, weeksWithGames } from './recap';

const snap = season2026 as unknown as SeasonSnapshot;
const lines = lines2026 as unknown as SeasonLines;
const teams = new Map(snap.teams.map((t) => [t.id, t]));
const games = snap.games['2'].map((c) => expandGame(c, teams));
const conf = new Map(snap.standings.flatMap((c) => c.rows.map((r) => [r.team.id, c.name] as [string, string])));

describe('weekly recap', () => {
  it('finds Monday', () => {
    expect(weekStart('2026-01-14')).toBe('2026-01-12'); // a Wednesday
    expect(weekStart('2026-01-12')).toBe('2026-01-12');
    expect(weekStart('2026-01-18')).toBe('2026-01-12'); // Sunday
  });
  const week = '2026-01-12';
  it('sums the week', () => {
    expect(weeksWithGames(games).length).toBeGreaterThan(20);
    const recs = weekRecords(games, week);
    expect(recs.length).toBe(30);
    const total = recs.reduce((s, r) => s + r.w, 0);
    expect(total).toBe(recs.reduce((s, r) => s + r.l, 0));
    expect(total).toBeGreaterThan(40);
  });
  it('finds movers, best games and highs', () => {
    const movers = standingsMovers(games, conf, week);
    expect(movers.length).toBeGreaterThan(0);
    expect(movers.every((m) => m.from >= 1 && m.to <= 15)).toBe(true);
    const best = bestGames(lines, week);
    expect(best).toHaveLength(8);
    expect(best[0].gameScore).toBeGreaterThanOrEqual(best[7].gameScore);
    expect(playersOfWeek(lines, week).length).toBe(5);
    expect(newSeasonHighs(lines, week).every((h) => h.pts > h.previous)).toBe(true);
  });
});

import { gameDays, tableBefore } from './recap';
describe('standings on a date', () => {
  it('builds each conference table as it stood', () => {
    const days = gameDays(games);
    expect(days.length).toBeGreaterThan(150);
    const end = tableBefore(games, conf, '2026-04-13');
    for (const rows of end.values()) {
      expect(rows).toHaveLength(15);
      expect(rows.reduce((s, r) => s + r.w + r.l, 0)).toBeGreaterThan(15 * 80);
    }
    const opening = tableBefore(games, conf, days[0]);
    for (const rows of opening.values()) expect(rows.every((r) => r.w + r.l === 0)).toBe(true);
  });
});
