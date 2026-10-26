// Builds src/data/season-<year>.json for completed seasons. Run in GitHub
// Actions (ESPN isn't reachable from every environment):
//   npx tsx scripts/snapshot.ts 2026 2025
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as live from '../src/api/live';
import { aggregateAssists } from '../src/api/normalize';
import { compactGame, type SeasonSnapshot } from '../src/api/snapshot';
import type { AssistEvent, RosterContract } from '../src/api/types';
import { parseBrefContracts, type PayrollPlayer } from '../src/lib/brefContracts';
import { FRANCHISES } from '../src/lib/franchises';
import { BoxAccumulator, lineValues, nameKey, type GameLines, type SeasonLines } from '../src/lib/boxTotals';
import { ClutchAccumulator } from '../src/lib/clutch';
import { ShotSplitAccumulator } from '../src/lib/shotTypes';
import { GarbageAccumulator } from '../src/lib/garbageTime';
import { QuarterAccumulator } from '../src/lib/quarters';
import { nightlyBest } from '../src/lib/gameLines';
import { countsInStandings } from '../src/lib/league';
import { gameLineups, LineupAccumulator, type GameInput } from '../src/lib/lineups';
import { BinCounter, gameDrama, type DramaRow, type ShotBins } from '../src/lib/pbpStats';

const TEAM_BIN_FT = 2;
const PLAYER_BIN_FT = 3;
const SHOT_MAP_PLAYERS = 75;

