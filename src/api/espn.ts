// The data API pages use. Completed seasons are served from the bundled
// snapshot (instant, works offline); anything else comes from ESPN live.
import { toISODate } from '../lib/dates';
import { involves } from '../lib/league';
import * as live from './live';
import { getSnapshot, snapshotGames } from './snapshotStore';
import type { Game, TeamRef } from './types';

export type { SeasonType, SeasonHighsResult } from './live';
export { ApiError, fetchAthlete, fetchGameLog, fetchSummary, mapLimit } from './live';
type SeasonType = live.SeasonType;

export function hasSnapshot(season: number): boolean {
  return !!getSnapshot(season);
}

export async function fetchStandings(season: number) {
  return getSnapshot(season)?.standings ?? live.fetchStandings(season);
}

export async function fetchTeams(season: number) {
  return getSnapshot(season)?.teams ?? live.fetchTeams(season);
}

export async function fetchLeagueGames(season: number, seasonType: SeasonType): Promise<{ teams: TeamRef[]; games: Game[] }> {
  const games = snapshotGames(season, seasonType);
  if (games) return { teams: getSnapshot(season)!.teams, games };
  return live.fetchLeagueGames(season, seasonType);
}

export async function fetchTeamSchedule(teamId: string, season: number, seasonType: SeasonType) {
  const games = snapshotGames(season, seasonType);
  if (games) {
    return { team: getSnapshot(season)!.teams.find((t) => t.id === teamId), games: games.filter((g) => involves(g, teamId)) };
  }
  return live.fetchTeamSchedule(teamId, season, seasonType);
}

export async function fetchLeaders(season: number, seasonType: SeasonType, sort: string) {
  return getSnapshot(season)?.leaders[`${seasonType}:${sort}`] ?? live.fetchLeaders(season, seasonType, sort);
}

export async function fetchTeamStats(season: number, seasonType: SeasonType) {
  const snap = getSnapshot(season);
  if (snap && String(seasonType) in snap.teamStats) {
    const t = snap.teamStats[String(seasonType)];
    if (!t) throw new live.ApiError('No team stats for this season', 'not-found');
    return t;
  }
  return live.fetchTeamStats(season, seasonType);
}

export async function fetchSeasonHighs(season: number, seasonType: SeasonType) {
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
    const day = [2, 3].flatMap((t) => snapshotGames(year, t as SeasonType) ?? []).filter((g) => toISODate(new Date(g.date)) === isoDate);
    if (getSnapshot(year)) return day;
    throw e;
  }
}
