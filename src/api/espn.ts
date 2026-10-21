// The data API pages use. Completed seasons are served from the bundled
// snapshot (instant, works offline); anything else comes from ESPN live.
import { toISODate } from '../lib/dates';
import { involves } from '../lib/league';
import * as live from './live';
import { getSnapshot, loadSnapshot, snapshotGames, snapshotYears } from './snapshotStore';
import type { AssistPairs, Game, TeamRef } from './types';

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
  return finished(season)?.standings ?? live.fetchStandings(season);
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
  if (games) return { teams: getSnapshot(season)!.teams, games };
  return live.fetchLeagueGames(season, seasonType);
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
  return finished(season)?.leaders[`${seasonType}:${sort}`] ?? live.fetchLeaders(season, seasonType, sort);
}

export async function fetchTeamStats(season: number, seasonType: SeasonType) {
  await loadSnapshot(season);
  const snap = finished(season);
  if (snap && String(seasonType) in snap.teamStats) {
    const t = snap.teamStats[String(seasonType)];
    if (!t) throw new live.ApiError('No team stats for this season', 'not-found');
    return t;
  }
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
