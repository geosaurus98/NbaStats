// Live client for ESPN's public (unauthenticated) NBA endpoints. Pages use
// ./espn, which serves bundled season snapshots first and falls back to these.
import { espnDate } from '../lib/dates';
import { seasonHighs } from '../lib/playerStats';
import type { AssistEvent, Game, TeamRef } from './types';
import {
  aggregateAssists,
  normalizeAthlete,
  normalizeGameLog,
  normalizeInjuries,
  normalizeRosterContracts,
  normalizeLeaders,
  normalizeScoreboard,
  normalizeStandings,
  normalizeSummary,
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
const TIMEOUT_MS = 15_000;
const RETRIES = 2;

/** Error with a plain-English reason, shown to the user by <ErrorBox>. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly kind: 'network' | 'timeout' | 'rate-limit' | 'server' | 'not-found',
  ) {
    super(message);
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchOnce(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { signal: ctrl.signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new ApiError('ESPN took too long to respond', 'timeout');
    // fetch() rejects without detail when the network or browser blocks the request.
    throw new ApiError("Couldn't reach ESPN. Your network may be blocking it", 'network');
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 429) throw new ApiError('ESPN is rate-limiting requests', 'rate-limit');
  if (res.status === 404) throw new ApiError('ESPN has no data for this', 'not-found');
  if (!res.ok) throw new ApiError(`ESPN returned an error (${res.status})`, 'server');
  return res.json();
}

async function getJSON(url: string, fresh = false, store = true): Promise<unknown> {
  const hit = cache.get(url);
  if (!fresh && hit && Date.now() - hit.at < TTL_MS) return hit.data;
  for (let attempt = 0; ; attempt++) {
    try {
      const data = await fetchOnce(url);
      if (store) cache.set(url, { at: Date.now(), data });
      return data;
    } catch (e) {
      const retryable = e instanceof ApiError && e.kind !== 'not-found';
      if (!retryable || attempt >= RETRIES) throw e;
      await wait(800 * 2 ** attempt * (e.kind === 'rate-limit' ? 3 : 1));
    }
  }
}

export async function fetchScoreboard(isoDate: string, fresh = false) {
  return normalizeScoreboard(await getJSON(`${SITE}/scoreboard?dates=${espnDate(isoDate)}&limit=100`, fresh));
}

export async function fetchRosterContracts(teamId: string, season: number) {
  return normalizeRosterContracts(await getJSON(`${SITE}/teams/${teamId}/roster`), season);
}

export async function fetchInjuries() {
  return normalizeInjuries(await getJSON(`${SITE}/injuries`));
}

export async function fetchStandings(season: number) {
  return normalizeStandings(await getJSON(`${STANDINGS}?season=${season}`));
}

/**
 * All teams, taken from the standings: ESPN's /teams endpoint omits the CORS
 * header, so browsers can't read it.
 */
export async function fetchTeams(season: number) {
  const confs = await fetchStandings(season);
  return confs.flatMap((c) => c.rows.map((r) => r.team)).sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchTeamSchedule(teamId: string, season: number, seasonType: SeasonType) {
  return normalizeTeamSchedule(
    await getJSON(`${SITE}/teams/${teamId}/schedule?season=${season}&seasontype=${seasonType}`),
  );
}

/** `store = false` skips the in-memory cache (bulk jobs fetch thousands). */
export async function fetchSummary(gameId: string, fresh = false, store = true) {
  return normalizeSummary(await getJSON(`${SITE}/summary?event=${gameId}`, fresh, store));
}

/** Passer → scorer pairs for a team, totalled over the given games' play-by-play. */
export async function fetchAssistPairs(gameIds: string[], teamId?: string, concurrency = 4) {
  const events: AssistEvent[] = [];
  const names: Record<string, string> = {};
  await mapLimit(gameIds, concurrency, async (id) => {
    const s = await fetchSummary(id, false, false).catch(() => undefined);
    if (!s) return;
    Object.assign(names, s.pbp.names);
    events.push(...s.pbp.assists.filter((a) => !teamId || a.teamId === teamId));
  });
  return aggregateAssists(events, names);
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

export async function fetchLeaders(season: number, seasonType: SeasonType, sort: string, limit = 50) {
  const url = `${STATS}?region=us&lang=en&contentorigin=espn&isqualified=true&limit=${limit}&season=${season}&seasontype=${seasonType}&sort=${encodeURIComponent(`${sort}:desc`)}`;
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
  const teams = await fetchTeams(season);
  const schedules = await mapLimit(teams, 4, (t) => fetchTeamSchedule(t.id, season, seasonType));
  const byId = new Map<string, Game>();
  for (const s of schedules) for (const g of s.games) if (!byId.has(g.id)) byId.set(g.id, g);
  return { teams, games: [...byId.values()].sort((a, b) => a.date.localeCompare(b.date)) };
}

// Highs are drawn from these leaderboards' players, not every player in the
// league: ESPN has no single "best games" endpoint.
const HIGH_POOLS = ['offensive.avgPoints', 'general.avgRebounds', 'offensive.avgAssists'];

export async function fetchSeasonHighs(season: number, seasonType: SeasonType, poolSize = 50) {
  const boards = await Promise.all(HIGH_POOLS.map((sort) => fetchLeaders(season, seasonType, sort, poolSize)));
  const players = new Map<string, { athleteId: string; athlete: string; team: string }>();
  for (const b of boards) for (const r of b.rows) if (r.athleteId) players.set(r.athleteId, r);
  const wanted = seasonType === 3 ? 'playoffs' : 'regular';
  const logs = await mapLimit([...players.values()], 4, async (p) => {
    const log = await fetchGameLog(p.athleteId, season).catch(() => undefined);
    return { ...p, games: log?.games.filter((g) => g.seasonType === wanted) ?? [] };
  });
  return { ...seasonHighs(logs), poolSize: players.size, poolDepth: poolSize };
}

export type SeasonHighsResult = Awaited<ReturnType<typeof fetchSeasonHighs>>;
