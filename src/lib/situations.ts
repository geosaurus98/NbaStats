// Shots by game situation, from the play-by-play: how long into the
// possession (ESPN has no shot clock, so this is time since the ball changed
// hands: a defensive rebound, a turnover, an opponent's basket or the start
// of a period), second chances after an offensive rebound, shots out of a
// timeout, and the score at the time.
import type { FeedItem } from '../api/types';

export const SITUATIONS = [
  { id: 'trans', label: 'Transition (0-7s)', group: 'clock' },
  { id: 'early', label: 'Early (7-14s)', group: 'clock' },
  { id: 'mid', label: 'Middle (14-20s)', group: 'clock' },
  { id: 'late', label: 'Late (20s+)', group: 'clock' },
  { id: 'second', label: 'Second chance', group: 'clock' },
  { id: 'ato', label: 'After a timeout', group: 'ato' },
  { id: 'ahead', label: 'Ahead by 4+', group: 'score' },
  { id: 'close', label: 'Within 3', group: 'score' },
  { id: 'behind', label: 'Behind by 4+', group: 'score' },
] as const;
export type SituationId = (typeof SITUATIONS)[number]['id'];
const INDEX = new Map(SITUATIONS.map((s, i) => [s.id, i]));

/** Per situation (SITUATIONS order): [attempts, makes, three attempts, three makes]. */
export type SituationCounts = number[];
export interface Situations {
  league: SituationCounts;
  teams: Record<string, SituationCounts>;
  players: Record<string, SituationCounts>;
}

const empty = () => Array(SITUATIONS.length * 4).fill(0);

/** Each field-goal attempt in a game with the situations it falls in. */
export function gameSituations(feed: FeedItem[], homeId: string, teamOf: Record<string, string>): { shooter: string; team: string; made: boolean; three: boolean; tags: SituationId[] }[] {
  const out: ReturnType<typeof gameSituations> = [];
  let start = 0;
  let owner = '';
  let second = false;
  let timeout = false;
  let period = 0;
  let home = 0;
  let away = 0;
  const other = (t: string) => Object.values(teamOf).find((x) => x !== t) ?? '';
  const change = (to: string, t: number) => {
    owner = to;
    start = t;
    second = false;
    timeout = false;
  };
  for (const p of feed) {
    if (p.period !== period) {
      period = p.period;
      change('', p.t);
    }
    const text = p.text.toLowerCase();
    const who = p.ids[0];
    const team = who ? teamOf[who] : undefined;
    const isFt = /free throw/.test(text);
    if (/timeout/.test(text)) timeout = true;
    if (team && !isFt && /\b(makes|misses)\b/.test(text)) {
      if (owner !== team) change(team, owner ? p.t : start);
      const margin = (team === homeId ? 1 : -1) * (home - away);
      const elapsed = p.t - start;
      const tags: SituationId[] = [second ? 'second' : elapsed <= 7 ? 'trans' : elapsed <= 14 ? 'early' : elapsed <= 20 ? 'mid' : 'late'];
      if (timeout) tags.push('ato');
      tags.push(margin >= 4 ? 'ahead' : margin <= -4 ? 'behind' : 'close');
      const made = /\bmakes\b/.test(text);
      out.push({ shooter: who!, team, made, three: /three point|3-pt|3pt/.test(text), tags });
      if (made) change(other(team), p.t);
    } else if (team && /offensive rebound/.test(text)) {
      owner = team;
      second = true;
      start = p.t;
    } else if (team && /defensive rebound/.test(text)) change(team, p.t);
    else if (team && /turnover|bad pass|lost ball|traveling|offensive foul/.test(text)) change(other(team), p.t);
    else if (team && isFt && /\bmakes\b/.test(text) && /(\d) of \1/.test(text)) change(other(team), p.t);
    home = p.home;
    away = p.away;
  }
  return out;
}

export class SituationAccumulator {
  private league = empty();
  private teams = new Map<string, SituationCounts>();
  private players = new Map<string, SituationCounts>();

  add(feed: FeedItem[], homeId: string, teamOf: Record<string, string>) {
    for (const s of gameSituations(feed, homeId, teamOf)) {
      const t = this.teams.get(s.team) ?? empty();
      const pl = this.players.get(s.shooter) ?? empty();
      for (const tag of s.tags) {
        const i = INDEX.get(tag)! * 4;
        for (const c of [this.league, t, pl]) {
          c[i]++;
          if (s.made) c[i + 1]++;
          if (s.three) {
            c[i + 2]++;
            if (s.made) c[i + 3]++;
          }
        }
      }
      this.teams.set(s.team, t);
      this.players.set(s.shooter, pl);
    }
  }

  /** Players with at least `minShots` field-goal attempts. */
  result(minShots = 150): Situations {
    const shots = (c: SituationCounts) => SITUATIONS.reduce((n, s, i) => n + (s.group === 'clock' ? c[i * 4] : 0), 0);
    return { league: this.league, teams: Object.fromEntries(this.teams), players: Object.fromEntries([...this.players].filter(([, c]) => shots(c) >= minShots)) };
  }
}

/** eFG% for one situation's counts. */
export function situationEfg(c: SituationCounts, id: SituationId): { att: number; efg: number; threeShare: number } {
  const i = INDEX.get(id)! * 4;
  const att = c[i];
  return { att, efg: att ? (c[i + 1] + 0.5 * c[i + 3]) / att : 0, threeShare: att ? c[i + 2] / att : 0 };
}
