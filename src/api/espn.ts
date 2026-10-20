// Thin client for ESPN's public (unauthenticated) NBA endpoints.
import { espnDate } from '../lib/dates';
import type { Game, TeamRef } from './types';
import {
  normalizeAthlete,
  normalizeGameLog,
  normalizeLeaders,
  normalizeScoreboard,
  normalizeStandings,
  normalizeSummary,
  normalizeTeams,
  normalizeTeamSchedule,
  normalizeTeamStats,
} from './normalize';

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const STANDINGS = 'https://site.api.espn.com/apis/v2/sports/basketball/nba/standings';
const COMMON = 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba';
const STATS = `${COMMON}/statistics/byathlete`;

export type SeasonType = 2 | 3; // 2 = regular season, 3 = playoffs

const cache = new Map<string, { at: number; data: unknown }>();
const TTL_MS = 5 * 60_000;

async function getJSON(url: string, fresh = false): Promise<unknown> {
  const hit = cache.get(url);
  if (!fresh && hit && Date.now() - hit.at < TTL_MS) return hit.data;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ESPN request failed (${res.status})`);
  const data = await res.json();
  cache.set(url, { at: Date.now(), data });
  return data;
}

export async function fetchScoreboard(isoDate: string, fresh = false) {
  return normalizeScoreboard(await getJSON(`${SITE}/scoreboard?dates=${espnDate(isoDate)}&limit=100`, fresh));
}

export async function fetchStandings(season: number) {
  return normalizeStandings(await getJSON(`${STANDINGS}?season=${season}`));
}

export async function fetchTeams() {
  return normalizeTeams(await getJSON(`${SITE}/teams`));
}

export async function fetchTeamSchedule(teamId: string, season: number, seasonType: SeasonType) {
  return normalizeTeamSchedule(
    await getJSON(`${SITE}/teams/${teamId}/schedule?season=${season}&seasontype=${seasonType}`),
  );
}

export async function fetchSummary(gameId: string, fresh = false) {
  return normalizeSummary(await getJSON(`${SITE}/summary?event=${gameId}`, fresh));
}

export const LEADER_COLUMNS = [
  { category: 'general', name: 'gamesPlayed', label: 'GP' },
  { category: 'general', name: 'avgMinutes', label: 'MIN' },
  { category: 'offensive', name: 'avgPoints', label: 'PTS' },
  { category: 'general', name: 'avgRebounds', label: 'REB' },
  { category: 'offensive', name: 'avgAssists', label: 'AST' },
  { category: 'defensive', name: 'avgSteals', label: 'STL' },
  { category: 'defensive', name: 'avgBlocks', label: 'BLK' },
  { category: 'offensive', name: 'fieldGoalPct', label: 'FG%' },
  { category: 'offensive', name: 'threePointFieldGoalPct', label: '3P%' },
  { category: 'offensive', name: 'freeThrowPct', label: 'FT%' },
];

export async function fetchLeaders(season: number, seasonType: SeasonType, sort: string) {
  const url = `${STATS}?region=us&lang=en&contentorigin=espn&isqualified=true&limit=50&season=${season}&seasontype=${seasonType}&sort=${encodeURIComponent(`${sort}:desc`)}`;
  return normalizeLeaders(await getJSON(url), LEADER_COLUMNS);
}

export async function fetchAthlete(id: string) {
  return normalizeAthlete(await getJSON(`${COMMON}/athletes/${id}`));
}

export async function fetchGameLog(id: string, season: number) {
  return normalizeGameLog(await getJSON(`${COMMON}/athletes/${id}/gamelog?season=${season}`));
}

export const TEAM_STAT_COLUMNS = [
  { category: 'offensive', name: 'fieldGoalPct', label: 'FG%' },
  { category: 'offensive', name: 'threePointFieldGoalPct', label: '3P%' },
  { category: 'offensive', name: 'avgThreePointFieldGoalsMade', label: '3PM' },
  { category: 'offensive', name: 'freeThrowPct', label: 'FT%' },
  { category: 'general', name: 'avgRebounds', label: 'REB' },
  { category: 'offensive', name: 'avgAssists', label: 'AST' },
  { category: 'offensive', name: 'avgTurnovers', label: 'TOV' },
  { category: 'defensive', name: 'avgSteals', label: 'STL' },
  { category: 'defensive', name: 'avgBlocks', label: 'BLK' },
];

export async function fetchTeamStats(season: number, seasonType: SeasonType) {
  const url = `${COMMON}/statistics/byteam?region=us&lang=en&contentorigin=espn&season=${season}&seasontype=${seasonType}`;
  return normalizeTeamStats(await getJSON(url), TEAM_STAT_COLUMNS);
}

/** Runs `fn` over `items` with at most `limit` requests in flight. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** Every team's schedule merged into one de-duplicated, date-ordered list. */
export async function fetchLeagueGames(season: number, seasonType: SeasonType): Promise<{ teams: TeamRef[]; games: Game[] }> {
  const teams = await fetchTeams();
  const schedules = await mapLimit(teams, 6, (t) =>
    fetchTeamSchedule(t.id, season, seasonType).catch(() => ({ games: [] as Game[] })),
  );
  const byId = new Map<string, Game>();
  for (const s of schedules) for (const g of s.games) if (!byId.has(g.id)) byId.set(g.id, g);
  return { teams, games: [...byId.values()].sort((a, b) => a.date.localeCompare(b.date)) };
}
