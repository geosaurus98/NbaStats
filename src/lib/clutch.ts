// Clutch time, as the NBA defines it: the last five minutes of the fourth
// quarter or overtime with the score within five points. Summed per player
// (scoring and shooting) and per team (record and margin in clutch games).
import type { FeedItem } from '../api/types';

/** [id, teamId, games, pts, fgm, fga, tpm, tpa, ftm, fta] */
export type ClutchPlayerRow = [string, string, number, number, number, number, number, number, number, number];
/** [teamId, games, wins, losses, pointsFor, pointsAgainst] */
export type ClutchTeamRow = [string, number, number, number, number, number];

export interface ClutchTotals {
  players: ClutchPlayerRow[];
  teams: ClutchTeamRow[];
}

export const C = { games: 2, pts: 3, fgm: 4, fga: 5, tpm: 6, tpa: 7, ftm: 8, fta: 9 } as const;

const remaining = (clock: string) => {
  const [m, s] = clock.includes(':') ? clock.split(':') : ['0', clock];
  return Number(m) * 60 + parseFloat(s || '0');
};

export interface ClutchGame {
  feed: FeedItem[];
  homeId: string;
  awayId: string;
  /** athleteId → teamId */
  teamOf: Record<string, string>;
  homeScore: number;
  awayScore: number;
}

export class ClutchAccumulator {
  private players = new Map<string, ClutchPlayerRow>();
  private teams = new Map<string, ClutchTeamRow>();

  add(g: ClutchGame) {
    let home = 0;
    let away = 0;
    let clutch = false;
    let forHome = 0;
    let forAway = 0;
    const seen = new Set<string>();
    for (const p of g.feed) {
      const inWindow = p.period >= 4 && remaining(p.clock) <= 300 && Math.abs(home - away) <= 5;
      if (inWindow) clutch = true;
      const scored = p.home - home + (p.away - away);
      if (inWindow) {
        if (p.home > home) forHome += p.home - home;
        if (p.away > away) forAway += p.away - away;
        const shooter = p.ids[0];
        const shot = /\b(makes|misses)\b/i.test(p.text);
        if (shooter && shot && g.teamOf[shooter]) {
          const row = this.players.get(shooter) ?? [shooter, g.teamOf[shooter], 0, 0, 0, 0, 0, 0, 0, 0];
          if (!seen.has(shooter)) {
            row[C.games]++;
            seen.add(shooter);
          }
          const made = p.scoring && scored > 0;
          if (/free throw/i.test(p.text)) {
            row[C.fta]++;
            if (made) row[C.ftm]++;
          } else {
            row[C.fga]++;
            if (made) row[C.fgm]++;
            if (/three point|3-pt|3pt/i.test(p.text)) {
              row[C.tpa]++;
              if (made) row[C.tpm]++;
            }
          }
          if (made) row[C.pts] += scored;
          row[1] = g.teamOf[shooter];
          this.players.set(shooter, row);
        }
      }
      home = p.home;
      away = p.away;
    }
    if (!clutch) return;
    for (const [id, pf, pa, won] of [
      [g.homeId, forHome, forAway, g.homeScore > g.awayScore],
      [g.awayId, forAway, forHome, g.awayScore > g.homeScore],
    ] as const) {
      const row = this.teams.get(id) ?? [id, 0, 0, 0, 0, 0];
      row[1]++;
      row[won ? 2 : 3]++;
      row[4] += pf;
      row[5] += pa;
      this.teams.set(id, row);
    }
  }

  result(): ClutchTotals {
    return { players: [...this.players.values()].filter((r) => r[C.pts] > 0 || r[C.fga] > 2), teams: [...this.teams.values()] };
  }
}
