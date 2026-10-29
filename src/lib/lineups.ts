// Five-man lineups and on/off splits from play-by-play. ESPN records
// in-quarter substitutions ("X enters the game for Y") but not changes made
// between quarters, so each period's starters are inferred: players who show
// up in a play before being subbed in, topped up from who was on court at the
// end of the previous period.
import type { FeedItem, Shot } from '../api/types';
import { ZONES, zoneOf } from './pbpStats';

export interface GameInput {
  /** teamId → the five starters (from the box score). */
  starters: Record<string, string[]>;
  /** athleteId → teamId for everyone in the box score. */
  teamOf: Record<string, string>;
  homeId: string;
  awayId: string;
  feed: FeedItem[];
  /** Located field-goal attempts, for opponents' shooting by zone with each player on court. */
  shots?: Shot[];
}

/** Rotation slots: sixteen 3-minute stretches of regulation, then all overtime. */
export const SEGMENTS = 17;
/** Zones in ZONES order, as [attempts, makes] pairs. */
export const ZONE_COUNT = ZONES.length;

export interface Tally {
  sec: number;
  pf: number;
  pa: number;
}

export interface GameLineups {
  /** teamId → lineup key (sorted ids joined by ",") → tally. */
  lineups: Record<string, Record<string, Tally>>;
  /** athleteId → time and points while on court. */
  on: Record<string, Tally>;
  /** teamId → whole-game team totals. */
  team: Record<string, Tally>;
  /** The same on-court and team tallies, garbage time only (see isGarbageTime). */
  garbageOn: Record<string, Tally>;
  garbageTeam: Record<string, Tally>;
  /** Garbage-time stretches as [from, to] seconds since tip-off. */
  garbageWindows: [number, number][];
  /** athleteId → seconds on court in each rotation slot (SEGMENTS). */
  segments: Record<string, number[]>;
  /** teamId → lineup key → tally, clutch time only (last 5 minutes of the 4th or OT, within 5 points). */
  clutch: Record<string, Record<string, Tally>>;
  /** athleteId → opponents' [attempts, makes] by zone while on court. */
  defZones: Record<string, number[]>;
  /** teamId → opponents' [attempts, makes] by zone, whole game. */
  oppZones: Record<string, number[]>;
}

/**
 * Garbage time, Cleaning the Glass's rule: the fourth quarter with the lead
 * at 25+ (12 to 9 minutes left), 20+ (9 to 6) or 10+ (6 or fewer), and two
 * or fewer of the game's starters on the floor between both teams.
 */
export function isGarbageTime(period: number, t: number, margin: number, startersOn = 0): boolean {
  if (period !== 4 || startersOn > 2) return false;
  const left = 2880 - t;
  const m = Math.abs(margin);
  return left > 540 ? m >= 25 : left > 360 ? m >= 20 : m >= 10;
}

const add = (t: Tally, sec: number, pf: number, pa: number) => {
  t.sec += sec;
  t.pf += pf;
  t.pa += pa;
};
const tally = (): Tally => ({ sec: 0, pf: 0, pa: 0 });

/** Who is on court for `teamId` when `period` starts. */
function periodStarters(feed: FeedItem[], period: number, teamId: string, teamOf: Record<string, string>, previous: Set<string>): Set<string> {
  const first = new Map<string, 'in' | 'other'>();
  for (const f of feed) {
    if (f.period !== period) continue;
    f.ids.forEach((id, i) => {
      if (teamOf[id] !== teamId || first.has(id)) return;
      first.set(id, f.sub && i === 0 ? 'in' : 'other');
    });
  }
  const out = new Set([...first].filter(([, how]) => how === 'other').map(([id]) => id));
  for (const id of previous) {
    if (out.size >= 5) break;
    if (first.get(id) !== 'in') out.add(id);
  }
  return new Set([...out].slice(0, 5));
}

