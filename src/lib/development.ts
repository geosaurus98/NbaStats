// Player development: how a player's role and efficiency change season to
// season (minutes, shot volume, efficiency, three-point rate, playmaking,
// rebounding), from career rows or this season's box totals.
import { P, type PlayerTotalsRow } from './boxTotals';
import { COL, type CareerData, type SeasonRow } from './careers';

export interface Profile {
  season: number;
  g: number;
  mpg: number;
  /** Per 36 minutes. */
  pts36: number;
  ast36: number;
  trb36: number;
  /** Shots per 36: FGA + 0.44 × FTA. */
  shots36: number;
  ts: number;
  /** Share of field-goal attempts that are threes. */
  threeRate: number;
}

export type Metric = Exclude<keyof Profile, 'season' | 'g'>;

export const METRICS: { id: Metric; label: string; fmt: (v: number) => string; what: string }[] = [
  { id: 'mpg', label: 'Minutes', fmt: (v) => v.toFixed(1), what: 'minutes per game' },
  { id: 'pts36', label: 'Scoring', fmt: (v) => v.toFixed(1), what: 'points per 36 minutes' },
  { id: 'shots36', label: 'Shot volume', fmt: (v) => v.toFixed(1), what: 'shots per 36 minutes (FGA + 0.44 × FTA)' },
  { id: 'ts', label: 'Efficiency', fmt: (v) => `${(v * 100).toFixed(1)}%`, what: 'true shooting' },
  { id: 'threeRate', label: 'Three-point rate', fmt: (v) => `${(v * 100).toFixed(0)}%`, what: 'share of shots that are threes' },
  { id: 'ast36', label: 'Playmaking', fmt: (v) => v.toFixed(1), what: 'assists per 36 minutes' },
  { id: 'trb36', label: 'Rebounding', fmt: (v) => v.toFixed(1), what: 'rebounds per 36 minutes' },
];

function profile(season: number, g: number, min: number, pts: number, ast: number, trb: number, fga: number, fta: number, tpa: number): Profile | undefined {
  if (g <= 0 || min <= 0) return undefined;
  const per36 = (v: number) => (v / min) * 36;
  const tsa = fga + 0.44 * fta;
  return { season, g, mpg: min / g, pts36: per36(pts), ast36: per36(ast), trb36: per36(trb), shots36: per36(tsa), ts: tsa ? pts / (2 * tsa) : 0, threeRate: fga ? tpa / fga : 0 };
}

/** From a careers.json season row (NBA only; missing stats are -1). */
export function fromCareer(r: SeasonRow): Profile | undefined {
  if (r[COL.lg] !== 0 || r[COL.mp] <= 0 || r[COL.fga] < 0) return undefined;
  const v = (k: keyof typeof COL) => Math.max(0, r[COL[k]]);
  return profile(r[COL.season], r[COL.g], r[COL.mp], v('pts'), v('ast'), v('trb'), v('fga'), v('fta'), v('tpa'));
}

/** From this season's box totals. */
export function fromBox(r: PlayerTotalsRow, season: number): Profile | undefined {
  const v = (k: keyof typeof P) => r[P[k]] as number;
  return profile(season, v('gp'), v('min'), v('pts'), v('ast'), v('oreb') + v('dreb'), v('fga'), v('fta'), v('tpa'));
}

/** League average of each metric per season, from players with 500+ minutes (weighted by minutes). */
export function leagueBySeason(careers: CareerData, seasons: number[]): Map<number, Profile> {
  const want = new Set(seasons);
  const sums = new Map<number, { min: number; g: number; pts: number; ast: number; trb: number; fga: number; fta: number; tpa: number }>();
  for (const rows of careers.seasons) {
    for (const r of rows) {
      const s = r[COL.season];
      if (!want.has(s) || r[COL.lg] !== 0 || r[COL.mp] < 500 || r[COL.fga] < 0) continue;
      const x = sums.get(s) ?? { min: 0, g: 0, pts: 0, ast: 0, trb: 0, fga: 0, fta: 0, tpa: 0 };
      x.min += r[COL.mp];
      x.g += r[COL.g];
      x.pts += r[COL.pts];
      x.ast += Math.max(0, r[COL.ast]);
      x.trb += Math.max(0, r[COL.trb]);
      x.fga += r[COL.fga];
      x.fta += Math.max(0, r[COL.fta]);
      x.tpa += Math.max(0, r[COL.tpa]);
      sums.set(s, x);
    }
  }
  return new Map([...sums].flatMap(([s, x]) => {
    const p = profile(s, x.g, x.min, x.pts, x.ast, x.trb, x.fga, x.fta, x.tpa);
    return p ? [[s, p] as [number, Profile]] : [];
  }));
}

export interface Change {
  id: string;
  teamId: string;
  before: Profile;
  now: Profile;
  change: number;
}

/**
 * This season against last for every player with enough games in both: last
 * season 20+ games and 10+ minutes; this season half the team's games so far
 * (up to 10) and 10+ minutes.
 */
export function changes(now: PlayerTotalsRow[], prev: PlayerTotalsRow[], season: number, metric: Metric, teamGames: number): Change[] {
  const before = new Map(prev.map((r) => [r[0], r]));
  const need = Math.min(10, Math.max(1, Math.floor(teamGames / 2)));
  const out: Change[] = [];
  for (const r of now) {
    const b = before.get(r[0]);
    const pn = fromBox(r, season);
    const pb = b && fromBox(b, season - 1);
    if (!pn || !pb || pb.g < 20 || pb.mpg < 10 || pn.g < need || pn.mpg < 10) continue;
    out.push({ id: r[0], teamId: r[1], before: pb, now: pn, change: pn[metric] - pb[metric] });
  }
  return out.sort((a, b) => b.change - a.change);
}
