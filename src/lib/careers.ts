// All-time season totals, awards and All-Star selections (player index =
// teammates.json index). Stats not recorded in a season are -1: rebounds
// before 1950-51, steals/blocks before 1973-74, threes before 1979-80.

/** [season, league (0 NBA, 1 ABA, 2 BAA), age, g, mp, pts, trb, ast, stl, blk, fg, fga, 3p, 3pa, ft, fta] */
export type SeasonRow = number[];

export interface CareerData {
  source: string;
  seasons: SeasonRow[][];
  /** award id ("nba mvp") → [season, player, voteShare, winner (0/1), firstPlaceVotes] */
  awards: Record<string, [number, number, number, number, number][]>;
  /** [season, player] */
  allStars: [number, number][];
}

export const COL = { season: 0, lg: 1, age: 2, g: 3, mp: 4, pts: 5, trb: 6, ast: 7, stl: 8, blk: 9, fg: 10, fga: 11, tp: 12, tpa: 13, ft: 14, fta: 15 } as const;
export type StatKey = 'pts' | 'trb' | 'ast' | 'stl' | 'blk' | 'tp' | 'g' | 'mp';

export const STAT_LABELS: Record<StatKey, string> = {
  pts: 'Points',
  trb: 'Rebounds',
  ast: 'Assists',
  stl: 'Steals',
  blk: 'Blocks',
  tp: 'Threes made',
  g: 'Games',
  mp: 'Minutes',
};

export const LEAGUE_NAMES = ['NBA', 'ABA', 'BAA'];

export interface Totals {
  seasons: number;
  g: number;
  values: Record<StatKey, number>;
  /** Games in seasons where the stat was recorded (for per-game averages). */
  gamesWith: Record<StatKey, number>;
  fg: number;
  fga: number;
  tp: number;
  tpa: number;
  ft: number;
  fta: number;
}

const KEYS: StatKey[] = ['pts', 'trb', 'ast', 'stl', 'blk', 'tp', 'g', 'mp'];

export function totals(rows: SeasonRow[], filter: (r: SeasonRow) => boolean = () => true): Totals {
  const t: Totals = {
    seasons: 0,
    g: 0,
    values: Object.fromEntries(KEYS.map((k) => [k, 0])) as Record<StatKey, number>,
    gamesWith: Object.fromEntries(KEYS.map((k) => [k, 0])) as Record<StatKey, number>,
    fg: 0,
    fga: 0,
    tp: 0,
    tpa: 0,
    ft: 0,
    fta: 0,
  };
  const seasons = new Set<number>();
  for (const r of rows) {
    if (!filter(r)) continue;
    seasons.add(r[COL.season]);
    const g = Math.max(0, r[COL.g]);
    t.g += g;
    for (const k of KEYS) {
      const v = r[COL[k]];
      if (v >= 0) {
        t.values[k] += v;
        t.gamesWith[k] += g;
      }
    }
    for (const k of ['fg', 'fga', 'tp', 'tpa', 'ft', 'fta'] as const) if (r[COL[k]] > 0) t[k] += r[COL[k]];
  }
  t.seasons = seasons.size;
  return t;
}

export function perGame(t: Totals, k: StatKey): number | undefined {
  return t.gamesWith[k] ? t.values[k] / t.gamesWith[k] : undefined;
}

export const pct = (made: number, att: number) => (att ? made / att : undefined);

export interface LeaderRow {
  player: number;
  value: number;
  games: number;
}

/** Career leaders: totals, or per-game averages with a minimum of `minGames`. */
export function careerLeaders(data: CareerData, k: StatKey, mode: 'total' | 'perGame', minGames = 400, top = 25, nbaOnly = false): LeaderRow[] {
  const rows: LeaderRow[] = [];
  data.seasons.forEach((s, p) => {
    if (!s.length) return;
    const t = totals(s, nbaOnly ? (r) => r[COL.lg] === 0 : undefined);
    if (mode === 'total') {
      if (t.values[k] > 0) rows.push({ player: p, value: t.values[k], games: t.g });
    } else if (t.gamesWith[k] >= minGames) {
      rows.push({ player: p, value: t.values[k] / t.gamesWith[k], games: t.gamesWith[k] });
    }
  });
  return rows.sort((a, b) => b.value - a.value).slice(0, top);
}

export interface SeasonBest {
  player: number;
  season: number;
  league: number;
  value: number;
  games: number;
}

/** Best single seasons by per-game average (minimum 50 games, or 58% of a 82-game schedule pro rata). */
export function seasonBests(data: CareerData, k: StatKey, top = 25, minGames = 50): SeasonBest[] {
  const out: SeasonBest[] = [];
  data.seasons.forEach((s, p) => {
    for (const r of s) {
      const v = r[COL[k]];
      const g = r[COL.g];
      if (v < 0 || g < minGames) continue;
      out.push({ player: p, season: r[COL.season], league: r[COL.lg], value: v / g, games: g });
    }
  });
  return out.sort((a, b) => b.value - a.value).slice(0, top);
}

/** Per-game value by age for career-arc charts (traded seasons are already combined). */
export function arcByAge(rows: SeasonRow[], k: StatKey): { age: number; value: number; season: number }[] {
  const byAge = new Map<number, { v: number; g: number; season: number }>();
  for (const r of rows) {
    const age = r[COL.age];
    const v = r[COL[k]];
    const g = r[COL.g];
    if (age < 0 || v < 0 || g <= 0) continue;
    const a = byAge.get(age) ?? { v: 0, g: 0, season: r[COL.season] };
    a.v += v;
    a.g += g;
    byAge.set(age, a);
  }
  return [...byAge].sort((a, b) => a[0] - b[0]).map(([age, a]) => ({ age, value: a.v / a.g, season: a.season }));
}

export function allStarCounts(data: CareerData): Map<number, number> {
  const m = new Map<number, number>();
  for (const [, p] of data.allStars) m.set(p, (m.get(p) ?? 0) + 1);
  return m;
}

export function awardsOf(data: CareerData, player: number): { award: string; season: number }[] {
  const out: { award: string; season: number }[] = [];
  for (const [award, rows] of Object.entries(data.awards)) for (const [season, p, , winner] of rows) if (p === player && winner) out.push({ award, season });
  return out.sort((a, b) => a.season - b.season);
}

export const AWARD_NAMES: Record<string, string> = {
  'nba mvp': 'MVP',
  'nba dpoy': 'Defensive Player of the Year',
  'nba roy': 'Rookie of the Year',
  'nba smoy': 'Sixth Man of the Year',
  'nba mip': 'Most Improved Player',
  'nba clutch_poy': 'Clutch Player of the Year',
  'aba mvp': 'ABA MVP',
  'aba roy': 'ABA Rookie of the Year',
  'baa roy': 'BAA Rookie of the Year',
};

let pending: Promise<CareerData> | undefined;

/** Loaded on demand: it's the largest data file. */
export function loadCareers(): Promise<CareerData> {
  pending ??= import('../data/careers.json').then((m) => (m.default ?? m) as unknown as CareerData);
  return pending;
}
