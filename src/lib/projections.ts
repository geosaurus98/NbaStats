// Elo power ratings and Monte Carlo season projections.
import type { Game } from '../api/types';
import { countsInStandings, isFinal } from './league';

export const ELO_MEAN = 1505;
const K = 20;
const HOME_ADV = 100;
const CARRY = 0.75; // keep 75% of last season's distance from the mean

export function winProb(homeElo: number, awayElo: number): number {
  return 1 / (1 + 10 ** (-(homeElo + HOME_ADV - awayElo) / 400));
}

export interface EloPoint {
  t: number; // ms timestamp
  rating: number;
}

export interface EloRun {
  ratings: Map<string, number>;
  history: Map<string, EloPoint[]>;
  /** Pre-game home win probability for each finished game. */
  predictions: { game: Game; pHome: number }[];
}

/** Next season's starting ratings: pulled a quarter of the way back to the mean. */
export function carryOver(ratings: Map<string, number>): Map<string, number> {
  return new Map([...ratings].map(([id, r]) => [id, ELO_MEAN + (r - ELO_MEAN) * CARRY]));
}

/** Runs Elo over finished games in date order (FiveThirtyEight-style margin multiplier). */
export function runElo(games: Game[], initial = new Map<string, number>()): EloRun {
  const ratings = new Map(initial);
  const history = new Map<string, EloPoint[]>();
  const predictions: EloRun['predictions'] = [];
  const get = (id: string) => ratings.get(id) ?? ELO_MEAN;
  const sorted = games.filter(isFinal).sort((a, b) => a.date.localeCompare(b.date));
  const t0 = sorted.length ? Date.parse(sorted[0].date) - 864e5 : 0;
  for (const id of new Set(sorted.flatMap((g) => [g.home.team.id, g.away.team.id]))) history.set(id, [{ t: t0, rating: get(id) }]);

  for (const g of sorted) {
    const h = g.home.team.id;
    const a = g.away.team.id;
    const rh = get(h);
    const ra = get(a);
    const p = winProb(rh, ra);
    predictions.push({ game: g, pHome: p });
    const margin = (g.home.score ?? 0) - (g.away.score ?? 0);
    const homeWon = margin > 0;
    const winnerDiff = homeWon ? rh + HOME_ADV - ra : ra - rh - HOME_ADV;
    const mult = (Math.abs(margin) + 3) ** 0.8 / (7.5 + 0.006 * winnerDiff);
    const shift = K * mult * ((homeWon ? 1 : 0) - p);
    ratings.set(h, rh + shift);
    ratings.set(a, ra - shift);
    const t = Date.parse(g.date);
    history.get(h)!.push({ t, rating: rh + shift });
    history.get(a)!.push({ t, rating: ra - shift });
  }
  return { ratings, history, predictions };
}

/** Rating of each team as of time `t` (ms), from an Elo history. */
export function ratingsAt(run: EloRun, t: number): Map<string, number> {
  const out = new Map<string, number>();
  for (const [id, pts] of run.history) {
    let r = pts[0].rating;
    for (const p of pts) {
      if (p.t > t) break;
      r = p.rating;
    }
    out.set(id, r);
  }
  return out;
}

export interface TeamOdds {
  teamId: string;
  avgWins: number;
  top6: number;
  playIn: number;
  playoffs: number;
  round2: number;
  confFinals: number;
  finals: number;
  champion: number;
}

/** Best-of-seven with 2-2-1-1-1 home court for `high`. Returns true if `high` wins. */
function series(high: string, low: string, r: Map<string, number>, rand: () => number): boolean {
  let w = 0;
  let l = 0;
  for (let g = 0; w < 4 && l < 4; g++) {
    const highHome = [0, 1, 4, 6].includes(g);
    const p = highHome ? winProb(r.get(high)!, r.get(low)!) : 1 - winProb(r.get(low)!, r.get(high)!);
    if (rand() < p) w++;
    else l++;
  }
  return w === 4;
}

function game(home: string, away: string, r: Map<string, number>, rand: () => number): boolean {
  return rand() < winProb(r.get(home)!, r.get(away)!);
}