export function gameLineups(g: GameInput): GameLineups {
  const res: GameLineups = { lineups: {}, on: {}, team: {}, garbageOn: {}, garbageTeam: {}, garbageWindows: [], segments: {}, clutch: {}, defZones: {}, oppZones: {} };
  // Shots by period, clock and shooter, to line them up with their feed plays.
  const shotAt = new Map<string, Shot[]>();
  for (const s of g.shots ?? []) {
    const k = `${s.period}|${s.clock}|${s.athleteId}`;
    shotAt.set(k, [...(shotAt.get(k) ?? []), s]);
  }
  const starters = new Set(Object.values(g.starters).flat());
  const teams = [g.homeId, g.awayId];
  for (const t of teams) {
    res.lineups[t] = {};
    res.clutch[t] = {};
    res.team[t] = tally();
    res.oppZones[t] = Array(ZONE_COUNT * 2).fill(0);
  }
  const addSegments = (id: string, from: number, to: number) => {
    const seg = (res.segments[id] ??= Array(SEGMENTS).fill(0));
    let t = from;
    while (t < to) {
      const i = t >= 2880 ? SEGMENTS - 1 : Math.floor(t / 180);
      const end = i === SEGMENTS - 1 ? to : Math.min(to, (i + 1) * 180);
      seg[i] += end - t;
      t = end;
    }
  };
  const court: Record<string, Set<string>> = Object.fromEntries(teams.map((t) => [t, new Set(g.starters[t] ?? [])]));
  let lastT = 0;
  let lastHome = 0;
  let lastAway = 0;
  let period = 1;

  const credit = (sec: number, home: number, away: number) => {
    if (sec <= 0 && home === 0 && away === 0) return;
    // The state at the start of the stretch decides whether it counts as garbage time.
    const startersOn = teams.reduce((n, t) => n + [...court[t]].filter((id) => starters.has(id)).length, 0);
    const garbage = isGarbageTime(period, lastT, lastHome - lastAway, startersOn);
    if (garbage && sec > 0) {
      const w = res.garbageWindows[res.garbageWindows.length - 1];
      if (w && w[1] === lastT) w[1] = lastT + sec;
      else res.garbageWindows.push([lastT, lastT + sec]);
    }
    const clutch = period >= 4 && periodEnd(period) - lastT <= 300 && Math.abs(lastHome - lastAway) <= 5;
    for (const t of teams) {
      const pf = t === g.homeId ? home : away;
      const pa = t === g.homeId ? away : home;
      add(res.team[t], sec, pf, pa);
      const five = court[t];
      for (const id of five) {
        add((res.on[id] ??= tally()), sec, pf, pa);
        if (sec > 0) addSegments(id, lastT, lastT + sec);
      }
      if (five.size === 5) add((res.lineups[t][[...five].sort().join(',')] ??= tally()), sec, pf, pa);
      if (clutch && five.size === 5) add((res.clutch[t][[...five].sort().join(',')] ??= tally()), sec, pf, pa);
      if (garbage) {
        add((res.garbageTeam[t] ??= tally()), sec, pf, pa);
        for (const id of five) add((res.garbageOn[id] ??= tally()), sec, pf, pa);
      }
    }
  };

  for (const f of g.feed) {
    if (f.period !== period) {
      // Close out the previous period, then infer who starts this one.
      credit(Math.max(0, periodEnd(period) - lastT), 0, 0);
      lastT = periodEnd(period);
      period = f.period;
      for (const t of teams) court[t] = periodStarters(g.feed, period, t, g.teamOf, court[t]);
    }
    credit(Math.max(0, f.t - lastT), f.home - lastHome, f.away - lastAway);
    lastT = Math.max(lastT, f.t);
    lastHome = f.home;
    lastAway = f.away;
    // A located shot: credit the defenders on court with the attempt in its zone.
    const shooter = f.ids[0];
    const shot = shooter ? shotAt.get(`${f.period}|${f.clock}|${shooter}`)?.shift() : undefined;
    if (shot && g.teamOf[shooter]) {
      const def = teams.find((t) => t !== g.teamOf[shooter]);
      if (def) {
        const z = ZONES.findIndex((x) => x.id === zoneOf(shot, shot.value)) * 2;
        res.oppZones[def][z]++;
        if (shot.made) res.oppZones[def][z + 1]++;
        for (const id of court[def]) {
          const d = (res.defZones[id] ??= Array(ZONE_COUNT * 2).fill(0));
          d[z]++;
          if (shot.made) d[z + 1]++;
        }
      }
    }
    if (f.sub && f.ids.length >= 2) {
      const [inId, outId] = f.ids;
      const t = g.teamOf[inId] ?? g.teamOf[outId];
      if (t && court[t]) {
        court[t].delete(outId);
        court[t].add(inId);
      }
    }
  }
  credit(Math.max(0, periodEnd(period) - lastT), 0, 0);
  return res;
}

