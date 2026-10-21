// Temporary diagnostic: which sources have historical NBA rosters?
const tries: [string, string, Record<string, string>?][] = [
  ['espn site roster 2010', 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/13/roster?season=2010'],
  ['espn site roster 1990', 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/13/roster?season=1990'],
  ['espn core seasons', 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons?limit=200'],
  ['espn core 1990 teams', 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/1990/teams?limit=50'],
  ['espn core 1990 LAL athletes', 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/1990/teams/13/athletes?limit=100'],
  ['espn core 1965 BOS athletes', 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/1965/teams/2/athletes?limit=100'],
  ['espn core 2005 LAL athletes', 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/2005/teams/13/athletes?limit=100'],
  ['nba stats roster 1985-86', 'https://stats.nba.com/stats/commonteamroster?LeagueID=00&Season=1985-86&TeamID=1610612747', {
    Referer: 'https://www.nba.com/', Origin: 'https://www.nba.com', 'User-Agent': 'Mozilla/5.0', Accept: 'application/json', 'x-nba-stats-origin': 'stats', 'x-nba-stats-token': 'true' }],
  ['nba stats allplayers', 'https://stats.nba.com/stats/commonallplayers?LeagueID=00&Season=2025-26&IsOnlyCurrentSeason=0', {
    Referer: 'https://www.nba.com/', Origin: 'https://www.nba.com', 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }],
];

for (const [name, url, headers] of tries) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    const text = await res.text();
    console.log(`\n## ${name}: ${res.status} ${text.length}B`);
    console.log(text.slice(0, 700).replace(/\s+/g, ' '));
    try {
      const j = JSON.parse(text);
      if (j.items) console.log('items', j.count ?? j.items.length, 'first', JSON.stringify(j.items[0]).slice(0, 200), 'last', JSON.stringify(j.items[j.items.length - 1]).slice(0, 200));
      if (j.athletes) console.log('athletes groups', j.athletes.length, JSON.stringify(j.athletes[0]).slice(0, 300));
      if (j.resultSets) console.log('rows', j.resultSets[0].rowSet.length, JSON.stringify(j.resultSets[0].headers), JSON.stringify(j.resultSets[0].rowSet[0]));
    } catch {}
  } catch (e) {
    console.log(`\n## ${name}: FAIL ${(e as Error).message}`);
  } finally {
    clearTimeout(t);
  }
}
// If core athletes are refs, resolve one to see the payload.
try {
  const j = await (await fetch('https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/1990/teams/13/athletes?limit=100')).json();
  const ref = j.items?.[0]?.$ref;
  if (ref) {
    const a = await (await fetch(ref)).json();
    console.log('\n## resolved athlete', JSON.stringify({ id: a.id, displayName: a.displayName, debutYear: a.debutYear }).slice(0, 300));
  }
} catch (e) {
  console.log('resolve failed', (e as Error).message);
}
