import { describe, expect, it } from 'vitest';
import type { Game, TeamRef } from '../api/types';
import { scheduleAhead } from './scheduleAhead';

const team = (id: string): TeamRef => ({ id, name: id, shortName: id, abbr: id });
const game = (date: string, home: string, away: string, hs?: number, as?: number): Game => ({
  id: `${date}${home}`,
  date: `${date}T23:30Z`,
  state: hs == null ? 'pre' : 'post',
  statusDetail: '',
  home: { team: team(home), homeAway: 'home', score: hs, winner: hs != null ? hs > as! : undefined, linescores: [], leaders: [] },
  away: { team: team(away), homeAway: 'away', score: as, winner: hs != null ? as! > hs : undefined, linescores: [], leaders: [] },
  broadcasts: [],
});

describe('scheduleAhead', () => {
  const games = [
    game('2026-01-01', 'A', 'B', 110, 100), // A 1-0, B 0-1
    game('2026-01-02', 'C', 'B', 100, 90), // C 1-0, B 0-2
    game('2026-01-10', 'B', 'A'),
    game('2026-01-11', 'C', 'A'),
    game('2026-01-13', 'A', 'B'),
  ];
  const rows = scheduleAhead([team('A'), team('B'), team('C')], games, '2026-01-05');
  const a = rows.find((r) => r.team.id === 'A')!;

  it('counts what is left', () => {
    expect([a.played, a.left, a.home, a.road]).toEqual([1, 3, 1, 2]);
    expect(a.backToBacks).toBe(1); // Jan 10 → Jan 11
    expect(a.longestTrip).toBe(2);
  });

  it('rates opponents by their record so far', () => {
    // B (0-2), C (1-0), B (0-2)
    expect(a.oppPct).toBeCloseTo(1 / 3, 5);
    expect(a.vsWinning).toBe(1);
  });
});
