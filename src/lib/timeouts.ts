// Timeouts: does calling one stop the other team's run? For each team timeout
// called while the opponent is on a run, the score over the next two minutes of
// game time, against the same situation when no timeout was called.

/** A run this long (unanswered points) counts as "on a run". */
export const RUN = 8;
/** Seconds of game time looked at after the timeout (or the moment the run reached RUN). */
export const WINDOW = 120;

export interface TimeoutPlay {
  t: number;
  text: string;
  teamId: string;
  home: number;
  away: number;
}

export interface TimeoutTotals {
  /**
   * teamId -> [games, timeouts called, timeouts during an opponent run, net points over the next WINDOW after
   * those, runs stopped after those (scored next), opponent runs with no timeout, net after those, stopped after those]
   */
  teams: Record<string, [number, number, number, number, number, number, number, number]>;
}

/** A team's own timeout (not an official or TV timeout). */
export const isTeamTimeout = (p: { text: string; teamId: string }) => !!p.teamId && /time ?out/i.test(p.text) && !/official|tv |media|technical|turnover/i.test(p.text);

interface Moment {
  team: string;
  i: number;
  timeout: boolean;
}

/** Each moment a team faced an opponent run of RUN or more: when it called a timeout, or (without one) when the run reached RUN. */
export function runMoments(feed: TimeoutPlay[], homeId: string, awayId: string): { moments: Moment[]; timeouts: Record<string, number> } {
  const timeouts: Record<string, number> = { [homeId]: 0, [awayId]: 0 };
  const moments: Moment[] = [];
  // Unanswered points scored against each team, and whether a moment has been taken for this run.
  const against: Record<string, number> = { [homeId]: 0, [awayId]: 0 };
  const taken: Record<string, boolean> = { [homeId]: false, [awayId]: false };
  const pending: Record<string, number | undefined> = {};
  let home = 0;
  let away = 0;
  feed.forEach((p, i) => {
    const h = p.home - home;
    const a = p.away - away;
    if (h > 0 || a > 0) {
      home = p.home;
      away = p.away;
      for (const [team, scored, conceded] of [[homeId, h, a], [awayId, a, h]] as const) {
        if (scored > 0) {
          against[team] = 0;
          taken[team] = false;
          pending[team] = undefined;
        } else if (conceded > 0) against[team] += conceded;
      }
    }
    for (const team of [homeId, awayId]) {
      if (isTeamTimeout(p) && p.teamId === team) {
        timeouts[team]++;
        if (against[team] >= RUN && !taken[team]) {
          moments.push({ team, i, timeout: true });
          taken[team] = true;
          pending[team] = undefined;
        }
      }
      // The run has just reached RUN: wait 30 seconds of game time for a timeout before counting it as "no timeout".
      if (against[team] >= RUN && !taken[team] && pending[team] === undefined) pending[team] = i;
      const start = pending[team];
      if (start !== undefined && !taken[team] && p.t - feed[start].t > 30) {
        moments.push({ team, i: start, timeout: false });
        taken[team] = true;
        pending[team] = undefined;
      }
    }
  });
  return { moments, timeouts };
}

/** What happened over the next WINDOW seconds after a moment: net points for the team, and whether it scored next. */
export function after(feed: TimeoutPlay[], m: Moment, homeId: string): { net: number; stopped: boolean } {
  const start = feed[m.i];
  const home = m.team === homeId;
  let end = start;
  let stopped: boolean | undefined;
  for (let j = m.i + 1; j < feed.length && feed[j].t - start.t <= WINDOW; j++) {
    const p = feed[j];
    if (stopped === undefined && (p.home !== end.home || p.away !== end.away)) stopped = home ? p.home > end.home : p.away > end.away;
    end = p;
  }
  const net = home ? end.home - start.home - (end.away - start.away) : end.away - start.away - (end.home - start.home);
  return { net, stopped: !!stopped };
}

export class TimeoutAccumulator {
  private teams: TimeoutTotals['teams'] = {};

  add(feed: TimeoutPlay[], homeId: string, awayId: string) {
    if (!feed.length) return;
    const { moments, timeouts } = runMoments(feed, homeId, awayId);
    for (const team of [homeId, awayId]) {
      const r = (this.teams[team] ??= [0, 0, 0, 0, 0, 0, 0, 0]);
      r[0]++;
      r[1] += timeouts[team];
    }
    for (const m of moments) {
      const r = this.teams[m.team];
      const { net, stopped } = after(feed, m, homeId);
      const k = m.timeout ? 2 : 5;
      r[k]++;
      r[k + 1] += net;
      if (stopped) r[k + 2]++;
    }
  }

  result(): TimeoutTotals {
    return { teams: this.teams };
  }
}
