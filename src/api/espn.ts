// The data API pages use. Completed seasons are served from the bundled
// snapshot (instant, works offline); anything else comes from ESPN live.
import { addDays, toISODate } from '../lib/dates';
import { leadersFromBox, teamStatsFromBox } from '../lib/boxTotals';
import { involves, isFinal, mergeResults } from '../lib/league';
import * as live from './live';
import { getSnapshot, loadSnapshot, snapshotGames, snapshotYears } from './snapshotStore';
import type { SeasonSnapshot } from './snapshot';
import type { AssistPairs, Game, Injury, TeamRef } from './types';

export type { SeasonType, SeasonHighsResult } from './live';
export { ApiError, fetchAthlete, fetchGameLog, fetchSummary, mapLimit } from './live';
type SeasonType = live.SeasonType;

export function hasSnapshot(season: number): boolean {
  return !!getSnapshot(season);
}

/**
 * Snapshot for light, single-request data: only once the season is over.
 * While it's being played, live data is fresher than last night's snapshot.
 */
function finished(season: number) {
  const snap = getSnapshot(season);
  return snap && snap.complete !== false ? snap : undefined;
}

export async function fetchStandings(season: number) {
  await loadSnapshot(season);
  const done = finished(season);
  if (done) return done.standings;
  try {
    return await live.fetchStandings(season);
  } catch (e) {
    // Season in progress and ESPN unreachable: last night's snapshot is close enough.
    const saved = getSnapshot(season)?.standings;
    if (saved?.length) return saved;
    throw e;
  }
}

export async function fetchTeams(season: number) {
  await loadSnapshot(season);
  return getSnapshot(season)?.teams ?? live.fetchTeams(season);
}

/** ESPN id → full name for every player in a snapshotted season's box scores. */
export function snapshotPlayers(season: number): Record<string, string> {
  return getSnapshot(season)?.players ?? {};
}

/** ESPN id → full name across every bundled season (newest name wins). */
export async function allSnapshotPlayers(): Promise<Record<string, string>> {
  const snaps = await Promise.all(snapshotYears().map(loadSnapshot));
  return Object.assign({}, ...snaps.reverse().map((s) => s?.players ?? {}));
}

export { loadSnapshot };

export async function fetchLeagueGames(season: number, seasonType: SeasonType): Promise<{ teams: TeamRef[]; games: Game[] }> {
  await loadSnapshot(season);
  const games = snapshotGames(season, seasonType);
  if (games) return { teams: getSnapshot(season)!.teams, games: await withRecentResults(season, seasonType, games) };
  return live.fetchLeagueGames(season, seasonType);
}

const MAX_TOP_UP_DAYS = 120;
const topUps = new Map<string, Promise<Game[]>>();

/**
 * The snapshot of a season in progress is refreshed once a day (and the
 * standalone file never), so lay ESPN's scoreboards for every day since it was
 * saved over the bundled schedule. If ESPN can't be reached, the snapshot stands.
 */
function withRecentResults(season: number, seasonType: SeasonType, games: Game[]): Promise<Game[]> {
  const snap = getSnapshot(season);
  if (!snap || snap.complete !== false) return Promise.resolve(games);
  const key = `${season}:${seasonType}`;
  if (!topUps.has(key)) {
    const today = toISODate(new Date());
    const days: string[] = [];
    for (let d = addDays(toISODate(new Date(snap.generatedAt)), -1); d <= today && days.length < MAX_TOP_UP_DAYS; d = addDays(d, 1)) days.push(d);
    topUps.set(
      key,
      live
        .mapLimit(days, 6, (d) => live.fetchScoreboard(d).catch(() => [] as Game[]))
        .then((boards) => mergeResults(games, boards.flat())),
    );
  }
  return topUps.get(key)!;
}

export async function fetchTeamSchedule(teamId: string, season: number, seasonType: SeasonType) {
  await loadSnapshot(season);
  const games = finished(season) && snapshotGames(season, seasonType);
  if (games) {
    return { team: getSnapshot(season)!.teams.find((t) => t.id === teamId), games: games.filter((g) => involves(g, teamId)) };
  }
  return live.fetchTeamSchedule(teamId, season, seasonType);
}

