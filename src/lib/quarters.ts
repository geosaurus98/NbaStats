// Quarter-by-quarter team scoring and what happened to half-time and
// three-quarter leads, summed from each game's line score.

export interface TeamQuarters {
  games: number;
  /** Points for and against in Q1-Q4, then all overtimes together. */
  pf: number[];
  pa: number[];
  /** Quarters won, lost (Q1-Q4). */
  won: number[];
  lost: number[];
  /** Games in overtime. */
  ot: number;
  /** [wins, losses] when leading / trailing at half-time and after three quarters. */
  leadHalf: [number, number];
  trailHalf: [number, number];
  lead3: [number, number];
  trail3: [number, number];
}

const empty = (): TeamQuarters => ({ games: 0, pf: [0, 0, 0, 0, 0], pa: [0, 0, 0, 0, 0], won: [0, 0, 0, 0], lost: [0, 0, 0, 0], ot: 0, leadHalf: [0, 0], trailHalf: [0, 0], lead3: [0, 0], trail3: [0, 0] });

export class QuarterAccumulator {
  private teams = new Map<string, TeamQuarters>();

  /** `own` and `opp` are one game's line scores (Q1, Q2, Q3, Q4, OT…). */
  add(teamId: string, own: number[], opp: number[]) {
    if (own.length < 4 || opp.length < 4) return;
    const t = this.teams.get(teamId) ?? empty();
    t.games++;
    own.forEach((pts, i) => {
      const q = Math.min(i, 4);
      t.pf[q] += pts;
      t.pa[q] += opp[i] ?? 0;
      if (i < 4 && pts !== opp[i]) (pts > opp[i] ? t.won : t.lost)[i]++;
    });
    if (own.length > 4) t.ot++;
    const sum = (a: number[], n: number) => a.slice(0, n).reduce((x, y) => x + y, 0);
    const won = sum(own, own.length) > sum(opp, opp.length) ? 0 : 1;
    const half = sum(own, 2) - sum(opp, 2);
    const three = sum(own, 3) - sum(opp, 3);
    if (half > 0) t.leadHalf[won]++;
    if (half < 0) t.trailHalf[won]++;
    if (three > 0) t.lead3[won]++;
    if (three < 0) t.trail3[won]++;
    this.teams.set(teamId, t);
  }

  result(): Record<string, TeamQuarters> {
    return Object.fromEntries(this.teams);
  }
}
