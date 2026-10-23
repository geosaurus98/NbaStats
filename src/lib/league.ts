// Pure calculations over a season's games: team records, strength of schedule,
// standings race and the playoff bracket.
import type { Competitor, Game, TeamRef } from '../api/types';

export function isFinal(g: Game): boolean {
  return g.state === 'post' && g.home.score != null && g.away.score != null;
}

/** The NBA Cup Championship is a real game but doesn't count in the standings. */
export function countsInStandings(g: Game): boolean {
  return !/cup championship/i.test(g.note ?? '');
}

/**
 * Newer results laid over a saved schedule: games with the same id take the
 * newer score and state. Unknown ids (preseason, other competitions) are ignored.
 */
export function mergeResults(base: Game[], updates: Game[]): Game[] {
  const byId = new Map(updates.map((g) => [g.id, g]));
  return base.map((g) => {
    const u = byId.get(g.id);
    return u ? { ...g, ...u, note: u.note ?? g.note } : g;
  });
}

/** The given team's side and its opponent's side of a game. */
export function sides(g: Game, teamId: string): [Competitor, Competitor] {
  return g.home.team.id === teamId ? [g.home, g.away] : [g.away, g.home];
}

export function won(g: Game, teamId: string): boolean {
  const [us, them] = sides(g, teamId);
  return us.winner ?? (us.score ?? 0) > (them.score ?? 0);
}

export function involves(g: Game, teamId: string): boolean {
  return g.home.team.id === teamId || g.away.team.id === teamId;
}

export interface TeamRecord {
  team: TeamRef;
  gp: number;
  wins: number;
  losses: number;
  pf: number;
  pa: number;
  homeW: number;
  homeL: number;
  roadW: number;
  roadL: number;
  closeW: number;
  closeL: number;
  last10: string;
  longestWin: number;
  sosPlayed?: number;
  sosRemaining?: number;
  remaining: number;
}

const CLOSE_MARGIN = 5;

export function teamRecords(teams: TeamRef[], allGames: Game[]): TeamRecord[] {
  const games = allGames.filter(countsInStandings);
  const finals = games.filter(isFinal);
  return teams.map((team) => {
    const mine = finals.filter((g) => involves(g, team.id));
    const r: TeamRecord = {
      team,
      gp: mine.length,
      wins: 0,
      losses: 0,
      pf: 0,
      pa: 0,
      homeW: 0,
      homeL: 0,
      roadW: 0,
      roadL: 0,
      closeW: 0,
      closeL: 0,
      last10: '-',
      longestWin: 0,
      remaining: games.filter((g) => !isFinal(g) && involves(g, team.id)).length,
    };
    let run = 0;
    for (const g of mine) {
      const [us, them] = sides(g, team.id);
      const w = won(g, team.id);
      const home = us.homeAway === 'home';
      const close = Math.abs((us.score ?? 0) - (them.score ?? 0)) <= CLOSE_MARGIN;
      r.pf += us.score ?? 0;
      r.pa += them.score ?? 0;
      if (w) {
        r.wins++;
        if (home) r.homeW++;
        else r.roadW++;
        if (close) r.closeW++;
        run++;
        r.longestWin = Math.max(r.longestWin, run);
      } else {
        r.losses++;
        if (home) r.homeL++;
        else r.roadL++;
        if (close) r.closeL++;
        run = 0;
      }
    }
    const recent = mine.slice(-10);
    if (recent.length) {
      const w = recent.filter((g) => won(g, team.id)).length;
      r.last10 = `${w}-${recent.length - w}`;
    }
    return r;
  });
}

/**
 * Strength of schedule: the average win % of opponents, for games already
 * played and for games still to come. Uses each opponent's current win %.
 */
