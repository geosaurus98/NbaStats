// Basketball-Reference team codes → today's 30 franchises, following the
// NBA's official franchise histories (moves, renames, ABA teams that joined).
// Codes not listed belong to defunct teams.

export interface Franchise {
  id: string;
  name: string;
  /** ESPN team id, for logos and links. */
  espnId: string;
  codes: string[];
}

export const FRANCHISES: Franchise[] = [
  { id: 'ATL', name: 'Atlanta Hawks', espnId: '1', codes: ['TRI', 'MLH', 'STL', 'ATL'] },
  { id: 'BOS', name: 'Boston Celtics', espnId: '2', codes: ['BOS'] },
  { id: 'BKN', name: 'Brooklyn Nets', espnId: '17', codes: ['NJA', 'NYA', 'NYN', 'NJN', 'BRK'] },
  { id: 'CHA', name: 'Charlotte Hornets', espnId: '30', codes: ['CHH', 'CHA', 'CHO'] },
  { id: 'CHI', name: 'Chicago Bulls', espnId: '4', codes: ['CHI'] },
  { id: 'CLE', name: 'Cleveland Cavaliers', espnId: '5', codes: ['CLE'] },
  { id: 'DAL', name: 'Dallas Mavericks', espnId: '6', codes: ['DAL'] },
  { id: 'DEN', name: 'Denver Nuggets', espnId: '7', codes: ['DNR', 'DNA', 'DEN'] },
  { id: 'DET', name: 'Detroit Pistons', espnId: '8', codes: ['FTW', 'DET'] },
  { id: 'GSW', name: 'Golden State Warriors', espnId: '9', codes: ['PHW', 'SFW', 'GSW'] },
  { id: 'HOU', name: 'Houston Rockets', espnId: '10', codes: ['SDR', 'HOU'] },
  { id: 'IND', name: 'Indiana Pacers', espnId: '11', codes: ['INA', 'IND'] },
  { id: 'LAC', name: 'LA Clippers', espnId: '12', codes: ['BUF', 'SDC', 'LAC'] },
  { id: 'LAL', name: 'Los Angeles Lakers', espnId: '13', codes: ['MNL', 'LAL'] },
  { id: 'MEM', name: 'Memphis Grizzlies', espnId: '29', codes: ['VAN', 'MEM'] },
  { id: 'MIA', name: 'Miami Heat', espnId: '14', codes: ['MIA'] },
  { id: 'MIL', name: 'Milwaukee Bucks', espnId: '15', codes: ['MIL'] },
  { id: 'MIN', name: 'Minnesota Timberwolves', espnId: '16', codes: ['MIN'] },
  { id: 'NOP', name: 'New Orleans Pelicans', espnId: '3', codes: ['NOH', 'NOK', 'NOP'] },
  { id: 'NYK', name: 'New York Knicks', espnId: '18', codes: ['NYK'] },
  { id: 'OKC', name: 'Oklahoma City Thunder', espnId: '25', codes: ['SEA', 'OKC'] },
  { id: 'ORL', name: 'Orlando Magic', espnId: '19', codes: ['ORL'] },
  { id: 'PHI', name: 'Philadelphia 76ers', espnId: '20', codes: ['SYR', 'PHI'] },
  { id: 'PHX', name: 'Phoenix Suns', espnId: '21', codes: ['PHO'] },
  { id: 'POR', name: 'Portland Trail Blazers', espnId: '22', codes: ['POR'] },
  { id: 'SAC', name: 'Sacramento Kings', espnId: '23', codes: ['ROC', 'CIN', 'KCO', 'KCK', 'SAC'] },
  { id: 'SAS', name: 'San Antonio Spurs', espnId: '24', codes: ['DLC', 'TEX', 'SAA', 'SAS'] },
  { id: 'TOR', name: 'Toronto Raptors', espnId: '28', codes: ['TOR'] },
  { id: 'UTA', name: 'Utah Jazz', espnId: '26', codes: ['NOJ', 'UTA'] },
  { id: 'WAS', name: 'Washington Wizards', espnId: '27', codes: ['CHP', 'CHZ', 'BAL', 'CAP', 'WSB', 'WAS'] },
];

// BLB (1948-55) is the original, defunct Baltimore Bullets; BAL is today's Wizards.
const byCode = new Map(FRANCHISES.flatMap((f) => f.codes.map((c) => [c, f] as const)));

/** Today's franchise for a team code, or undefined for a defunct team. */
export function franchiseOf(code: string): Franchise | undefined {
  return byCode.get(code);
}

export function franchiseById(id: string): Franchise | undefined {
  return FRANCHISES.find((f) => f.id === id);
}

export function espnLogo(f: Franchise): string {
  const slug: Record<string, string> = { BKN: 'bkn', GSW: 'gs', NOP: 'no', NYK: 'ny', PHX: 'phx', SAS: 'sa', UTA: 'utah', WAS: 'wsh' };
  return `https://a.espncdn.com/i/teamlogos/nba/500/${slug[f.id] ?? f.id.toLowerCase()}.png`;
}
