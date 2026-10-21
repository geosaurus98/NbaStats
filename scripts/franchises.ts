// Builds src/data/franchises.json: every team-season's record and ratings
// (Team Summaries) and every draft pick (Draft Pick History), from
// Basketball-Reference via sumitrodatta/bball-reference-datasets.
//   npx tsx scripts/franchises.ts   (after scripts/teammates.ts)
import { readFileSync, writeFileSync } from 'node:fs';
import { parseCSV } from './csv';
import type { FranchiseData } from '../src/lib/franchiseData';

const BASE = 'https://raw.githubusercontent.com/sumitrodatta/bball-reference-datasets/master/Data/';
const LEAGUES = ['NBA', 'ABA', 'BAA'];

async function table(file: string) {
  const res = await fetch(BASE + encodeURIComponent(file));
  if (!res.ok) throw new Error(`${file}: ${res.status}`);
  const [header, ...rows] = parseCSV(await res.text());
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])) as Record<string, string>);
}

const teammates = JSON.parse(readFileSync('src/data/teammates.json', 'utf8'));
const indexOf = new Map<string, number>((teammates.ids as string[]).map((id, i) => [id, i]));
const n = (v: string | undefined, dp = 1) => (v == null || v === 'NA' || v === '' ? null : Math.round(Number(v) * 10 ** dp) / 10 ** dp);

const teamSeasons: FranchiseData['teamSeasons'] = [];
for (const r of await table('Team Summaries.csv')) {
  if (!r.abbreviation || r.abbreviation === 'NA') continue; // league-average rows
  teamSeasons.push([
    Number(r.season),
    LEAGUES.indexOf(r.lg),
    r.abbreviation,
    r.team.replace(/\*$/, ''),
    n(r.w, 0) ?? 0,
    n(r.l, 0) ?? 0,
    r.playoffs === 'TRUE' ? 1 : 0,
    n(r.srs, 2),
    n(r.o_rtg),
    n(r.d_rtg),
    n(r.pace),
    n(r.attend_g, 0),
  ]);
}

const draft: FranchiseData['draft'] = [];
for (const r of await table('Draft Pick History.csv')) {
  draft.push([Number(r.season), LEAGUES.indexOf(r.lg), n(r.overall_pick, 0) ?? 0, n(r.round, 0) ?? 0, r.tm, indexOf.get(r.player_id) ?? -1, r.player, r.college === 'NA' ? '' : r.college]);
}

const data: FranchiseData = { source: 'Basketball-Reference via github.com/sumitrodatta/bball-reference-datasets', teamSeasons, draft };
const json = JSON.stringify(data);
writeFileSync('src/data/franchises.json', json);
console.log(`${teamSeasons.length} team-seasons, ${draft.length} draft picks (${draft.filter((d) => d[5] >= 0).length} played), ${(json.length / 1024).toFixed(0)} KB`);
