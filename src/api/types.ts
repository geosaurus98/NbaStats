export type GameState = 'pre' | 'in' | 'post';

export interface TeamRef {
  id: string;
  name: string;
  shortName: string;
  abbr: string;
  logo?: string;
  color?: string;
}

export interface Leader {
  category: string;
  athlete: string;
  value: string;
}

export interface Competitor {
  team: TeamRef;
  homeAway: 'home' | 'away';
  score?: number;
  winner?: boolean;
  record?: string;
  linescores: number[];
  leaders: Leader[];
}

export interface Game {
  id: string;
  date: string;
  state: GameState;
  statusDetail: string;
  home: Competitor;
  away: Competitor;
  venue?: string;
  broadcasts: string[];
  note?: string;
}

export interface StandingRow {
  team: TeamRef;
  wins: number;
  losses: number;
  pct: number;
  gb: string;
  streak: string;
  seed?: number;
  home: string;
  road: string;
  last10: string;
  ppg?: number;
  oppPpg?: number;
}

export interface Conference {
  name: string;
  rows: StandingRow[];
}

export interface PlayerLine {
  id: string;
  name: string;
  position?: string;
  starter: boolean;
  dnp: boolean;
  reason?: string;
  stats: string[];
}

export interface TeamBox {
  team: TeamRef;
  labels: string[];
  players: PlayerLine[];
  totals: string[];
  teamStats: { label: string; value: string }[];
}

export interface GameSummary {
  game: Game;
  teams: TeamBox[];
}

export interface LeaderRow {
  athlete: string;
  athleteId: string;
  team: string;
  values: Record<string, string>;
}

export interface LeaderTable {
  columns: { key: string; label: string }[];
  rows: LeaderRow[];
}
