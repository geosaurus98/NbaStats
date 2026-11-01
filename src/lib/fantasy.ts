// Fantasy basketball: points in common league formats, nine-category value,
// hot pickups (recent form well above the season) and games per team in a week.
import type { CompactGame } from '../api/snapshot';
import { L, type SeasonLines } from './boxTotals';
import { usDay } from './gameLines';

export const FORMATS = {
  espn: { label: 'ESPN points', w: { pts: 1, tpm: 1, fga: -1, fgm: 2, fta: -1, ftm: 1, reb: 1, ast: 2, stl: 4, blk: 4, tov: -2 } },
  yahoo: { label: 'Yahoo points', w: { pts: 1, reb: 1.2, ast: 1.5, stl: 3, blk: 3, tov: -1 } },
  dk: { label: 'DraftKings', w: { pts: 1, tpm: 0.5, reb: 1.25, ast: 1.5, stl: 2, blk: 2, tov: -0.5 }, dd: 1.5, td: 3 },
} as const;
export type FormatId = keyof typeof FORMATS;
type Stat = 'pts' | 'tpm' | 'fga' | 'fgm' | 'fta' | 'ftm' | 'reb' | 'ast' | 'stl' | 'blk' | 'tov';

const stat = (l: number[], s: Stat) =>
  s === 'reb' ? l[L.oreb] + l[L.dreb] : s === 'pts' ? l[L.pts] : s === 'tpm' ? l[L.tpm] : s === 'fga' ? l[L.fga] : s === 'fgm' ? l[L.fgm] : s === 'fta' ? l[L.fta] : s === 'ftm' ? l[L.ftm] : s === 'ast' ? l[L.ast] : s === 'stl' ? l[L.stl] : s === 'blk' ? l[L.blk] : l[L.tov];

/** Fantasy points for one game line. */
export function fantasyPoints(l: number[], format: FormatId): number {
  const f = FORMATS[format];
  let pts = 0;
  for (const [k, w] of Object.entries(f.w)) pts += w * stat(l, k as Stat);
  if ('dd' in f) {
    const tens = [l[L.pts], l[L.oreb] + l[L.dreb], l[L.ast], l[L.stl], l[L.blk]].filter((v) => v >= 10).length;
    if (tens >= 2) pts += f.dd;
    if (tens >= 3) pts += f.td;
  }
  return pts;
}

export interface FantasyRow {
  id: string;
  team: string;
  games: number;
  mpg: number;
  fppg: number;
  /** Average over the last `recent` games played. */
  recent: number;
  recentMpg: number;
  /** Nine-category value: sum of per-game standard scores (FG% and FT% weighted by attempts). */
  nineCat: number;
  cats: Record<string, number>;
}

/** Every player's fantasy line for the regular season (or the last `days` of it). */
export function fantasyTable(data: SeasonLines, format: FormatId, recent = 5): FantasyRow[] {
  const games = data.games.filter((g) => g[2] === 2).sort((a, b) => a[1].localeCompare(b[1]));
  const per = new Map<number, { team: string; lines: number[][] }>();
  for (const [, , , homeId, awayId, , lines] of games) {
    for (const l of lines) {
      if (l[L.min] <= 0) continue;
      const p = per.get(l[L.p]) ?? { team: '', lines: [] };
      p.team = l[L.home] ? homeId : awayId;
      p.lines.push(l);
      per.set(l[L.p], p);
    }
  }
  const rows = [...per].map(([p, { team, lines }]) => {
    const n = lines.length;
    const sum = (f: (l: number[]) => number, ls = lines) => ls.reduce((s, l) => s + f(l), 0);
    const last = lines.slice(-recent);
    const avg = (s: Stat) => sum((l) => stat(l, s)) / n;
    return {
      id: data.ids[p],
      team,
      games: n,
      mpg: sum((l) => l[L.min]) / n,
      fppg: sum((l) => fantasyPoints(l, format)) / n,
      recent: sum((l) => fantasyPoints(l, format), last) / last.length,
      recentMpg: sum((l) => l[L.min], last) / last.length,
      raw: { pts: avg('pts'), reb: avg('reb'), ast: avg('ast'), stl: avg('stl'), blk: avg('blk'), tpm: avg('tpm'), tov: avg('tov'), fgm: avg('fgm'), fga: avg('fga'), ftm: avg('ftm'), fta: avg('fta') },
    };
  });
  // Nine-category z-scores against players with real minutes.
  const pool = rows.filter((r) => r.mpg >= 20 && r.games >= Math.min(5, Math.max(...rows.map((x) => x.games))));
  const lgFg = pool.reduce((s, r) => s + r.raw.fgm, 0) / Math.max(1, pool.reduce((s, r) => s + r.raw.fga, 0));
  const lgFt = pool.reduce((s, r) => s + r.raw.ftm, 0) / Math.max(1, pool.reduce((s, r) => s + r.raw.fta, 0));
  const value = (r: (typeof rows)[number]): Record<string, number> => ({
    pts: r.raw.pts,
    reb: r.raw.reb,
    ast: r.raw.ast,
    stl: r.raw.stl,
    blk: r.raw.blk,
    tpm: r.raw.tpm,
    tov: -r.raw.tov,
    fg: r.raw.fgm - lgFg * r.raw.fga,
    ft: r.raw.ftm - lgFt * r.raw.fta,
  });
  const cats = Object.keys(value(rows[0] ?? ({ raw: {} } as never)));
  const stats = Object.fromEntries(
    cats.map((c) => {
      const xs = pool.map((r) => value(r)[c]);
      const m = xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
      const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length)) || 1;
      return [c, { m, sd }];
    }),
  );
  return rows.map(({ raw: _raw, ...r }) => {
    const v = value({ ...r, raw: _raw });
    const z = Object.fromEntries(cats.map((c) => [c, (v[c] - stats[c].m) / stats[c].sd]));
    return { ...r, cats: z, nineCat: Object.values(z).reduce((a, b) => a + b, 0) };
  });
}

/** Games for each team between two ISO dates (inclusive), and back-to-backs within them. */
export function gamesInWeek(games: CompactGame[], from: string, to: string): Map<string, { games: number; b2b: number; days: string[] }> {
  const out = new Map<string, { games: number; b2b: number; days: string[] }>();
  for (const [, date, homeId, awayId] of games) {
    const d = usDay(date);
    if (d < from || d > to) continue;
    for (const t of [homeId, awayId]) {
      const r = out.get(t) ?? { games: 0, b2b: 0, days: [] };
      r.games++;
      r.days.push(d);
      out.set(t, r);
    }
  }
  for (const r of out.values()) {
    r.days.sort();
    r.b2b = r.days.filter((d, i) => i > 0 && Date.parse(d) - Date.parse(r.days[i - 1]) === 864e5).length;
  }
  return out;
}

/** Monday-to-Sunday weeks: this one (containing `today`) and the next. */
export function fantasyWeeks(today: string): [string, string][] {
  const d = new Date(`${today}T12:00:00Z`);
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  const add = (x: Date, n: number) => {
    const y = new Date(x);
    y.setUTCDate(y.getUTCDate() + n);
    return y;
  };
  return [
    [iso(monday), iso(add(monday, 6))],
    [iso(add(monday, 7)), iso(add(monday, 13))],
  ];
}
