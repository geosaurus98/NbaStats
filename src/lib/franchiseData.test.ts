import { describe, expect, it } from 'vitest';
import { expandGame, type SeasonSnapshot } from '../api/snapshot';
import s2025 from '../data/season-2025.json';
import s2026 from '../data/season-2026.json';
import { CHAMPIONS } from './franchiseData';
import { franchiseOf } from './franchises';
import { buildBracket } from './league';

describe('CHAMPIONS', () => {
  it('covers every season since 1947', () => {
    for (let y = 1947; y <= 2026; y++) expect(CHAMPIONS[y], String(y)).toBeTruthy();
  });

  it.each([2025, 2026])('matches the %i Finals winner in the ESPN snapshot', (year) => {
    const snap = (year === 2025 ? s2025 : s2026) as unknown as SeasonSnapshot;
    const teams = new Map(snap.teams.map((t) => [t.id, t]));
    const seeds = new Map<string, number>();
    const confs = new Map<string, string>();
    for (const c of snap.standings) c.rows.forEach((r, i) => (seeds.set(r.team.id, r.seed ?? i + 1), confs.set(r.team.id, c.name)));
    const finals = buildBracket(snap.games['3'].map((g) => expandGame(g, teams)), seeds, confs).find((s) => s.round === 4)!;
    expect(finals.winner?.id).toBe(franchiseOf(CHAMPIONS[year])?.espnId);
  });
});
