// Temporary diagnostic: how ESPN records substitutions and period starters.
const SITE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const j = await (await fetch(`${SITE}/summary?event=401810793`)).json();
const starters = j.boxscore.players.map((t: any) => ({ team: t.team.id, starters: t.statistics[0].athletes.filter((a: any) => a.starter).map((a: any) => `${a.athlete.id}:${a.athlete.shortName}`) }));
console.log('starters', JSON.stringify(starters));
const subs = j.plays.filter((p: any) => /substitution/i.test(p.type?.text ?? ''));
console.log('subs', subs.length);
for (const p of subs.slice(0, 4)) console.log('SUB', JSON.stringify({ text: p.text, team: p.team?.id, participants: p.participants, period: p.period?.number, clock: p.clock?.displayValue }));
for (const q of [2, 3, 4]) {
  const first = j.plays.filter((p: any) => p.period?.number === q).slice(0, 6).map((p: any) => `${p.type?.text}: ${p.text}`);
  console.log(`Q${q} first plays`, JSON.stringify(first));
}
console.log('types', [...new Set(j.plays.map((p: any) => p.type?.text))].filter((t: any) => /sub|period|timeout/i.test(t)).join(' | '));