function periodEnd(period: number): number {
  return period <= 4 ? period * 720 : 2880 + (period - 4) * 300;
}

/** Season totals across games, for one team. */
export interface TeamLineupSeason {
  /** [ids, seconds, points for, points against], most-used first (lineups with 2+ minutes). */
  lineups: [string[], number, number, number][];
  /** [id, onSec, onPF, onPA, gameSec, gamePF, gamePA] over games the player played. */
  onOff: [string, number, number, number, number, number, number][];
  /** Two- and three-man combinations, same shape as lineups (most-used first; the 120 most-used pairs, trios with 60+ minutes). */
  pairs?: [string[], number, number, number][];
  trios?: [string[], number, number, number][];
  /** [id, games, average seconds in each rotation slot (SEGMENTS)…], most minutes first. */
  rotation?: [string, number, ...number[]][];
  /** Clutch-time five-man lineups with 2+ minutes, same shape as lineups. */
  clutchLineups?: [string[], number, number, number][];
  /** [id, opponents' attempts and makes by zone while on court…], players with 100+ minutes. */
  defense?: [string, ...number[]][];
  /** Opponents' attempts and makes by zone, all games. */
  oppZones?: number[];
}

/** Every k-player subset of a sorted five-man lineup. */
function subsets(ids: string[], k: number): string[][] {
  if (k === 0) return [[]];
  if (ids.length < k) return [];
  const [first, ...rest] = ids;
  return [...subsets(rest, k - 1).map((s) => [first, ...s]), ...subsets(rest, k)];
}

/** Sums lineup tallies into every pair or trio they contain. */
export function combos(lineups: Map<string, Tally>, k: number, minSec: number, top: number): [string[], number, number, number][] {
  const m = new Map<string, Tally>();
  for (const [key, t] of lineups) {
    for (const sub of subsets(key.split(',').sort(), k)) {
      const ck = sub.join(',');
      add(m.get(ck) ?? (m.set(ck, tally()), m.get(ck)!), t.sec, t.pf, t.pa);
    }
  }
  return [...m]
    .filter(([, t]) => t.sec >= minSec)
    .sort((a, b) => b[1].sec - a[1].sec)
    .slice(0, top)
    .map(([key, t]) => [key.split(','), Math.round(t.sec), t.pf, t.pa]);
}

export class LineupAccumulator {
  private lineups = new Map<string, Map<string, Tally>>();
  private on = new Map<string, Map<string, { on: Tally; game: Tally }>>();
  private seg = new Map<string, Map<string, { games: number; sec: number[] }>>();
  private clutch = new Map<string, Map<string, Tally>>();
  private def = new Map<string, Map<string, number[]>>();
  private opp = new Map<string, number[]>();

