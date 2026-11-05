// Referees: each official's games, with the fouls, free throws, scoring and
// home record in them, from the box scores and each game's officials.
import { L, type SeasonLines } from './boxTotals';

export interface RefRow {
  name: string;
  games: number;
  /** Per game, both teams. */
  fouls: number;
  fta: number;
  points: number;
  /** Home team's record in their games. */
  homeWins: number;
  /** Away fouls minus home fouls, per game (positive = more calls against the visitors). */
  foulGap: number;
}

export function refereeTable(lines: SeasonLines, officials: Record<string, string[]>, minGames = 10): { refs: RefRow[]; league: Omit<RefRow, 'name'> } {
  const by = new Map<string, { games: number; fouls: number; fta: number; points: number; homeWins: number; gap: number }>();
  const league = { games: 0, fouls: 0, fta: 0, points: 0, homeWins: 0, gap: 0 };
  for (const g of lines.games) {
    if (g[2] !== 2) continue;
    const crew = officials[g[0]];
    if (!crew?.length) continue;
    const t = { fouls: 0, fta: 0, points: 0, hp: 0, ap: 0, hf: 0, af: 0 };
    for (const l of g[6]) {
      t.fouls += l[L.pf];
      t.fta += l[L.fta];
      t.points += l[L.pts];
      if (l[L.home]) {
        t.hp += l[L.pts];
        t.hf += l[L.pf];
      } else {
        t.ap += l[L.pts];
        t.af += l[L.pf];
      }
    }
    for (const r of [league, ...crew.map((name) => {
      const x = by.get(name) ?? { games: 0, fouls: 0, fta: 0, points: 0, homeWins: 0, gap: 0 };
      by.set(name, x);
      return x;
    })]) {
      r.games++;
      r.fouls += t.fouls;
      r.fta += t.fta;
      r.points += t.points;
      if (t.hp > t.ap) r.homeWins++;
      r.gap += t.af - t.hf;
    }
  }
  const per = (r: typeof league) => ({ games: r.games, fouls: r.fouls / r.games, fta: r.fta / r.games, points: r.points / r.games, homeWins: r.homeWins, foulGap: r.gap / r.games });
  return {
    refs: [...by].filter(([, r]) => r.games >= minGames).map(([name, r]) => ({ name, ...per(r) })).sort((a, b) => b.fouls - a.fouls),
    league: league.games ? per(league) : { games: 0, fouls: 0, fta: 0, points: 0, homeWins: 0, foulGap: 0 },
  };
}
