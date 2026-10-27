// The hot-hand test: each player's shooting right after a make against right
// after a miss (their previous field-goal attempt in the same game), split by
// shot type so a tougher "heat check" diet can be allowed for.
import type { Shot } from '../api/types';
import { SHOT_TYPES, shotType, type ShotTypeId } from './shotTypes';

export const HOT_CONDITIONS = ['make', 'miss', 'make2', 'miss2'] as const;
export type HotCondition = (typeof HOT_CONDITIONS)[number];

/** Per condition: [attempts, makes] for each shot type, flattened in SHOT_TYPES order. */
export type HotCounts = Record<HotCondition, number[]>;

export interface HotHand {
  league: HotCounts;
  players: Record<string, HotCounts>;
}

const TYPE_INDEX = new Map<ShotTypeId, number>(SHOT_TYPES.map((t, i) => [t.id, i]));
const empty = (): HotCounts => Object.fromEntries(HOT_CONDITIONS.map((c) => [c, Array(SHOT_TYPES.length * 2).fill(0)])) as HotCounts;

export class HotHandAccumulator {
  private league = empty();
  private players = new Map<string, HotCounts>();

  /** One game's shots, in game order. */
  add(shots: Shot[]) {
    const last = new Map<string, boolean[]>();
    for (const s of shots) {
      if (!s.athleteId) continue;
      const prev = last.get(s.athleteId) ?? [];
      const conds: HotCondition[] = [];
      if (prev.length) conds.push(prev[prev.length - 1] ? 'make' : 'miss');
      if (prev.length >= 2 && prev[prev.length - 1] === prev[prev.length - 2]) conds.push(prev[prev.length - 1] ? 'make2' : 'miss2');
      const i = TYPE_INDEX.get(shotType(s.text, s.value))! * 2;
      const p = this.players.get(s.athleteId) ?? empty();
      for (const c of conds) {
        for (const counts of [p[c], this.league[c]]) {
          counts[i]++;
          if (s.made) counts[i + 1]++;
        }
      }
      this.players.set(s.athleteId, p);
      last.set(s.athleteId, [...prev.slice(-1), s.made]);
    }
  }

  /** Players with at least `minShots` attempts that followed another shot. */
  result(minShots = 60): HotHand {
    const total = (c: HotCounts) => c.make.reduce((s, v, i) => s + (i % 2 ? 0 : v), 0) + c.miss.reduce((s, v, i) => s + (i % 2 ? 0 : v), 0);
    return { league: this.league, players: Object.fromEntries([...this.players].filter(([, c]) => total(c) >= minShots)) };
  }
}

export interface HotHandRow {
  att: number;
  pct: number;
  /** FG% this player would expect from the same shot types, at their own season rates. */
  expected: number;
  /** Share of these shots that were threes. */
  threeShare: number;
}

/** Actual and expected shooting after a given condition. */
export function hotHandRow(c: HotCounts, cond: HotCondition, values: Record<ShotTypeId, number> = {} as Record<ShotTypeId, number>): HotHandRow {
  // The player's own rate by type, over every shot that followed another.
  const rate = SHOT_TYPES.map((_, t) => {
    const att = c.make[t * 2] + c.miss[t * 2];
    return att ? (c.make[t * 2 + 1] + c.miss[t * 2 + 1]) / att : 0;
  });
  let att = 0;
  let made = 0;
  let exp = 0;
  let threes = 0;
  SHOT_TYPES.forEach((type, t) => {
    const a = c[cond][t * 2];
    att += a;
    made += c[cond][t * 2 + 1];
    exp += a * rate[t];
    if (type.id === 'three' || values[type.id] === 3) threes += a;
  });
  return { att, pct: att ? made / att : 0, expected: att ? exp / att : 0, threeShare: att ? threes / att : 0 };
}
