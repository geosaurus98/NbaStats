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

/** Sparse shot bins: [binIndex, attempts, makes]. */
export type BinRow = [number, number, number];

export const COURT_W = 50;
export const COURT_H = 47;

export function binIndex(s: Pick<Shot, 'x' | 'y'>, size: number): number {
  const cols = Math.ceil(COURT_W / size);
  const cx = Math.min(cols - 1, Math.max(0, Math.floor(s.x / size)));
  const cy = Math.max(0, Math.floor(s.y / size));
  return cy * cols + cx;
}

export class BinCounter {
  private bins = new Map<number, [number, number]>();
  attempts = 0;
  constructor(readonly size: number) {}

  add(s: Shot) {
    if (s.y > COURT_H) return; // heaves from the back court
    const k = binIndex(s, this.size);
    const b = this.bins.get(k) ?? [0, 0];
    b[0]++;
    if (s.made) b[1]++;
    this.bins.set(k, b);
    this.attempts++;
  }

  rows(): BinRow[] {
    return [...this.bins.entries()].sort((a, b) => a[0] - b[0]).map(([k, [att, made]]) => [k, att, made]);
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
