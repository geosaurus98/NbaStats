// Builds src/data/staff.json: each team's head coach (season and career
// records) and front office, from Basketball-Reference.
//   npx tsx scripts/staff.ts          (STAFF_PROBE=1 prints the tables' columns instead)
import { brefTables } from '../src/lib/brefTables';

const UA = { 'User-Agent': 'NbaStatsHub/1.0 (personal stats site; one staff refresh a week)' };
const pause = () => new Promise((r) => setTimeout(r, 3500));

async function page(url: string): Promise<string | undefined> {
  const res = await fetch(url, { headers: UA }).catch(() => undefined);
  if (!res?.ok) {
    console.log(`  ${url}: ${res?.status ?? 'failed'}`);
    return undefined;
  }
  return res.text();
}

function probe(label: string, html: string | undefined) {
  if (!html) return;
  console.log(`== ${label}`);
  for (const [id, rows] of brefTables(html)) {
    console.log(`table ${id}: ${rows.length} rows; columns: ${Object.keys(rows[0] ?? {}).join(', ')}`);
    for (const r of rows.slice(0, 3)) console.log('   ', JSON.stringify(r));
  }
}

const year = new Date().getUTCMonth() >= 8 ? new Date().getUTCFullYear() + 1 : new Date().getUTCFullYear();
if (process.env.STAFF_PROBE) {
  probe(`coaches ${year}`, await page(`https://www.basketball-reference.com/leagues/NBA_${year}_coaches.html`));
  await pause();
  probe('executives OKC', await page('https://www.basketball-reference.com/teams/OKC/executives.html'));
  await pause();
  probe('coaches OKC', await page('https://www.basketball-reference.com/teams/OKC/coaches.html'));
}
