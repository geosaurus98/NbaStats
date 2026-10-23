// Builds src/data/teammates.json: every team-season roster since 1946-47
// (BAA, NBA and ABA), for the "degrees of separation" teammate graph.
// Source: sumitrodatta/bball-reference-datasets (Basketball-Reference data).
//   npx tsx scripts/teammates.ts
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parseCSV } from './csv';
import { nameKey, type SeasonLines } from '../src/lib/boxTotals';
import { franchiseOf, FRANCHISES } from '../src/lib/franchises';
import { buildGraph, centrality, type TeammateData } from '../src/lib/teammates';

const SOURCE = 'https://raw.githubusercontent.com/sumitrodatta/bball-reference-datasets/master/Data/Player%20Season%20Info.csv';

const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`Download failed: ${res.status}`);
const [header, ...rows] = parseCSV(await res.text());
const col = (name: string) => {
  const i = header.indexOf(name);
  if (i < 0) throw new Error(`Missing column ${name}`);
  return i;
};
const [SEASON, LG, PLAYER, ID, TEAM] = ['season', 'lg', 'player', 'player_id', 'team'].map(col);

const players: TeammateData['players'] = [];
const index = new Map<string, number>();
const rosters = new Map<string, { season: number; lg: string; team: string; ids: Set<number> }>();
// Each player's roster keys in the order Basketball-Reference lists them.
const stintKeys: string[][] = [];

for (const r of rows) {
  const team = r[TEAM];
  // "2TM"/"3TM" rows are a traded player's season totals; the per-team rows follow.
  if (/^\dTM$/.test(team) || team === 'TOT') continue;
  const season = Number(r[SEASON]);
  let p = index.get(r[ID]);
  if (p == null) {
    p = players.length;
    index.set(r[ID], p);
    players.push([r[PLAYER], season, season]);
    stintKeys.push([]);
  }
  players[p][1] = Math.min(players[p][1], season);
  players[p][2] = Math.max(players[p][2], season);
  const key = `${season}|${r[LG]}|${team}`;
  const roster = rosters.get(key) ?? { season, lg: r[LG], team, ids: new Set() };
  roster.ids.add(p);
  rosters.set(key, roster);
  if (!stintKeys[p].includes(key)) stintKeys[p].push(key);
}

// Seasons Basketball-Reference doesn't have yet (the one in progress): rosters
// from our ESPN snapshot, i.e. everyone who has played a game for each team.
// Returning players are matched by name; first-timers become new players.
const lastBref = Math.max(...players.map((p) => p[2]));
const recentByName = new Map<string, number>();
players.forEach(([name, , last], p) => {
  const k = nameKey(name);
  const prev = recentByName.get(k);
  // Anyone from the last 15 seasons (players come back from Europe); the most recent wins a shared name.
  if (last >= lastBref - 15 && (prev == null || players[prev][2] < last)) recentByName.set(k, p);
});
const editDistance = (a: string, b: string) => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
};
const parts = (name: string) => {
  const words = name.replace(/\s+(jr|sr|ii|iii|iv)\.?$/i, '').split(/\s+/);
  return { first: nameKey(words[0] ?? ''), last: nameKey(words.slice(1).join(' ')) };
};
/**
 * Fallback for names spelled differently in the two sources ("Ron Holland" /
 * "Ronald Holland II", a Cyrillic "ё" in "Dёmin"): a player from last season
 * with the same surname and a first name that starts the other, or a name one
 * letter off. Only a single candidate counts.
 */
function looseMatch(name: string, year: number): number | undefined {
  const me = parts(name);
  const key = nameKey(name);
  const hits = players
    .map((pl, i) => ({ pl, i }))
    .filter(({ pl }) => pl[2] === year - 1)
    .filter(({ pl }) => {
      const them = parts(pl[0]);
      const sameLast = me.last && them.last === me.last && (them.first.startsWith(me.first) || me.first.startsWith(them.first));
      return sameLast || editDistance(nameKey(pl[0]), key) <= 1;
    });
  return hits.length === 1 ? hits[0].i : undefined;
}

