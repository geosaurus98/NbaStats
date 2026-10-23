// Standings "what if": apply picked winners to unplayed games and re-rank.
import type { Game } from '../api/types';
import { isFinal, teamRecords, type TeamRecord } from './league';

/** gameId → picked winner's team id. */
export type Picks = Record<string, string>;

/** The schedule with each picked game turned into a 1-0 final for its winner. */
export function applyPicks(games: Game[], picks: Picks): Game[] {
  return games.map((g) => {
    const w = picks[g.id];
    if (!w || isFinal(g) || (w !== g.home.team.id && w !== g.away.team.id)) return g;
    const homeWon = w === g.home.team.id;
    return {
      ...g,
      state: 'post',
      statusDetail: 'Picked',
      home: { ...g.home, score: homeWon ? 1 : 0, winner: homeWon },
      away: { ...g.away, score: homeWon ? 0 : 1, winner: !homeWon },
    };
  });
}

export type Zone = 'playoffs' | 'playin' | 'lottery';

export interface Seeded {
  record: TeamRecord;
  seed: number;
  zone: Zone;
}

/** Conference standings by win %, best first; 1-6 playoffs, 7-10 play-in, the rest lottery. */
export function seedConferences(records: TeamRecord[], conferences: Map<string, string>): Map<string, Seeded[]> {
  const out = new Map<string, Seeded[]>();
  const pct = (r: TeamRecord) => (r.gp ? r.wins / r.gp : 0.5);
  for (const name of new Set(conferences.values())) {
    const rows = records
      .filter((r) => conferences.get(r.team.id) === name)
      .sort((a, b) => pct(b) - pct(a) || b.wins - a.wins || a.team.name.localeCompare(b.team.name))
      .map((record, i): Seeded => ({ record, seed: i + 1, zone: i < 6 ? 'playoffs' : i < 10 ? 'playin' : 'lottery' }));
    out.set(name, rows);
  }
  return out;
}

export function whatIfStandings(teams: Parameters<typeof teamRecords>[0], games: Game[], picks: Picks, conferences: Map<string, string>) {
  return seedConferences(teamRecords(teams, applyPicks(games, picks)), conferences);
}
