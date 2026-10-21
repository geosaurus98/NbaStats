// Per-franchise history: seasons, titles, all-time leaders (only the seasons
// spent with that franchise, split correctly for traded players) and drafts.
import { COL, type CareerData, type StatKey } from './careers';
import { CHAMPIONS, type FranchiseData } from './franchiseData';
import { franchiseOf } from './franchises';
import type { Graph } from './teammates';

const fr = (code: string) => franchiseOf(code)?.id ?? code;

export function franchiseSeasons(data: FranchiseData, id: string) {
  return data.teamSeasons.filter((s) => fr(s[2]) === id).sort((a, b) => a[0] - b[0]);
}

export function titlesOf(id: string): number[] {
  return Object.entries(CHAMPIONS)
    .filter(([, code]) => fr(code) === id)
    .map(([y]) => Number(y))
    .sort((a, b) => a - b);
}

/** Names the franchise has played under, with their first and last seasons. */
export function eras(seasons: FranchiseData['teamSeasons']): { name: string; code: string; from: number; to: number; league: number }[] {
  const out: { name: string; code: string; from: number; to: number; league: number }[] = [];
  for (const [season, league, code, name] of seasons) {
    const last = out[out.length - 1];
    if (last && last.name === name) last.to = season;
    else out.push({ name, code, from: season, to: season, league });
  }
  return out;
}

const STAT_COL: Record<StatKey, number> = { g: 4, pts: 5, trb: 6, ast: 7, stl: 8, blk: 9, mp: 10, tp: -1 };

export interface FranchiseLeader {
  player: number;
  value: number;
  games: number;
  from: number;
  to: number;
}

/** Totals with one franchise for every player who played for it. */
export function franchiseTotals(graph: Graph, careers: CareerData, id: string): Map<number, Record<StatKey, number> & { from: number; to: number }> {
  const splits = new Map<string, (number | string)[][]>();
  for (const row of careers.splits ?? []) {
    const key = `${row[0]}|${row[1]}`;
    splits.set(key, [...(splits.get(key) ?? []), row]);
  }
  const out = new Map<number, Record<StatKey, number> & { from: number; to: number }>();
  const bump = (p: number, season: number, vals: Partial<Record<StatKey, number>>) => {
    const t = out.get(p) ?? { pts: 0, trb: 0, ast: 0, stl: 0, blk: 0, tp: 0, g: 0, mp: 0, from: season, to: season };
    for (const [k, v] of Object.entries(vals) as [StatKey, number][]) if (v > 0) t[k] += v;
    t.from = Math.min(t.from, season);
    t.to = Math.max(t.to, season);
    out.set(p, t);
  };
  careers.seasons.forEach((rows, p) => {
    for (const r of rows) {
      const season = r[COL.season];
      const parts = splits.get(`${p}|${season}`);
      if (parts) {
        for (const s of parts) {
          if (fr(String(s[3])) !== id) continue;
          bump(p, season, Object.fromEntries(Object.entries(STAT_COL).filter(([, c]) => c >= 0).map(([k, c]) => [k, Number(s[c])])));
        }
        continue;
      }
      // One team that season: find it from the roster data.
      const code = (graph.data.stints[p] ?? []).map((ri) => graph.data.rosters[ri]).find((ro) => ro[0] === season)?.[2];
      if (!code || fr(code) !== id) continue;
      bump(p, season, { g: r[COL.g], pts: r[COL.pts], trb: r[COL.trb], ast: r[COL.ast], stl: r[COL.stl], blk: r[COL.blk], mp: r[COL.mp], tp: r[COL.tp] });
    }
  });
  return out;
}

export function franchiseLeaders(totals: ReturnType<typeof franchiseTotals>, k: StatKey, top = 10): FranchiseLeader[] {
  return [...totals]
    .filter(([, t]) => t[k] > 0)
    .sort((a, b) => b[1][k] - a[1][k])
    .slice(0, top)
    .map(([player, t]) => ({ player, value: t[k], games: t.g, from: t.from, to: t.to }));
}

export function franchiseDraft(data: FranchiseData, id: string) {
  return data.draft.filter((d) => fr(d[4]) === id);
}
