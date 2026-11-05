// Clutch shot log: every field-goal attempt in the last minute of the fourth
// quarter or overtime that would tie the game or put the shooter's team ahead.
import type { FeedItem } from '../api/types';

/** Seconds of game clock the log covers at the end of a period. */
export const LAST = 60;

/** [gameId, period, secondsLeft, shooterId, teamId, made (0/1), shot value (2/3), deficit before the shot (0 = tied), team won the game (0/1)] */
export type ClutchShot = [string, number, number, string, string, number, number, number, number];

export const S = { game: 0, period: 1, left: 2, player: 3, team: 4, made: 5, value: 6, deficit: 7, won: 8 } as const;

export const secondsLeft = (clock: string) => {
  const [m, s] = clock.includes(':') ? clock.split(':') : ['0', clock];
  return Number(m) * 60 + parseFloat(s || '0');
};

export function gameClutchShots(gameId: string, feed: FeedItem[], homeId: string, teamOf: Record<string, string>, homeWon: boolean): ClutchShot[] {
  const out: ClutchShot[] = [];
  let home = 0;
  let away = 0;
  for (const p of feed) {
    const shooter = p.ids[0];
    const team = shooter ? teamOf[shooter] : undefined;
    const left = secondsLeft(p.clock);
    if (team && p.period >= 4 && left <= LAST && /\b(makes|misses)\b/i.test(p.text) && !/free throw/i.test(p.text)) {
      const isHome = team === homeId;
      const deficit = isHome ? away - home : home - away;
      const value = /three point|3-pt|3pt/i.test(p.text) ? 3 : 2;
      if (deficit >= 0 && value >= deficit) {
        const made = (isHome ? p.home > home : p.away > away) && /\bmakes\b/i.test(p.text);
        out.push([gameId, p.period, Math.round(left * 10) / 10, shooter, team, made ? 1 : 0, value, deficit, isHome === homeWon ? 1 : 0]);
      }
    }
    home = p.home;
    away = p.away;
  }
  return out;
}

export interface ShooterRow {
  playerId: string;
  teamId: string;
  made: number;
  attempts: number;
  /** Made shots to tie, and to take the lead. */
  ties: number;
  leads: number;
  /** Games won after a made clutch shot. */
  wonAfter: number;
}

export function shooterTable(shots: ClutchShot[]): ShooterRow[] {
  const by = new Map<string, ShooterRow>();
  for (const s of shots) {
    const r = by.get(s[S.player]) ?? { playerId: s[S.player], teamId: s[S.team], made: 0, attempts: 0, ties: 0, leads: 0, wonAfter: 0 };
    r.attempts++;
    r.teamId = s[S.team];
    if (s[S.made]) {
      r.made++;
      if (s[S.value] === s[S.deficit]) r.ties++;
      else r.leads++;
      if (s[S.won]) r.wonAfter++;
    }
    by.set(s[S.player], r);
  }
  return [...by.values()].sort((a, b) => b.made - a.made || a.attempts - b.attempts);
}
