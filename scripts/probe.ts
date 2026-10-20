// Diagnostic: hits every ESPN endpoint the app uses, reports CORS headers for a
// file:// page (Origin: null) and what the app's normalisers extract.
import * as api from '../src/api/espn';

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const COMMON = 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba';
const RAW = [
  `${SITE}/scoreboard?dates=20260412&limit=100`,
  `${SITE}/teams`,
  `${SITE}/teams/13/schedule?season=2026&seasontype=2`,
  'https://site.api.espn.com/apis/v2/sports/basketball/nba/standings?season=2026',
  `${COMMON}/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=true&limit=5&season=2026&seasontype=2&sort=offensive.avgPoints%3Adesc`,
  `${COMMON}/statistics/byteam?region=us&lang=en&contentorigin=espn&season=2026&seasontype=2`,
  `${COMMON}/athletes/3945274`,
  `${COMMON}/athletes/3945274/gamelog?season=2026`,
];

function shape(v: unknown, depth = 0): string {
  if (depth > 3) return '…';
  if (Array.isArray(v)) return `[${v.length}] ${v.length ? shape(v[0], depth + 1) : ''}`;
  if (v && typeof v === 'object') {
    const keys = Object.keys(v).slice(0, 14);
    return `{${keys.map((k) => `${k}: ${shape((v as Record<string, unknown>)[k], depth + 1)}`).join(', ')}}`;
  }
  return typeof v === 'string' ? JSON.stringify(v.slice(0, 30)) : String(v);
}

async function main() {
  console.log('=== RAW / CORS ===');
  for (const url of RAW) {
    try {
      const res = await fetch(url, { headers: { Origin: 'null' } });
      const text = await res.text();
      console.log(`\n${res.status} ${url}\n  ACAO=${res.headers.get('access-control-allow-origin')} bytes=${text.length}`);
      try {
        console.log('  shape:', shape(JSON.parse(text)).slice(0, 1500));
      } catch {
        console.log('  body:', text.slice(0, 200));
      }
    } catch (e) {
      console.log(`\nFAIL ${url}: ${(e as Error).message}`);
    }
  }

  console.log('\n=== NORMALISED ===');
  const run = async (name: string, fn: () => Promise<unknown>, summary: (x: any) => unknown) => {
    try {
      console.log(name, JSON.stringify(summary(await fn())).slice(0, 600));
    } catch (e) {
      console.log(name, 'ERROR', (e as Error).message);
    }
  };
  await run('scoreboard', () => api.fetchScoreboard('2026-04-12'), (g) => ({ n: g.length, first: g[0] }));
  await run('standings', () => api.fetchStandings(2026), (c) => c.map((x: any) => ({ name: x.name, n: x.rows.length, top: x.rows[0] })));
  await run('teams', () => api.fetchTeams(), (t) => ({ n: t.length, first: t[0] }));
  await run('schedule', () => api.fetchTeamSchedule('13', 2026, 2), (s) => ({ n: s.games.length, first: s.games[0] }));
  await run('playoffs', () => api.fetchTeamSchedule('25', 2026, 3), (s) => ({ n: s.games.length, notes: s.games.map((g: any) => g.note).slice(0, 3) }));
  await run('leaders', () => api.fetchLeaders(2026, 2, 'offensive.avgPoints'), (l) => ({ cols: l.columns, n: l.rows.length, first: l.rows[0] }));
  await run('teamStats', () => api.fetchTeamStats(2026, 2), (t) => ({ cols: t.columns, n: t.rows.length, first: t.rows[0] }));
  await run('athlete', () => api.fetchAthlete('3945274'), (a) => a);
  await run('gamelog', () => api.fetchGameLog('3945274', 2026), (l) => ({ labels: l.labels, n: l.games.length, first: l.games[0] }));
  const sb = await api.fetchScoreboard('2026-04-12').catch(() => []);
  if (sb[0]) await run('summary', () => api.fetchSummary(sb[0].id), (s) => ({ game: s.game.statusDetail, teams: s.teams.map((t: any) => ({ n: t.players.length, labels: t.labels, stats: t.teamStats.length })) }));
}

main();
