// Builds src/data/careers.json: every player's season-by-season totals since
// 1946-47, award voting and All-Star selections, keyed by the same player
// index as teammates.json. Source: Basketball-Reference via
// sumitrodatta/bball-reference-datasets.
//   npx tsx scripts/careers.ts   (after scripts/teammates.ts)
import { readFileSync, writeFileSync } from 'node:fs';
import { parseCSV } from './csv';
import type { CareerData } from '../src/lib/careers';

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
const num = (v: string | undefined) => (v == null || v === 'NA' || v === '' ? -1 : Math.round(Number(v)));

// Season totals: a traded player has per-team rows plus a combined "2TM" row; use the combined one.
const totals = await table('Player Totals.csv');
const multi = new Set(totals.filter((r) => /^\dTM$/.test(r.team)).map((r) => `${r.player_id}|${r.season}|${r.lg}`));
const seasons: CareerData['seasons'] = teammates.players.map(() => []);
let missing = 0;
for (const r of totals) {
  const key = `${r.player_id}|${r.season}|${r.lg}`;
  if (multi.has(key) && !/^\dTM$/.test(r.team)) continue;
  const p = indexOf.get(r.player_id);
  if (p == null) {
    missing++;
    continue;
  }
  seasons[p].push([
    Number(r.season),
    LEAGUES.indexOf(r.lg),
    num(r.age),
    num(r.g),
    num(r.mp),
    num(r.pts),
    num(r.trb),
    num(r.ast),
    num(r.stl),
    num(r.blk),
    num(r.fg),
    num(r.fga),
    num(r.x3p),
    num(r.x3pa),
    num(r.ft),
    num(r.fta),
  ]);
}
for (const s of seasons) s.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

// Per-team rows for traded players' seasons (for franchise leaderboards).
const splits: CareerData['splits'] = [];
for (const r of totals) {
  if (!multi.has(`${r.player_id}|${r.season}|${r.lg}`) || /^\dTM$/.test(r.team)) continue;
  const p = indexOf.get(r.player_id);
  if (p != null) splits.push([p, Number(r.season), LEAGUES.indexOf(r.lg), r.team, num(r.g), num(r.pts), num(r.trb), num(r.ast), num(r.stl), num(r.blk), num(r.mp)]);
}

const awards: CareerData['awards'] = {};
for (const r of await table('Player Award Shares.csv')) {
  const p = indexOf.get(r.player_id);
  if (p == null) continue;
  (awards[r.award] ??= []).push([Number(r.season), p, Number(r.share), r.winner === 'TRUE' ? 1 : 0, num(r.first)]);
}

const allStars: CareerData['allStars'] = [];
for (const r of await table('All-Star Selections.csv')) {
  const p = indexOf.get(r.player_id);
  if (p != null) allStars.push([Number(r.season), p]);
}

const data: CareerData = {
  source: 'Basketball-Reference via github.com/sumitrodatta/bball-reference-datasets',
  seasons,
  awards,
  allStars,
  splits,
};
const json = JSON.stringify(data);
writeFileSync('src/data/careers.json', json);
console.log(`${splits.length} traded-season splits, ${seasons.filter((s) => s.length).length} players with stats, ${missing} unmatched rows, ${Object.keys(awards).length} awards, ${allStars.length} All-Star selections, ${(json.length / 1024).toFixed(0)} KB`);