export async function fetchLeaders(season: number, seasonType: SeasonType, sort: string) {
  await loadSnapshot(season);
  const done = finished(season);
  if (done) return done.leaders[`${seasonType}:${sort}`] ?? live.fetchLeaders(season, seasonType, sort);
  const snap = getSnapshot(season);
  try {
    const table = await live.fetchLeaders(season, seasonType, sort);
    if (!snap || !staleLeaders(table, snap, seasonType)) return table;
  } catch (e) {
    if (!snap) throw e;
  }
  // ESPN's feed can serve last season's numbers early in a new season: use our own totals.
  const box = snap.box?.[String(seasonType)];
  if (!box) return { columns: [], rows: [] };
  const abbr = Object.fromEntries(snap.teams.map((t) => [t.id, t.abbr]));
  return leadersFromBox(box, snap.players ?? {}, abbr, sort);
}

/** Most games any team has finished this season type, per the snapshot. */
function maxTeamGames(snap: SeasonSnapshot, seasonType: SeasonType): number {
  const n = new Map<string, number>();
  for (const g of snapshotGames(snap.year, seasonType) ?? []) {
    if (!isFinal(g)) continue;
    for (const t of [g.home.team.id, g.away.team.id]) n.set(t, (n.get(t) ?? 0) + 1);
  }
  return Math.max(0, ...n.values());
}

/** A player can't have played more games than any team has (allowing for games since the snapshot). */
function staleLeaders(table: { rows: { values: Record<string, string> }[] }, snap: SeasonSnapshot, seasonType: SeasonType): boolean {
  const most = Math.max(0, ...table.rows.map((r) => Number(r.values['general.gamesPlayed']) || 0));
  return most > maxTeamGames(snap, seasonType) + 3;
}

export async function fetchTeamStats(season: number, seasonType: SeasonType) {
  await loadSnapshot(season);
  const snap = finished(season);
  if (snap && String(seasonType) in snap.teamStats) {
    const t = snap.teamStats[String(seasonType)];
    if (!t) throw new live.ApiError('No team stats for this season', 'not-found');
    return t;
  }
  // During a season ESPN's team feed can still show last season; our box-score totals are at most a day old.
  const box = getSnapshot(season)?.box?.[String(seasonType)];
  const own = box && teamStatsFromBox(box);
  if (own) return own;
  return live.fetchTeamStats(season, seasonType);
}

export async function fetchSeasonHighs(season: number, seasonType: SeasonType) {
  await loadSnapshot(season);
  const snap = getSnapshot(season);
  if (snap && String(seasonType) in snap.highs) return snap.highs[String(seasonType)];
  return live.fetchSeasonHighs(season, seasonType);
}

/**
 * A day's games. Live data is richer (top scorers, quarter scores), so try it
 * first; for a snapshotted season fall back to the bundled results if ESPN
 * can't be reached.
 */
export async function fetchScoreboard(isoDate: string, fresh = false): Promise<Game[]> {
  try {
    return await live.fetchScoreboard(isoDate, fresh);
  } catch (e) {
    const year = Number(isoDate.slice(0, 4)) + (Number(isoDate.slice(5, 7)) >= 8 ? 1 : 0);
    await loadSnapshot(year);
    const day = [2, 3].flatMap((t) => snapshotGames(year, t as SeasonType) ?? []).filter((g) => toISODate(new Date(g.date)) === isoDate);
    if (getSnapshot(year)) return day;
    throw e;
  }
}

/** How many recent games the live (non-snapshot) assist network looks at. */
export const LIVE_ASSIST_GAMES = 15;

/**
 * A team's season passer → scorer pairs. Snapshotted seasons cover every
 * game; otherwise the last LIVE_ASSIST_GAMES finished games are fetched.
 */