export function addStrengthOfSchedule(records: TeamRecord[], games: Game[]): TeamRecord[] {
  const pct = new Map(records.map((r) => [r.team.id, r.gp ? r.wins / r.gp : 0]));
  return records.map((r) => {
    const played: number[] = [];
    const remaining: number[] = [];
    for (const g of games) {
      if (!involves(g, r.team.id)) continue;
      const opp = sides(g, r.team.id)[1].team.id;
      (isFinal(g) ? played : remaining).push(pct.get(opp) ?? 0);
    }
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);
    return { ...r, sosPlayed: avg(played), sosRemaining: avg(remaining) };
  });
}

/** Games above .500 after each game played (index 0 = after game 1). */
export function raceSeries(games: Game[], teamId: string): number[] {
  const out: number[] = [];
  let net = 0;
  for (const g of games) {
    if (!isFinal(g) || !involves(g, teamId) || !countsInStandings(g)) continue;
    net += won(g, teamId) ? 1 : -1;
    out.push(net);
  }
  return out;
}

export interface Series {
  key: string;
  round: number; // 1-3 conference rounds, 4 = Finals
  conference?: string;
  teams: [TeamRef, TeamRef];
  wins: [number, number];
  seeds: [number | undefined, number | undefined];
  games: Game[];
  winner?: TeamRef;
}

const WINS_NEEDED = 4;

/**
 * Groups playoff games into series. A team's Nth series is round N; a series
 * between conferences is the Finals. `seeds`/`conferences` come from standings.
 */
export function buildBracket(
  playoffGames: Game[],
  seeds: Map<string, number>,
  conferences: Map<string, string>,
): Series[] {
  const games = playoffGames
    .filter((g) => !/play-?in/i.test(g.note ?? ''))
    .sort((a, b) => a.date.localeCompare(b.date));
  const byKey = new Map<string, Series>();
  for (const g of games) {
    const [a, b] = [g.home.team, g.away.team].sort((x, y) => x.id.localeCompare(y.id));
    const key = `${a.id}-${b.id}`;
    let s = byKey.get(key);
    if (!s) {
      s = { key, round: 0, teams: [a, b], wins: [0, 0], seeds: [seeds.get(a.id), seeds.get(b.id)], games: [] };
      byKey.set(key, s);
    }
    s.games.push(g);
    if (isFinal(g)) s.wins[won(g, a.id) ? 0 : 1]++;
  }

  const all = [...byKey.values()];
  const seriesOf = new Map<string, Series[]>();
  for (const s of all) {
    for (const t of s.teams) seriesOf.set(t.id, [...(seriesOf.get(t.id) ?? []), s]);
  }
  for (const s of all) {
    const confA = conferences.get(s.teams[0].id);
    const confB = conferences.get(s.teams[1].id);
    if (confA && confB && confA !== confB) {
      s.round = 4;
    } else {
      s.round = Math.max(...s.teams.map((t) => (seriesOf.get(t.id) ?? []).indexOf(s) + 1));
      s.conference = confA ?? confB;
    }
    if (s.wins[0] >= WINS_NEEDED) s.winner = s.teams[0];
    else if (s.wins[1] >= WINS_NEEDED) s.winner = s.teams[1];
  }
  return orderBracket(all);
}

// Standard bracket order for the first round, by the higher seed in each tie.
const R1_ORDER = [1, 4, 3, 2];

function orderBracket(all: Series[]): Series[] {
  const slot = new Map<string, number>();
  const minSeed = (s: Series) => Math.min(...s.seeds.map((x) => x ?? 99));
  for (const s of all.filter((x) => x.round === 1)) {
    const i = R1_ORDER.indexOf(minSeed(s));
    const pos = i >= 0 ? i : 9;
    for (const t of s.teams) slot.set(t.id, pos);
  }
  const pos = (s: Series) => Math.min(...s.teams.map((t) => slot.get(t.id) ?? 9));
  return all.sort((a, b) => a.round - b.round || (a.conference ?? '').localeCompare(b.conference ?? '') || pos(a) - pos(b));
}
