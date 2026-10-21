// Temporary diagnostic: what does ESPN's play-by-play look like?
const SITE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';

function shape(v: unknown, depth = 0): string {
  if (depth > 3) return '…';
  if (Array.isArray(v)) return `[${v.length}] ${v.length ? shape(v[0], depth + 1) : ''}`;
  if (v && typeof v === 'object') return `{${Object.keys(v).slice(0, 20).map((k) => `${k}: ${shape((v as any)[k], depth + 1)}`).join(', ')}}`;
  return typeof v === 'string' ? JSON.stringify(v.slice(0, 40)) : String(v);
}

const res = await fetch(`${SITE}/summary?event=401810793`);
const text = await res.text();
const j = JSON.parse(text);
console.log('status', res.status, 'bytes', text.length, 'ACAO', res.headers.get('access-control-allow-origin'));
console.log('top keys', Object.keys(j).join(', '));
const plays = j.plays ?? [];
console.log('plays', plays.length);
console.log('play shape', shape(plays[0]));
const scoring = plays.filter((p: any) => p.scoringPlay);
const assisted = scoring.filter((p: any) => /assist/i.test(p.text));
console.log('scoring', scoring.length, 'assisted', assisted.length);
for (const p of assisted.slice(0, 3)) console.log('ASSISTED', JSON.stringify(p));
for (const p of plays.filter((p: any) => p.shootingPlay && !p.scoringPlay).slice(0, 2)) console.log('MISS', JSON.stringify(p));
console.log('types', [...new Set(plays.map((p: any) => p.type?.text))].slice(0, 60).join(' | '));
console.log('boxscore players athlete sample', JSON.stringify(j.boxscore?.players?.[0]?.statistics?.[0]?.athletes?.[0]?.athlete).slice(0, 400));
console.log('winprob', shape(j.winprobability?.[0]), (j.winprobability ?? []).length);
