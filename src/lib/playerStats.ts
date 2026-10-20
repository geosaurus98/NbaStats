// Averages and highs computed from a player's game log.
import type { GameLogEntry } from '../api/types';

/** "10-20" → [10, 20]; plain numbers → [n, n]. */
export function madeAttempted(v: string | undefined): [number, number] {
  const m = /^(\d+)-(\d+)$/.exec(v ?? '');
  return m ? [Number(m[1]), Number(m[2])] : [0, 0];
}

export function statValue(g: GameLogEntry, label: string): number {
  if (label === '3PM') return madeAttempted(g.stats['3PT'])[0];
  const n = parseFloat(g.stats[label] ?? '');
  return Number.isFinite(n) ? n : 0;
}

export interface Averages {
  gp: number;
  min: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fgPct?: number;
  threePct?: number;
  ftPct?: number;
}

export function averages(games: GameLogEntry[]): Averages {
  const gp = games.length;
  const avg = (label: string) => (gp ? games.reduce((s, g) => s + statValue(g, label), 0) / gp : 0);
  const pct = (label: string) => {
    let made = 0;
    let att = 0;
    for (const g of games) {
      const [m, a] = madeAttempted(g.stats[label]);
      made += m;
      att += a;
    }
    return att ? made / att : undefined;
  };
  return {
    gp,
    min: avg('MIN'),
    pts: avg('PTS'),
    reb: avg('REB'),
    ast: avg('AST'),
    stl: avg('STL'),
    blk: avg('BLK'),
    tov: avg('TO'),
    fgPct: pct('FG'),
    threePct: pct('3PT'),
    ftPct: pct('FT'),
  };
}

const DOUBLE_CATS = ['PTS', 'REB', 'AST', 'STL', 'BLK'];

export function isTripleDouble(g: GameLogEntry): boolean {
  return DOUBLE_CATS.filter((c) => statValue(g, c) >= 10).length >= 3;
}

export interface HighEntry {
  athleteId: string;
  athlete: string;
  team: string;
  value: number;
  game: GameLogEntry;
}

export const HIGH_CATEGORIES = [
  { label: 'PTS', title: 'Points' },
  { label: 'REB', title: 'Rebounds' },
  { label: 'AST', title: 'Assists' },
  { label: '3PM', title: 'Threes made' },
  { label: 'STL', title: 'Steals' },
  { label: 'BLK', title: 'Blocks' },
];

/** Top `n` single-game performances per category across many players' logs. */
export function seasonHighs(
  players: { athleteId: string; athlete: string; team: string; games: GameLogEntry[] }[],
  n = 10,
): { byCategory: Record<string, HighEntry[]>; tripleDoubles: { athleteId: string; athlete: string; team: string; count: number }[] } {
  const byCategory: Record<string, HighEntry[]> = {};
  for (const { label } of HIGH_CATEGORIES) {
    const all: HighEntry[] = [];
    for (const p of players) {
      for (const g of p.games) all.push({ athleteId: p.athleteId, athlete: p.athlete, team: p.team, value: statValue(g, label), game: g });
    }
    byCategory[label] = all.sort((a, b) => b.value - a.value || a.game.date.localeCompare(b.game.date)).slice(0, n);
  }
  const tripleDoubles = players
    .map((p) => ({ athleteId: p.athleteId, athlete: p.athlete, team: p.team, count: p.games.filter(isTripleDouble).length }))
    .filter((p) => p.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
  return { byCategory, tripleDoubles };
}
