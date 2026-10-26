// More team measures from every game's box score: the Simple Rating System,
// rest and travel splits, records with and without each player, a style
// profile against the league, and which past champions a team resembles.
import { emptyBox, fourFactors, possessions, type Box, type TeamGame, type TeamSeason } from './advanced';
import { L, type SeasonLines } from './boxTotals';
import { CHAMPIONS, DETAIL, LEAGUE, type FranchiseData } from './franchiseData';

/**
 * Basketball-Reference's Simple Rating System: average margin adjusted for
 * opponents, solved by iteration (SRS = margin + average opponent SRS).
 */
export function srs(games: TeamGame[]): Map<string, { srs: number; mov: number; sos: number }> {
  const byTeam = new Map<string, TeamGame[]>();
  for (const g of games) byTeam.set(g.teamId, [...(byTeam.get(g.teamId) ?? []), g]);
  const mov = new Map([...byTeam].map(([id, gs]) => [id, gs.reduce((s, g) => s + g.own.pts - g.opp.pts, 0) / gs.length]));
  let rating = new Map(mov);
  for (let i = 0; i < 200; i++) {
    const next = new Map<string, number>();
    for (const [id, gs] of byTeam) next.set(id, mov.get(id)! + gs.reduce((s, g) => s + (rating.get(g.oppId) ?? 0), 0) / gs.length);
    // Keep the league average at zero.
    const mean = [...next.values()].reduce((a, b) => a + b, 0) / next.size;
    for (const [id, v] of next) next.set(id, v - mean);
    const moved = Math.max(...[...next].map(([id, v]) => Math.abs(v - (rating.get(id) ?? 0))));
    rating = next;
    if (moved < 1e-6) break;
  }
  return new Map([...rating].map(([id, v]) => [id, { srs: v, mov: mov.get(id)!, sos: v - mov.get(id)! }]));
}

/** ESPN team abbreviation → arena [latitude, longitude, UTC offset in winter]. */
export const ARENAS: Record<string, [number, number, number]> = {
  ATL: [33.757, -84.396, -5], BOS: [42.366, -71.062, -5], BKN: [40.683, -73.976, -5], CHA: [35.225, -80.839, -5],
  CHI: [41.881, -87.674, -6], CLE: [41.497, -81.688, -5], DAL: [32.79, -96.81, -6], DEN: [39.749, -105.008, -7],
  DET: [42.341, -83.055, -5], GS: [37.768, -122.388, -8], HOU: [29.751, -95.362, -6], IND: [39.764, -86.155, -5],
  LAC: [33.945, -118.343, -8], LAL: [34.043, -118.267, -8], MEM: [35.138, -90.051, -6], MIA: [25.781, -80.188, -5],
  MIL: [43.045, -87.917, -6], MIN: [44.979, -93.276, -6], NO: [29.949, -90.082, -6], NY: [40.751, -73.993, -5],
  OKC: [35.463, -97.515, -6], ORL: [28.539, -81.384, -5], PHI: [39.901, -75.172, -5], PHX: [33.446, -112.071, -7],
  POR: [45.532, -122.667, -8], SAC: [38.58, -121.5, -8], SA: [29.427, -98.438, -6], TOR: [43.643, -79.379, -5],
  UTAH: [40.768, -111.901, -7], WSH: [38.898, -77.021, -5],
};

export function miles(a: [number, number, number], b: [number, number, number]): number {
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLon = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 3959 * 2 * Math.asin(Math.sqrt(h));
}

const usDay = (iso: string) => new Date(new Date(iso).getTime() - 6 * 3600e3).toISOString().slice(0, 10);
const dayNum = (iso: string) => Date.parse(`${usDay(iso)}T00:00:00Z`) / 864e5;

export interface Record2 {
  w: number;
  l: number;
  margin: number;
}
const rec = (): Record2 => ({ w: 0, l: 0, margin: 0 });
const tally = (r: Record2, g: TeamGame) => {
  if (g.own.pts > g.opp.pts) r.w++;
  else r.l++;
  r.margin += g.own.pts - g.opp.pts;
};

