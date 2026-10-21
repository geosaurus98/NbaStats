// Builds src/data/franchises.json: every team-season's record and ratings
// (Team Summaries) and every draft pick (Draft Pick History), from
// Basketball-Reference via sumitrodatta/bball-reference-datasets.
//   npx tsx scripts/franchises.ts   (after scripts/teammates.ts)
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseCSV } from './csv';
import type { FranchiseData } from '../src/lib/franchiseData';
import { franchiseOf } from '../src/lib/franchises';

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

// Top five scorers per team-season (per-team rows, so traded players count for each team).
const topBy = new Map<string, number[][]>();
for (const r of await table('Player Totals.csv')) {
  if (/^\dTM$/.test(r.team)) continue;
  const p = indexOf.get(r.player_id);
  const g = Number(r.g);
  if (p == null || !g) continue;
  const key = `${r.season}|${r.lg}|${r.team}`;
  const per = (v: string) => (v === 'NA' ? -1 : Math.round((Number(v) / g) * 10));
  topBy.set(key, [...(topBy.get(key) ?? []), [p, g, per(r.pts), per(r.trb), per(r.ast), Number(r.pts) || 0]]);
}
const topOf = (season: string, lg: string, code: string) =>
  (topBy.get(`${season}|${lg}|${code}`) ?? [])
    .sort((a, b) => b[5] - a[5])
    .slice(0, 5)
    .flatMap((x) => x.slice(0, 5));

// The source's playoff flags can lag for the latest season: fill them in from our ESPN snapshots.
const espnPlayoffTeams = new Map<number, Set<string>>();
for (const f of readdirSync('src/data').filter((f) => /^season-\d+\.json$/.test(f))) {
  const snap = JSON.parse(readFileSync(`src/data/${f}`, 'utf8'));
  const ids = new Set<string>((snap.games?.['3'] ?? []).flatMap((g: string[]) => [g[2], g[3]]));
  if (ids.size >= 16) espnPlayoffTeams.set(snap.year, ids);
}

const teamSeasons: FranchiseData['teamSeasons'] = [];
const detail: FranchiseData['detail'] = [];
const top: FranchiseData['top'] = [];
const league: FranchiseData['league'] = [];
for (const r of await table('Team Summaries.csv')) {
  const rates = [n(r.x3p_ar, 3), n(r.ts_percent, 3), n(r.e_fg_percent, 3), n(r.tov_percent), n(r.orb_percent), n(r.f_tr, 3)];
  if (!r.abbreviation || r.abbreviation === 'NA') {
    league.push([Number(r.season), LEAGUES.indexOf(r.lg), n(r.o_rtg), n(r.pace), ...rates]);
    continue;
  }
  const espn = espnPlayoffTeams.get(Number(r.season));
  const espnId = franchiseOf(r.abbreviation)?.espnId;
  const playoffs = espn && espnId ? espn.has(espnId) : r.playoffs === 'TRUE';
  detail.push([n(r.age), n(r.mov, 2), n(r.n_rtg), rates[0], rates[1], rates[2], rates[3], rates[4], n(r.opp_e_fg_percent, 3), rates[5]]);
  top.push(topOf(r.season, r.lg, r.abbreviation));
  teamSeasons.push([
    Number(r.season),
    LEAGUES.indexOf(r.lg),
    r.abbreviation,
    r.team.replace(/\*$/, ''),
    n(r.w, 0) ?? 0,
    n(r.l, 0) ?? 0,
    playoffs ? 1 : 0,
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

const data: FranchiseData = { source: 'Basketball-Reference via github.com/sumitrodatta/bball-reference-datasets', teamSeasons, draft, detail, top, league };
const json = JSON.stringify(data);
writeFileSync('src/data/franchises.json', json);
console.log(`${teamSeasons.length} team-seasons, ${draft.length} draft picks (${draft.filter((d) => d[5] >= 0).length} played), ${(json.length / 1024).toFixed(0)} KB`);
