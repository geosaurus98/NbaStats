// Season review: a season's story in one page, from the bundled data: the
// champion's path, best and worst records, upsets, best games and leaders.
import type { Game } from '../api/types';
import { P, type PlayerTotalsRow } from './boxTotals';
import { countsInStandings, isFinal } from './league';
import type { DramaRow } from './pbpStats';

export interface Series {
  opponentId: string;
  wins: number;
  losses: number;
}

const winnerOf = (g: Game) => ((g.home.score ?? 0) > (g.away.score ?? 0) ? g.home.team.id : g.away.team.id);

/** The champion (winner of the last playoff game) and each series on its way. */
export function championPath(playoffs: Game[]): { championId: string; series: Series[] } | undefined {
  const done = playoffs.filter(isFinal).filter((g) => !/play-in/i.test(g.note ?? '')).sort((a, b) => a.date.localeCompare(b.date));
  if (!done.length) return undefined;
  const last = done[done.length - 1];
  const champ = winnerOf(last);
  const series = new Map<string, Series>();
  for (const g of done) {
    if (g.home.team.id !== champ && g.away.team.id !== champ) continue;
    const opp = g.home.team.id === champ ? g.away.team.id : g.home.team.id;
    const s = series.get(opp) ?? { opponentId: opp, wins: 0, losses: 0 };
    if (winnerOf(g) === champ) s.wins++;
    else s.losses++;
    series.set(opp, s);
  }
  // Only a finished Finals (four wins) crowns a champion.
  const finals = series.get(last.home.team.id === champ ? last.away.team.id : last.home.team.id);
  if (!finals || finals.wins < 4) return undefined;
  return { championId: champ, series: [...series.values()] };
}

export interface Upset {
  game: Game;
  winnerId: string;
  /** The winner's pre-game chance. */
  chance: number;
}

/** Wins the model gave the smallest chance to. */
export function biggestUpsets(predictions: { game: Game; pHome: number }[], n = 5): Upset[] {
  return predictions
    .filter((p) => isFinal(p.game) && countsInStandings(p.game))
    .map((p) => {
      const w = winnerOf(p.game);
      return { game: p.game, winnerId: w, chance: w === p.game.home.team.id ? p.pHome : 1 - p.pHome };
    })
    .sort((a, b) => a.chance - b.chance)
    .slice(0, n);
}

/** The most dramatic games: win-probability swing plus the late swing (as on Insights). */
export function bestGames(drama: DramaRow[], n = 5): { gameId: string; index: number; comeback: number }[] {
  return drama
    .map((r) => ({ gameId: r[0], index: r[1] + r[4], comeback: r[2] }))
    .sort((a, b) => b.index - a.index)
    .slice(0, n);
}

export interface Leader {
  id: string;
  teamId: string;
  value: number;
  g: number;
}

/** Per-game leaders among players who played 58+ games (scaled to the games played so far). */
export function leaders(players: PlayerTotalsRow[], teamGames: number, stat: 'pts' | 'reb' | 'ast' | 'stl' | 'blk', n = 3): Leader[] {
  const min = Math.floor((58 / 82) * teamGames);
  return players
    .filter((r) => (r[P.gp] as number) >= Math.max(1, min))
    .map((r) => {
      const v = (k: keyof typeof P) => r[P[k]] as number;
      const total = stat === 'reb' ? v('oreb') + v('dreb') : v(stat);
      return { id: r[0], teamId: r[1], value: total / v('gp'), g: v('gp') };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}
