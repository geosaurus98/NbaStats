// Conference rank at the end of every week of the season, for the
// "standings over time" bump chart.
import type { Game, TeamRef } from '../api/types';
import { countsInStandings, isFinal } from './league';

export interface RankHistory {
  /** The last day (ISO date) of each week. */
  weeks: string[];
  /** teamId → conference rank (1 = best) after each week. */
  ranks: Map<string, number[]>;
}

/** `conferences` lists each conference's team ids. */
export function rankHistory(games: Game[], conferences: string[][], teams: TeamRef[] = []): RankHistory {
  const played = games.filter((g) => isFinal(g) && countsInStandings(g)).sort((a, b) => a.date.localeCompare(b.date));
  if (!played.length) return { weeks: [], ranks: new Map() };
  const day = (iso: string) => new Date(new Date(iso).getTime() - 6 * 3600e3).toISOString().slice(0, 10);
  const first = new Date(day(played[0].date) + 'T00:00:00Z');
  const last = day(played[played.length - 1].date);
  // Week ends: every Sunday after the first game, plus the latest game day.
  const weeks: string[] = [];
  const d = new Date(first);
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7));
  while (d.toISOString().slice(0, 10) < last) {
    weeks.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 7);
  }
  weeks.push(last);
  const record = new Map<string, [number, number]>();
  for (const ids of conferences) for (const id of ids) record.set(id, [0, 0]);
  const ranks = new Map<string, number[]>([...record.keys()].map((id) => [id, []]));
  const name = new Map(teams.map((t) => [t.id, t.name]));
  let i = 0;
  for (const w of weeks) {
    for (; i < played.length && day(played[i].date) <= w; i++) {
      const g = played[i];
      const homeWon = (g.home.score ?? 0) > (g.away.score ?? 0);
      const h = record.get(g.home.team.id);
      const a = record.get(g.away.team.id);
      if (h) h[homeWon ? 0 : 1]++;
      if (a) a[homeWon ? 1 : 0]++;
    }
    for (const ids of conferences) {
      const pct = (id: string) => {
        const [wn, l] = record.get(id)!;
        return wn + l ? wn / (wn + l) : 0.5;
      };
      [...ids]
        .sort((x, y) => pct(y) - pct(x) || record.get(y)![0] - record.get(x)![0] || (name.get(x) ?? x).localeCompare(name.get(y) ?? y))
        .forEach((id, r) => ranks.get(id)!.push(r + 1));
    }
  }
  return { weeks, ranks };
}
