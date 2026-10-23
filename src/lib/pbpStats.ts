// Season-level numbers built from play-by-play: how dramatic each game was,
// and binned shot locations for shot maps.
import type { PlayByPlay, Shot } from '../api/types';

/** [gameId, winProbSwing, comeback, leadChanges, lateSwing, periods] */
export type DramaRow = [string, number, number, number, number, number];

const REGULATION_S = 48 * 60;
const LATE_S = 5 * 60;

/**
 * How dramatic a game was:
 * - swing: total movement of ESPN's win probability (0.5 → 0.9 → 0.4 = 0.9)
 * - comeback: biggest deficit the winner overcame
 * - leadChanges: times the lead switched sides
 * - lateSwing: win-probability movement in the last 5 minutes and overtime
 */
export function gameDrama(gameId: string, pbp: PlayByPlay): DramaRow | undefined {
  const flow = pbp.flow;
  if (flow.length < 10) return undefined;
  const last = flow[flow.length - 1];
  const homeWon = last.home > last.away;
  let comeback = 0;
  let leadChanges = 0;
  let leader = 0;
  let swing = 0;
  let lateSwing = 0;
  let prevWin: number | undefined;
  for (const f of flow) {
    const margin = f.home - f.away;
    comeback = Math.max(comeback, homeWon ? -margin : margin);
    const now = Math.sign(margin);
    if (now !== 0) {
      if (leader !== 0 && now !== leader) leadChanges++;
      leader = now;
    }
    if (f.homeWin != null) {
      if (prevWin != null) {
        const d = Math.abs(f.homeWin - prevWin);
        swing += d;
        if (f.t >= REGULATION_S - LATE_S) lateSwing += d;
      }
      prevWin = f.homeWin;
    }
  }
  const round = (v: number) => Math.round(v * 100) / 100;
  return [gameId, round(swing), comeback, leadChanges, round(lateSwing), last.period];
}

/** Sparse shot bins: [binIndex, attempts, makes, shotValue (2 or 3)]. */
export type BinRow = [number, number, number, number];

export const COURT_W = 50;
export const COURT_H = 47;

export function binIndex(s: Pick<Shot, 'x' | 'y'>, size: number): number {
  const cols = Math.ceil(COURT_W / size);
  const cx = Math.min(cols - 1, Math.max(0, Math.floor(s.x / size)));
  const cy = Math.max(0, Math.floor(s.y / size));
  return cy * cols + cx;
}

/** Counts shots per court bin, keeping 2s and 3s apart (bins straddle the arc). */
export class BinCounter {
  private bins = new Map<string, BinRow>();
  attempts = 0;
  constructor(readonly size: number) {}

  add(s: Shot) {
    if (s.y > COURT_H) return; // heaves from the back court
    const k = binIndex(s, this.size);
    const value = s.value === 3 ? 3 : 2;
    const key = `${k}:${value}`;
    const b = this.bins.get(key) ?? [k, 0, 0, value];
    b[1]++;
    if (s.made) b[2]++;
    this.bins.set(key, b);
    this.attempts++;
  }

  rows(): BinRow[] {
    return [...this.bins.values()].sort((a, b) => a[0] - b[0] || a[3] - b[3]);
  }
}

export interface ShotBins {
  teamSize: number;
  playerSize: number;
  league: BinRow[];
  teams: Record<string, BinRow[]>;
  /** Highest-volume shooters only, to keep the bundle small. */
  players: Record<string, { name: string; team: string; attempts: number; bins: BinRow[] }>;
}

const HOOP = { x: 25, y: 5.25 };

/** Bin centre in feet. */
export function binCentre(bin: number, size: number): { x: number; y: number } {
  const cols = Math.ceil(COURT_W / size);
  return { x: (bin % cols) * size + size / 2, y: Math.floor(bin / cols) * size + size / 2 };
}


/** Key for comparing like with like: shot value + distance to the hoop in feet. */
function distanceKey(p: { x: number; y: number }, value: number): string {
  return `${value}:${Math.round(Math.hypot(p.x - HOOP.x, p.y - HOOP.y))}`;
}

/** League FG% by shot value and distance, from the league bins. */
export function leagueByDistance(bins: BinRow[], size: number): Map<string, number> {
  const acc = new Map<string, [number, number]>();
  for (const [b, att, made, value] of bins) {
    const k = distanceKey(binCentre(b, size), value);
    const v = acc.get(k) ?? [0, 0];
    v[0] += att;
    v[1] += made;
    acc.set(k, v);
  }
  return new Map([...acc].map(([k, [att, made]]) => [k, att ? made / att : 0]));
}

export interface ShotCell {
  x: number;
  y: number;
  size: number;
  value: number;
  att: number;
  made: number;
  pct: number;
  /** FG% minus the league's from the same distance and shot value. */
  diff: number;
}

export function shotCells(bins: BinRow[], size: number, league: Map<string, number>): ShotCell[] {
  return bins.map(([b, att, made, value]) => {
    const c = binCentre(b, size);
    const pct = made / att;
    return { ...c, size, value, att, made, pct, diff: pct - (league.get(distanceKey(c, value)) ?? pct) };
  });
}

export const ZONES = [
  { id: 'rim', label: 'At the rim', title: 'Twos within 4 feet of the hoop' },
  { id: 'paint', label: 'Short range', title: 'Twos from 4 to 10 feet' },
  { id: 'mid', label: 'Mid-range', title: 'Twos from beyond 10 feet' },
  { id: 'corner3', label: 'Corner three', title: 'Threes from the corners (within 14 feet of the baseline)' },
  { id: 'arc3', label: 'Above-the-break three', title: 'All other threes' },
] as const;
export type ZoneId = (typeof ZONES)[number]['id'];

/** Which zone a bin's centre falls in. */
export function zoneOf(p: { x: number; y: number }, value: number): ZoneId {
  if (value === 3) return p.y <= 14 ? 'corner3' : 'arc3';
  const d = Math.hypot(p.x - HOOP.x, p.y - HOOP.y);
  return d <= 4 ? 'rim' : d <= 10 ? 'paint' : 'mid';
}

/** Attempts and makes per zone. */
export function zoneTotals(bins: BinRow[], size: number): Record<ZoneId, { att: number; made: number }> {
  const out = Object.fromEntries(ZONES.map((z) => [z.id, { att: 0, made: 0 }])) as Record<ZoneId, { att: number; made: number }>;
  for (const [b, att, made, value] of bins) {
    const z = out[zoneOf(binCentre(b, size), value)];
    z.att += att;
    z.made += made;
  }
  return out;
}