export interface TeamTravel {
  teamId: string;
  /** Days of rest before each game: 0 (back-to-back), 1, 2, 3+. */
  byRest: Record2[];
  /** When this team had more / less / the same rest as its opponent. */
  restEdge: { more: Record2; less: Record2; same: Record2 };
  miles: number;
  /** Games after flying across two or more time zones. */
  zoneJump: Record2;
  /** Longest road trip (consecutive away games). */
  longestTrip: number;
  /** Away games that were the 4th or later of a trip. */
  lateTrip: Record2;
}

/** Rest and travel for every team; `abbr` maps team ids to ESPN abbreviations. Neutral-site games count as the home team's arena. */
export function restAndTravel(games: TeamGame[], abbr: Map<string, string>): TeamTravel[] {
  const byTeam = new Map<string, TeamGame[]>();
  for (const g of games) byTeam.set(g.teamId, [...(byTeam.get(g.teamId) ?? []), g]);
  const lastDay = new Map<string, number[]>();
  for (const [id, gs] of byTeam) lastDay.set(id, gs.map((g) => dayNum(g.date)).sort((a, b) => a - b));
  const restBefore = (teamId: string, date: string) => {
    const days = lastDay.get(teamId) ?? [];
    const d = dayNum(date);
    let prev: number | undefined;
    for (const x of days) if (x < d) prev = x;
    return prev == null ? 3 : Math.min(3, d - prev - 1);
  };
  return [...byTeam].map(([teamId, gs]) => {
    const sorted = [...gs].sort((a, b) => a.date.localeCompare(b.date));
    const t: TeamTravel = { teamId, byRest: [rec(), rec(), rec(), rec()], restEdge: { more: rec(), less: rec(), same: rec() }, miles: 0, zoneJump: rec(), longestTrip: 0, lateTrip: rec() };
    let where = ARENAS[abbr.get(teamId) ?? ''];
    let trip = 0;
    for (const g of sorted) {
      const mine = restBefore(teamId, g.date);
      const theirs = restBefore(g.oppId, g.date);
      tally(t.byRest[mine], g);
      tally(mine > theirs ? t.restEdge.more : mine < theirs ? t.restEdge.less : t.restEdge.same, g);
      const venue = ARENAS[abbr.get(g.home ? teamId : g.oppId) ?? ''];
      if (where && venue) {
        t.miles += miles(where, venue);
        if (Math.abs(venue[2] - where[2]) >= 2) tally(t.zoneJump, g);
      }
      if (venue) where = venue;
      trip = g.home ? 0 : trip + 1;
      t.longestTrip = Math.max(t.longestTrip, trip);
      if (trip >= 4) tally(t.lateTrip, g);
    }
    return t;
  });
}

export interface WithWithout {
  id: string;
  played: Record2;
  missed: Record2;
  minutes: number;
}

/**
 * Team record and margin in games each player played and missed, counting
 * only games while they were on the team (first to last appearance for it).
 */
export function withWithout(data: SeasonLines, teamId: string, minGames = 5): WithWithout[] {
  const teamGames = data.games.filter(([, , type, h, a, counts]) => type === 2 && counts && (h === teamId || a === teamId)).sort((x, y) => x[1].localeCompare(y[1]));
  const appear = new Map<number, number[]>();
  const minutes = new Map<number, number>();
  teamGames.forEach(([, , , homeId, , , lines], i) => {
    const isHome = homeId === teamId;
    for (const l of lines) {
      if (!!l[L.home] !== isHome || l[L.min] <= 0) continue;
      appear.set(l[L.p], [...(appear.get(l[L.p]) ?? []), i]);
      minutes.set(l[L.p], (minutes.get(l[L.p]) ?? 0) + l[L.min]);
    }
  });
  const result = teamGames.map(([, , , homeId, , , lines]) => {
    let home = 0;
    let away = 0;
    for (const l of lines) {
      if (l[L.home]) home += l[L.pts];
      else away += l[L.pts];
    }
    return homeId === teamId ? home - away : away - home;
  });
  return [...appear]
    .filter(([, idx]) => idx.length >= minGames)
    .map(([p, idx]) => {
      const set = new Set(idx);
      const played = rec();
      const missed = rec();
      for (let i = idx[0]; i <= idx[idx.length - 1]; i++) {
        const m = result[i];
        const r = set.has(i) ? played : missed;
        if (m > 0) r.w++;
        else r.l++;
        r.margin += m;
      }
      return { id: data.ids[p], played, missed, minutes: minutes.get(p) ?? 0 };
    })
    .sort((a, b) => b.minutes - a.minutes);
}

