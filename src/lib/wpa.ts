// Win probability added: every play's change in ESPN's win probability,
// credited to the players in it. A made shot goes to the shooter (shared
// with the passer on an assist); a steal or block splits the swing between
// the player who lost the ball or missed and the defender; a defensive
// rebound's swing goes mostly to the shooter who missed.
import type { FeedItem } from '../api/types';

/** [id, teamId, games, wpa (wins), best game wpa, best game id, worst game wpa, worst game id] */
export type WpaRow = [string, string, number, number, number, string, number, string];

export interface WpaTotals {
  players: WpaRow[];
  /** The biggest single-game totals: [id, teamId, gameId, wpa]. */
  games: [string, string, string, number][];
}

/** Each player's win probability added in one game (wins, from their team's side). */
export function gameWpa(feed: FeedItem[], homeId: string, teamOf: Record<string, string>): Map<string, number> {
  const out = new Map<string, number>();
  const credit = (id: string, delta: number) => {
    const team = teamOf[id];
    if (!team) return;
    out.set(id, (out.get(id) ?? 0) + (team === homeId ? delta : -delta));
  };
  let prev: number | undefined;
  let lastMiss: string | undefined;
  for (const p of feed) {
    const missed = /\bmisses\b/i.test(p.text) ? p.ids[0] : undefined;
    const miss = lastMiss;
    if (missed) lastMiss = missed;
    else if (!/rebound/i.test(p.text)) lastMiss = undefined;
    if (p.wp == null) continue;
    // ESPN's first value is the pre-game chance, not a swing anyone caused.
    if (prev == null) {
      prev = p.wp;
      continue;
    }
    const delta = p.wp - prev;
    prev = p.wp;
    if (!delta || p.sub) continue;
    const [a, b] = p.ids;
    if (!a || !teamOf[a]) continue;
    if (/defensive rebound/i.test(p.text) && miss && teamOf[miss] && teamOf[miss] !== teamOf[a]) {
      // The swing on a defensive rebound mostly belongs to the miss before it.
      credit(a, delta * 0.3);
      credit(miss, delta * 0.7);
    } else if (b && teamOf[b]) {
      if (teamOf[b] === teamOf[a]) {
        // Assist: two thirds to the scorer, one third to the passer.
        credit(a, (delta * 2) / 3);
        credit(b, delta / 3);
      } else {
        credit(a, delta / 2);
        credit(b, delta / 2);
      }
    } else credit(a, delta);
  }
  return out;
}

export class WpaAccumulator {
  private rows = new Map<string, WpaRow>();
  private best: [string, string, string, number][] = [];

  add(gameId: string, feed: FeedItem[], homeId: string, teamOf: Record<string, string>) {
    if (!feed.some((p) => p.wp != null)) return;
    for (const [id, v] of gameWpa(feed, homeId, teamOf)) {
      const r = this.rows.get(id) ?? [id, teamOf[id], 0, 0, -Infinity, '', Infinity, ''];
      r[1] = teamOf[id];
      r[2]++;
      r[3] += v;
      if (v > r[4]) [r[4], r[5]] = [v, gameId];
      if (v < r[6]) [r[6], r[7]] = [v, gameId];
      this.rows.set(id, r);
      this.best.push([id, teamOf[id], gameId, v]);
    }
    // Keep the list short as it grows.
    if (this.best.length > 2000) this.best = this.top();
  }

  private top() {
    return [...this.best].sort((a, b) => b[3] - a[3]).slice(0, 40);
  }

  result(): WpaTotals {
    const r3 = (v: number) => Math.round(v * 1000) / 1000;
    return {
      players: [...this.rows.values()].map((r) => [r[0], r[1], r[2], r3(r[3]), r3(r[4]), r[5], r3(r[6]), r[7]]),
      games: this.top().map(([id, t, g, v]) => [id, t, g, r3(v)]),
    };
  }
}