/** One pass over every game's play-by-play: assists, drama and shot bins. */
async function playByPlay(gameIds: string[], notCounted = new Set<string>()) {
  const events: AssistEvent[] = [];
  const names: Record<string, string> = {};
  const fullNames: Record<string, string> = {};
  const drama: DramaRow[] = [];
  const league = new BinCounter(TEAM_BIN_FT);
  const teams = new Map<string, BinCounter>();
  const players = new Map<string, { team: string; bins: BinCounter }>();
  const lineups = new LineupAccumulator();
  const box = new BoxAccumulator();
  const clutch = new ClutchAccumulator();
  const shotSplits = new ShotSplitAccumulator();
  const garbage = new GarbageAccumulator();
  const quarters = new QuarterAccumulator();
  const teamStatSums = new Map<string, { gp: number; sums: Record<string, number> }>();
  const lines = new Map<string, { home: boolean; starter: boolean; id: string; v: number[] }[]>();
  let failed = 0;
  await live.mapLimit(gameIds, 8, async (id) => {
    const s = await live.fetchSummary(id, false, false).catch(() => undefined);
    if (!s) {
      failed++;
      return;
    }
    Object.assign(names, s.pbp.names);
    if (!notCounted.has(id)) box.add(s.teams); // the NBA Cup final isn't a regular-season game
    lines.set(
      id,
      s.teams.flatMap((t) =>
        t.players.flatMap((p) => {
          const v = !p.dnp && p.id ? lineValues(t.labels, p.stats) : undefined;
          return v ? [{ id: p.id, home: t.team.id === s.game.home.team.id, starter: p.starter, v }] : [];
        }),
      ),
    );
    clutch.add({
      feed: s.pbp.feed,
      homeId: s.game.home.team.id,
      awayId: s.game.away.team.id,
      teamOf: Object.fromEntries(s.teams.flatMap((t) => t.players.map((p) => [p.id, t.team.id]))),
      homeScore: s.game.home.score ?? 0,
      awayScore: s.game.away.score ?? 0,
    });
    for (const t of s.teams) for (const p of t.players) if (p.id && p.name) fullNames[p.id] = p.name;
    quarters.add(s.game.home.team.id, s.game.home.linescores, s.game.away.linescores);
    quarters.add(s.game.away.team.id, s.game.away.linescores, s.game.home.linescores);
    // Team box-score extras ESPN reports per game (points in the paint, fast break points…): sum the plain numbers.
    for (const t of s.teams) {
      const row = teamStatSums.get(t.team.id) ?? { gp: 0, sums: {} };
      row.gp++;
      for (const { label, value } of t.teamStats) if (/^-?\d+(\.\d+)?$/.test(value)) row.sums[label] = (row.sums[label] ?? 0) + Number(value);
      teamStatSums.set(t.team.id, row);
    }
    const input: GameInput = {
      starters: Object.fromEntries(s.teams.map((t) => [t.team.id, t.players.filter((p) => p.starter).map((p) => p.id)])),
      teamOf: Object.fromEntries(s.teams.flatMap((t) => t.players.map((p) => [p.id, t.team.id]))),
      homeId: s.game.home.team.id,
      awayId: s.game.away.team.id,
      feed: s.pbp.feed,
    };
    if (Object.values(input.starters).every((ids) => ids.length === 5)) {
      const r = gameLineups(input);
      lineups.add(input, r);
      garbage.add(input.feed, input.teamOf, r);
    }
    events.push(...s.pbp.assists);
    const d = gameDrama(id, s.pbp);
    if (d) drama.push(d);
    for (const shot of s.pbp.shots) {
      league.add(shot);
      shotSplits.add(shot);
      if (!teams.has(shot.teamId)) teams.set(shot.teamId, new BinCounter(TEAM_BIN_FT));
      teams.get(shot.teamId)!.add(shot);
      if (!shot.athleteId) continue;
      const p = players.get(shot.athleteId) ?? { team: shot.teamId, bins: new BinCounter(PLAYER_BIN_FT) };
      p.team = shot.teamId; // latest team for traded players
      p.bins.add(shot);
      players.set(shot.athleteId, p);
    }
  });
  const top = [...players.entries()].sort((a, b) => b[1].bins.attempts - a[1].bins.attempts).slice(0, SHOT_MAP_PLAYERS);
  const shots: ShotBins = {
    teamSize: TEAM_BIN_FT,
    playerSize: PLAYER_BIN_FT,
    league: league.rows(),
    teams: Object.fromEntries([...teams].map(([id, b]) => [id, b.rows()])),
    players: Object.fromEntries(top.map(([id, p]) => [id, { name: names[id] ?? id, team: p.team, attempts: p.bins.attempts, bins: p.bins.rows() }])),
  };
  console.log(`  play-by-play: ${gameIds.length - failed}/${gameIds.length} games, ${league.attempts} shots, ${drama.length} drama rows`);
  return { assists: aggregateAssists(events, names), drama, shots, fullNames, lineups: lineups.result(), box: box.result(), clutch: clutch.result(), lines, shotSplits: shotSplits.result(), teamStatSums: Object.fromEntries(teamStatSums), garbage: garbage.result(), quarters: quarters.result() };
}

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

  const snap: SeasonSnapshot = { year, generatedAt: new Date().toISOString(), teams, standings, games: {}, leaders: {}, teamStats: {}, highs: {}, assists: {}, drama: {}, shots: {}, players: {}, lineups: {}, complete: true };
  const playerIndex = new Map<string, number>();
  const seasonLines: GameLines[] = [];
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
    const finals = games.filter((g) => g.state === 'post').map((g) => g.id);
    // An unplayed regular-season game means the season is still going.
    if (type === 2 && finals.length < games.length) snap.complete = false;
    const pbp = await playByPlay(finals, new Set(games.filter((g) => !countsInStandings(g)).map((g) => g.id)));
    snap.assists![type] = pbp.assists;
    snap.drama![type] = pbp.drama;
    snap.shots![type] = pbp.shots;
    snap.lineups![type] = pbp.lineups;
    Object.assign(snap.players!, pbp.fullNames);
    snap.clutch ??= {};
    snap.clutch[type] = pbp.clutch;
    snap.shotSplits ??= {};
    snap.shotSplits[type] = pbp.shotSplits;
    snap.teamStatSums ??= {};
    snap.teamStatSums[type] = pbp.teamStatSums;
    snap.garbage ??= {};
    snap.garbage[type] = pbp.garbage;
    snap.quarters ??= {};
    snap.quarters[type] = pbp.quarters;
    console.log(`  garbage time: ${pbp.garbage.teams.length} teams, ${pbp.garbage.players.length} players; quarters: ${Object.keys(pbp.quarters).length} teams`);
    console.log(`  shot splits: ${Object.keys(pbp.shotSplits.players).length} players; team stat labels: ${Object.keys(Object.values(pbp.teamStatSums)[0]?.sums ?? {}).join(', ')}`);
    for (const g of games) {
      const ls = pbp.lines.get(g.id);
      if (!ls) continue;
      const line = (l: { id: string; home: boolean; starter: boolean; v: number[] }) => {
        let i = playerIndex.get(l.id);
        if (i == null) playerIndex.set(l.id, (i = playerIndex.size));
        return [i, l.home ? 1 : 0, l.starter ? 1 : 0, ...l.v.map((x) => Math.round(x))];
      };
      seasonLines.push([g.id, g.date, type, g.home.team.id, g.away.team.id, countsInStandings(g) ? 1 : 0, ls.map(line)]);
    }
    if (type === 2) snap.box = { 2: { ...pbp.box, rookies: rookies(year, pbp.box.players.map((r) => r[0]), pbp.fullNames) } };
    const pairCount = Object.values(snap.assists![type]).reduce((n, t) => n + t.pairs.length, 0);
    console.log(`type ${type}: assist pairs ${pairCount} across ${Object.keys(snap.assists![type]).length} teams`);
  }
  if (!snap.complete) {
    snap.injuries = await live.fetchInjuries().catch((e) => {
      console.log(`  injuries: failed (${e})`);
      return undefined;
    });
    console.log(`  injuries: ${snap.injuries?.length ?? 0} players`);
    // Salaries: full payrolls (this season and the next five) from Basketball-Reference,
    // matched to ESPN players; past salaries from ESPN's roster contracts.
    const espnRosters: Record<string, RosterContract[]> = {};
    for (const t of snap.teams) {
      const roster = await live.fetchRosterContracts(t.id, year).catch(() => undefined);
      if (roster?.length) espnRosters[t.id] = roster;
    }
    snap.salaryHistory = Object.fromEntries(Object.values(espnRosters).flat().filter((r) => r.history.length).map((r) => [r.athleteId, r.history]));
    snap.payroll = await brefPayrolls(snap.teams.map((t) => t.id), espnRosters);
    const players = Object.values(snap.payroll ?? {}).flat();
    console.log(`  payroll: ${Object.keys(snap.payroll ?? {}).length} teams, ${players.length} contracts (${players.filter((p) => p.espn).length} matched to ESPN), ${Object.keys(snap.salaryHistory).length} salary histories`);
  }
  const out: SeasonLines = { year, ids: [...playerIndex.keys()], games: seasonLines };
  // The last two weeks of nightly bests, small enough for the home page.
  snap.nightly = nightlyBest(out, 2, 3).slice(0, 14);
  writeFileSync(`src/data/lines-${year}.json`, JSON.stringify(out));
  console.log(`  lines: ${seasonLines.length} games, ${playerIndex.size} players`);
  return snap;
}

