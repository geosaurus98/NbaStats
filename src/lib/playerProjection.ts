// Projected box scores for an upcoming game: each likely player's minutes,
// points, rebounds, assists and threes from recent form and the season,
// adjusted for what the opponent allows, plus the chance of 30 points, a
// double-double and a triple-double.
import { L, type SeasonLines } from './boxTotals';

const STATS = ['min', 'pts', 'reb', 'ast', 'tpm', 'stl', 'blk'] as const;
type Stat = (typeof STATS)[number];
const value = (l: number[], s: Stat) => (s === 'reb' ? l[L.oreb] + l[L.dreb] : l[L[s]]);

export interface Projection {
  playerId: string;
  teamId: string;
  games: number;
  mean: Record<Stat, number>;
  p30: number;
  pDouble: number;
  pTriple: number;
}

/** What each team allows per game against the league average, per stat (1 = average). */
export function allowedFactors(lines: SeasonLines): Map<string, Record<'pts' | 'reb' | 'ast' | 'tpm', number>> {
  const sums = new Map<string, { g: number; pts: number; reb: number; ast: number; tpm: number }>();
  const league = { g: 0, pts: 0, reb: 0, ast: 0, tpm: 0 };
  for (const [, , type, homeId, awayId, , gl] of lines.games) {
    if (type !== 2) continue;
    for (const [defId, attackHome] of [[homeId, false], [awayId, true]] as const) {
      const t = { pts: 0, reb: 0, ast: 0, tpm: 0 };
      for (const l of gl) {
        if (!!l[L.home] !== attackHome) continue;
        t.pts += l[L.pts];
        t.reb += l[L.oreb] + l[L.dreb];
        t.ast += l[L.ast];
        t.tpm += l[L.tpm];
      }
      const s = sums.get(defId) ?? { g: 0, pts: 0, reb: 0, ast: 0, tpm: 0 };
      s.g++;
      league.g++;
      for (const k of ['pts', 'reb', 'ast', 'tpm'] as const) {
        s[k] += t[k];
        league[k] += t[k];
      }
      sums.set(defId, s);
    }
  }
  const out = new Map<string, Record<'pts' | 'reb' | 'ast' | 'tpm', number>>();
  for (const [id, s] of sums) {
    const f = (k: 'pts' | 'reb' | 'ast' | 'tpm') => (league[k] && s.g ? s[k] / s.g / (league[k] / league.g) : 1);
    out.set(id, { pts: f('pts'), reb: f('reb'), ast: f('ast'), tpm: f('tpm') });
  }
  return out;
}

/** Standard normal CDF (Abramowitz-Stegun). */
function phi(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/** A small seeded random number generator, so the chances don't change on every render. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Projections for one team's likely players against `opponentId`: anyone who
 * played in its last five games and isn't listed as out.
 */
export function projectTeam(lines: SeasonLines, teamId: string, opponentId: string, out: Set<string> = new Set(), factors = allowedFactors(lines)): Projection[] {
  const games = lines.games.filter((g) => g[2] === 2 && (g[3] === teamId || g[4] === teamId)).sort((a, b) => a[1].localeCompare(b[1]));
  const recent = new Set<number>();
  for (const g of games.slice(-5)) for (const l of g[6]) if (!!l[L.home] === (g[3] === teamId) && l[L.min] > 0) recent.add(l[L.p]);
  const opp = factors.get(opponentId);
  const rand = seeded(teamId.length * 7919 + Number(opponentId) || 1);
  const result: Projection[] = [];
  for (const p of recent) {
    const id = lines.ids[p];
    if (out.has(id)) continue;
    const mine = games.flatMap((g) => g[6].filter((l) => l[L.p] === p && l[L.min] > 0 && !!l[L.home] === (g[3] === teamId)));
    if (mine.length < 3) continue;
    const last = mine.slice(-10);
    const avg = (ls: number[][], s: Stat) => ls.reduce((a, l) => a + value(l, s), 0) / ls.length;
    const sd = (s: Stat, m: number) => Math.max(s === 'pts' ? 4 : 1.5, Math.sqrt(mine.reduce((a, l) => a + (value(l, s) - m) ** 2, 0) / mine.length));
    const mean = {} as Record<Stat, number>;
    for (const s of STATS) {
      let m = 0.6 * avg(last, s) + 0.4 * avg(mine, s);
      // Half of the opponent's tendency to allow more or less than average.
      if (opp && (s === 'pts' || s === 'reb' || s === 'ast' || s === 'tpm')) m *= 1 + 0.5 * (opp[s] - 1);
      mean[s] = m;
    }
    const sds = Object.fromEntries((['pts', 'reb', 'ast', 'stl', 'blk'] as const).map((s) => [s, sd(s, avg(mine, s))])) as Record<'pts' | 'reb' | 'ast' | 'stl' | 'blk', number>;
    const p30 = 1 - phi((29.5 - mean.pts) / sds.pts);
    // Double- and triple-doubles: simulated draws of the five counting stats.
    const N = 2000;
    let dd = 0;
    let td = 0;
    for (let k = 0; k < N; k++) {
      let tens = 0;
      for (const s of ['pts', 'reb', 'ast', 'stl', 'blk'] as const) {
        const u = Math.max(1e-9, rand());
        const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
        if (mean[s] + z * sds[s] >= 9.5) tens++;
      }
      if (tens >= 2) dd++;
      if (tens >= 3) td++;
    }
    result.push({ playerId: id, teamId, games: mine.length, mean, p30, pDouble: dd / N, pTriple: td / N });
  }
  return result.sort((a, b) => b.mean.min - a.mean.min);
}
