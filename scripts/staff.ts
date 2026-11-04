// Builds src/data/staff.json: each team's head coach (season, with-team and
// career records), its coaching history and its front office, from
// Basketball-Reference, politely (one request every few seconds).
//   npx tsx scripts/staff.ts          (STAFF_PROBE=1 prints the tables' columns instead)
import { writeFileSync } from 'node:fs';
import { brefTables } from '../src/lib/brefTables';
import { FRANCHISES } from '../src/lib/franchises';
import { seasonYearFor } from '../src/lib/seasons';
import { parseExecutives, parseFranchiseCoaches, parseSeasonCoaches, type StaffData } from '../src/lib/staff';

const UA = { 'User-Agent': 'NbaStatsHub/1.0 (personal stats site; one staff refresh a week)' };
const pause = () => new Promise((r) => setTimeout(r, 3500));

async function page(url: string): Promise<string | undefined> {
  const res = await fetch(url, { headers: UA }).catch(() => undefined);
  await pause();
  if (!res?.ok) {
    console.log(`  ${url}: ${res?.status ?? 'failed'}`);
    return undefined;
  }
  return res.text();
}

const season = seasonYearFor(new Date().toISOString().slice(0, 10));
const base = 'https://www.basketball-reference.com';

if (process.env.STAFF_PROBE) {
  for (const url of [`${base}/leagues/NBA_${season}_coaches.html`, `${base}/teams/OKC/executives.html`, `${base}/teams/OKC/coaches.html`]) {
    const html = await page(url);
    if (!html) continue;
    console.log(`== ${url}`);
    for (const [tid, rows] of brefTables(html)) console.log(`table ${tid}: ${rows.length} rows; ${JSON.stringify(rows.slice(0, 3))}`);
  }
} else {
  let coaches = parseSeasonCoaches((await page(`${base}/leagues/NBA_${season}_coaches.html`)) ?? '');
  // Before a season's first game the page can be empty: use last season's.
  if (coaches.length < 30) coaches = parseSeasonCoaches((await page(`${base}/leagues/NBA_${season - 1}_coaches.html`)) ?? '');
  const coachHistory: StaffData['coachHistory'] = {};
  const executives: StaffData['executives'] = {};
  for (const f of FRANCHISES) {
    const code = f.codes[f.codes.length - 1];
    const ch = await page(`${base}/teams/${code}/coaches.html`);
    if (ch) coachHistory[code] = parseFranchiseCoaches(ch);
    const ex = await page(`${base}/teams/${code}/executives.html`);
    if (ex) executives[code] = parseExecutives(ex);
  }
  console.log(`${coaches.length} coaches, ${Object.keys(coachHistory).length} coaching histories, ${Object.keys(executives).length} front offices`);
  if (coaches.length < 28 || Object.keys(executives).length < 28) throw new Error('Staff data looks incomplete; not writing it');
  const out: StaffData = { generatedAt: new Date().toISOString(), season, coaches, coachHistory, executives };
  writeFileSync('src/data/staff.json', JSON.stringify(out));
}
