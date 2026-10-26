// Shot types from the play-by-play text ("makes 2-foot driving layup (X
// assists)"), with assisted makes and a quarter-by-quarter split, per player.
import type { Shot } from '../api/types';

export const SHOT_TYPES = [
  { id: 'dunk', label: 'Dunks' },
  { id: 'layup', label: 'Layups' },
  { id: 'tip', label: 'Tips & putbacks' },
  { id: 'floater', label: 'Floaters' },
  { id: 'hook', label: 'Hooks' },
  { id: 'fadeaway', label: 'Fadeaways & turnarounds' },
  { id: 'pullup', label: 'Pull-up jumpers' },
  { id: 'stepback', label: 'Step-backs' },
  { id: 'jumper', label: 'Other two-point jumpers' },
  { id: 'three', label: 'Other threes' },
] as const;
export type ShotTypeId = (typeof SHOT_TYPES)[number]['id'];

/** Which type a shot description is. Order matters: a "pullup three" is a pull-up, a "driving dunk" a dunk. */
export function shotType(text: string, value: number): ShotTypeId {
  const t = text.toLowerCase();
  if (/dunk/.test(t)) return 'dunk';
  if (/tip|putback/.test(t)) return 'tip';
  if (/layup|finger roll/.test(t)) return 'layup';
  if (/float/.test(t)) return 'floater';
  if (/hook/.test(t)) return 'hook';
  if (/step ?back/.test(t)) return 'stepback';
  if (/pull ?up/.test(t)) return 'pullup';
  if (/fade|turnaround/.test(t)) return 'fadeaway';
  return value === 3 ? 'three' : 'jumper';
}

/** Per type: [attempts, makes, assisted makes]. */
export type TypeCounts = Partial<Record<ShotTypeId, [number, number, number]>>;

export interface PlayerShotSplits {
  types: TypeCounts;
  /** Per quarter (1-4, then all overtimes): [attempts, makes]. */
  quarters: [number, number][];
}

export interface ShotSplits {
  league: TypeCounts;
  players: Record<string, PlayerShotSplits>;
}

const bump = (c: TypeCounts, type: ShotTypeId, made: boolean, assisted: boolean) => {
  const v = (c[type] ??= [0, 0, 0]);
  v[0]++;
  if (made) v[1]++;
  if (made && assisted) v[2]++;
};

export class ShotSplitAccumulator {
  private league: TypeCounts = {};
  private players = new Map<string, PlayerShotSplits>();

  add(shot: Shot) {
    const type = shotType(shot.text, shot.value);
    const assisted = /assist/i.test(shot.text);
    bump(this.league, type, shot.made, assisted);
    if (!shot.athleteId) return;
    const p = this.players.get(shot.athleteId) ?? { types: {}, quarters: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]] };
    bump(p.types, type, shot.made, assisted);
    const q = p.quarters[Math.min(shot.period, 5) - 1];
    if (q) {
      q[0]++;
      if (shot.made) q[1]++;
    }
    this.players.set(shot.athleteId, p);
  }

  /** Players with at least `minShots` attempts. */
  result(minShots = 10): ShotSplits {
    const players = Object.fromEntries([...this.players].filter(([, p]) => p.quarters.reduce((a, q) => a + q[0], 0) >= minShots));
    return { league: this.league, players };
  }
}
