import { describe, expect, it } from 'vitest';
import type { TeamBox } from '../api/types';
import { BoxAccumulator, nameKey, P } from './boxTotals';

const labels = ['MIN', 'PTS', 'FG', '3PT', 'FT', 'REB', 'AST', 'TO', 'STL', 'BLK', 'OREB', 'DREB', 'PF', '+/-'];
const box = (id: string, rows: [string, boolean, string[]][]): TeamBox => ({
  team: { id, name: id, shortName: id, abbr: id },
  labels,
  totals: [],
  teamStats: [],
  players: rows.map(([pid, starter, stats]) => ({ id: pid, name: pid, starter, dnp: !stats.length, stats })),
});

describe('BoxAccumulator', () => {
  it('sums player lines and team possessions', () => {
    const acc = new BoxAccumulator();
    const game = [
      box('A', [['a1', true, ['36', '30', '10-20', '4-8', '6-6', '10', '5', '3', '2', '1', '2', '8', '2', '+12']], ['a2', false, []]]),
      box('B', [['b1', true, ['40', '20', '8-18', '0-2', '4-5', '5', '7', '2', '1', '0', '1', '4', '3', '-12']]]),
    ];
    acc.add(game);
    acc.add(game);
    const r = acc.result();
    const a1 = r.players.find((p) => p[0] === 'a1')!;
    expect(a1[P.gp]).toBe(2);
    expect(a1[P.gs]).toBe(2);
    expect(a1[P.pts]).toBe(60);
    expect(a1[P.tpm]).toBe(8);
    expect(a1[P.dreb]).toBe(16);
    expect(a1[P.pm]).toBe(24);
    expect(r.players.some((p) => p[0] === 'a2')).toBe(false);
    const teamA = r.teams.find((t) => t[0] === 'A')!;
    expect(teamA.slice(1, 4)).toEqual([2, 60, 40]);
    expect(teamA[4]).toBeCloseTo(2 * (20 + 0.44 * 6 - 2 + 3), 1);
  });

  it('matches names across sources', () => {
    expect(nameKey('Nikola Jokić')).toBe(nameKey('Nikola Jokic'));
    expect(nameKey('Jaren Jackson Jr.')).toBe(nameKey('Jaren Jackson'));
    expect(nameKey("Kel'el Ware")).toBe('kelelware');
  });
});
