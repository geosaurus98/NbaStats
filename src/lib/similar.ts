// "Most similar seasons": every NBA player-season since 1979-80 (the
// three-point era) as a point in stat space, era-adjusted by dividing by that
// season's league average, then compared by weighted distance.
import { COL, type CareerData } from './careers';

const FROM = 1980;
const MIN_MINUTES = 800;

const FEATURES = [
  { key: 'pts', label: 'points', weight: 1.5 },
  { key: 'trb', label: 'rebounds', weight: 1.2 },
  { key: 'ast', label: 'assists', weight: 1.2 },
  { key: 'stl', label: 'steals', weight: 0.6 },
  { key: 'blk', label: 'blocks', weight: 0.8 },
  { key: 'tpa', label: 'three-point attempts', weight: 1 },
  { key: 'fta', label: 'free-throw attempts', weight: 0.6 },
  { key: 'ts', label: 'true shooting', weight: 1 },
  { key: 'mpg', label: 'minutes', weight: 0.8 },
] as const;
type Key = (typeof FEATURES)[number]['key'];

export interface SeasonPoint {
  player: number;
  season: number;
  age: number;
  g: number;
  /** Raw per-game numbers for display. */
  perGame: { pts: number; trb: number; ast: number; stl: number; blk: number; tpm: number; ts: number; mpg: number };
  z: Record<Key, number>;
}

export function buildSeasonPoints(data: CareerData): SeasonPoint[] {
  const raw: { player: number; season: number; age: number; g: number; v: Record<Key, number>; pg: SeasonPoint['perGame'] }[] = [];
  data.seasons.forEach((rows, player) => {
    for (const r of rows) {
      if (r[COL.lg] !== 0 || r[COL.season] < FROM || r[COL.mp] < MIN_MINUTES || r[COL.g] <= 0) continue;
      if ([COL.stl, COL.blk, COL.tpa, COL.fta, COL.fga].some((c) => r[c] < 0)) continue;
      const per36 = (c: number) => (r[c] / r[COL.mp]) * 36;
      const tsa = 2 * (r[COL.fga] + 0.44 * r[COL.fta]);
      const ts = tsa ? r[COL.pts] / tsa : 0;
      const g = r[COL.g];
      raw.push({
        player,
        season: r[COL.season],
        age: r[COL.age],
        g,
        v: { pts: per36(COL.pts), trb: per36(COL.trb), ast: per36(COL.ast), stl: per36(COL.stl), blk: per36(COL.blk), tpa: per36(COL.tpa), fta: per36(COL.fta), ts, mpg: r[COL.mp] / g },
        pg: { pts: r[COL.pts] / g, trb: r[COL.trb] / g, ast: r[COL.ast] / g, stl: r[COL.stl] / g, blk: r[COL.blk] / g, tpm: r[COL.tp] / g, ts, mpg: r[COL.mp] / g },
      });
    }
  });
  // Era adjustment: each stat relative to that season's average among qualifying players.
  const bySeason = new Map<number, Record<Key, number>>();
  for (const season of new Set(raw.map((x) => x.season))) {
    const pool = raw.filter((x) => x.season === season);
    bySeason.set(season, Object.fromEntries(FEATURES.map((f) => [f.key, pool.reduce((a, x) => a + x.v[f.key], 0) / pool.length])) as Record<Key, number>);
  }
  const rel = raw.map((x) => {
    const avg = bySeason.get(x.season)!;
    return Object.fromEntries(FEATURES.map((f) => [f.key, f.key === 'ts' ? x.v.ts - avg.ts : f.key === 'mpg' ? x.v.mpg : x.v[f.key] / Math.max(avg[f.key], 1e-6)])) as Record<Key, number>;
  });
  const stats = FEATURES.map((f) => {
    const vals = rel.map((r) => r[f.key]);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length) || 1;
    return { key: f.key, mean, sd };
  });
  return raw.map((x, i) => ({
    player: x.player,
    season: x.season,
    age: x.age,
    g: x.g,
    perGame: x.pg,
    z: Object.fromEntries(stats.map((s) => [s.key, (rel[i][s.key] - s.mean) / s.sd])) as Record<Key, number>,
  }));
}

export interface Match {
  point: SeasonPoint;
  /** 0-100: 100 = identical profile. */
  similarity: number;
}

export function similarSeasons(points: SeasonPoint[], target: SeasonPoint, top = 10): Match[] {
  const total = FEATURES.reduce((a, f) => a + f.weight, 0);
  const dist = (a: SeasonPoint) => Math.sqrt(FEATURES.reduce((s, f) => s + f.weight * (a.z[f.key] - target.z[f.key]) ** 2, 0) / total);
  return points
    .filter((p) => p.player !== target.player)
    .map((point) => ({ point, d: dist(point) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, top)
    .map(({ point, d }) => ({ point, similarity: Math.max(0, Math.round(100 * (1 - d / 2))) }));
}
