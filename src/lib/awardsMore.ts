// The other award races: Sixth Man, Most Improved, Clutch Player and Coach of
// the Year. Same idea as the MVP model: simple, transparent scores from the box
// scores, clutch splits and team records, with the "why" shown.
import type { Game } from '../api/types';
import { C, type ClutchPlayerRow, type ClutchTeamRow } from './clutch';
import { countsInStandings, isFinal } from './league';
import { carryOver, runElo, winProb } from './projections';
import type { Candidate, Ranked } from './awards';

export type MoreAwardId = 'sixth' | 'mip' | 'clutch' | 'coy';

export const MORE_AWARDS: { id: MoreAwardId; name: string; short: string }[] = [
  { id: 'sixth', name: 'Sixth Man', short: '6MOY' },
  { id: 'mip', name: 'Most Improved', short: 'MIP' },
  { id: 'clutch', name: 'Clutch Player', short: 'Clutch' },
  { id: 'coy', name: 'Coach of the Year', short: 'COY' },
];

export const MORE_METHOD: Record<MoreAwardId, string> = {
  sixth: 'Players who have come off the bench in more games than they started. Game Score per game, scaled down for missed games, plus minutes (× 0.1) and plus-minus per game (× 0.15). Needs 15+ minutes a game.',
  mip: 'Change from last season in Game Score per game (× 1.5), minutes (× 0.15) and points per game (× 0.3), for players who also played last season (at least 20 games and 10 minutes then). Needs 20+ minutes a game this season and to have played half the team’s games.',
  clutch: 'Last five minutes of the fourth quarter or overtime, score within five. Clutch points, plus points above what an average shooter scores on the same shots (× 1.5), plus the team’s clutch record (wins − losses, × 0.5). Needs 5+ clutch games.',
  coy: 'Wins above what the team’s rating going into the season predicted for the games played (last season’s Elo, pulled a quarter back to average), plus the change in win % from last season (× 25), plus a little for the record itself (× 10 above .500).',
};

const availability = (c: Candidate, share: number) => Math.min(1, c.gp / Math.max(1, share * c.teamGames));
const sum = (parts: { value: number }[]) => parts.reduce((n, p) => n + p.value, 0);
const sorted = (xs: Ranked[]) => xs.sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score);

export function rankSixthMan(list: Candidate[]): Ranked[] {
  return sorted(
    list
      .filter((c) => c.gs * 2 < c.gp && c.mpg >= 15)
      .map((c) => {
        const parts = [
          { label: 'production', value: c.gmsc * availability(c, 0.8) },
          { label: 'minutes', value: 0.1 * c.mpg },
          { label: 'plus-minus', value: 0.15 * c.pm },
        ];
        return { c, parts, score: sum(parts), eligible: true };
      }),
  );
}

export function rankMostImproved(list: Candidate[], prev: Candidate[]): (Ranked & { before: Candidate })[] {
  const last = new Map(prev.map((c) => [c.id, c]));
  const out: (Ranked & { before: Candidate })[] = [];
  for (const c of list) {
    const b = last.get(c.id);
    if (!b || b.gp < 20 || b.mpg < 10 || c.mpg < 20) continue;
    const parts = [
      { label: 'Game Score', value: 1.5 * (c.gmsc - b.gmsc) },
      { label: 'minutes', value: 0.15 * (c.mpg - b.mpg) },
      { label: 'points', value: 0.3 * (c.ppg - b.ppg) },
    ];
    out.push({ c, before: b, parts, score: sum(parts), eligible: c.gp * 2 >= c.teamGames });
  }
  return sorted(out) as (Ranked & { before: Candidate })[];
}

export interface ClutchRanked extends Ranked {
  row: ClutchPlayerRow;
  team?: ClutchTeamRow;
}

/** League points per true-shooting attempt in clutch time. */
const tsa = (r: ClutchPlayerRow) => r[C.fga] + 0.44 * r[C.fta];

export function rankClutch(list: Candidate[], players: ClutchPlayerRow[], teams: ClutchTeamRow[]): ClutchRanked[] {
  const byId = new Map(list.map((c) => [c.id, c]));
  const teamRow = new Map(teams.map((t) => [t[0], t]));
  const lp = players.reduce((a, r) => a + r[C.pts], 0);
  const la = players.reduce((a, r) => a + tsa(r), 0);
  const perShot = la ? lp / la : 1;
  const out: ClutchRanked[] = [];
  for (const r of players) {
    const c = byId.get(r[0]);
    if (!c || r[C.games] < 5) continue;
    const t = teamRow.get(r[1]);
    const parts = [
      { label: 'clutch points', value: r[C.pts] },
      { label: 'efficiency', value: 1.5 * (r[C.pts] - perShot * tsa(r)) },
      { label: 'team clutch record', value: t ? 0.5 * (t[2] - t[3]) : 0 },
    ];
    out.push({ c, row: r, team: t, parts, score: sum(parts), eligible: true });
  }
  return sorted(out) as ClutchRanked[];
}

export interface CoachRanked {
  teamId: string;
  wins: number;
  losses: number;
  expected: number;
  prevPct?: number;
  parts: { label: string; value: number }[];
  score: number;
}

/** Wins each team has against what its preseason rating predicted for the games it has played. */
export function expectedWins(games: Game[], prevGames: Game[] | undefined): Map<string, number> {
  const start = prevGames ? carryOver(runElo(prevGames).ratings) : new Map<string, number>();
  const out = new Map<string, number>();
  for (const g of games) {
    if (!isFinal(g) || !g.home || !g.away || !countsInStandings(g)) continue;
    const p = winProb(start.get(g.home.team.id) ?? 1505, start.get(g.away.team.id) ?? 1505);
    out.set(g.home.team.id, (out.get(g.home.team.id) ?? 0) + p);
    out.set(g.away.team.id, (out.get(g.away.team.id) ?? 0) + 1 - p);
  }
  return out;
}

const records = (games: Game[]) => {
  const r = new Map<string, [number, number]>();
  for (const g of games) {
    if (!isFinal(g) || g.home.score == null || g.away.score == null || !countsInStandings(g)) continue;
    for (const [t, won] of [[g.home.team.id, g.home.score > g.away.score], [g.away.team.id, g.away.score > g.home.score]] as const) {
      const x = r.get(t) ?? [0, 0];
      x[won ? 0 : 1]++;
      r.set(t, x);
    }
  }
  return r;
};

export function rankCoaches(games: Game[], prevGames: Game[] | undefined): CoachRanked[] {
  const exp = expectedWins(games, prevGames);
  const now = records(games);
  const before = prevGames ? records(prevGames) : new Map<string, [number, number]>();
  return [...now]
    .map(([teamId, [wins, losses]]) => {
      const n = wins + losses;
      const pct = n ? wins / n : 0.5;
      const b = before.get(teamId);
      const prevPct = b && b[0] + b[1] ? b[0] / (b[0] + b[1]) : undefined;
      const parts = [
        { label: 'wins above preseason', value: wins - (exp.get(teamId) ?? n / 2) },
        { label: 'change from last season', value: prevPct === undefined ? 0 : 25 * (pct - prevPct) },
        { label: 'record', value: 10 * (pct - 0.5) },
      ];
      return { teamId, wins, losses, expected: exp.get(teamId) ?? n / 2, prevPct, parts, score: sum(parts) };
    })
    .sort((a, b) => b.score - a.score);
}
