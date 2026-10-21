// Season totals for every player and team, summed from each game's box score.
// Used by the snapshot job; the awards model reads the result.
import type { TeamBox } from '../api/types';

/** [id, teamId, gp, gs, min, pts, fgm, fga, tpm, tpa, ftm, fta, oreb, dreb, ast, stl, blk, tov, pf, pm] */
export type PlayerTotalsRow = [string, string, ...number[]];
/** [teamId, gp, pts, oppPts, poss, oppPoss] */
export type TeamTotalsRow = [string, number, number, number, number, number];

export interface BoxTotals {
  players: PlayerTotalsRow[];
  teams: TeamTotalsRow[];
  /** ESPN ids of first-year players. */
  rookies?: string[];
}

export const P = { gp: 2, gs: 3, min: 4, pts: 5, fgm: 6, fga: 7, tpm: 8, tpa: 9, ftm: 10, fta: 11, oreb: 12, dreb: 13, ast: 14, stl: 15, blk: 16, tov: 17, pf: 18, pm: 19 } as const;
const COUNT = 18; // numeric columns after id and team

function lineValues(labels: string[], stats: string[]): number[] | undefined {
  const get = (l: string) => stats[labels.indexOf(l)];
  const num = (l: string) => {
    const v = parseFloat(get(l) ?? '');
    return Number.isFinite(v) ? v : 0;
  };
  const pair = (l: string) => {
    const [m, a] = (get(l) ?? '').split('-').map(Number);
    return [m || 0, a || 0];
  };
  const min = num('MIN');
  if (!labels.length || !stats.length) return undefined;
  const [fgm, fga] = pair('FG');
  const [tpm, tpa] = pair('3PT');
  const [ftm, fta] = pair('FT');
  const reb = num('REB');
  const oreb = num('OREB');
  const dreb = labels.includes('DREB') ? num('DREB') : Math.max(0, reb - oreb);
  return [min, num('PTS'), fgm, fga, tpm, tpa, ftm, fta, oreb, dreb, num('AST'), num('STL'), num('BLK'), num('TO'), num('PF'), num('+/-')];
}

const possessions = (fga: number, fta: number, oreb: number, tov: number) => fga + 0.44 * fta - oreb + tov;

export class BoxAccumulator {
  private players = new Map<string, PlayerTotalsRow>();
  private teams = new Map<string, TeamTotalsRow>();

  add(boxes: TeamBox[]) {
    if (boxes.length !== 2) return;
    const teamLine: { id: string; pts: number; poss: number }[] = [];
    for (const box of boxes) {
      let pts = 0, fga = 0, fta = 0, oreb = 0, tov = 0;
      for (const p of box.players) {
        if (p.dnp || !p.id) continue;
        const v = lineValues(box.labels, p.stats);
        if (!v) continue;
        const row = this.players.get(p.id) ?? ([p.id, box.team.id, ...Array(COUNT).fill(0)] as PlayerTotalsRow);
        row[1] = box.team.id; // latest team for traded players
        (row[P.gp] as number)++;
        if (p.starter) (row[P.gs] as number)++;
        v.forEach((x, i) => ((row[P.min + i] as number) += x));
        this.players.set(p.id, row);
        pts += v[1];
        fga += v[3];
        fta += v[7];
        oreb += v[8];
        tov += v[13];
      }
      teamLine.push({ id: box.team.id, pts, poss: possessions(fga, fta, oreb, tov) });
    }
    for (const [i, t] of teamLine.entries()) {
      const o = teamLine[1 - i];
      const row = this.teams.get(t.id) ?? [t.id, 0, 0, 0, 0, 0];
      row[1]++;
      row[2] += t.pts;
      row[3] += o.pts;
      row[4] += t.poss;
      row[5] += o.poss;
      this.teams.set(t.id, row);
    }
  }

  result(): BoxTotals {
    const round = (x: number) => Math.round(x * 10) / 10;
    return {
      players: [...this.players.values()].map((r) => [r[0], r[1], ...(r.slice(2) as number[]).map(round)] as PlayerTotalsRow),
      teams: [...this.teams.values()].map((r) => [r[0], r[1], r[2], r[3], round(r[4]), round(r[5])]),
    };
  }
}

/** Normalised name for matching ESPN and Basketball-Reference players. */
export function nameKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, '')
    .replace(/[^a-z]/g, '');
}