export interface StyleRow {
  id: string;
  label: string;
  title: string;
  value: number;
  league: number;
  /** 0-100: share of teams below this one. */
  pct: number;
  fmt: (v: number) => string;
}

const pct1 = (v: number) => `${(v * 100).toFixed(1)}%`;

/** A team's playing style against the league: pace, shot diet, ball movement, glass and turnovers. */
export function styleProfile(teamId: string, seasons: Map<string, TeamSeason>, rimShare?: Map<string, number>): StyleRow[] {
  const metrics: { id: string; label: string; title: string; get: (t: TeamSeason) => number | undefined; fmt: (v: number) => string }[] = [
    { id: 'pace', label: 'Pace', title: 'Possessions per 48 minutes', get: (t) => (48 * possessions(t.own, t.opp)) / (t.own.min / 5), fmt: (v) => v.toFixed(1) },
    { id: 'par3', label: 'Three-point rate', title: 'Share of shots that are threes', get: (t) => t.own.tpa / t.own.fga, fmt: pct1 },
    { id: 'rim', label: 'Rim attempts', title: 'Share of shots at the rim (dunks, layups, tips)', get: (t) => rimShare?.get(t.teamId), fmt: pct1 },
    { id: 'ast', label: 'Assisted baskets', title: 'Share of made field goals that were assisted', get: (t) => t.own.ast / t.own.fgm, fmt: pct1 },
    { id: 'ftr', label: 'Free-throw rate', title: 'Free-throw attempts per field-goal attempt', get: (t) => t.own.fta / t.own.fga, fmt: pct1 },
    { id: 'orb', label: 'Offensive rebounding', title: 'Share of own misses rebounded', get: (t) => fourFactors(t.own, t.opp).orb, fmt: pct1 },
    { id: 'tov', label: 'Turnovers', title: 'Turnovers per 100 plays', get: (t) => fourFactors(t.own, t.opp).tov, fmt: pct1 },
    { id: 'opp3', label: 'Opp. three-point rate', title: "Share of opponents' shots that are threes", get: (t) => t.opp.tpa / t.opp.fga, fmt: pct1 },
    { id: 'blk', label: 'Blocks', title: 'Blocks per opponent two-point attempt', get: (t) => t.own.blk / Math.max(1, t.opp.fga - t.opp.tpa), fmt: pct1 },
  ];
  const all = [...seasons.values()];
  const me = seasons.get(teamId);
  if (!me) return [];
  return metrics.flatMap((m) => {
    const v = m.get(me);
    const vals = all.map(m.get).filter((x): x is number => x != null && Number.isFinite(x));
    if (v == null || !vals.length) return [];
    const league = vals.reduce((a, b) => a + b, 0) / vals.length;
    const pct = (100 * vals.filter((x) => x < v).length) / Math.max(1, vals.length - 1);
    return [{ id: m.id, label: m.label, title: m.title, value: v, league, pct: Math.min(100, pct), fmt: m.fmt }];
  });
}

