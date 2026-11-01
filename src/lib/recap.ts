// Weekly recap: a Monday-to-Sunday NBA week (US dates) summed up: team
// records, standings movers, upsets, the best performances and new season highs.
import type { Game } from '../api/types';
import { gameScore, L, type SeasonLines } from './boxTotals';
import { addDays, parseISODate, usDate } from './dates';
import { countsInStandings, isFinal, sides, won } from './league';

/** Monday of the US week containing `day` (YYYY-MM-DD). */
export function weekStart(day: string): string {
  const dow = (parseISODate(day).getDay() + 6) % 7; // Monday = 0
  return addDays(day, -dow);
}

const dayOf = (g: { date: string }) => usDate(new Date(g.date));
const inWeek = (day: string, start: string) => day >= start && day <= addDays(start, 6);

export interface TeamWeek {
  teamId: string;
  w: number;
  l: number;
  margin: number;
}

/** Each team's record and point margin in the week. */
export function weekRecords(games: Game[], start: string): TeamWeek[] {
  const by = new Map<string, TeamWeek>();
  for (const g of games) {
    if (!isFinal(g) || !countsInStandings(g) || !inWeek(dayOf(g), start)) continue;
    for (const t of [g.home.team.id, g.away.team.id]) {
      const [us, them] = sides(g, t);
      const r = by.get(t) ?? { teamId: t, w: 0, l: 0, margin: 0 };
      if (won(g, t)) r.w++;
      else r.l++;
      r.margin += (us.score ?? 0) - (them.score ?? 0);
      by.set(t, r);
    }
  }
  return [...by.values()].sort((a, b) => b.w - b.l - (a.w - a.l) || b.margin - a.margin);
}

/** Conference rank of every team using games before `day` (exclusive): win %, then wins. */
export function ranksBefore(games: Game[], conferenceOf: Map<string, string>, day: string): Map<string, number> {
  const rec = new Map<string, [number, number]>();
  for (const t of conferenceOf.keys()) rec.set(t, [0, 0]);
  for (const g of games) {
    if (!isFinal(g) || !countsInStandings(g) || dayOf(g) >= day) continue;
    for (const t of [g.home.team.id, g.away.team.id]) {
      const r = rec.get(t) ?? [0, 0];
      if (won(g, t)) r[0]++;
      else r[1]++;
      rec.set(t, r);
    }
  }
  const pct = ([w, l]: [number, number]) => (w + l ? w / (w + l) : 0.5);
  const out = new Map<string, number>();
  for (const conf of new Set(conferenceOf.values())) {
    const teams = [...conferenceOf].filter(([, c]) => c === conf).map(([t]) => t);
    teams.sort((a, b) => pct(rec.get(b)!) - pct(rec.get(a)!) || rec.get(b)![0] - rec.get(a)![0]);
    teams.forEach((t, i) => out.set(t, i + 1));
  }
  return out;
}

export interface Mover {
  teamId: string;
  from: number;
  to: number;
}

/** Biggest climbs and falls in the conference standings over the week. */
export function standingsMovers(games: Game[], conferenceOf: Map<string, string>, start: string): Mover[] {
  const before = ranksBefore(games, conferenceOf, start);
  const after = ranksBefore(games, conferenceOf, addDays(start, 7));
  return [...conferenceOf.keys()]
    .map((t) => ({ teamId: t, from: before.get(t)!, to: after.get(t)! }))
    .filter((m) => m.from !== m.to)
    .sort((a, b) => Math.abs(b.from - b.to) - Math.abs(a.from - a.to));
}

export interface Performance {
  playerId: string;
  teamId: string;
  gameId: string;
  day: string;
  line: number[];
  gameScore: number;
}

/** The week's best single games by Game Score. */
export function bestGames(lines: SeasonLines, start: string, n = 8): Performance[] {
  const out: Performance[] = [];
  for (const [gameId, date, type, homeId, awayId, , gl] of lines.games) {
    const day = dayOf({ date });
    if (type !== 2 || !inWeek(day, start)) continue;
    for (const l of gl) {
      if (l[L.min] <= 0) continue;
      out.push({ playerId: lines.ids[l[L.p]], teamId: l[L.home] ? homeId : awayId, gameId, day, line: l, gameScore: gameScore(l) });
    }
  }
  return out.sort((a, b) => b.gameScore - a.gameScore).slice(0, n);
}

export interface PlayerWeek {
  playerId: string;
  teamId: string;
  games: number;
  pts: number;
  reb: number;
  ast: number;
  gameScore: number;
}

/** Players of the week: best average Game Score with at least `minGames` games. */
export function playersOfWeek(lines: SeasonLines, start: string, minGames = 2, n = 5): PlayerWeek[] {
  const by = new Map<string, PlayerWeek>();
  for (const [, date, type, homeId, awayId, , gl] of lines.games) {
    if (type !== 2 || !inWeek(dayOf({ date }), start)) continue;
    for (const l of gl) {
      if (l[L.min] <= 0) continue;
      const id = lines.ids[l[L.p]];
      const r = by.get(id) ?? { playerId: id, teamId: l[L.home] ? homeId : awayId, games: 0, pts: 0, reb: 0, ast: 0, gameScore: 0 };
      r.games++;
      r.pts += l[L.pts];
      r.reb += l[L.oreb] + l[L.dreb];
      r.ast += l[L.ast];
      r.gameScore += gameScore(l);
      by.set(id, r);
    }
  }
  return [...by.values()]
    .filter((r) => r.games >= minGames)
    .map((r) => ({ ...r, pts: r.pts / r.games, reb: r.reb / r.games, ast: r.ast / r.games, gameScore: r.gameScore / r.games }))
    .sort((a, b) => b.gameScore - a.gameScore)
    .slice(0, n);
}

/** New season highs in points set during the week (only counting players who had played 5+ games before). */
export function newSeasonHighs(lines: SeasonLines, start: string): { playerId: string; pts: number; previous: number; gameId: string }[] {
  const games = [...lines.games].filter((g) => g[2] === 2).sort((a, b) => a[1].localeCompare(b[1]));
  const best = new Map<number, { pts: number; games: number }>();
  const out = new Map<string, { playerId: string; pts: number; previous: number; gameId: string }>();
  for (const [gameId, date, , , , , gl] of games) {
    const day = dayOf({ date });
    if (day > addDays(start, 6)) break;
    for (const l of gl) {
      if (l[L.min] <= 0) continue;
      const prev = best.get(l[L.p]) ?? { pts: 0, games: 0 };
      if (inWeek(day, start) && prev.games >= 5 && l[L.pts] > prev.pts) {
        const id = lines.ids[l[L.p]];
        const first = out.get(id);
        out.set(id, { playerId: id, pts: l[L.pts], previous: first?.previous ?? prev.pts, gameId });
      }
      best.set(l[L.p], { pts: Math.max(prev.pts, l[L.pts]), games: prev.games + 1 });
    }
  }
  return [...out.values()].sort((a, b) => b.pts - b.previous - (a.pts - a.previous));
}

/** Monday of every week that had a regular-season game, newest first. */
export function weeksWithGames(games: Game[]): string[] {
  return [...new Set(games.filter((g) => isFinal(g) && countsInStandings(g)).map((g) => weekStart(dayOf(g))))].sort().reverse();
}
