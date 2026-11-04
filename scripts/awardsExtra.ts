// Fills in award voting and All-NBA teams the Basketball-Reference dataset
// hasn't published yet (scripts/awards-extra.json), for seasons the source is
// missing only, so the source wins once it catches up. Players are matched by
// name (accents ignored) among those active that season.
//   npx tsx scripts/awardsExtra.ts   (patches src/data/careers.json in place)
import { readFileSync, writeFileSync } from 'node:fs';
import type { CareerData } from '../src/lib/careers';

type Extra = Record<string, { awards?: Record<string, [string, number | null, number, number][]>; allNba?: [string, number][] }>;

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

export function mergeAwardsExtra(data: CareerData, players: [string, number, number][], extra: Extra = JSON.parse(readFileSync('scripts/awards-extra.json', 'utf8'))): string[] {
  const added: string[] = [];
  const find = (name: string, season: number) => {
    const n = norm(name);
    const hits = players.map((p, i) => [p, i] as const).filter(([p]) => norm(p[0]) === n && p[2] >= season - 1);
    return hits.length ? hits.sort((a, b) => b[0][2] - a[0][2])[0][1] : undefined;
  };
  for (const [key, val] of Object.entries(extra)) {
    const season = Number(key);
    if (!season) continue;
    for (const [award, rows] of Object.entries(val.awards ?? {})) {
      const list = (data.awards[award] ??= []);
      if (list.some((r) => r[0] === season)) continue;
      for (const [name, share, winner, first] of rows) {
        const p = find(name, season);
        if (p == null) throw new Error(`awards-extra: no player "${name}" in ${season}`);
        list.push([season, p, share as number, winner, first]);
      }
      added.push(`${season} ${award}`);
    }
    if (val.allNba && data.allNba && !data.allNba.some((r) => r[0] === season)) {
      for (const [name, team] of val.allNba) {
        const p = find(name, season);
        if (p == null) throw new Error(`awards-extra: no player "${name}" in ${season}`);
        data.allNba.push([season, p, team]);
      }
      added.push(`${season} All-NBA`);
    }
  }
  return added;
}

if (process.argv[1]?.endsWith('awardsExtra.ts')) {
  const data = JSON.parse(readFileSync('src/data/careers.json', 'utf8')) as CareerData;
  const players = JSON.parse(readFileSync('src/data/teammates.json', 'utf8')).players;
  console.log('added', mergeAwardsExtra(data, players));
  writeFileSync('src/data/careers.json', JSON.stringify(data));
}
