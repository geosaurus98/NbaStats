// Puzzle generators over the all-time roster graph. Seeded so a daily puzzle
// is the same for everyone on the same date.
import { FRANCHISES } from './franchises';
import { careerSegments } from './history';
import { bfs, type Graph } from './teammates';

/** Deterministic PRNG (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function shuffle<T>(xs: T[], rand: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Franchise ids each player played for. */
export function franchiseSets(g: Graph): Set<string>[] {
  return g.data.players.map((_, p) => new Set(careerSegments(g, p).filter((s) => !s.defunct).map((s) => s.key)));
}

export interface Grid {
  rows: string[];
  cols: string[];
  /** answers[r][c] = players who played for both rows[r] and cols[c]. */
  answers: number[][][];
}

const MIN_ANSWERS = 4;

export function makeGrid(g: Graph, rand: () => number, sets = franchiseSets(g)): Grid {
  const ids = FRANCHISES.map((f) => f.id);
  const both = (a: string, b: string) => g.data.players.map((_, p) => p).filter((p) => sets[p].has(a) && sets[p].has(b));
  for (let attempt = 0; attempt < 200; attempt++) {
    const pick = shuffle(ids, rand).slice(0, 6);
    const rows = pick.slice(0, 3);
    const cols = pick.slice(3);
    const answers = rows.map((r) => cols.map((c) => both(r, c)));
    if (answers.every((row) => row.every((cell) => cell.length >= MIN_ANSWERS))) return { rows, cols, answers };
  }
  throw new Error('Could not build a grid');
}

/** Longer careers = better known. Returns 0 (famous) – 100 (obscure). */
export function obscurity(g: Graph, player: number, among: number[]): number {
  const len = (p: number) => g.data.players[p][2] - g.data.players[p][1];
  const longer = among.filter((p) => len(p) > len(player)).length;
  return Math.round((longer / Math.max(1, among.length - 1)) * 100);
}

export interface ConnectPuzzle {
  start: number;
  target: number;
  optimal: number;
}

/** Two well-known players (8+ seasons, from different eras) 3–4 links apart. */
export function makeConnect(g: Graph, rand: () => number): ConnectPuzzle {
  const known = g.data.players.map((_, p) => p).filter((p) => g.data.players[p][2] - g.data.players[p][1] >= 8);
  for (let attempt = 0; attempt < 500; attempt++) {
    const start = known[Math.floor(rand() * known.length)];
    const s = bfs(g, start);
    const candidates = known.filter((p) => s.dist[p] === 3 || s.dist[p] === 4);
    if (candidates.length === 0) continue;
    const target = candidates[Math.floor(rand() * candidates.length)];
    return { start, target, optimal: s.dist[target] };
  }
  throw new Error('Could not build a puzzle');
}

/** Rosters linking two players (empty if they were never teammates). */
export function linkingRosters(g: Graph, a: number, b: number): number[] {
  const rb = new Set(g.playerRosters[b]);
  return g.playerRosters[a].filter((r) => rb.has(r));
}

/**
 * A hint from `current` towards `target`: a teammate one step closer, and
 * the roster they shared. Prefers the best-known such teammate.
 */
export function hint(g: Graph, current: number, target: number): { player: number; roster: number } | undefined {
  const fromTarget = bfs(g, target);
  const d = fromTarget.dist[current];
  if (d <= 0) return undefined;
  let best: { player: number; roster: number; len: number } | undefined;
  for (const r of g.playerRosters[current]) {
    for (const p of g.data.rosters[r][3]) {
      if (fromTarget.dist[p] !== d - 1) continue;
      const len = g.data.players[p][2] - g.data.players[p][1];
      if (!best || len > best.len) best = { player: p, roster: r, len };
    }
  }
  return best && { player: best.player, roster: best.roster };
}

export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
