// Scoring runs: stretches where one team scores and the other doesn't.

/** [teamId, games, runs of 10+ for, runs of 10+ against, biggest for, biggest against] */
export type TeamRunRow = [string, number, number, number, number, number];

export interface RunTotals {
  teams: TeamRunRow[];
  /** The season's biggest runs: [gameId, teamId, oppId, points, period it started]. */
  biggest: [string, string, string, number, number][];
}

export interface ScoreEvent {
  period: number;
  home: number;
  away: number;
}

/** Every unanswered run in a game: [home (true) or away, points, period it started]. */
export function gameRuns(feed: ScoreEvent[]): [boolean, number, number][] {
  const runs: [boolean, number, number][] = [];
  let home = 0;
  let away = 0;
  let cur: [boolean, number, number] | undefined;
  for (const p of feed) {
    const h = p.home - home;
    const a = p.away - away;
    home = p.home;
    away = p.away;
    if (h <= 0 && a <= 0) continue;
    const side = h > 0;
    const pts = side ? h : a;
    if (cur && cur[0] === side && !(h > 0 && a > 0)) cur[1] += pts;
    else {
      if (cur) runs.push(cur);
      cur = [side, pts, p.period];
    }
  }
  if (cur) runs.push(cur);
  return runs;
}

export class RunAccumulator {
  private teams = new Map<string, TeamRunRow>();
  private biggest: [string, string, string, number, number][] = [];

  add(gameId: string, homeId: string, awayId: string, feed: ScoreEvent[]) {
    const runs = gameRuns(feed);
    if (!runs.length) return;
    for (const [id, isHome] of [
      [homeId, true],
      [awayId, false],
    ] as const) {
      const r = this.teams.get(id) ?? [id, 0, 0, 0, 0, 0];
      r[1]++;
      for (const [side, pts] of runs) {
        const mine = side === isHome;
        if (pts >= 10) r[mine ? 2 : 3]++;
        if (mine) r[4] = Math.max(r[4], pts);
        else r[5] = Math.max(r[5], pts);
      }
      this.teams.set(id, r);
    }
    for (const [side, pts, period] of runs) if (pts >= 12) this.biggest.push([gameId, side ? homeId : awayId, side ? awayId : homeId, pts, period]);
  }

  result(): RunTotals {
    return { teams: [...this.teams.values()], biggest: this.biggest.sort((a, b) => b[3] - a[3]).slice(0, 30) };
  }
}
