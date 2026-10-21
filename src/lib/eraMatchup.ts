// Cross-era team matchups. SRS is a team's point margin adjusted for schedule,
// measured against its own season's league, so two SRS values give an
// era-neutral estimate of how many points better one team was.

/** Spread of single-game NBA results around the expected margin, in points. */
export const GAME_SD = 12;

/** Standard normal CDF (Abramowitz–Stegun 7.1.26, error < 1.5e-7). */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/** Chance of winning a best-of-n series when each game is won with probability p. */
export function seriesWinProb(p: number, n = 7): number {
  const need = Math.ceil(n / 2);
  let total = 0;
  // Win the series in game need + k, having lost k of the earlier games.
  for (let k = 0; k < need; k++) total += binom(need - 1 + k, k) * p ** need * (1 - p) ** k;
  return total;
}

function binom(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

export interface Matchup {
  /** Expected neutral-court margin for A (negative = B favoured). */
  margin: number;
  gameProb: number;
  seriesProb: number;
}

export function eraMatchup(srsA: number, srsB: number): Matchup {
  const margin = srsA - srsB;
  const gameProb = normalCdf(margin / GAME_SD);
  return { margin, gameProb, seriesProb: seriesWinProb(gameProb) };
}
