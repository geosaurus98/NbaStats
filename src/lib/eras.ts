// Era adjustment: per-game numbers rescaled to one season's pace (and, for
// points, its scoring efficiency), so a 1962 season and a 2026 one can be
// compared. League pace comes from Basketball-Reference where it exists
// (1973-74 on); earlier seasons estimate it from shooting possessions per 48
// minutes, calibrated against the seasons where both are known.
import { COL, type CareerData } from './careers';
import { LEAGUE, type FranchiseData } from './franchiseData';

export interface EraContext {
  /** Possessions per 48 minutes. */
  pace: number;
  /** Points per shooting possession (FGA + 0.44 FTA). */
  eff: number;
}

export function eraContexts(careers: CareerData, fr: FranchiseData): Map<number, EraContext> {
  const sums = new Map<number, { pts: number; shots: number; mp: number }>();
  for (const rows of careers.seasons) {
    for (const r of rows) {
      if (r[COL.lg] !== 0 || r[COL.mp] <= 0 || r[COL.fga] < 0 || r[COL.fta] < 0) continue;
      const s = sums.get(r[COL.season]) ?? { pts: 0, shots: 0, mp: 0 };
      s.pts += r[COL.pts];
      s.shots += r[COL.fga] + 0.44 * r[COL.fta];
      s.mp += r[COL.mp];
      sums.set(r[COL.season], s);
    }
  }
  const known = new Map(fr.league.filter((l) => l[1] === 0 && l[LEAGUE.pace] != null).map((l) => [l[0] as number, l[LEAGUE.pace] as number]));
  // Shooting possessions per team 48 minutes (five players on court).
  const proxy = (s: { shots: number; mp: number }) => (s.shots / s.mp) * 48 * 5;
  const ratios = [...known].filter(([y]) => sums.has(y)).sort((a, b) => a[0] - b[0]).slice(0, 10).map(([y, pace]) => pace / proxy(sums.get(y)!));
  const k = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 1;
  const out = new Map<number, EraContext>();
  for (const [y, s] of sums) {
    if (s.mp < 10000 || s.shots <= 0) continue;
    out.set(y, { pace: known.get(y) ?? k * proxy(s), eff: s.pts / s.shots });
  }
  return out;
}

export interface AdjustedSeason {
  season: number;
  g: number;
  raw: { pts: number; trb: number; ast: number };
  adj: { pts: number; trb: number; ast: number };
}

/** A player's NBA seasons with per-game numbers rescaled to `ref`. */
export function adjustedSeasons(rows: number[][], eras: Map<number, EraContext>, ref: EraContext): AdjustedSeason[] {
  return rows.flatMap((r) => {
    const e = eras.get(r[COL.season]);
    if (r[COL.lg] !== 0 || !e || r[COL.g] <= 0) return [];
    const per = (c: number) => Math.max(0, r[c]) / r[COL.g];
    const paceF = ref.pace / e.pace;
    const raw = { pts: per(COL.pts), trb: per(COL.trb), ast: per(COL.ast) };
    return [{ season: r[COL.season], g: r[COL.g], raw, adj: { pts: raw.pts * paceF * (ref.eff / e.eff), trb: raw.trb * paceF, ast: raw.ast * paceF } }];
  });
}

/** Games-weighted career averages of adjusted seasons. */
export function careerAverage(seasons: AdjustedSeason[]): AdjustedSeason['raw'] & { adjPts: number; adjTrb: number; adjAst: number; g: number } {
  const g = seasons.reduce((s, x) => s + x.g, 0) || 1;
  const w = (f: (x: AdjustedSeason) => number) => seasons.reduce((s, x) => s + f(x) * x.g, 0) / g;
  return { g, pts: w((x) => x.raw.pts), trb: w((x) => x.raw.trb), ast: w((x) => x.raw.ast), adjPts: w((x) => x.adj.pts), adjTrb: w((x) => x.adj.trb), adjAst: w((x) => x.adj.ast) };
}
