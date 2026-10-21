// Builds src/data/teammates.json: every team-season roster since 1946-47
// (BAA, NBA and ABA), for the "degrees of separation" teammate graph.
// Source: sumitrodatta/bball-reference-datasets (Basketball-Reference data).
//   npx tsx scripts/teammates.ts
import { writeFileSync } from 'node:fs';
import { buildGraph, centrality, type TeammateData } from '../src/lib/teammates';

const SOURCE = 'https://raw.githubusercontent.com/sumitrodatta/bball-reference-datasets/master/Data/Player%20Season%20Info.csv';

/** Minimal RFC 4180 parser (handles quoted fields and escaped quotes). */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) rows.push([...row, field]);
  return rows.filter((r) => r.length > 1);
}

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
  }
  players[p][1] = Math.min(players[p][1], season);
  players[p][2] = Math.max(players[p][2], season);
  const key = `${season}|${r[LG]}|${team}`;
  const roster = rosters.get(key) ?? { season, lg: r[LG], team, ids: new Set() };
  roster.ids.add(p);
  rosters.set(key, roster);
}

const data: TeammateData = {
  source: 'Basketball-Reference via github.com/sumitrodatta/bball-reference-datasets',
  generatedAt: new Date().toISOString(),
  players,
  rosters: [...rosters.values()]
    .sort((a, b) => a.season - b.season || a.team.localeCompare(b.team))
    .map((r) => [r.season, r.lg, r.team, [...r.ids]]),
  central: [],
};

// The most connected players in history: lowest average distance to everyone.
const graph = buildGraph(data);
data.central = centrality(graph, 25);

const json = JSON.stringify(data);
writeFileSync('src/data/teammates.json', json);
console.log(`${players.length} players, ${data.rosters.length} rosters, ${(json.length / 1024).toFixed(0)} KB`);
console.log('most central:', data.central.slice(0, 5).map(([i, avg]) => `${players[i][0]} ${avg.toFixed(3)}`).join(', '));