/**
 * First-year players: their Basketball-Reference debut is this season, or
 * they aren't in that data yet (current season) and didn't play last season.
 */
function rookies(year: number, ids: string[], names: Record<string, string>): string[] {
  const debuts = new Map<string, number[]>();
  for (const [name, first] of JSON.parse(readFileSync('src/data/teammates.json', 'utf8')).players as [string, number][]) {
    const k = nameKey(name);
    debuts.set(k, [...(debuts.get(k) ?? []), first]);
  }
  const prevFile = `src/data/season-${year - 1}.json`;
  const previous = new Set(existsSync(prevFile) ? Object.keys(JSON.parse(readFileSync(prevFile, 'utf8')).players ?? {}) : []);
  const out = ids.filter((id) => {
    const firsts = debuts.get(nameKey(names[id] ?? ''));
    if (firsts?.includes(year)) return true;
    if (firsts?.some((f) => f < year)) return false;
    return !previous.has(id);
  });
  console.log(`  rookies: ${out.length}`);
  return out;
}

/**
 * Every team's payroll page on Basketball-Reference, fetched politely (one
 * request every few seconds, well inside their published bot limits).
 */
async function brefPayrolls(teamIds: string[], espnRosters: Record<string, RosterContract[]>): Promise<Record<string, PayrollPlayer[]> | undefined> {
  const graph = JSON.parse(readFileSync('src/data/teammates.json', 'utf8'));
  const brefToEspn = new Map<string, string>();
  for (const [espn, p] of Object.entries((graph.espn ?? {}) as Record<string, number>)) if (graph.ids?.[p]) brefToEspn.set(graph.ids[p], espn);
  const out: Record<string, PayrollPlayer[]> = {};
  for (const id of teamIds) {
    const f = FRANCHISES.find((x) => x.espnId === id);
    if (!f) continue;
    const code = f.codes[f.codes.length - 1];
    const res = await fetch(`https://www.basketball-reference.com/contracts/${code}.html`, { headers: { 'User-Agent': 'NbaStatsHub/1.0 (personal stats site; one payroll refresh a day)' } }).catch(() => undefined);
    if (res?.ok) {
      const byName = new Map((espnRosters[id] ?? []).map((r) => [nameKey(r.name), r.athleteId]));
      out[id] = parseBrefContracts(await res.text()).map((p) => ({ ...p, espn: brefToEspn.get(p.bref) ?? byName.get(nameKey(p.name)) }));
    } else console.log(`  payroll ${code}: ${res?.status ?? 'failed'}`);
    await new Promise((r) => setTimeout(r, 3500));
  }
  return Object.keys(out).length >= 28 ? out : undefined;
}

const years = process.argv.slice(2).map(Number).filter(Boolean);
mkdirSync('src/data', { recursive: true });
for (const year of years) {
  const snap = await build(year);
  // Guard against writing a broken snapshot over a good one.
  // Guards against writing a broken snapshot over a good one.
  if (snap.teams.length < 30 || (snap.games['2']?.length ?? 0) < 1000) throw new Error(`Snapshot ${year} looks incomplete`);
  if (snap.complete) {
    if (Object.keys(snap.assists?.['2'] ?? {}).length < 30) throw new Error(`Snapshot ${year} is missing assist data`);
    if ((snap.drama?.['2']?.length ?? 0) < 1000) throw new Error(`Snapshot ${year} is missing game drama data`);
  }
  const json = JSON.stringify(snap);
  writeFileSync(`src/data/season-${year}.json`, json);
  console.log(`wrote src/data/season-${year}.json (${(json.length / 1024).toFixed(0)} KB, ${snap.complete ? 'complete' : 'in progress'}, ${Object.keys(snap.players!).length} players)`);
}
