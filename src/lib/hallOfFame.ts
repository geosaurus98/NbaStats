// Hall of Fame odds: a logistic regression on retired players' careers
// (All-Star selections, All-NBA teams, MVPs, rings, career totals, seasons),
// trained in the browser on who actually made it, then applied to everyone
// still playing or not yet eligible.
import { COL, type CareerData } from './careers';

export const HOF_FEATURES = ['All-Star selections', 'All-NBA (weighted)', 'MVPs', 'Rings', 'Career points (1,000s)', 'Career rebounds + assists (1,000s)', 'Seasons'] as const;

export interface HofCandidate {
  player: number;
  last: number;
  features: number[];
  prob: number;
}

function features(data: CareerData): { player: number; first: number; last: number; x: number[] }[] {
  const n = data.seasons.length;
  const stars = new Array(n).fill(0);
  for (const [, p] of data.allStars) stars[p]++;
  const allNba = new Array(n).fill(0);
  for (const [, p, team] of data.allNba ?? []) allNba[p] += team === 1 ? 1 : team === 2 ? 0.6 : 0.4;
  const mvps = new Array(n).fill(0);
  for (const id of ['nba mvp', 'aba mvp']) for (const [, p, , won] of data.awards[id] ?? []) if (won) mvps[p]++;
  const rings = new Array(n).fill(0);
  for (const [, p] of data.rings ?? []) rings[p]++;
  return data.seasons.flatMap((rows, player) => {
    if (!rows.length) return [];
    let pts = 0;
    let rebAst = 0;
    const years = new Set<number>();
    for (const r of rows) {
      pts += Math.max(0, r[COL.pts]);
      rebAst += Math.max(0, r[COL.trb]) + Math.max(0, r[COL.ast]);
      years.add(r[COL.season]);
    }
    return [{ player, first: Math.min(...years), last: Math.max(...years), x: [stars[player], allNba[player], mvps[player], rings[player], pts / 1000, rebAst / 1000, years.size] }];
  });
}

/** Trains on players retired long enough to be eligible; returns odds for the rest. */
export function hallOfFameOdds(data: CareerData, latest: number): { candidates: HofCandidate[]; weights: number[]; accuracy: number } {
  const hof = new Set(data.hof ?? []);
  const all = features(data);
  // Eligible: retired at least five full seasons, careers from 1960 on (earlier eras were picked differently).
  const train = all.filter((p) => p.last <= latest - 6 && p.first >= 1960);
  const k = HOF_FEATURES.length;
  const mean = Array.from({ length: k }, (_, j) => train.reduce((s, p) => s + p.x[j], 0) / train.length);
  const sd = Array.from({ length: k }, (_, j) => Math.sqrt(train.reduce((s, p) => s + (p.x[j] - mean[j]) ** 2, 0) / train.length) || 1);
  const z = (x: number[]) => x.map((v, j) => (v - mean[j]) / sd[j]);
  const w = new Array(k + 1).fill(0);
  const sig = (v: number) => 1 / (1 + Math.exp(-v));
  const predict = (x: number[]) => sig(w[k] + z(x).reduce((s, v, j) => s + v * w[j], 0));
  // Plain gradient descent with a little L2 to keep weights sensible.
  for (let it = 0; it < 400; it++) {
    const g = new Array(k + 1).fill(0);
    for (const p of train) {
      const err = predict(p.x) - (hof.has(p.player) ? 1 : 0);
      const zx = z(p.x);
      for (let j = 0; j < k; j++) g[j] += err * zx[j];
      g[k] += err;
    }
    for (let j = 0; j <= k; j++) w[j] -= (0.5 * (g[j] / train.length + (j < k ? 0.002 * w[j] : 0)));
  }
  const correct = train.filter((p) => predict(p.x) >= 0.5 === hof.has(p.player)).length;
  const candidates = all
    .filter((p) => p.last > latest - 6 && !hof.has(p.player))
    .map((p) => ({ player: p.player, last: p.last, features: p.x, prob: predict(p.x) }))
    .sort((a, b) => b.prob - a.prob);
  return { candidates, weights: w.slice(0, k), accuracy: train.length ? correct / train.length : 0 };
}
