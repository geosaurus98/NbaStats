import { describe, expect, it } from 'vitest';
import type { SeasonSnapshot } from '../api/snapshot';
import lines2025 from '../data/lines-2025.json';
import lines2026 from '../data/lines-2026.json';
import season2026 from '../data/season-2026.json';
import type { SeasonLines } from './boxTotals';
import { absences, backToBackDrops, continuity, modelReport, restSplits, swings } from './seasonExtras';

const snap = season2026 as unknown as SeasonSnapshot;
const lines = lines2026 as unknown as SeasonLines;
const byName = (n: string) => Object.entries(snap.players!).find(([, v]) => v === n)![0];
const team = (abbr: string) => snap.teams.find((t) => t.abbr === abbr)!.id;

describe('season extras', () => {
  it('counts games missed within a player’s span with the team', () => {
    const ws = new Map([[byName('Shai Gilgeous-Alexander'), 0.25]]);
    const okc = absences(lines, ws).find((t) => t.teamId === team('OKC'))!;
    const sga = okc.players.find((p) => p.playerId === byName('Shai Gilgeous-Alexander'))!;
    expect(sga.played + sga.missed).toBeLessThanOrEqual(82);
    expect(sga.withRec[0] + sga.withRec[1]).toBe(sga.played);
    expect(sga.withoutRec[0] + sga.withoutRec[1]).toBe(sga.missed);
    expect(sga.wsLost).toBeCloseTo(0.25 * sga.missed, 10);
  });
  it('counts players still out to today, but not games after a trade', () => {
    // Lines: [p, home, starter, min, pts, ...]; team T is always home. Player 0 plays every game,
    // player 1 plays the first three and is still out, player 2 plays three then moves to team U.
    const line = (p: number, home: number) => [p, home, 1, 30, 10, 4, 8, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0];
    const games = Array.from({ length: 6 }, (_, i) => {
      const gl = [line(0, 1)];
      if (i < 3) gl.push(line(1, 1), line(2, 1));
      return [`g${i}`, `2026-01-0${i + 1}`, 2, 'T', i < 3 ? 'X' : 'U', 0, gl];
    });
    games[5][6] = [...(games[5][6] as number[][]), line(2, 0)]; // player 2 now plays for U, away
    const fake = { year: 2026, ids: ['a', 'b', 'c'], games } as unknown as SeasonLines;
    const t = absences(fake, new Map([['b', 0.1]])).find((x) => x.teamId === 'T')!;
    expect(t.players.find((p) => p.playerId === 'b')).toMatchObject({ played: 3, missed: 3 });
    expect(t.players.find((p) => p.playerId === 'c')).toMatchObject({ played: 3, missed: 0 });
    expect(t.players.find((p) => p.playerId === 'b')!.wsLost).toBeCloseTo(0.3, 10);
  });
  it('grades the model', () => {
    const r = modelReport([
      { home: 'A', away: 'B', date: '2026-01-02', pHome: 0.7, homeWon: true },
      { home: 'B', away: 'A', date: '2026-01-05', pHome: 0.6, homeWon: false },
      { home: 'A', away: 'B', date: '2026-02-01', pHome: 0.8, homeWon: false },
    ]);
    expect(r.overall).toMatchObject({ games: 3, correct: 1 });
    const a = r.teams.find((t) => t.teamId === 'A')!;
    expect(a.wins).toBe(2);
    expect(a.expected).toBeCloseTo(0.7 + 0.4 + 0.8, 10);
    expect(a.asFavourite).toEqual([1, 1]);
    expect(a.asUnderdog).toEqual([1, 0]);
    expect(r.months.map((m) => m.month)).toEqual(['2026-01', '2026-02']);
  });
  it('finds comebacks and collapses', () => {
    const s = swings(snap.drama!['2'], snap.games['2'], team('OKC'));
    expect(s.comebacks.length).toBeGreaterThan(0);
    expect(s.comebacks[0].margin).toBeGreaterThanOrEqual(s.comebacks[s.comebacks.length - 1].margin);
  });
  it('measures roster continuity', () => {
    const c = continuity(lines2025 as unknown as SeasonLines, lines);
    expect(c).toHaveLength(30);
    expect(c.every((t) => t.share >= 0 && t.share <= 1)).toBe(true);
    expect(c[0].share).toBeGreaterThan(c[29].share);
  });
  it('splits by rest', () => {
    const splits = restSplits(lines, byName('Shai Gilgeous-Alexander'));
    expect(splits.map((s) => s.label)).toContain('Back-to-back');
    expect(splits.reduce((a, s) => a + s.games, 0)).toBeGreaterThan(60);
    expect(backToBackDrops(lines).length).toBeGreaterThan(50);
  });
});
