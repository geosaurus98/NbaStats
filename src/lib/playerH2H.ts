// Head-to-head: how two players have done in the games they played against
// each other (on opposite teams, both with minutes).
import { L, type SeasonLines } from './boxTotals';

export interface H2HLine {
  playerId: string;
  games: number;
  wins: number;
  pts: number;
  reb: number;
  ast: number;
  /** Best single game against the other (points). */
  best: number;
}

export interface H2HGame {
  gameId: string;
  date: string;
  /** Points, rebounds, assists for each player, in the order asked. */
  lines: [number, number, number][];
  /** Index of the winner's player. */
  winner: number;
}

export function headToHead(seasons: SeasonLines[], a: string, b: string): { summary: [H2HLine, H2HLine]; games: H2HGame[] } {
  const empty = (id: string): H2HLine => ({ playerId: id, games: 0, wins: 0, pts: 0, reb: 0, ast: 0, best: 0 });
  const summary: [H2HLine, H2HLine] = [empty(a), empty(b)];
  const games: H2HGame[] = [];
  for (const lines of seasons) {
    const ia = lines.ids.indexOf(a);
    const ib = lines.ids.indexOf(b);
    if (ia < 0 || ib < 0) continue;
    for (const [gameId, date, , , , , gl] of lines.games) {
      const la = gl.find((l) => l[L.p] === ia && l[L.min] > 0);
      const lb = gl.find((l) => l[L.p] === ib && l[L.min] > 0);
      if (!la || !lb || la[L.home] === lb[L.home]) continue;
      let home = 0;
      let away = 0;
      for (const l of gl) (l[L.home] ? (home += l[L.pts]) : (away += l[L.pts]));
      const homeWon = home > away;
      const winner = !!la[L.home] === homeWon ? 0 : 1;
      const row: [number, number, number][] = [la, lb].map((l) => [l[L.pts], l[L.oreb] + l[L.dreb], l[L.ast]] as [number, number, number]);
      [la, lb].forEach((l, i) => {
        const s = summary[i];
        s.games++;
        s.pts += l[L.pts];
        s.reb += l[L.oreb] + l[L.dreb];
        s.ast += l[L.ast];
        s.best = Math.max(s.best, l[L.pts]);
        if (winner === i) s.wins++;
      });
      games.push({ gameId, date, lines: row, winner });
    }
  }
  for (const s of summary) {
    if (!s.games) continue;
    s.pts /= s.games;
    s.reb /= s.games;
    s.ast /= s.games;
  }
  return { summary, games: games.sort((x, y) => y.date.localeCompare(x.date)) };
}
