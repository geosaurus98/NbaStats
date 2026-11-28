// Perfect Season: draft a starting five, one player from each randomly dealt
// team-season, and see whether they can go 82-0. Ratings come from each
// player's box-score line in that season (careers.json); the season is
// simulated game by game against opponents of varying strength.
import { COL, type CareerData, type SeasonRow } from './careers';
import type { Graph } from './teammates';

export const SLOTS = ['PG', 'SG', 'SF', 'PF', 'C'] as const;
export type Slot = (typeof SLOTS)[number];
/** Steals and blocks are recorded from 1973-74, so the all-time deck starts there. */
export const FIRST_SEASON = 1974;

export interface Card {
  player: number;
  season: number;
  team: string;
  pos: string;
  g: number;
  mpg: number;
  ppg: number;
  rpg: number;
  apg: number;
  /** Production per 36 minutes (Game Score without turnovers, which aren't in the history data, estimated instead). */
  gs36: number;
  /** Shots per 36 (FGA + 0.44 FTA) and rebounds per 36, for the team-fit checks. */
  shots36: number;
  reb36: number;
}

/** One season's line for a player as a card (NBA only, 20+ games, 10+ minutes). */
export function card(rows: SeasonRow[], player: number, season: number, team: string, pos: string): Card | undefined {
  const r = rows.find((x) => x[COL.season] === season && x[COL.lg] === 0);
  if (!r || r[COL.g] < 20 || r[COL.mp] / r[COL.g] < 10) return undefined;
  const per36 = (v: number) => (v / r[COL.mp]) * 36;
  const v = (k: keyof typeof COL) => Math.max(0, r[COL[k]]);
  const fga = per36(v('fga'));
  const fta = per36(v('fta'));
  const ast = per36(v('ast'));
  // Steals and blocks before 1973-74 aren't recorded: assume a typical rate.
  const stl = r[COL.stl] < 0 ? 1.1 : per36(r[COL.stl]);
  const blk = r[COL.blk] < 0 ? 0.6 : per36(r[COL.blk]);
  const tov = 0.1 * (fga + 0.44 * fta) + 0.15 * ast;
  const trb = per36(v('trb'));
  const gs36 = per36(v('pts')) + 0.4 * per36(v('fg')) - 0.7 * fga - 0.4 * (fta - per36(v('ft'))) + 0.4 * trb + stl + 0.7 * ast + 0.7 * blk - tov;
  return { player, season, team, pos, g: r[COL.g], mpg: r[COL.mp] / r[COL.g], ppg: v('pts') / r[COL.g], rpg: v('trb') / r[COL.g], apg: v('ast') / r[COL.g], gs36, shots36: fga + 0.44 * fta, reb36: trb };
}

/** A team-season to pick from: its playable cards, best first. */
export interface Deal {
  season: number;
  team: string;
  cards: Card[];
}

/** Every NBA team-season from `from` on with at least five playable cards. */
export function deck(graph: Graph, careers: CareerData, from: number): Deal[] {
  const out: Deal[] = [];
  for (const [season, league, team, ids] of graph.data.rosters) {
    if (league !== 'NBA' || season < from) continue;
    const cards = ids.map((p) => card(careers.seasons[p] ?? [], p, season, team, careers.pos?.[p] ?? '')).filter((c): c is Card => !!c);
    if (cards.length >= 5) out.push({ season, team, cards: cards.sort((a, b) => b.mpg - a.mpg) });
  }
  return out;
}

const ORDER: Record<string, number> = { PG: 0, G: 0.5, SG: 1, SF: 2, F: 2.5, PF: 3, C: 4 };
/** How far a player is from the slot (0 = natural fit). */
export const distance = (pos: string, slot: Slot) => (pos in ORDER ? Math.abs(ORDER[pos] - SLOTS.indexOf(slot)) : 1);

export interface Rating {
  net: number;
  parts: { label: string; value: number }[];
}

/** Points per 100 possessions better than an average team. */
export function rate(team: Partial<Record<Slot, Card>>): Rating {
  const cards = SLOTS.map((s) => team[s]).filter((c): c is Card => !!c);
  const talent = cards.reduce((a, c) => a + (c.gs36 - 12) * 0.38 * Math.min(1, c.mpg / 34), 0);
  const fit = -1.5 * SLOTS.filter((s) => team[s] && distance(team[s]!.pos, s) >= 2).length;
  const shots = cards.reduce((a, c) => a + c.shots36, 0);
  const oneBall = -0.15 * Math.max(0, shots - 90);
  const boards = cards.reduce((a, c) => a + c.reb36, 0);
  const glass = -0.2 * Math.max(0, 32 - boards);
  return {
    net: talent + fit + oneBall + glass,
    parts: [
      { label: 'Talent', value: talent },
      { label: 'Out of position', value: fit },
      { label: 'Too many shots', value: oneBall },
      { label: 'Rebounding', value: glass },
    ],
  };
}

/** Chance of beating an opponent of strength `opp` (net rating), at home or away. */
export const winChance = (net: number, opp: number, home: boolean) => 1 / (1 + Math.exp(-(net - opp + (home ? 1.5 : -1.5)) / 5.5));

export interface SeasonResult {
  wins: number;
  losses: number;
  /** Expected wins before the dice: the sum of each game's chance. */
  expected: number;
  /** W/L for each game in order. */
  games: boolean[];
  longestStreak: number;
}

/** Plays 82 games against opponents drawn around league average, with a seeded random generator. */
export function playSeason(net: number, rand: () => number): SeasonResult {
  const normal = () => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
  const games: boolean[] = [];
  let expected = 0;
  for (let i = 0; i < 82; i++) {
    const p = winChance(net, 3.5 * normal(), i % 2 === 0);
    expected += p;
    games.push(rand() < p);
  }
  let streak = 0;
  let longest = 0;
  for (const w of games) {
    streak = w ? streak + 1 : 0;
    longest = Math.max(longest, streak);
  }
  const wins = games.filter(Boolean).length;
  return { wins, losses: 82 - wins, expected, games, longestStreak: longest };
}
