// Garbage-time totals: what each player and team did once a game was decided
// (see isGarbageTime), so the site can show numbers with those minutes taken out.
import type { FeedItem } from '../api/types';
import type { GameLineups } from './lineups';

/** [id, teamId, seconds, pts, fgm, fga, tpm, tpa, ftm, fta, reb, ast, tov] */
export type GarbagePlayerRow = [string, string, ...number[]];
/** [teamId, games with garbage time, seconds, pointsFor, pointsAgainst] */
export type GarbageTeamRow = [string, number, number, number, number];

export interface GarbageTotals {
  players: GarbagePlayerRow[];
  teams: GarbageTeamRow[];
}

export const G = { sec: 2, pts: 3, fgm: 4, fga: 5, tpm: 6, tpa: 7, ftm: 8, fta: 9, reb: 10, ast: 11, tov: 12 } as const;

export class GarbageAccumulator {
  private players = new Map<string, GarbagePlayerRow>();
  private teams = new Map<string, GarbageTeamRow>();

  private row(id: string, team: string) {
    let r = this.players.get(id);
    if (!r) this.players.set(id, (r = [id, team, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
    r[1] = team;
    return r as [string, string, ...number[]];
  }

  add(feed: FeedItem[], teamOf: Record<string, string>, r: GameLineups) {
    for (const [id, t] of Object.entries(r.garbageOn)) if (teamOf[id] && t.sec > 0) (this.row(id, teamOf[id])[G.sec] as number) += t.sec;
    for (const [team, t] of Object.entries(r.garbageTeam)) {
      if (t.sec <= 0) continue;
      const row = this.teams.get(team) ?? [team, 0, 0, 0, 0];
      row[1]++;
      row[2] += t.sec;
      row[3] += t.pf;
      row[4] += t.pa;
      this.teams.set(team, row);
    }
    let home = 0;
    let away = 0;
    // A play belongs to the stretch that ends at its time.
    const inGarbage = (t: number) => r.garbageWindows.some(([a, b]) => t > a && t <= b);
    for (const p of feed) {
      const scored = p.home - home + (p.away - away);
      home = p.home;
      away = p.away;
      if (!inGarbage(p.t)) continue;
      const [first, second] = p.ids;
      const team = first && teamOf[first];
      if (!team) continue;
      const row = this.row(first, team);
      const inc = (k: keyof typeof G, by = 1) => ((row[G[k]] as number) += by);
      if (/\b(makes|misses)\b/i.test(p.text)) {
        const made = p.scoring && scored > 0;
        if (/free throw/i.test(p.text)) {
          inc('fta');
          if (made) inc('ftm');
        } else {
          inc('fga');
          if (made) inc('fgm');
          if (/three point|3-pt|3pt/i.test(p.text)) {
            inc('tpa');
            if (made) inc('tpm');
          }
        }
        if (made) inc('pts', scored);
        if (made && second && teamOf[second] === team && /assist/i.test(p.text)) (this.row(second, team)[G.ast] as number)++;
      } else if (/rebound/i.test(p.text) && !/team rebound/i.test(p.text)) inc('reb');
      else if (/turnover|bad pass|lost ball|traveling|offensive foul/i.test(p.text)) inc('tov');
    }
  }

  result(): GarbageTotals {
    return { players: [...this.players.values()].map((r) => r.map((v, i) => (i === G.sec ? Math.round(v as number) : v)) as GarbagePlayerRow).filter((r) => (r[G.sec] as number) > 0), teams: [...this.teams.values()].map((r) => [r[0], r[1], Math.round(r[2]), r[3], r[4]]) };
  }
}
