// The NBA Cup: group tables worked out from the group-play games (ESPN tags
// the games but not the groups, so each group is the five teams that played
// each other), the tiebreakers, the wildcards and the knockout rounds.
import type { CompactGame } from '../api/snapshot';

export interface CupRow {
  teamId: string;
  w: number;
  l: number;
  pf: number;
  pa: number;
  played: number;
}

export interface CupGroup {
  conference: string;
  /** 1-3 within the conference, ordered by the first team alphabetically by id (ESPN doesn't name the groups). */
  index: number;
  rows: CupRow[];
}

export interface CupKnockout {
  round: 'Quarterfinals' | 'Semifinals' | 'Championship';
  gameId: string;
  date: string;
  homeId: string;
  awayId: string;
  homeScore: number | null;
  awayScore: number | null;
}

export function cupGames(games: CompactGame[]): { group: CompactGame[]; knockout: CupKnockout[] } {
  const group = games.filter((g) => /NBA Cup - Group/i.test(g[6] ?? ''));
  const knockout = games.flatMap((g): CupKnockout[] => {
    const note = g[6] ?? '';
    const round = /Quarterfinal/i.test(note) ? 'Quarterfinals' : /Semifinal/i.test(note) ? 'Semifinals' : /NBA Cup Championship/i.test(note) ? 'Championship' : undefined;
    return round ? [{ round, gameId: g[0], date: g[1], homeId: g[2], awayId: g[3], homeScore: g[4], awayScore: g[5] }] : [];
  });
  return { group, knockout };
}

/**
 * Groups and tables. `conferenceOf` maps team ids to "East" / "West".
 * Order: win %, then head-to-head (two-way ties), point differential, points scored.
 */
export function cupGroups(group: CompactGame[], conferenceOf: Map<string, string>): CupGroup[] {
  // Teams linked by any group game (played or scheduled) form a group.
  const links = new Map<string, Set<string>>();
  for (const [, , h, a] of group) {
    links.set(h, (links.get(h) ?? new Set()).add(a));
    links.set(a, (links.get(a) ?? new Set()).add(h));
  }
  const seen = new Set<string>();
  const comps: string[][] = [];
  for (const t of links.keys()) {
    if (seen.has(t)) continue;
    const stack = [t];
    const comp: string[] = [];
    seen.add(t);
    while (stack.length) {
      const x = stack.pop()!;
      comp.push(x);
      for (const y of links.get(x) ?? []) if (!seen.has(y)) (seen.add(y), stack.push(y));
    }
    comps.push(comp.sort());
  }
  const out: CupGroup[] = [];
  for (const conf of ['East', 'West']) {
    comps
      .filter((c) => conferenceOf.get(c[0]) === conf)
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
      .forEach((teams, i) => out.push({ conference: conf, index: i + 1, rows: rankGroup(teams, group) }));
  }
  return out;
}

export function rankGroup(teams: string[], games: CompactGame[]): CupRow[] {
  const played = games.filter(([, , h, a, hs, as]) => teams.includes(h) && teams.includes(a) && hs != null && as != null);
  const rows = new Map(teams.map((t) => [t, { teamId: t, w: 0, l: 0, pf: 0, pa: 0, played: 0 }]));
  const beat = new Set<string>();
  for (const [, , h, a, hs, as] of played) {
    const H = rows.get(h)!;
    const A = rows.get(a)!;
    H.played++;
    A.played++;
    H.pf += hs!;
    H.pa += as!;
    A.pf += as!;
    A.pa += hs!;
    if (hs! > as!) (H.w++, A.l++, beat.add(`${h}>${a}`));
    else (A.w++, H.l++, beat.add(`${a}>${h}`));
  }
  const pct = (r: CupRow) => (r.played ? r.w / r.played : 0);
  return [...rows.values()].sort((x, y) => {
    if (pct(y) !== pct(x)) return pct(y) - pct(x);
    // Two-way tie on record: head-to-head first.
    const tied = [...rows.values()].filter((r) => pct(r) === pct(x));
    if (tied.length === 2) {
      if (beat.has(`${x.teamId}>${y.teamId}`)) return -1;
      if (beat.has(`${y.teamId}>${x.teamId}`)) return 1;
    }
    return y.pf - y.pa - (x.pf - x.pa) || y.pf - x.pf;
  });
}

/** The best second-placed team in each conference (the wildcard), by the same order. */
export function wildcards(groups: CupGroup[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const conf of ['East', 'West']) {
    const seconds = groups.filter((g) => g.conference === conf && g.rows.length > 1).map((g) => g.rows[1]);
    const pct = (r: CupRow) => (r.played ? r.w / r.played : 0);
    const best = seconds.sort((a, b) => pct(b) - pct(a) || b.pf - b.pa - (a.pf - a.pa) || b.pf - a.pf)[0];
    if (best) out.set(conf, best.teamId);
  }
  return out;
}
