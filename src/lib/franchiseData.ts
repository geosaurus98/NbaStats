// Franchise seasons and draft history (franchises.json, loaded on demand),
// plus the list of champions, which the source doesn't include.

export interface FranchiseData {
  source: string;
  /** [season, league (0 NBA, 1 ABA, 2 BAA), code, name, w, l, madePlayoffs, srs, oRtg, dRtg, pace, attendancePerGame] (null = not recorded) */
  teamSeasons: [number, number, string, string, number, number, number, number | null, number | null, number | null, number | null, number | null][];
  /** [season, league, overallPick, round, teamCode, playerIndex (-1 = never played), name, college] */
  draft: [number, number, number, number, string, number, string, string][];
  /** Parallel to teamSeasons: [age, mov, netRtg, threePARate, ts%, eFG%, tov%, orb%, oppEFG%, ftRate]. */
  detail: (number | null)[][];
  /** Parallel to teamSeasons: top five scorers, flattened [playerIndex, g, ppg×10, rpg×10, apg×10] × 5. */
  top: number[][];
  /** League averages: [season, league, oRtg, pace, threePARate, ts%, eFG%, tov%, orb%, ftRate]. */
  league: (number | null)[][];
}

export const DETAIL = { age: 0, mov: 1, nrtg: 2, par3: 3, ts: 4, efg: 5, tov: 6, orb: 7, oppEfg: 8, ftr: 9 } as const;
export const LEAGUE = { ortg: 2, pace: 3, par3: 4, ts: 5, efg: 6, tov: 7, orb: 8, ftr: 9 } as const;

let pending: Promise<FranchiseData> | undefined;

export function loadFranchiseData(): Promise<FranchiseData> {
  pending ??= import('../data/franchises.json').then((m) => (m.default ?? m) as unknown as FranchiseData);
  return pending;
}

/**
 * BAA/NBA champions by season (the year the season ends), as the team code of
 * that season. 1947-48 Baltimore (BLB) is a defunct franchise.
 */
export const CHAMPIONS: Record<number, string> = {
  1947: 'PHW', 1948: 'BLB', 1949: 'MNL', 1950: 'MNL', 1951: 'ROC', 1952: 'MNL', 1953: 'MNL', 1954: 'MNL', 1955: 'SYR',
  1956: 'PHW', 1957: 'BOS', 1958: 'STL', 1959: 'BOS', 1960: 'BOS', 1961: 'BOS', 1962: 'BOS', 1963: 'BOS', 1964: 'BOS',
  1965: 'BOS', 1966: 'BOS', 1967: 'PHI', 1968: 'BOS', 1969: 'BOS', 1970: 'NYK', 1971: 'MIL', 1972: 'LAL', 1973: 'NYK',
  1974: 'BOS', 1975: 'GSW', 1976: 'BOS', 1977: 'POR', 1978: 'WSB', 1979: 'SEA', 1980: 'LAL', 1981: 'BOS', 1982: 'LAL',
  1983: 'PHI', 1984: 'BOS', 1985: 'LAL', 1986: 'BOS', 1987: 'LAL', 1988: 'LAL', 1989: 'DET', 1990: 'DET', 1991: 'CHI',
  1992: 'CHI', 1993: 'CHI', 1994: 'HOU', 1995: 'HOU', 1996: 'CHI', 1997: 'CHI', 1998: 'CHI', 1999: 'SAS', 2000: 'LAL',
  2001: 'LAL', 2002: 'LAL', 2003: 'SAS', 2004: 'DET', 2005: 'SAS', 2006: 'MIA', 2007: 'SAS', 2008: 'BOS', 2009: 'LAL',
  2010: 'LAL', 2011: 'DAL', 2012: 'MIA', 2013: 'MIA', 2014: 'SAS', 2015: 'GSW', 2016: 'CLE', 2017: 'GSW', 2018: 'GSW',
  2019: 'TOR', 2020: 'LAL', 2021: 'MIL', 2022: 'GSW', 2023: 'DEN', 2024: 'BOS', 2025: 'OKC', 2026: 'NYK',
};
