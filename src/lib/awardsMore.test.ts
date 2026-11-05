import { describe, expect, it } from 'vitest';
import type { SeasonSnapshot } from '../api/snapshot';
import { expandGame } from '../api/snapshot';
import s2025 from '../data/season-2025.json';
import s2026 from '../data/season-2026.json';
import { candidates } from './awards';
import { rankClutch, rankCoaches, rankMostImproved, rankSixthMan } from './awardsMore';

const games = (s: SeasonSnapshot) => s.games['2'].map((g) => expandGame(g, new Map(s.teams.map((t) => [t.id, t]))));
const names = (xs: { c: { name: string } }[], n: number) => xs.slice(0, n).map((r) => r.c.name);

describe('more award races', () => {
  const a = s2025 as unknown as SeasonSnapshot;
  const b = s2026 as unknown as SeasonSnapshot;
  const la = candidates(a).list;
  const lb = candidates(b).list;
  it('has 2024-25’s real winners near the top', () => {
    const sixth = names(rankSixthMan(la), 5);
    const clutch = names(rankClutch(la, a.clutch!['2'].players, a.clutch!['2'].teams), 5);
    const coy = rankCoaches(games(a), undefined).slice(0, 5).map((r) => a.teams.find((t) => t.id === r.teamId)!.abbr);
    console.log('2025', { sixth, clutch, coy });
    expect(sixth).toContain('Payton Pritchard');
    expect(clutch).toContain('Jalen Brunson');
    expect(coy).toContain('CLE');
  });
  it('ranks 2025-26 against 2024-25', () => {
    const mip = names(rankMostImproved(lb, la), 8);
    const coy = rankCoaches(games(b), games(a)).slice(0, 5).map((r) => `${b.teams.find((t) => t.id === r.teamId)!.abbr} ${r.score.toFixed(1)}`);
    console.log('2026', { sixth: names(rankSixthMan(lb), 5), mip, clutch: names(rankClutch(lb, b.clutch!['2'].players, b.clutch!['2'].teams), 5), coy });
    expect(mip.length).toBe(8);
  });
});
