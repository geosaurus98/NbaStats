// What's left of each team's schedule from a given date: opponent strength,
// back-to-backs, home/road split and the longest road trip.
import type { Game, TeamRef } from '../api/types';
import { countsInStandings, isFinal } from './league';

export interface ScheduleAhead {
  team: TeamRef;
  played: number;
  left: number;
  home: number;
  road: number;
  /** Average current win % of the remaining opponents. */
  oppPct: number;
  /** Remaining games against teams currently above .500. */
  vsWinning: number;
  backToBacks: number;
  /** Most consecutive road games still to come. */
  longestTrip: number;
}

const day = (iso: string) => Math.floor(new Date(iso).getTime() / 864e5 - 0.25); // US evenings fall on the same day

export function scheduleAhead(teams: TeamRef[], games: Game[], asOf: string): ScheduleAhead[] {
  const cut = new Date(asOf).getTime();
  const regular = games.filter((g) => countsInStandings(g) && !(isFinal(g) && g.home.score === 0 && g.away.score === 0));
  const before = regular.filter((g) => isFinal(g) && new Date(g.date).getTime() < cut);
  const record = new Map<string, [number, number]>();
  for (const g of before) {
    for (const c of [g.home, g.away]) {
      const r = record.get(c.team.id) ?? [0, 0];
      r[c.winner ? 0 : 1]++;
      record.set(c.team.id, r);
    }
  }
  const pct = (id: string) => {
    const [w, l] = record.get(id) ?? [0, 0];
    return w + l ? w / (w + l) : 0.5;
  };
  return teams.map((team) => {
    const mine = regular.filter((g) => g.home.team.id === team.id || g.away.team.id === team.id).sort((a, b) => a.date.localeCompare(b.date));
    const future = mine.filter((g) => new Date(g.date).getTime() >= cut);
    const lastBefore = [...mine].reverse().find((g) => new Date(g.date).getTime() < cut);
    let b2b = 0;
    let trip = 0;
    let longest = 0;
    let prev = lastBefore ? day(lastBefore.date) : undefined;
    for (const g of future) {
      const d = day(g.date);
      if (prev != null && d - prev === 1) b2b++;
      prev = d;
      if (g.away.team.id === team.id) longest = Math.max(longest, ++trip);
      else trip = 0;
    }
    const opps = future.map((g) => (g.home.team.id === team.id ? g.away.team.id : g.home.team.id));
    return {
      team,
      played: mine.length - future.length,
      left: future.length,
      home: future.filter((g) => g.home.team.id === team.id).length,
      road: future.filter((g) => g.away.team.id === team.id).length,
      oppPct: opps.length ? opps.reduce((a, id) => a + pct(id), 0) / opps.length : 0,
      vsWinning: opps.filter((id) => pct(id) > 0.5).length,
      backToBacks: b2b,
      longestTrip: longest,
    };
  });
}
