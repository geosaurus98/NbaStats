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