  add(g: GameInput, r: GameLineups) {
    for (const [team, lus] of Object.entries(r.lineups)) {
      const m = this.lineups.get(team) ?? new Map<string, Tally>();
      for (const [k, t] of Object.entries(lus)) add(m.get(k) ?? (m.set(k, tally()), m.get(k)!), t.sec, t.pf, t.pa);
      this.lineups.set(team, m);
    }
    for (const [id, t] of Object.entries(r.on)) {
      const team = g.teamOf[id];
      if (!team || t.sec <= 0) continue;
      const m = this.on.get(team) ?? new Map();
      const row = m.get(id) ?? { on: tally(), game: tally() };
      add(row.on, t.sec, t.pf, t.pa);
      const tt = r.team[team];
      add(row.game, tt.sec, tt.pf, tt.pa);
      m.set(id, row);
      this.on.set(team, m);
    }
    for (const [id, sec] of Object.entries(r.segments)) {
      const team = g.teamOf[id];
      if (!team) continue;
      const m = this.seg.get(team) ?? new Map();
      const row = m.get(id) ?? { games: 0, sec: Array(SEGMENTS).fill(0) };
      row.games++;
      sec.forEach((v, i) => (row.sec[i] += v));
      m.set(id, row);
      this.seg.set(team, m);
    }
    for (const [team, lus] of Object.entries(r.clutch)) {
      const m = this.clutch.get(team) ?? new Map<string, Tally>();
      for (const [k, t] of Object.entries(lus)) add(m.get(k) ?? (m.set(k, tally()), m.get(k)!), t.sec, t.pf, t.pa);
      this.clutch.set(team, m);
    }
    for (const [id, z] of Object.entries(r.defZones)) {
      const team = g.teamOf[id];
      if (!team) continue;
      const m = this.def.get(team) ?? new Map<string, number[]>();
      const row = m.get(id) ?? Array(ZONE_COUNT * 2).fill(0);
      z.forEach((v, i) => (row[i] += v));
      m.set(id, row);
      this.def.set(team, m);
    }
    for (const [team, z] of Object.entries(r.oppZones)) {
      const row = this.opp.get(team) ?? Array(ZONE_COUNT * 2).fill(0);
      z.forEach((v, i) => (row[i] += v));
      this.opp.set(team, row);
    }
  }

  /** Lineups with 2+ minutes (most-used first, up to `topLineups`), so any combination can be summed from them. */
  result(topLineups = 250): Record<string, TeamLineupSeason> {
    const out: Record<string, TeamLineupSeason> = {};
    for (const team of new Set([...this.lineups.keys(), ...this.on.keys()])) {
      const lus = [...(this.lineups.get(team) ?? new Map<string, Tally>())]
        .sort((a, b) => b[1].sec - a[1].sec)
        .filter(([, t], i) => i < 20 || t.sec >= 120)
        .slice(0, topLineups)
        .map(([k, t]) => [k.split(','), Math.round(t.sec), t.pf, t.pa] as [string[], number, number, number]);
      const onOff = [...(this.on.get(team) ?? new Map())]
        .map(([id, { on, game }]) => [id, Math.round(on.sec), on.pf, on.pa, Math.round(game.sec), game.pf, game.pa] as TeamLineupSeason['onOff'][number])
        .sort((a, b) => b[1] - a[1]);
      const all = this.lineups.get(team) ?? new Map<string, Tally>();
      const minutes = new Map(onOff.map((r) => [r[0], r[1]]));
      const rotation = [...(this.seg.get(team) ?? new Map<string, { games: number; sec: number[] }>())]
        .filter(([id]) => (minutes.get(id) ?? 0) >= 6000)
        .sort((a, b) => (minutes.get(b[0]) ?? 0) - (minutes.get(a[0]) ?? 0))
        .slice(0, 15)
        .map(([id, r]) => [id, r.games, ...r.sec.map((v) => Math.round(v / r.games))] as [string, number, ...number[]]);
      const clutchLineups = [...(this.clutch.get(team) ?? new Map<string, Tally>())]
        .filter(([, t]) => t.sec >= 120)
        .sort((a, b) => b[1].sec - a[1].sec)
        .slice(0, 10)
        .map(([k, t]) => [k.split(','), Math.round(t.sec), t.pf, t.pa] as [string[], number, number, number]);
      const defense = [...(this.def.get(team) ?? new Map<string, number[]>())].filter(([id]) => (minutes.get(id) ?? 0) >= 6000).map(([id, z]) => [id, ...z] as [string, ...number[]]);
      out[team] = { lineups: lus, onOff, pairs: combos(all, 2, 0, 120), trios: combos(all, 3, 3600, 40), rotation, clutchLineups, defense, oppZones: this.opp.get(team) };
    }
    return out;
  }
}
