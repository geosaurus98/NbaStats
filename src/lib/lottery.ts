// NBA draft lottery (2019 format): the 14 non-playoff teams, worst first, get
// 140, 140, 140, 125, 105, 90, 75, 60, 45, 30, 20, 15, 10 and 5 of 1,000
// combinations. Four picks are drawn; everyone else then goes in reverse
// order of record. Tied teams share their combinations equally.

export const COMBOS = [140, 140, 140, 125, 105, 90, 75, 60, 45, 30, 20, 15, 10, 5];
export const DRAWN = 4;

/** Combinations per team after splitting ties (teams in lottery order, worst first; equal keys = tied). */
export function shareTies(keys: number[], combos = COMBOS): number[] {
  const out = [...combos.slice(0, keys.length)];
  for (let i = 0; i < keys.length; ) {
    let j = i;
    while (j + 1 < keys.length && keys[j + 1] === keys[i]) j++;
    const avg = out.slice(i, j + 1).reduce((a, b) => a + b, 0) / (j - i + 1);
    for (let k = i; k <= j; k++) out[k] = avg;
    i = j + 1;
  }
  return out;
}

/**
 * Exact chance of each team landing each pick: result[team][pick - 1].
 * Enumerates every ordered draw of the four lottery picks.
 */
export function pickOdds(weights: number[], drawn = DRAWN): number[][] {
  const n = weights.length;
  const out = weights.map(() => new Array(n).fill(0));
  const total = weights.reduce((a, b) => a + b, 0);
  const recurse = (taken: number[], p: number, left: number) => {
    if (taken.length === drawn || taken.length === n) {
      taken.forEach((t, k) => (out[t][k] += p));
      // The rest keep their order, after the drawn picks.
      let pick = taken.length;
      for (let t = 0; t < n; t++) if (!taken.includes(t)) out[t][pick++] += p;
      return;
    }
    for (let t = 0; t < n; t++) {
      if (taken.includes(t) || weights[t] <= 0) continue;
      recurse([...taken, t], (p * weights[t]) / left, left - weights[t]);
    }
  };
  recurse([], 1, total);
  return out;
}

/** One random lottery: the teams' indexes in draft order. */
export function drawLottery(weights: number[], rand: () => number, drawn = DRAWN): number[] {
  const order: number[] = [];
  let left = weights.reduce((a, b) => a + b, 0);
  for (let k = 0; k < drawn && k < weights.length; k++) {
    let r = rand() * left;
    for (let t = 0; t < weights.length; t++) {
      if (order.includes(t)) continue;
      r -= weights[t];
      if (r < 0) {
        order.push(t);
        left -= weights[t];
        break;
      }
    }
  }
  for (let t = 0; t < weights.length; t++) if (!order.includes(t)) order.push(t);
  return order;
}

// ---------------------------------------------------------------------------
// The "3-2-1" lottery (approved May 2026, for the 2027 to 2029 drafts):
// 16 teams and 37 balls, and all 16 lottery picks are drawn.
//  - Teams outside the play-in get 3 balls, except the three worst records,
//    which are "relegated" to 2 balls and can't fall below pick 12.
//  - The 9th and 10th seeds in each conference get 2 balls.
//  - The loser of each 7-v-8 play-in game gets 1 ball (even if it goes on
//    to win the 8th seed). The 7-v-8 winners aren't in the lottery.
//  - Picks 17-30 go to everyone else in reverse order of record.
// Not modelled: no team may win No. 1 two years running or pick in the top
// five three drafts in a row, and the league can cut a tanking team's odds.

export type LotteryFormat = 'classic' | '321';

/** Which lottery a draft uses (draft year = the season's end year). */
export const lotteryFormat = (draftYear: number): LotteryFormat => (draftYear >= 2027 ? '321' : 'classic');

export interface LotteryCandidate {
  id: string;
  conference: string;
  /** Lower = worse record (win % or projected wins). */
  key: number;
}

export interface LotterySlot {
  id: string;
  /** Combinations (classic, out of 1,000) or balls (3-2-1, out of 37). */
  weight: number;
  /** 3-2-1 only: one of the three worst records, guaranteed a top-12 pick. */
  relegated?: boolean;
  /** Why the team is in the lottery. */
  group: string;
}

export const RELEGATED_FLOOR = 12;

const worstFirst = (a: LotteryCandidate, b: LotteryCandidate) => a.key - b.key || a.id.localeCompare(b.id);

