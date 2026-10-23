// Milestone watch: active players' career totals (history through last
// season plus this season's box scores) and the next round number or
// all-time mark each is closing in on.
import { P, type BoxTotals } from './boxTotals';
import { totals, type CareerData, type StatKey } from './careers';
import type { Graph } from './teammates';

export const MILESTONE_STATS: { key: StatKey; box: keyof typeof P | 'trb'; label: string; marks: (total: number) => number }[] = [
  { key: 'pts', box: 'pts', label: 'points', marks: (t) => (t >= 30000 ? 1000 : 5000) },
  { key: 'trb', box: 'trb', label: 'rebounds', marks: (t) => (t >= 10000 ? 1000 : t >= 5000 ? 1000 : 2500) },
  { key: 'ast', box: 'ast', label: 'assists', marks: (t) => (t >= 3000 ? 1000 : 2500) },
  { key: 'stl', box: 'stl', label: 'steals', marks: () => 250 },
  { key: 'blk', box: 'blk', label: 'blocks', marks: () => 250 },
  { key: 'tp', box: 'tpm', label: 'threes', marks: (t) => (t >= 2000 ? 250 : 500) },
  { key: 'g', box: 'gp', label: 'games', marks: () => 100 },
];

/** The smallest totals worth flagging, so the list is about real milestones. */
const FLOOR: Record<StatKey, number> = { pts: 10000, trb: 5000, ast: 3000, stl: 1000, blk: 1000, tp: 1000, g: 800, mp: Infinity };

export interface Milestone {
  espnId: string;
  player: number;
  stat: StatKey;
  label: string;
  total: number;
  target: number;
  /** "10,000 points", or "passes Kobe Bryant (33,643) for 4th". */
  what: string;
  remaining: number;
  perGame: number;
  gamesAway: number;
}

const boxValue = (row: (string | number)[], box: keyof typeof P | 'trb') => (box === 'trb' ? (row[P.oreb] as number) + (row[P.dreb] as number) : (row[P[box]] as number));

/**
 * Upcoming milestones for everyone playing this season, soonest first.
 * `espn` maps ESPN ids to history indexes (teammates.json).
 */
export function milestones(careers: CareerData, graph: Graph, box: BoxTotals, maxGames = 30): Milestone[] {
  const espn = graph.data.espn ?? {};
  // All-time totals to find "passes X" targets.
  const allTime = new Map<StatKey, { player: number; value: number }[]>();
  for (const s of MILESTONE_STATS) allTime.set(s.key, []);
  const careerTotals = careers.seasons.map((rows) => totals(rows));
  careerTotals.forEach((t, player) => {
    for (const s of MILESTONE_STATS) if (t.values[s.key] > 0) allTime.get(s.key)!.push({ player, value: t.values[s.key] });
  });
  const current = new Map<number, (string | number)[]>();
  for (const row of box.players) {
    const p = espn[row[0]];
    if (p != null) current.set(p, row);
  }
  // Add this season to everyone on the all-time lists so passes are measured against live totals.
  const live = (player: number, key: StatKey) => {
    const s = MILESTONE_STATS.find((x) => x.key === key)!;
    const row = current.get(player);
    return (careerTotals[player]?.values[key] ?? 0) + (row ? boxValue(row, s.box) : 0);
  };
  for (const s of MILESTONE_STATS) {
    const list = allTime.get(s.key)!;
    for (const p of current.keys()) if (!list.some((x) => x.player === p)) list.push({ player: p, value: 0 });
    for (const x of list) x.value = live(x.player, s.key);
    list.sort((a, b) => b.value - a.value);
  }

  const out: Milestone[] = [];
  for (const [player, row] of current) {
    const gp = row[P.gp] as number;
    const past = careerTotals[player];
    for (const s of MILESTONE_STATS) {
      const total = live(player, s.key);
      if (total < FLOOR[s.key] * 0.9) continue;
      // Pace: this season's rate once it means something, otherwise last career rate.
      const seasonRate = gp ? boxValue(row, s.box) / gp : 0;
      const careerRate = past && past.g ? (past.values[s.key] || 0) / Math.max(1, s.key === 'g' ? past.g : past.gamesWith[s.key] || past.g) : 0;
      const perGame = s.key === 'g' ? 1 : gp >= 5 ? seasonRate : careerRate || seasonRate;
      if (perGame <= 0) continue;
      const step = s.marks(total);
      const round = Math.ceil((total + 1) / step) * step;
      const candidates: { target: number; what: string }[] = [{ target: round, what: `${round.toLocaleString()} ${s.label}` }];
      const list = allTime.get(s.key)!;
      const rank = list.findIndex((x) => x.player === player);
      if (rank > 0 && rank <= 50) {
        const ahead = list[rank - 1];
        candidates.push({ target: ahead.value + 1, what: `passes ${graph.data.players[ahead.player][0]} (${ahead.value.toLocaleString()} ${s.label}) for ${ordinal(rank)} all-time` });
      }
      for (const c of candidates) {
        const remaining = c.target - total;
        if (remaining <= 0) continue;
        const gamesAway = Math.ceil(remaining / perGame);
        if (gamesAway > maxGames) continue;
        out.push({ espnId: row[0] as string, player, stat: s.key, label: s.label, total, target: c.target, what: c.what, remaining, perGame, gamesAway });
      }
    }
  }
  return out.sort((a, b) => a.gamesAway - b.gamesAway || b.total - a.total);
}

export const ordinal = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 >= 11 && n % 100 <= 13 ? 0 : n % 10] ?? 'th'}`;