export async function fetchTeamAssists(
  teamId: string,
  season: number,
  seasonType: SeasonType,
): Promise<{ pairs: AssistPairs | undefined; games: number; partial: boolean }> {
  await loadSnapshot(season);
  const snap = getSnapshot(season);
  const fromSnap = snap?.assists?.[String(seasonType)];
  const finals = (await fetchTeamSchedule(teamId, season, seasonType)).games.filter((g) => g.state === 'post');
  if (fromSnap) return { pairs: fromSnap[teamId], games: finals.length, partial: false };
  const recent = finals.slice(-LIVE_ASSIST_GAMES).map((g) => g.id);
  const pairs = (await live.fetchAssistPairs(recent, teamId))[teamId];
  return { pairs, games: recent.length, partial: recent.length < finals.length };
}

export interface Partner {
  id: string;
  name: string;
  assists: number;
  points: number;
}

/** Who a player assists and who assists them, from a snapshotted season. */
export function playerAssistPartners(playerId: string, season: number, seasonType: SeasonType) {
  const byTeam = getSnapshot(season)?.assists?.[String(seasonType)];
  if (!byTeam) return undefined;
  const to = new Map<string, Partner>();
  const from = new Map<string, Partner>();
  const add = (m: Map<string, Partner>, id: string, name: string, n: number, pts: number) => {
    const p = m.get(id) ?? { id, name, assists: 0, points: 0 };
    p.assists += n;
    p.points += pts;
    m.set(id, p);
  };
  // A traded player appears under more than one team.
  for (const t of Object.values(byTeam)) {
    const names = new Map(t.players);
    for (const [passer, scorer, n, pts] of t.pairs) {
      if (passer === playerId) add(to, scorer, names.get(scorer) ?? scorer, n, pts);
      if (scorer === playerId) add(from, passer, names.get(passer) ?? passer, n, pts);
    }
  }
  const sort = (m: Map<string, Partner>) => [...m.values()].sort((a, b) => b.assists - a.assists);
  return { to: sort(to), from: sort(from) };
}

/** Win-probability "drama" rows for a snapshotted season. */
export function seasonDrama(season: number, seasonType: SeasonType) {
  return getSnapshot(season)?.drama?.[String(seasonType)];
}

/** Binned season shots (teams, top shooters, league) for a snapshotted season. */
export function seasonShots(season: number, seasonType: SeasonType) {
  return getSnapshot(season)?.shots?.[String(seasonType)];
}

/** Every team's passer → scorer pairs for a snapshotted season. */
export function seasonAssists(season: number, seasonType: SeasonType) {
  return getSnapshot(season)?.assists?.[String(seasonType)];
}

/** Snapshot games by id (for labelling drama rows). */
export function snapshotGameMap(season: number, seasonType: SeasonType): Map<string, Game> {
  return new Map((snapshotGames(season, seasonType) ?? []).map((g) => [g.id, g]));
}

/** Teams of a snapshotted season. */
export function snapshotTeams(season: number): TeamRef[] | undefined {
  return getSnapshot(season)?.teams;
}

/** Most-used lineups and on/off splits for a team (loaded snapshot seasons only). */
export function seasonLineups(season: number, seasonType: SeasonType, teamId: string) {
  return getSnapshot(season)?.lineups?.[String(seasonType)]?.[teamId];
}

/** The bundled snapshot itself, for models that read several parts of it (e.g. the awards race). */
export function seasonSnapshot(season: number) {
  return getSnapshot(season);
}

let injuriesPending: Promise<Injury[]> | undefined;

/** The league injury report: live from ESPN, or the copy saved with the latest snapshot. */
export function fetchInjuries(): Promise<Injury[]> {
  injuriesPending ??= live.fetchInjuries().catch(async (e) => {
    const years = snapshotYears();
    const snaps = await Promise.all(years.map(loadSnapshot));
    const saved = snaps.find((s) => s?.injuries)?.injuries;
    if (saved) return saved;
    throw e;
  });
  return injuriesPending;
}
