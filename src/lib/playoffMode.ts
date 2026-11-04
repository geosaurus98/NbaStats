// Playoff mode: series odds from Elo (re-worked after every game), series
// stats from the box scores, and a bracket challenge kept in this browser.
import { useCallback, useState } from 'react';
import type { Conference } from '../api/types';
import { L, type SeasonLines } from './boxTotals';
import type { Series } from './league';
import { winProb } from './projections';

/** Games the team with home court plays at home in a 2-2-1-1-1 best-of-seven. */
const HOME_GAMES = [true, true, false, false, true, false, true];

/**
 * Chance team A wins a best-of-seven from `winsA`-`winsB`, given the two Elo
 * ratings and whether A has home court.
 */
export function seriesProb(ra: number, rb: number, aHomeCourt: boolean, winsA = 0, winsB = 0): number {
  const pHome = winProb(ra, rb); // A at home
  const pAway = 1 - winProb(rb, ra); // A on the road
  const memo = new Map<string, number>();
  const go = (a: number, b: number): number => {
    if (a === 4) return 1;
    if (b === 4) return 0;
    const key = `${a}-${b}`;
    const hit = memo.get(key);
    if (hit != null) return hit;
    const aHome = HOME_GAMES[a + b] === aHomeCourt;
    const p = aHome ? pHome : pAway;
    const v = p * go(a + 1, b) + (1 - p) * go(a, b + 1);
    memo.set(key, v);
    return v;
  };
  return go(winsA, winsB);
}

/** Team 0's series odds before game 1 and after each game played (using ratings as they were at the time). */
export function oddsPath(s: Series, ratingAt: (teamId: string, t: number) => number): number[] {
  const finals = s.games.filter((g) => g.state === 'post');
  const homeCourt0 = s.games[0] ? s.games[0].home.team.id === s.teams[0].id : (s.seeds[0] ?? 99) <= (s.seeds[1] ?? 99);
  const out: number[] = [];
  let w0 = 0;
  let w1 = 0;
  for (let k = 0; k <= finals.length; k++) {
    if (k > 0) {
      const g = finals[k - 1];
      const homeWon = (g.home.score ?? 0) > (g.away.score ?? 0);
      const t0Won = (g.home.team.id === s.teams[0].id) === homeWon;
      if (t0Won) w0++;
      else w1++;
    }
    const t = k === 0 ? Date.parse(s.games[0]?.date ?? '') - 1 : Date.parse(finals[k - 1].date);
    out.push(seriesProb(ratingAt(s.teams[0].id, t), ratingAt(s.teams[1].id, t), homeCourt0, w0, w1));
  }
  return out;
}

export interface Matchup {
  conference: string;
  seeds: [number, number];
  teams: [Conference['rows'][number]['team'], Conference['rows'][number]['team']];
}

/** First-round pairings if the season ended today (seeds 7 and 8 would come out of the play-in). */
export function projectedFirstRound(confs: Conference[]): Matchup[] {
  return confs.flatMap((c) => {
    const rows = [...c.rows].sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99));
    if (rows.length < 8) return [];
    return ([[1, 8], [4, 5], [3, 6], [2, 7]] as const).map(([a, b]) => ({ conference: c.name, seeds: [a, b] as [number, number], teams: [rows[a - 1].team, rows[b - 1].team] as Matchup['teams'] }));
  });
}

export interface SeriesLeader {
  id: string;
  teamId: string;
  games: number;
  pts: number;
  reb: number;
  ast: number;
}

/** Per-player averages over a series' games, from the per-game lines. */
export function seriesLeaders(gameIds: string[], lines: SeasonLines): SeriesLeader[] {
  const want = new Set(gameIds);
  const by = new Map<string, SeriesLeader>();
  for (const [gid, , , homeId, awayId, , gl] of lines.games) {
    if (!want.has(gid)) continue;
    for (const l of gl) {
      if (l[L.min] <= 0) continue;
      const id = lines.ids[l[L.p]];
      const r = by.get(id) ?? { id, teamId: l[L.home] ? homeId : awayId, games: 0, pts: 0, reb: 0, ast: 0 };
      r.games++;
      r.pts += l[L.pts];
      r.reb += l[L.oreb] + l[L.dreb];
      r.ast += l[L.ast];
      by.set(id, r);
    }
  }
  return [...by.values()].map((r) => ({ ...r, pts: r.pts / r.games, reb: r.reb / r.games, ast: r.ast / r.games })).sort((a, b) => b.pts - a.pts);
}

export interface BracketPicks {
  series: Record<string, string>;
  champion?: string;
}

/** Points for a correct pick: 1 in the first round, doubling each round; 10 for the champion. */
export const roundPoints = (round: number) => 2 ** (round - 1);

export function scoreBracket(picks: BracketPicks, series: Series[]): { points: number; right: number; decided: number } {
  let points = 0;
  let right = 0;
  let decided = 0;
  for (const s of series) {
    const pick = picks.series[s.key];
    if (!pick || !s.winner) continue;
    decided++;
    if (pick === s.winner.id) {
      right++;
      points += roundPoints(s.round);
    }
  }
  const finals = series.find((s) => s.round === 4);
  if (picks.champion && finals?.winner) {
    decided++;
    if (finals.winner.id === picks.champion) {
      right++;
      points += 10;
    }
  }
  return { points, right, decided };
}

/** The bracket challenge picks for a season, kept in localStorage. */
export function useBracket(season: number): [BracketPicks, (next: BracketPicks) => void] {
  const key = `nba-bracket-${season}`;
  const [picks, setPicks] = useState<BracketPicks>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? '') as BracketPicks;
    } catch {
      return { series: {} };
    }
  });
  const save = useCallback(
    (next: BracketPicks) => {
      setPicks(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* storage blocked: picks last for this visit */
      }
    },
    [key],
  );
  return [picks, save];
}

export interface PlayInOdds {
  teamId: string;
  seed: number;
  /** Chance of finishing as the 7th seed, the 8th seed, or out. */
  seventh: number;
  eighth: number;
  out: number;
}

/**
 * The play-in for one conference from Elo ratings: 7 hosts 8 (winner is the
 * 7th seed), 9 hosts 10 (loser is out), then the 7-v-8 loser hosts the 9-v-10
 * winner for the 8th seed. `ids` are the 7th to 10th seeds in order.
 */
export function playIn(ids: [string, string, string, string], rating: (id: string) => number): PlayInOdds[] {
  const [s7, s8, s9, s10] = ids;
  const p = (home: string, away: string) => winProb(rating(home), rating(away));
  const out = new Map(ids.map((id, i) => [id, { teamId: id, seed: i + 7, seventh: 0, eighth: 0, out: 0 }]));
  const pA = p(s7, s8);
  const pB = p(s9, s10);
  for (const [winA, loseA, wA] of [[s7, s8, pA], [s8, s7, 1 - pA]] as const) {
    out.get(winA)!.seventh += wA;
    for (const [winB, loseB, wB] of [[s9, s10, pB], [s10, s9, 1 - pB]] as const) {
      out.get(loseB)!.out += wA * wB;
      const pC = p(loseA, winB);
      out.get(loseA)!.eighth += wA * wB * pC;
      out.get(winB)!.out += wA * wB * pC;
      out.get(winB)!.eighth += wA * wB * (1 - pC);
      out.get(loseA)!.out += wA * wB * (1 - pC);
    }
  }
  return [...out.values()];
}
