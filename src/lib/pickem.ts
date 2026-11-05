// Pick'em: your picks for each game against the Elo model's, scored once the
// games are final.
import type { Game } from '../api/types';
import { isFinal } from './league';

/** Game id -> the team id you picked. */
export type Picks = Record<string, string>;

export interface PickResult {
  game: Game;
  pick: string;
  /** The model's pre-game chance the home team wins. */
  pHome: number;
  winner: string;
  youRight: boolean;
  modelRight: boolean;
}

export interface PickScore {
  you: [number, number];
  model: [number, number];
  /** Games where you went against the model, and how many of those you got right. */
  against: [number, number];
  results: PickResult[];
}

const winner = (g: Game) => ((g.home.score ?? 0) > (g.away.score ?? 0) ? g.home.team.id : g.away.team.id);

/** Scores your picks on finished games; the model's pick is its pre-game favourite. */
export function scorePicks(picks: Picks, games: Game[], predictions: Map<string, number>): PickScore {
  const out: PickScore = { you: [0, 0], model: [0, 0], against: [0, 0], results: [] };
  for (const g of games) {
    const pick = picks[g.id];
    const pHome = predictions.get(g.id);
    if (!pick || pHome === undefined || !isFinal(g)) continue;
    const w = winner(g);
    const modelPick = pHome >= 0.5 ? g.home.team.id : g.away.team.id;
    const youRight = pick === w;
    const modelRight = modelPick === w;
    out.you[youRight ? 0 : 1]++;
    out.model[modelRight ? 0 : 1]++;
    if (pick !== modelPick) {
      out.against[0]++;
      if (youRight) out.against[1]++;
    }
    out.results.push({ game: g, pick, pHome, winner: w, youRight, modelRight });
  }
  out.results.sort((a, b) => b.game.date.localeCompare(a.game.date));
  return out;
}

/** Games you can still pick: not started, from today's slate onwards (the next `days` days with games). */
export function openGames(games: Game[], now = Date.now(), days = 2): Game[] {
  const upcoming = games.filter((g) => g.state === 'pre' && Date.parse(g.date) > now).sort((a, b) => a.date.localeCompare(b.date));
  const dayOf = (g: Game) => new Date(Date.parse(g.date) - 6 * 36e5).toISOString().slice(0, 10); // US evening games stay on their US date
  const firstDays = [...new Set(upcoming.map(dayOf))].slice(0, days);
  return upcoming.filter((g) => firstDays.includes(dayOf(g)));
}
