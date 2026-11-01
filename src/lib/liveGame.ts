// Live game centre helpers: who is on the floor, the current scoring run,
// team fouls and foul trouble, all worked out from the play-by-play.
import type { FeedItem, TeamBox } from '../api/types';

/** The five players each team has on the floor after the latest play. */
export function onCourt(teams: TeamBox[], feed: FeedItem[]): Map<string, string[]> {
  const teamOf = new Map<string, string>();
  const court = new Map<string, string[]>();
  const seen = new Map<string, number>();
  for (const t of teams) {
    for (const p of t.players) if (p.id) teamOf.set(p.id, t.team.id);
    court.set(t.team.id, t.players.filter((p) => p.starter && p.id).map((p) => p.id));
  }
  const add = (id: string, i: number) => {
    const team = teamOf.get(id);
    const five = team ? court.get(team) : undefined;
    if (!five) return;
    seen.set(id, i);
    if (five.includes(id)) return;
    five.push(id);
    // A player we did not see come on (ESPN skips some changes between quarters):
    // the one who has gone longest without being involved is the one who left.
    if (five.length > 5) {
      five.sort((a, b) => (seen.get(b) ?? -1) - (seen.get(a) ?? -1));
      five.length = 5;
    }
  };
  feed.forEach((f, i) => {
    if (f.sub && f.ids.length >= 2) {
      const [on, off] = f.ids;
      const team = teamOf.get(on) ?? teamOf.get(off);
      const five = team ? court.get(team) : undefined;
      if (five) {
        const at = five.indexOf(off);
        if (at >= 0) five.splice(at, 1);
      }
      add(on, i);
    } else {
      for (const id of f.ids) add(id, i);
    }
  });
  return court;
}

export interface Run {
  teamId: string;
  for: number;
  against: number;
  /** Game seconds the run has lasted. */
  seconds: number;
}

/** The biggest run still going: the stretch ending now in which one team most outscored the other. */
export function currentRun(feed: FeedItem[], homeId: string, awayId: string, min = 6): Run | undefined {
  const scores: { t: number; home: number; away: number }[] = [];
  let h = 0;
  let a = 0;
  for (const f of feed) {
    if (f.home === h && f.away === a) continue;
    scores.push({ t: f.t, home: f.home - h, away: f.away - a });
    h = f.home;
    a = f.away;
  }
  if (!scores.length) return undefined;
  const now = feed[feed.length - 1].t;
  let best: Run | undefined;
  let home = 0;
  let away = 0;
  for (let i = scores.length - 1; i >= 0; i--) {
    home += scores[i].home;
    away += scores[i].away;
    // A run starts with a basket by the team on it.
    const lead = home - away;
    const starter = lead > 0 ? scores[i].home > 0 : scores[i].away > 0;
    if (!starter || Math.abs(lead) < min) continue;
    if (!best || Math.abs(lead) > best.for - best.against) {
      best = lead > 0 ? { teamId: homeId, for: home, against: away, seconds: now - scores[i].t } : { teamId: awayId, for: away, against: home, seconds: now - scores[i].t };
    }
  }
  return best;
}

/** Team fouls in the current period (offensive and technical fouls don't count towards the bonus). */
export function teamFouls(feed: FeedItem[], period: number): Map<string, number> {
  const out = new Map<string, number>();
  for (const f of feed) {
    if (f.period !== period || !f.teamId || !/foul/i.test(f.text) || /offensive|technical|charge|delay/i.test(f.text)) continue;
    out.set(f.teamId, (out.get(f.teamId) ?? 0) + 1);
  }
  return out;
}

/** Personal fouls that usually earn a seat on the bench by this point in the game. */
export const foulTrouble = (fouls: number, period: number) => fouls >= Math.min(6, Math.max(2, period + 1));

/** "4:32" for a number of seconds. */
export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
