// League-history views over the roster graph: careers by franchise, player
// movement between franchises, shared teammates and roster continuity.
import { franchiseOf, FRANCHISES } from './franchises';
import type { Graph } from './teammates';

export interface Segment {
  /** Franchise id, or the raw team code for a defunct team. */
  key: string;
  code: string;
  league: string;
  from: number;
  to: number;
  defunct: boolean;
}

/** A player's career as consecutive spells with one franchise. */
export function careerSegments(g: Graph, player: number): Segment[] {
  const out: Segment[] = [];
  for (const r of g.data.stints[player] ?? []) {
    const [season, league, code] = g.data.rosters[r];
    const f = franchiseOf(code);
    const key = f?.id ?? code;
    const last = out[out.length - 1];
    if (last && last.key === key && season - last.to <= 1) {
      last.to = season;
      last.code = code;
    } else {
      out.push({ key, code, league, from: season, to: season, defunct: !f });
    }
  }
  return out;
}

export interface Move {
  player: number;
  from: string;
  to: string;
  season: number;
}

/** Every time a player went from one current franchise to another. */
export function allMoves(g: Graph): Move[] {
  const moves: Move[] = [];
  g.data.players.forEach((_, p) => {
    const segs = careerSegments(g, p).filter((s) => !s.defunct);
    for (let i = 1; i < segs.length; i++) {
      if (segs[i].key !== segs[i - 1].key) moves.push({ player: p, from: segs[i - 1].key, to: segs[i].key, season: segs[i].from });
    }
  });
  return moves;
}

/** Symmetric franchise × franchise counts of moves (either direction). */
export function moveMatrix(moves: Move[]): { ids: string[]; matrix: number[][] } {
  const ids = FRANCHISES.map((f) => f.id);
  const idx = new Map(ids.map((id, i) => [id, i]));
  const matrix = ids.map(() => ids.map(() => 0));
  for (const m of moves) {
    const a = idx.get(m.from);
    const b = idx.get(m.to);
    if (a == null || b == null) continue;
    matrix[a][b]++;
    if (a !== b) matrix[b][a]++;
  }
  return { ids, matrix };
}

export function teammatesOf(g: Graph, player: number): Set<number> {
  const out = new Set<number>();
  for (const r of g.playerRosters[player]) for (const q of g.data.rosters[r][3]) if (q !== player) out.add(q);
  return out;
}

export function commonTeammates(g: Graph, a: number, b: number): number[] {
  const tb = teammatesOf(g, b);
  return [...teammatesOf(g, a)].filter((p) => tb.has(p) && p !== b);
}

/** Rosters both players were on (i.e. seasons they were teammates). */
export function sharedRosters(g: Graph, a: number, b: number): number[] {
  const rb = new Set(g.playerRosters[b]);
  return g.playerRosters[a].filter((r) => rb.has(r));
}

export interface ContinuityCell {
  season: number;
  roster: number;
  returning: number;
  share: number;
}

/**
 * For each franchise and season: how much of the roster was with the
 * franchise the season before. First seasons have no value.
 */
export function continuity(g: Graph): Map<string, ContinuityCell[]> {
  const bySeason = new Map<string, Map<number, Set<number>>>();
  for (const [season, , code, ids] of g.data.rosters) {
    const f = franchiseOf(code);
    if (!f) continue;
    const seasons = bySeason.get(f.id) ?? new Map<number, Set<number>>();
    const set = seasons.get(season) ?? new Set<number>();
    for (const p of ids) set.add(p);
    seasons.set(season, set);
    bySeason.set(f.id, seasons);
  }
  const out = new Map<string, ContinuityCell[]>();
  for (const [id, seasons] of bySeason) {
    const cells: ContinuityCell[] = [];
    for (const [season, set] of [...seasons].sort((a, b) => a[0] - b[0])) {
      const prev = seasons.get(season - 1);
      if (!prev) continue;
      const returning = [...set].filter((p) => prev.has(p)).length;
      cells.push({ season, roster: set.size, returning, share: returning / set.size });
    }
    out.set(id, cells);
  }
  return out;
}

export interface Journeyman {
  player: number;
  franchises: number;
  stints: number;
}

/** Players who played for the most different franchises (defunct teams count). */
export function journeymen(g: Graph, top = 25): Journeyman[] {
  return g.data.players
    .map((_, p) => {
      const segs = careerSegments(g, p);
      return { player: p, franchises: new Set(segs.map((s) => s.key)).size, stints: segs.length };
    })
    .sort((a, b) => b.franchises - a.franchises || b.stints - a.stints)
    .slice(0, top);
}

/** Players who played for both franchises (any era). */
export function playedForBoth(g: Graph, a: string, b: string): number[] {
  const out: number[] = [];
  g.data.players.forEach((_, p) => {
    const keys = new Set(careerSegments(g, p).map((s) => s.key));
    if (keys.has(a) && keys.has(b)) out.push(p);
  });
  return out;
}
