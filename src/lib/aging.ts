// Aging curves: a player's per-game numbers by age against the all-time
// average, and the players whose careers looked most like theirs up to the
// same age (and what those players did next).
import { COL, type CareerData, type SeasonRow } from './careers';

export type AgeStat = 'pts' | 'trb' | 'ast' | 'mp';
const STATS: AgeStat[] = ['pts', 'trb', 'ast', 'mp'];

/** Per-game values at each age (traded seasons are already combined). */
export function byAge(rows: SeasonRow[]): Map<number, { g: number } & Record<AgeStat, number>> {
  const m = new Map<number, { g: number } & Record<AgeStat, number>>();
  for (const r of rows) {
    if (r[COL.lg] !== 0 || r[COL.age] < 0 || r[COL.g] <= 0 || r[COL.mp] < 0) continue;
    const a = m.get(r[COL.age]) ?? { g: 0, pts: 0, trb: 0, ast: 0, mp: 0 };
    a.g += r[COL.g];
    for (const k of STATS) a[k] += Math.max(0, r[COL[k]]);
    m.set(r[COL.age], a);
  }
  for (const a of m.values()) for (const k of STATS) a[k] /= a.g;
  return m;
}

/** Average per-game value by age across every NBA season since 1979-80 with 1,000+ minutes. */
export function leagueCurve(data: CareerData, k: AgeStat): Map<number, number> {
  const sum = new Map<number, [number, number]>();
  for (const rows of data.seasons) {
    for (const r of rows) {
      if (r[COL.lg] !== 0 || r[COL.season] < 1980 || r[COL.mp] < 1000 || r[COL.age] < 19 || r[COL.age] > 40) continue;
      const s = sum.get(r[COL.age]) ?? [0, 0];
      s[0] += Math.max(0, r[COL[k]]) / r[COL.g];
      s[1]++;
      sum.set(r[COL.age], s);
    }
  }
  return new Map([...sum].filter(([, [, n]]) => n >= 20).map(([age, [v, n]]) => [age, v / n]));
}

export interface AgeComp {
  player: number;
  /** 0-100, 100 = identical numbers at the same ages. */
  similarity: number;
  arc: Map<number, { g: number } & Record<AgeStat, number>>;
}

/**
 * The players most like `target` (per-game points, rebounds, assists and
 * minutes at the same ages, the latest seasons counting most), from those
 * who played at least two more seasons after that age.
 */
export function ageComps(data: CareerData, target: Map<number, { g: number } & Record<AgeStat, number>>, exclude: number, top = 5): AgeComp[] {
  const ages = [...target.keys()].sort((a, b) => a - b).slice(-4);
  if (!ages.length) return [];
  const last = ages[ages.length - 1];
  const scale: Record<AgeStat, number> = { pts: 6, trb: 2.5, ast: 2, mp: 7 };
  const out: { player: number; d: number; arc: AgeComp['arc'] }[] = [];
  data.seasons.forEach((rows, player) => {
    if (player === exclude || !rows.length) return;
    const arc = byAge(rows);
    if (![...arc.keys()].some((a) => a >= last + 2)) return;
    let d = 0;
    let w = 0;
    for (const [i, age] of ages.entries()) {
      const a = arc.get(age);
      const t = target.get(age)!;
      const weight = i + 1;
      if (!a || a.g < 10) return;
      for (const k of STATS) d += weight * ((a[k] - t[k]) / scale[k]) ** 2;
      w += weight * STATS.length;
    }
    out.push({ player, d: Math.sqrt(d / w), arc });
  });
  return out
    .sort((a, b) => a.d - b.d)
    .slice(0, top)
    .map(({ player, d, arc }) => ({ player, arc, similarity: Math.round(100 * Math.exp(-d)) }));
}
