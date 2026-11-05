// Starting lineups through a season: each game's starting five, stretches
// with the same five, and how the team did in each.
import { L, type SeasonLines } from './boxTotals';

export interface StarterGame {
  gameId: string;
  date: string;
  /** Player indexes (into lines.ids), sorted. */
  five: number[];
  margin: number;
}

export interface Stretch {
  five: number[];
  from: string;
  to: string;
  games: number;
  wins: number;
  /** Average margin per game. */
  net: number;
  /** Who came in and who went out against the previous stretch. */
  in: number[];
  out: number[];
}

export function starterGames(lines: SeasonLines, teamId: string): StarterGame[] {
  const out: StarterGame[] = [];
  for (const g of [...lines.games].filter((x) => x[2] === 2 && (x[3] === teamId || x[4] === teamId)).sort((a, b) => a[1].localeCompare(b[1]))) {
    const home = g[3] === teamId;
    let us = 0;
    let them = 0;
    const five: number[] = [];
    for (const l of g[6]) {
      if (!!l[L.home] === home) {
        us += l[L.pts];
        if (l[L.starter]) five.push(l[L.p]);
      } else them += l[L.pts];
    }
    if (five.length === 5) out.push({ gameId: g[0], date: g[1], five: five.sort((a, b) => a - b), margin: us - them });
  }
  return out;
}

const key = (five: number[]) => five.join(',');

/** Runs of consecutive games with the same starting five. */
export function stretches(games: StarterGame[]): Stretch[] {
  const out: Stretch[] = [];
  for (const g of games) {
    const last = out[out.length - 1];
    if (last && key(last.five) === key(g.five)) {
      last.to = g.date;
      last.net = (last.net * last.games + g.margin) / (last.games + 1);
      last.games++;
      if (g.margin > 0) last.wins++;
      continue;
    }
    const prev = last?.five ?? [];
    out.push({ five: g.five, from: g.date, to: g.date, games: 1, wins: g.margin > 0 ? 1 : 0, net: g.margin, in: g.five.filter((p) => !prev.includes(p)), out: prev.filter((p) => !g.five.includes(p)) });
  }
  return out;
}

export interface FiveSummary {
  five: number[];
  games: number;
  wins: number;
  net: number;
}

/** Every starting five a team has used, most-used first. */
export function fives(games: StarterGame[]): FiveSummary[] {
  const by = new Map<string, FiveSummary>();
  for (const g of games) {
    const r = by.get(key(g.five)) ?? { five: g.five, games: 0, wins: 0, net: 0 };
    r.net = (r.net * r.games + g.margin) / (r.games + 1);
    r.games++;
    if (g.margin > 0) r.wins++;
    by.set(key(g.five), r);
  }
  return [...by.values()].sort((a, b) => b.games - a.games || b.net - a.net);
}
