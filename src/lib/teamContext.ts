// Shared bits for team-focused pages (game previews, the team hub): current
// Elo ratings, recent form, head-to-head and team leaders.
import { fetchLeagueGames, seasonSnapshot } from '../api/espn';
import type { Game } from '../api/types';
import { P } from './boxTotals';
import { countsInStandings, isFinal } from './league';
import { carryOver, runElo, winProb } from './projections';
import { SEASONS } from './seasons';

/** Roughly how many Elo points one point of margin is worth (FiveThirtyEight). */
const ELO_PER_POINT = 28;
const HOME_ELO = 100;

const eloCache = new Map<number, Promise<Map<string, number>>>();

/** Each team's current Elo, with last season carried over at 75%. */
export function seasonElo(season: number): Promise<Map<string, number>> {
  if (!eloCache.has(season)) {
    eloCache.set(
      season,
      (async () => {
        const { games } = await fetchLeagueGames(season, 2);
        let start = new Map<string, number>();
        if (SEASONS.some((s) => s.year === season - 1)) {
          const prev = await fetchLeagueGames(season - 1, 2).catch(() => undefined);
          if (prev) start = carryOver(runElo(prev.games).ratings);
        }
        return runElo(games, start).ratings;
      })(),
    );
  }
  return eloCache.get(season)!;
}

export interface Prediction {
  homeWin: number;
  /** Expected home margin in points (negative = away favoured). */
  margin: number;
}

export function predict(ratings: Map<string, number>, homeId: string, awayId: string): Prediction {
  const h = ratings.get(homeId) ?? 1505;
  const a = ratings.get(awayId) ?? 1505;
  return { homeWin: winProb(h, a), margin: (h + HOME_ELO - a) / ELO_PER_POINT };
}

const played = (games: Game[]) => games.filter((g) => isFinal(g) && countsInStandings(g) && !(g.home.score === 0 && g.away.score === 0));

/** A team's finished games, oldest first. */
export function teamGames(games: Game[], teamId: string): Game[] {
  return played(games)
    .filter((g) => g.home.team.id === teamId || g.away.team.id === teamId)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface Result {
  game: Game;
  won: boolean;
  us: number;
  them: number;
  oppId: string;
  home: boolean;
}

export function results(games: Game[], teamId: string): Result[] {
  return teamGames(games, teamId).map((g) => {
    const home = g.home.team.id === teamId;
    const us = (home ? g.home.score : g.away.score) ?? 0;
    const them = (home ? g.away.score : g.home.score) ?? 0;
    return { game: g, won: us > them, us, them, oppId: home ? g.away.team.id : g.home.team.id, home };
  });
}

/** This season's meetings between two teams, oldest first. */
export function headToHead(games: Game[], a: string, b: string): Game[] {
  return teamGames(games, a).filter((g) => g.home.team.id === b || g.away.team.id === b);
}

export interface TeamLeader {
  id: string;
  name: string;
  gp: number;
  ppg: number;
  rpg: number;
  apg: number;
}

/** A team's players by points per game this season (from the daily box-score totals). */
export function teamLeaders(season: number, teamId: string, top = 5): TeamLeader[] {
  const snap = seasonSnapshot(season);
  const rows = snap?.box?.['2']?.players.filter((r) => r[1] === teamId && (r[P.gp] as number) > 0) ?? [];
  return rows
    .map((r) => {
      const g = r[P.gp] as number;
      const v = (k: keyof typeof P) => (r[P[k]] as number) / g;
      return { id: r[0], name: snap?.players?.[r[0]] ?? r[0], gp: g, ppg: v('pts'), rpg: v('oreb') + v('dreb'), apg: v('ast') };
    })
    .sort((a, b) => b.ppg * Math.min(1, b.gp / 3) - a.ppg * Math.min(1, a.gp / 3))
    .slice(0, top);
}