/**
 * The lottery teams (worst record first) and the rest of the first round
 * (picks after the lottery, worst first). `playoffIds`, when the playoff
 * field is known, sets the classic lottery; otherwise seeds come from `key`.
 */
export function lotteryField(teams: LotteryCandidate[], format: LotteryFormat, playoffIds?: Set<string>): { lottery: LotterySlot[]; rest: string[] } {
  const byConf = new Map<string, LotteryCandidate[]>();
  for (const t of teams) byConf.set(t.conference, [...(byConf.get(t.conference) ?? []), t]);
  const seeds = new Map<string, number>();
  for (const list of byConf.values()) [...list].sort((a, b) => worstFirst(b, a)).forEach((t, i) => seeds.set(t.id, i + 1));
  if (format === 'classic') {
    const out = teams.filter((t) => (playoffIds && playoffIds.size >= 16 ? !playoffIds.has(t.id) : (seeds.get(t.id) ?? 99) > 8)).sort(worstFirst).slice(0, 14);
    const weights = shareTies(out.map((t) => t.key));
    const ids = new Set(out.map((t) => t.id));
    return {
      lottery: out.map((t, i) => ({ id: t.id, weight: weights[i], group: 'Missed the playoffs' })),
      rest: teams.filter((t) => !ids.has(t.id)).sort(worstFirst).map((t) => t.id),
    };
  }
  const seed = (t: LotteryCandidate) => seeds.get(t.id) ?? 99;
  const outside = teams.filter((t) => seed(t) > 10).sort(worstFirst);
  const slots: (LotterySlot & { key: number })[] = [
    ...outside.map((t, i) => (i < 3 ? { id: t.id, key: t.key, weight: 2, relegated: true, group: 'Three worst records (relegated)' } : { id: t.id, key: t.key, weight: 3, group: 'Outside the play-in' })),
    ...teams.filter((t) => seed(t) === 9 || seed(t) === 10).map((t) => ({ id: t.id, key: t.key, weight: 2, group: '9th or 10th seed' })),
    // Until the play-in is played, the 8th seed is taken to lose the 7-v-8 game.
    ...teams.filter((t) => seed(t) === 8).map((t) => ({ id: t.id, key: t.key, weight: 1, group: 'Lost the 7-v-8 play-in game' })),
  ];
  slots.sort((a, b) => a.key - b.key || a.id.localeCompare(b.id));
  const ids = new Set(slots.map((s) => s.id));
  return { lottery: slots.map(({ key: _key, ...s }) => s), rest: teams.filter((t) => !ids.has(t.id)).sort(worstFirst).map((t) => t.id) };
}

/** One 3-2-1 draw: every lottery pick drawn by balls, with the relegated teams' top-12 floor. */
export function draw321(slots: LotterySlot[], rand: () => number): number[] {
  const left = slots.map((_, i) => i);
  const order: number[] = [];
  for (let pick = 1; left.length; pick++) {
    const relegated = left.filter((i) => slots[i].relegated);
    let chosen: number;
    if (relegated.length && RELEGATED_FLOOR - pick + 1 <= relegated.length) {
      chosen = relegated[0]; // out of draws: the worst record left takes this pick
    } else {
      let r = rand() * left.reduce((s, i) => s + slots[i].weight, 0);
      chosen = left[left.length - 1];
      for (const i of left) {
        r -= slots[i].weight;
        if (r < 0) {
          chosen = i;
          break;
        }
      }
    }
    order.push(chosen);
    left.splice(left.indexOf(chosen), 1);
  }
  return order;
}

/** A small seeded random number generator, so simulated odds are the same on every visit. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Chance of each lottery team landing each lottery pick: result[team][pick - 1]. */
export function lotteryOdds(slots: LotterySlot[], format: LotteryFormat, sims = 100_000): number[][] {
  if (format === 'classic') return pickOdds(slots.map((s) => s.weight));
  const out = slots.map(() => new Array(slots.length).fill(0));
  const rand = seeded(2027);
  for (let s = 0; s < sims; s++) draw321(slots, rand).forEach((t, pick) => out[t][pick]++);
  return out.map((row) => row.map((v) => v / sims));
}

/** One random lottery in either format: lottery teams' indexes in draft order. */
export function runLottery(slots: LotterySlot[], format: LotteryFormat, rand: () => number): number[] {
  return format === 'classic' ? drawLottery(slots.map((s) => s.weight), rand) : draw321(slots, rand);
}
