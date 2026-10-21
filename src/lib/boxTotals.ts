// Season totals for every player and team, summed from each game's box score.
// Used by the snapshot job; the awards model reads the result.
import type { TeamBox } from '../api/types';

/** [id, teamId, gp, gs, min, pts, fgm, fga, tpm, tpa, ftm, fta, oreb, dreb, ast, stl, blk, tov, pf, pm] */
export type PlayerTotalsRow = [string, string, ...number[]];
/** [teamId, gp, pts, oppPts, poss, oppPoss, fgm, fga, tpm, tpa, ftm, fta, oreb, dreb, ast, stl, blk, tov] (older snapshots stop after oppPoss) */
export type TeamTotalsRow = [string, ...number[]];
/** Columns of TeamTotalsRow from fgm on, in the same order as PlayerTotalsRow's. */
const TEAM_SUMS = ['fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta', 'oreb', 'dreb', 'ast', 'stl', 'blk', 'tov'] as const;
export const T = { gp: 1, pts: 2, opp: 3, poss: 4, oppPoss: 5, fgm: 6, fga: 7, tpm: 8, tpa: 9, ftm: 10, fta: 11, oreb: 12, dreb: 13, ast: 14, stl: 15, blk: 16, tov: 17 } as const;

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
    const teamLine: { id: string; pts: number; poss: number; sums: number[] }[] = [];
    for (const box of boxes) {
      let pts = 0, fga = 0, fta = 0, oreb = 0, tov = 0;
      const sums = TEAM_SUMS.map(() => 0);
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
        TEAM_SUMS.forEach((k, i) => (sums[i] += v[P[k] - P.min]));
        pts += v[1];
        fga += v[3];
        fta += v[7];
        oreb += v[8];
        tov += v[13];
      }
      teamLine.push({ id: box.team.id, pts, poss: possessions(fga, fta, oreb, tov), sums });
    }
    for (const [i, t] of teamLine.entries()) {
      const o = teamLine[1 - i];
      const row = this.teams.get(t.id) ?? ([t.id, ...Array(5 + TEAM_SUMS.length).fill(0)] as TeamTotalsRow);
      const add = (i: number, x: number) => ((row[i] as number) += x);
      add(T.gp, 1);
      add(T.pts, t.pts);
      add(T.opp, o.pts);
      add(T.poss, t.poss);
      add(T.oppPoss, o.poss);
      t.sums.forEach((x, i) => add(T.fgm + i, x));
      this.teams.set(t.id, row);
    }
  }

  result(): BoxTotals {
    const round = (x: number) => Math.round(x * 10) / 10;
    return {
      players: [...this.players.values()].map((r) => [r[0], r[1], ...(r.slice(2) as number[]).map(round)] as PlayerTotalsRow),
      teams: [...this.teams.values()].map((r) => [r[0], ...(r.slice(1) as number[]).map(round)] as TeamTotalsRow),
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

const f1 = (x: number) => (Math.round(x * 10) / 10).toFixed(1);

/** The leader table columns ESPN's leaders feed returns, built from our own totals. */
export const LEADER_KEYS: { key: string; label: string }[] = [
  { key: 'general.gamesPlayed', label: 'GP' },
  { key: 'general.avgMinutes', label: 'MIN' },
  { key: 'offensive.avgPoints', label: 'PTS' },
  { key: 'general.avgRebounds', label: 'REB' },
  { key: 'offensive.avgAssists', label: 'AST' },
  { key: 'defensive.avgSteals', label: 'STL' },
  { key: 'defensive.avgBlocks', label: 'BLK' },
  { key: 'offensive.fieldGoalPct', label: 'FG%' },
  { key: 'offensive.threePointFieldGoalPct', label: '3P%' },
  { key: 'offensive.freeThrowPct', label: 'FT%' },
];

/**
 * Per-game leaders from season totals. Like the NBA, players must have played
 * 70% of their team's games, and percentage leaders need enough attempts.
 */
export function leadersFromBox(
  totals: BoxTotals,
  names: Record<string, string>,
  abbr: Record<string, string>,
  sort: string,
  limit = 50,
): { columns: { key: string; label: string }[]; rows: { athlete: string; athleteId: string; team: string; values: Record<string, string> }[] } {
  const teamGames = new Map(totals.teams.map((t) => [t[0], t[T.gp] as number]));
  const rows = totals.players.flatMap((r) => {
    const v = (k: keyof typeof P) => r[P[k]] as number;
    const g = v('gp');
    const tg = teamGames.get(r[1]) ?? g;
    if (!g || g < 0.7 * tg) return [];
    const pct = (m: number, a: number, need: number) => (a >= need ? f1((m / a) * 100) : undefined);
    const values: Record<string, string | undefined> = {
      'general.gamesPlayed': String(g),
      'general.avgMinutes': f1(v('min') / g),
      'offensive.avgPoints': f1(v('pts') / g),
      'general.avgRebounds': f1((v('oreb') + v('dreb')) / g),
      'offensive.avgAssists': f1(v('ast') / g),
      'defensive.avgSteals': f1(v('stl') / g),
      'defensive.avgBlocks': f1(v('blk') / g),
      // NBA minimums (300 FGM, 82 3PM, 125 FTM over 82 games), pro-rated.
      'offensive.fieldGoalPct': v('fgm') >= (300 / 82) * tg ? pct(v('fgm'), v('fga'), 1) : undefined,
      'offensive.threePointFieldGoalPct': v('tpm') >= tg ? pct(v('tpm'), v('tpa'), 1) : undefined,
      'offensive.freeThrowPct': v('ftm') >= (125 / 82) * tg ? pct(v('ftm'), v('fta'), 1) : undefined,
    };
    if (values[sort] == null) return [];
    return [{ athlete: names[r[0]] ?? r[0], athleteId: r[0], team: abbr[r[1]] ?? '', values: Object.fromEntries(Object.entries(values).map(([k, x]) => [k, x ?? '-'])) }];
  });
  rows.sort((a, b) => Number(b.values[sort]) - Number(a.values[sort]));
  return { columns: LEADER_KEYS, rows: rows.slice(0, limit) };
}

/** Team per-game and shooting stats from season totals (needs the full team rows). */
export function teamStatsFromBox(totals: BoxTotals): { columns: { key: string; label: string }[]; rows: { teamId: string; values: Record<string, number | undefined> }[] } | undefined {
  if (!totals.teams.length || totals.teams.some((t) => t.length <= T.tov)) return undefined;
  const columns = [
    { key: 'offensive.fieldGoalPct', label: 'FG%' },
    { key: 'offensive.threePointFieldGoalPct', label: '3P%' },
    { key: 'offensive.avgThreePointFieldGoalsMade', label: '3PM' },
    { key: 'offensive.freeThrowPct', label: 'FT%' },
    { key: 'general.avgRebounds', label: 'REB' },
    { key: 'offensive.avgAssists', label: 'AST' },
    { key: 'offensive.avgTurnovers', label: 'TOV' },
    { key: 'defensive.avgSteals', label: 'STL' },
    { key: 'defensive.avgBlocks', label: 'BLK' },
  ];
  const rows = totals.teams.map((t) => {
    const v = (k: keyof typeof T) => t[T[k]] as number;
    const g = v('gp') || 1;
    const pct = (m: number, a: number) => (a ? (m / a) * 100 : undefined);
    return {
      teamId: t[0],
      values: {
        'offensive.fieldGoalPct': pct(v('fgm'), v('fga')),
        'offensive.threePointFieldGoalPct': pct(v('tpm'), v('tpa')),
        'offensive.avgThreePointFieldGoalsMade': v('tpm') / g,
        'offensive.freeThrowPct': pct(v('ftm'), v('fta')),
        'general.avgRebounds': (v('oreb') + v('dreb')) / g,
        'offensive.avgAssists': v('ast') / g,
        'offensive.avgTurnovers': v('tov') / g,
        'defensive.avgSteals': v('stl') / g,
        'defensive.avgBlocks': v('blk') / g,
      },
    };
  });
  return { columns, rows };
}