/**
 * Simulates the rest of the regular season, the play-in and the playoffs.
 * Games finished before `asOf` (ms) keep their real results; later ones are
 * simulated with the given ratings. Ties in the standings break at random.
 */
export function simulate(
  games: Game[],
  conferences: Map<string, string>,
  ratings: Map<string, number>,
  sims: number,
  rand: () => number,
  asOf = Infinity,
): Map<string, TeamOdds> {
  const teams = [...conferences.keys()];
  const r = new Map(teams.map((id) => [id, ratings.get(id) ?? ELO_MEAN]));
  const odds = new Map<string, TeamOdds>(
    teams.map((id) => [id, { teamId: id, avgWins: 0, top6: 0, playIn: 0, playoffs: 0, round2: 0, confFinals: 0, finals: 0, champion: 0 }]),
  );
  const baseWins = new Map(teams.map((id) => [id, 0]));
  const remaining: [string, string][] = [];
  for (const g of games) {
    const h = g.home.team.id;
    const a = g.away.team.id;
    if (!r.has(h) || !r.has(a) || !countsInStandings(g)) continue;
    if (isFinal(g) && Date.parse(g.date) <= asOf) {
      const winner = (g.home.score ?? 0) > (g.away.score ?? 0) ? h : a;
      baseWins.set(winner, baseWins.get(winner)! + 1);
    } else remaining.push([h, a]);
  }
  const confs = [...new Set(conferences.values())];

  for (let s = 0; s < sims; s++) {
    const wins = new Map(baseWins);
    for (const [h, a] of remaining) {
      const w = game(h, a, r, rand) ? h : a;
      wins.set(w, wins.get(w)! + 1);
    }
    const champs: string[] = [];
    const jitter = new Map(teams.map((id) => [id, rand()]));
    for (const conf of confs) {
      const seeded = teams
        .filter((id) => conferences.get(id) === conf)
        .sort((x, y) => wins.get(y)! - wins.get(x)! || jitter.get(y)! - jitter.get(x)!);
      seeded.forEach((id, i) => {
        if (i < 6) odds.get(id)!.top6++;
        else if (i < 10) odds.get(id)!.playIn++;
      });
      if (seeded.length < 10) continue;
      // Play-in: 7v8 winner is the 7 seed; loser hosts the 9v10 winner for the 8 seed.
      const [s7, s8, s9, s10] = seeded.slice(6, 10);
      const won78 = game(s7, s8, r, rand);
      const seed7 = won78 ? s7 : s8;
      const lost78 = won78 ? s8 : s7;
      const win910 = game(s9, s10, r, rand) ? s9 : s10;
      const seed8 = game(lost78, win910, r, rand) ? lost78 : win910;
      const bracket = [...seeded.slice(0, 6), seed7, seed8];
      for (const id of bracket) odds.get(id)!.playoffs++;
      const seedOf = new Map(bracket.map((id, i) => [id, i]));
      const play = (x: string, y: string) => {
        const [hi, lo] = seedOf.get(x)! < seedOf.get(y)! ? [x, y] : [y, x];
        return series(hi, lo, r, rand) ? hi : lo;
      };
      const r1 = [play(bracket[0], bracket[7]), play(bracket[3], bracket[4]), play(bracket[2], bracket[5]), play(bracket[1], bracket[6])];
      for (const id of r1) odds.get(id)!.round2++;
      const r2 = [play(r1[0], r1[1]), play(r1[2], r1[3])];
      for (const id of r2) odds.get(id)!.confFinals++;
      const champ = play(r2[0], r2[1]);
      odds.get(champ)!.finals++;
      champs.push(champ);
    }
    if (champs.length === 2) {
      const [x, y] = champs;
      const [hi, lo] = wins.get(x)! >= wins.get(y)! ? [x, y] : [y, x];
      odds.get(series(hi, lo, r, rand) ? hi : lo)!.champion++;
    }
    for (const id of teams) odds.get(id)!.avgWins += wins.get(id)!;
  }
  for (const o of odds.values()) {
    for (const k of ['avgWins', 'top6', 'playIn', 'playoffs', 'round2', 'confFinals', 'finals', 'champion'] as const) o[k] /= sims;
  }
  return odds;
}
