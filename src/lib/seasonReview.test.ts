import { describe, expect, it } from 'vitest';
import type { SeasonSnapshot } from '../api/snapshot';
import { expandGame } from '../api/snapshot';
import s2026 from '../data/season-2026.json';
import { bestGames, championPath, leaders } from './seasonReview';

const snap = s2026 as unknown as SeasonSnapshot;
const teams = new Map(snap.teams.map((t) => [t.id, t]));

describe('season review (2025-26)', () => {
  it('finds the champion and its four series', () => {
    const path = championPath(snap.games['3'].map((g) => expandGame(g, teams)))!;
    expect(path).toBeDefined();
    expect(path.series.length).toBe(4);
    expect(path.series.every((s) => s.wins === 4)).toBe(true);
    console.log('champion', teams.get(path.championId)?.abbr, path.series);
  });
  it('ranks leaders and games', () => {
    const top = leaders(snap.box!['2'].players, 82, 'pts');
    expect(top[0].value).toBeGreaterThan(28);
    expect(bestGames(snap.drama!['2'])[0].index).toBeGreaterThan(bestGames(snap.drama!['2'])[4].index);
  });
});
