// Coaches and front offices (src/data/staff.json, built weekly from
// Basketball-Reference by scripts/staff.ts).
import { brefTables, type BrefRow } from './brefTables';

export type WL = [number, number];

export interface CurrentCoach {
  /** Basketball-Reference team code (e.g. OKC). */
  team: string;
  name: string;
  bref: string;
  /** Seasons with this franchise and overall, counting this one. */
  seasonsWithTeam: number;
  seasons: number;
  season: WL;
  withTeam: WL;
  career: WL;
  playoffsWithTeam: WL;
  playoffsCareer: WL;
}

export interface FranchiseCoach {
  name: string;
  bref: string;
  from: number;
  to: number;
  record: WL;
  playoffs: WL;
  conferenceTitles: number;
  titles: number;
}

export interface Executive {
  name: string;
  bref: string;
  start: string;
  /** Blank while still in the job. */
  end: string;
  notes: string;
}

export interface StaffData {
  generatedAt: string;
  season: number;
  coaches: CurrentCoach[];
  /** By team code: every coach in franchise history, first first. */
  coachHistory: Record<string, FranchiseCoach[]>;
  /** By team code: executives, first first. */
  executives: Record<string, Executive[]>;
}

const n = (v: string | undefined) => (v && /\d/.test(v) ? Number(v.replace(/,/g, '')) : 0);
const id = (href: string | undefined) => /\/(\w+)\.html/.exec(href ?? '')?.[1] ?? '';
/** Data rows only (header rows repeat the column labels and have no links). */
const data = (rows: BrefRow[] | undefined, key: string) => (rows ?? []).filter((r) => r[`${key}_href`]);

/** leagues/NBA_<year>_coaches.html: one row per coach this season (a mid-season change gives a team two rows; the last is current). */
export function parseSeasonCoaches(html: string): CurrentCoach[] {
  // Data rows have a team and a number of games; the repeated header rows don't.
  const rows = (brefTables(html).get('NBA_coaches') ?? []).filter((r) => r.coach && r.team && /^[A-Z]{3}$/.test(r.team) && /\d/.test(r.cur_g ?? r.cur_w ?? ''));
  const byTeam = new Map<string, CurrentCoach>();
  for (const r of rows) {
    byTeam.set(r.team, {
      team: r.team,
      name: r.coach,
      bref: id(r.coach_href) || r.coach.toLowerCase().replace(/[^a-z]/g, ''),
      seasonsWithTeam: n(r.seas_num_franch),
      seasons: n(r.seas_num_overall),
      season: [n(r.cur_w), n(r.cur_l)],
      withTeam: [n(r.fr_w), n(r.fr_l)],
      career: [n(r.car_w), n(r.car_l)],
      playoffsWithTeam: [n(r.fr_w_p), n(r.fr_l_p)],
      playoffsCareer: [n(r.car_w_p), n(r.car_l_p)],
    });
  }
  return [...byTeam.values()];
}

/** teams/<code>/coaches.html */
export function parseFranchiseCoaches(html: string): FranchiseCoach[] {
  return data(brefTables(html).get('coaches'), 'coach')
    .map((r) => ({
      name: r.coach,
      bref: id(r.coach_href),
      from: n(r.year_min),
      to: n(r.year_max),
      record: [n(r.wins), n(r.losses)] as WL,
      playoffs: [n(r.wins_playoffs), n(r.losses_playoffs)] as WL,
      conferenceTitles: n(r.years_conference_champion),
      titles: n(r.years_league_champion),
    }))
    .sort((a, b) => a.from - b.from || a.to - b.to);
}

/** teams/<code>/executives.html */
export function parseExecutives(html: string): Executive[] {
  return data(brefTables(html).get('executives'), 'exec').map((r) => ({ name: r.exec, bref: id(r.exec_href), start: r.date_start, end: r.date_end, notes: r.notes }));
}

export function loadStaff(): Promise<StaffData | undefined> {
  return import('../data/staff.json')
    .then((m) => (m.default ?? m) as unknown as StaffData)
    .catch(() => undefined);
}