for (let year = lastBref + 1; existsSync(`src/data/lines-${year}.json`); year++) {
  const lines: SeasonLines = JSON.parse(readFileSync(`src/data/lines-${year}.json`, 'utf8'));
  const names: Record<string, string> = JSON.parse(readFileSync(`src/data/season-${year}.json`, 'utf8')).players ?? {};
  // ESPN team id → this franchise's current Basketball-Reference code.
  const codeOf = new Map(FRANCHISES.map((f) => [f.espnId, f.codes[f.codes.length - 1]]));
  let matched = 0;
  let added = 0;
  for (const g of [...lines.games].filter((x) => x[2] === 2).sort((a, b) => a[1].localeCompare(b[1]))) {
    for (const l of g[6]) {
      const espnId = lines.ids[l[0]];
      const team = codeOf.get(l[1] ? g[3] : g[4]);
      const name = names[espnId];
      if (!team || !name) continue;
      let p = index.get(`espn:${espnId}`) ?? recentByName.get(nameKey(name)) ?? looseMatch(name, year);
      if (p == null) {
        p = players.length;
        players.push([name, year, year]);
        stintKeys.push([]);
        added++;
      } else if (players[p][2] < year) matched++;
      index.set(`espn:${espnId}`, p);
      players[p][2] = Math.max(players[p][2], year);
      const key = `${year}|NBA|${team}`;
      const roster = rosters.get(key) ?? { season: year, lg: 'NBA', team, ids: new Set() };
      roster.ids.add(p);
      rosters.set(key, roster);
      if (!stintKeys[p].includes(key)) stintKeys[p].push(key);
    }
  }
  console.log(`${year} (from ESPN box scores): ${matched} returning players, ${added} new`);
}

/**
 * Career order. The source lists a traded player's teams alphabetically
 * within a season, so order each season's teams by continuity: the one that
 * matches last season's franchise first, the one that matches next season's
 * last. (Three-team seasons may leave the middle team approximate.)
 */
function orderStints(rs: number[]): number[] {
  const season = (r: number) => sortedRosters[r][1].season;
  const fr = (r: number) => franchiseOf(sortedRosters[r][1].team)?.id ?? sortedRosters[r][1].team;
  const bySeason = new Map<number, number[]>();
  for (const r of rs) bySeason.set(season(r), [...(bySeason.get(season(r)) ?? []), r]);
  const seasons = [...bySeason.keys()].sort((a, b) => a - b);
  const out: number[] = [];
  seasons.forEach((y, k) => {
    let group = bySeason.get(y)!;
    if (group.length > 1) {
      const prev = out.length ? fr(out[out.length - 1]) : undefined;
      const nextGroup = bySeason.get(seasons[k + 1]);
      const next = nextGroup && seasons[k + 1] === y + 1 ? new Set(nextGroup.map(fr)) : undefined;
      const first = group.find((r) => fr(r) === prev);
      const last = group.find((r) => r !== first && next?.has(fr(r)));
      group = [...(first != null ? [first] : []), ...group.filter((r) => r !== first && r !== last), ...(last != null ? [last] : [])];
    }
    out.push(...group);
  });
  return out;
}

/** One id per player: the Basketball-Reference id, or "espn:<id>" for players it doesn't have yet. */
function idsByPlayer(): string[] {
  const out: string[] = new Array(players.length);
  for (const [id, p] of index) if (out[p] == null || out[p].startsWith('espn:')) out[p] = id;
  return out;
}

const sortedRosters = [...rosters.entries()].sort(([, a], [, b]) => a.season - b.season || a.team.localeCompare(b.team));
const rosterIndex = new Map(sortedRosters.map(([key], i) => [key, i]));

const data: TeammateData = {
  source: 'Basketball-Reference via github.com/sumitrodatta/bball-reference-datasets',
  generatedAt: new Date().toISOString(),
  players,
  rosters: sortedRosters.map(([, r]) => [r.season, r.lg, r.team, [...r.ids]]),
  central: [],
  stints: stintKeys.map((keys) => orderStints(keys.map((k) => rosterIndex.get(k)!))),
  ids: idsByPlayer(),
  espn: Object.fromEntries([...index].filter(([id]) => id.startsWith('espn:')).map(([id, p]) => [id.slice(5), p])),
};

// The most connected players in history: lowest average distance to everyone.
const graph = buildGraph(data);
data.central = centrality(graph, 25);

const json = JSON.stringify(data);
writeFileSync('src/data/teammates.json', json);
console.log(`${players.length} players, ${data.rosters.length} rosters, ${(json.length / 1024).toFixed(0)} KB`);
console.log('most central:', data.central.slice(0, 5).map(([i, avg]) => `${players[i][0]} ${avg.toFixed(3)}`).join(', '));
