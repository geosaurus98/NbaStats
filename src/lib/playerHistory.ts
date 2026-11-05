// A player's record against each opponent, games missed by season, and the
// contract-year watch.
import { L, P, type PlayerTotalsRow, type SeasonLines } from './boxTotals';
import type { PayrollPlayer } from './brefContracts';

export interface VsTeam {
  teamId: string;
  games: number;
  wins: number;
  pts: number;
  reb: number;
  ast: number;
  /** True shooting over those games. */
  ts: number;
  best: { gameId: string; date: string; pts: number };
}

/** A player's regular-season and playoff games against each opponent, over the given seasons. */
export function vsTeams(seasons: SeasonLines[], playerId: string): VsTeam[] {
  const by = new Map<string, VsTeam & { fga: number; fta: number }>();
  for (const lines of seasons) {
    const p = lines.ids.indexOf(playerId);
    if (p < 0) continue;
    for (const g of lines.games) {
      const l = g[6].find((x) => x[L.p] === p && x[L.min] > 0);
      if (!l) continue;
      const home = !!l[L.home];
      const opp = home ? g[4] : g[3];
      let us = 0;
      let them = 0;
      for (const x of g[6]) (!!x[L.home] === home ? (us += x[L.pts]) : (them += x[L.pts]));
      const r = by.get(opp) ?? { teamId: opp, games: 0, wins: 0, pts: 0, reb: 0, ast: 0, ts: 0, fga: 0, fta: 0, best: { gameId: g[0], date: g[1], pts: -1 } };
      r.games++;
      if (us > them) r.wins++;
      r.pts += l[L.pts];
      r.reb += l[L.oreb] + l[L.dreb];
      r.ast += l[L.ast];
      r.fga += l[L.fga];
      r.fta += l[L.fta];
      if (l[L.pts] > r.best.pts) r.best = { gameId: g[0], date: g[1], pts: l[L.pts] };
      by.set(opp, r);
    }
  }
  return [...by.values()]
    .map(({ fga, fta, ...r }) => ({ ...r, ts: fga + fta ? r.pts / (2 * (fga + 0.44 * fta)) : 0 }))
    .sort((a, b) => b.games - a.games || b.pts / b.games - a.pts / a.games);
}

export interface Availability {
  season: number;
  teamId: string;
  teamGames: number;
  played: number;
  missed: number;
  /** Longest run of team games missed in a row, with its first and last game dates. */
  longest: { games: number; from: string; to: string } | undefined;
}

/**
 * Games missed each season, per team: from the player's first game for the
 * team to its last game of the regular season (or to their last game for it,
 * if they have since played for another team). `skip` leaves out games that
 * don't count in the standings (the NBA Cup final).
 */
export function availability(lines: SeasonLines, playerId: string, skip: Set<string> = new Set()): Availability[] {
  const p = lines.ids.indexOf(playerId);
  if (p < 0) return [];
  const games = lines.games.filter((g) => g[2] === 2 && !skip.has(g[0])).sort((a, b) => a[1].localeCompare(b[1]));
  // The team in each game the player played.
  const stints: { team: string; i: number }[] = [];
  games.forEach((g, i) => {
    const l = g[6].find((x) => x[L.p] === p && x[L.min] > 0);
    if (l) stints.push({ team: l[L.home] ? g[3] : g[4], i });
  });
  const out: Availability[] = [];
  for (const team of [...new Set(stints.map((s) => s.team))]) {
    const mine = stints.filter((s) => s.team === team);
    const last = stints[stints.length - 1].team === team;
    const tg = games.map((g, i) => ({ g, i })).filter(({ g }) => g[3] === team || g[4] === team);
    const startAt = tg.findIndex(({ i }) => i === mine[0].i);
    const endAt = last ? tg.length - 1 : tg.findIndex(({ i }) => i === mine[mine.length - 1].i);
    const played = new Set(mine.map((s) => s.i));
    let run = 0;
    let runFrom = '';
    let longest: Availability['longest'];
    let missed = 0;
    for (let k = startAt; k <= endAt; k++) {
      const { g, i } = tg[k];
      if (played.has(i)) {
        run = 0;
        continue;
      }
      missed++;
      if (run === 0) runFrom = g[1];
      run++;
      if (!longest || run > longest.games) longest = { games: run, from: runFrom, to: g[1] };
    }
    out.push({ season: lines.year, teamId: team, teamGames: endAt - startAt + 1, played: mine.length, missed, longest });
  }
  return out;
}

export interface ContractYear {
  espn: string;
  name: string;
  teamId: string;
  salary: number;
  /** What happens next season: free agent, player option, team option… */
  next: 'free agent' | 'player option' | 'team option' | 'non-guaranteed' | 'early termination';
  now?: { g: number; ppg: number; mpg: number; gmsc: number };
  before?: { g: number; ppg: number; mpg: number; gmsc: number };
}

const line = (r: PlayerTotalsRow | undefined) => {
  if (!r) return undefined;
  const v = (k: keyof typeof P) => r[P[k]] as number;
  const g = v('gp');
  if (!g) return undefined;
  const gmsc = v('pts') + 0.4 * v('fgm') - 0.7 * v('fga') - 0.4 * (v('fta') - v('ftm')) + 0.7 * v('oreb') + 0.3 * v('dreb') + v('stl') + 0.7 * v('ast') + 0.7 * v('blk') - 0.4 * v('pf') - v('tov');
  return { g, ppg: v('pts') / g, mpg: v('min') / g, gmsc: gmsc / g };
};

/** Players whose deal ends after this season, or whose next season is an option. */
export function contractYears(payroll: Record<string, PayrollPlayer[]>, now: PlayerTotalsRow[], prev: PlayerTotalsRow[] | undefined): ContractYear[] {
  const byNow = new Map(now.map((r) => [r[0], r]));
  const byPrev = new Map((prev ?? []).map((r) => [r[0], r]));
  const out: ContractYear[] = [];
  for (const [teamId, players] of Object.entries(payroll)) {
    for (const p of players) {
      if (!p.espn || !p.salaries[0]) continue;
      const flag = p.flags[1];
      const next: ContractYear['next'] | undefined = !p.salaries[1] ? 'free agent' : flag === 'player-option' ? 'player option' : flag === 'team-option' ? 'team option' : flag === 'non-guaranteed' ? 'non-guaranteed' : flag === 'early-termination' ? 'early termination' : undefined;
      if (!next) continue;
      out.push({ espn: p.espn, name: p.name, teamId, salary: p.salaries[0], next, now: line(byNow.get(p.espn)), before: line(byPrev.get(p.espn)) });
    }
  }
  return out.sort((a, b) => b.salary - a.salary);
}
