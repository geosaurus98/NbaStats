// Thin client for ESPN's public (unauthenticated) NBA endpoints.
import { espnDate } from '../lib/dates';
import {
  normalizeLeaders,
  normalizeScoreboard,
  normalizeStandings,
  normalizeSummary,
  normalizeTeams,
  normalizeTeamSchedule,
} from './normalize';

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const STANDINGS = 'https://site.api.espn.com/apis/v2/sports/basketball/nba/standings';
const STATS = 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete';

export type SeasonType = 2 | 3; // 2 = regular season, 3 = playoffs

const cache = new Map<string, { at: number; data: unknown }>();
const TTL_MS = 60_000;

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
