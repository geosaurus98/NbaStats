// Calculations over every game's player lines: the best line each night,
// who is running hot or cold, and season totals as of any date.
import type { SeasonSnapshot } from '../api/snapshot';
import { gameScore, L, type BoxTotals, type GameLines, type PlayerTotalsRow, type SeasonLines, type TeamTotalsRow } from './boxTotals';

/** The US calendar day a game was played (tip-offs are in the evening, US time). */
export const usDay = (iso: string) => new Date(new Date(iso).getTime() - 6 * 3600e3).toISOString().slice(0, 10);

export interface NightBest {
  day: string;
  gameId: string;
  playerId: string;
  teamId: string;
  oppId: string;
  line: number[];
  gmsc: number;
  won: boolean;
}

/** Each night's best single game (by Game Score), newest first; top `perNight` per night. */
export function nightlyBest(data: SeasonLines, seasonType = 2, perNight = 3): { day: string; best: NightBest[] }[] {
  const byDay = new Map<string, NightBest[]>();
  for (const g of data.games) {
    if (g[2] !== seasonType) continue;
    const [gameId, date, , homeId, awayId] = g;
    const pts = { home: 0, away: 0 };
    for (const l of g[6]) pts[l[L.home] ? 'home' : 'away'] += l[L.pts];
    for (const l of g[6]) {
      const home = !!l[L.home];
      const list = byDay.get(usDay(date)) ?? [];
      list.push({ day: usDay(date), gameId, playerId: data.ids[l[L.p]], teamId: home ? homeId : awayId, oppId: home ? awayId : homeId, line: l, gmsc: gameScore(l), won: home ? pts.home > pts.away : pts.away > pts.home });
      byDay.set(usDay(date), list);
    }
  }
  return [...byDay]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([day, list]) => ({ day, best: list.sort((a, b) => b.gmsc - a.gmsc).slice(0, perNight) }));
}

export interface Streak {
  playerId: string;
  teamId: string;
  games: number;
  season: { pts: number; gmsc: number; min: number };
  recent: { pts: number; gmsc: number; min: number };
}

/** Last-n-games form vs the season so far, for regulars (20+ minutes, 2n+ games). */
export function form(data: SeasonLines, n = 10, seasonType = 2): Streak[] {
  const byPlayer = new Map<number, { teamId: string; lines: number[][] }>();
  for (const g of [...data.games].filter((x) => x[2] === seasonType).sort((a, b) => a[1].localeCompare(b[1]))) {
    for (const l of g[6]) {
      const row = byPlayer.get(l[L.p]) ?? { teamId: '', lines: [] };
      row.teamId = l[L.home] ? g[3] : g[4];
      row.lines.push(l);
      byPlayer.set(l[L.p], row);
    }
  }
  const avg = (ls: number[][]) => ({
    pts: ls.reduce((a, l) => a + l[L.pts], 0) / ls.length,
    gmsc: ls.reduce((a, l) => a + gameScore(l), 0) / ls.length,
    min: ls.reduce((a, l) => a + l[L.min], 0) / ls.length,
  });
  const out: Streak[] = [];
  for (const [p, { teamId, lines }] of byPlayer) {
    if (lines.length < 2 * n) continue;
    const season = avg(lines);
    if (season.min < 20) continue;
    out.push({ playerId: data.ids[p], teamId, games: lines.length, season, recent: avg(lines.slice(-n)) });
  }
  return out;
}

/** Season box-score totals from games before `before` (ISO date), in the snapshot's BoxTotals shape. */
export function totalsBefore(data: SeasonLines, before: string, seasonType = 2): BoxTotals {
  const players = new Map<number, PlayerTotalsRow>();
  const teams = new Map<string, TeamTotalsRow>();
  for (const g of data.games) {
    if (g[2] !== seasonType || !g[5] || g[1] >= before) continue;
    const side = { home: { pts: 0, fga: 0, fta: 0, oreb: 0, tov: 0 }, away: { pts: 0, fga: 0, fta: 0, oreb: 0, tov: 0 } };
    for (const l of g[6]) {
      const teamId = l[L.home] ? g[3] : g[4];
      const row = players.get(l[L.p]) ?? ([data.ids[l[L.p]], teamId, ...Array(18).fill(0)] as PlayerTotalsRow);
      row[1] = teamId;
      (row[2] as number)++;
      if (l[L.starter]) (row[3] as number)++;
      for (let k = L.min; k <= L.pm; k++) (row[k + 1] as number) += l[k];
      players.set(l[L.p], row);
      const s = side[l[L.home] ? 'home' : 'away'];
      s.pts += l[L.pts];
      s.fga += l[L.fga];
      s.fta += l[L.fta];
      s.oreb += l[L.oreb];
      s.tov += l[L.tov];
    }
    const poss = (s: typeof side.home) => s.fga + 0.44 * s.fta - s.oreb + s.tov;
    for (const [id, us, them] of [[g[3], side.home, side.away], [g[4], side.away, side.home]] as const) {
      const row = teams.get(id) ?? [id, 0, 0, 0, 0, 0];
      (row[1] as number)++;
      (row[2] as number) += us.pts;
      (row[3] as number) += them.pts;
      (row[4] as number) += poss(us);
      (row[5] as number) += poss(them);
      teams.set(id, row);
    }
  }
  return { players: [...players.values()], teams: [...teams.values()] };
}

/**
 * A copy of the snapshot as it stood before `before`: box totals and results
 * up to then (on/off splits are season-long, so they're left out).
 */
export function snapshotBefore(snap: SeasonSnapshot, data: SeasonLines, before: string): SeasonSnapshot {
  const box = totalsBefore(data, before);
  return {
    ...snap,
    games: { ...snap.games, 2: (snap.games['2'] ?? []).filter((g) => g[1] < before) },
    box: { 2: { ...box, rookies: snap.box?.['2']?.rookies } },
    lineups: undefined,
  };
}

export type { GameLines };
