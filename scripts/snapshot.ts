// Builds src/data/season-<year>.json for completed seasons. Run in GitHub
// Actions (ESPN isn't reachable from every environment):
//   npx tsx scripts/snapshot.ts 2026 2025
import { mkdirSync, writeFileSync } from 'node:fs';
import * as live from '../src/api/live';
import { compactGame, type SeasonSnapshot } from '../src/api/snapshot';

const SORTS = [
  'offensive.avgPoints',
  'general.avgRebounds',
  'offensive.avgAssists',
  'defensive.avgSteals',
  'defensive.avgBlocks',
  'offensive.threePointFieldGoalPct',
];
const TYPES = [2, 3] as const;
const HIGH_POOL = 100;

async function build(year: number): Promise<SeasonSnapshot> {
  console.log(`\n== ${year} ==`);
  const standings = await live.fetchStandings(year);
  const teams = standings.flatMap((c) => c.rows.map((r) => r.team)).sort((a, b) => a.name.localeCompare(b.name));
  console.log(`teams: ${teams.length}`);

  const snap: SeasonSnapshot = { year, generatedAt: new Date().toISOString(), teams, standings, games: {}, leaders: {}, teamStats: {}, highs: {} };
  for (const type of TYPES) {
    const { games } = await live.fetchLeagueGames(year, type);
    snap.games[type] = games.map(compactGame);
    console.log(`type ${type}: ${games.length} games`);
    for (const sort of SORTS) {
      snap.leaders[`${type}:${sort}`] = await live.fetchLeaders(year, type, sort).catch(() => ({ columns: [], rows: [] }));
    }
    snap.teamStats[type] = await live.fetchTeamStats(year, type).catch(() => null);
    snap.highs[type] = games.length ? await live.fetchSeasonHighs(year, type, HIGH_POOL).catch(() => null) : null;
    console.log(`type ${type}: highs pool ${snap.highs[type]?.poolSize ?? 0}`);
  }
  return snap;
}

const years = process.argv.slice(2).map(Number).filter(Boolean);
mkdirSync('src/data', { recursive: true });
for (const year of years) {
  const snap = await build(year);
  // Guard against writing a broken snapshot over a good one.
  if (snap.teams.length < 30 || (snap.games['2']?.length ?? 0) < 1000) throw new Error(`Snapshot ${year} looks incomplete`);
  const json = JSON.stringify(snap);
  writeFileSync(`src/data/season-${year}.json`, json);
  console.log(`wrote src/data/season-${year}.json (${(json.length / 1024).toFixed(0)} KB)`);
}