/** Features relative to that season's league: net rating, eFG, opponents' eFG, TOV%, ORB%, FT rate, 3PA rate, pace. */
type Dna = [number, number, number, number, number, number, number, number];
const SCALE: Dna = [4, 0.02, 0.02, 1.2, 2.5, 0.03, 0.05, 3];

export interface ChampionMatch {
  season: number;
  code: string;
  name: string;
  similarity: number;
  record: string;
}

export function championDna(fr: FranchiseData): { season: number; code: string; name: string; w: number; l: number; dna: Dna }[] {
  const league = new Map(fr.league.filter((l) => l[1] === 0).map((l) => [l[0] as number, l]));
  return fr.teamSeasons.flatMap((t, i) => {
    const [season, lg, code, name, w, l, , , , , pace] = t;
    if (lg !== 0 || season < 1980 || CHAMPIONS[season] !== code) return [];
    const d = fr.detail[i];
    const L0 = league.get(season);
    if (!d || !L0) return [];
    const need = [d[DETAIL.nrtg], d[DETAIL.efg], d[DETAIL.oppEfg], d[DETAIL.tov], d[DETAIL.orb], d[DETAIL.ftr], d[DETAIL.par3], pace, L0[LEAGUE.efg], L0[LEAGUE.tov], L0[LEAGUE.orb], L0[LEAGUE.ftr], L0[LEAGUE.par3], L0[LEAGUE.pace]];
    if (need.some((x) => x == null)) return [];
    const n = (x: number | null) => x as number;
    const dna: Dna = [
      n(d[DETAIL.nrtg]),
      n(d[DETAIL.efg]) - n(L0[LEAGUE.efg]),
      n(d[DETAIL.oppEfg]) - n(L0[LEAGUE.efg]),
      n(d[DETAIL.tov]) - n(L0[LEAGUE.tov]),
      n(d[DETAIL.orb]) - n(L0[LEAGUE.orb]),
      n(d[DETAIL.ftr]) - n(L0[LEAGUE.ftr]),
      n(d[DETAIL.par3]) - n(L0[LEAGUE.par3]),
      n(pace) - n(L0[LEAGUE.pace]),
    ];
    return [{ season, code, name, w, l, dna }];
  });
}

/** The same features for this season's teams, from the box scores. */
export function currentDna(seasons: Map<string, TeamSeason>): Map<string, Dna> {
  const lg = emptyBox();
  const lgOpp = emptyBox();
  let lgPoss = 0;
  for (const t of seasons.values()) {
    for (const k of Object.keys(lg) as (keyof Box)[]) {
      lg[k] += t.own[k];
      lgOpp[k] += t.opp[k];
    }
    lgPoss += possessions(t.own, t.opp);
  }
  const lgF = fourFactors(lg, lgOpp);
  const lgPace = (48 * lgPoss) / (lg.min / 5);
  const out = new Map<string, Dna>();
  for (const t of seasons.values()) {
    const poss = possessions(t.own, t.opp);
    const off = fourFactors(t.own, t.opp);
    const def = fourFactors(t.opp, t.own);
    out.set(t.teamId, [
      (100 * (t.own.pts - t.opp.pts)) / poss,
      off.efg - lgF.efg,
      def.efg - lgF.efg,
      100 * (off.tov - lgF.tov),
      100 * (off.orb - lgF.orb),
      off.ftr - lgF.ftr,
      t.own.tpa / t.own.fga - lg.tpa / lg.fga,
      (48 * poss) / (t.own.min / 5) - lgPace,
    ]);
  }
  return out;
}

export function closestChampions(dna: Dna, champs: ReturnType<typeof championDna>, top = 3): ChampionMatch[] {
  return champs
    .map((c) => ({ c, d: Math.sqrt(c.dna.reduce((s, v, i) => s + ((v - dna[i]) / SCALE[i]) ** 2, 0) / dna.length) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, top)
    .map(({ c, d }) => ({ season: c.season, code: c.code, name: c.name, record: `${c.w}-${c.l}`, similarity: Math.round(100 * Math.exp(-d)) }));
}
