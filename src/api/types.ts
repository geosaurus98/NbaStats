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
  athleteId?: string;
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
  shortName?: string;
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
  pbp: PlayByPlay;
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

export interface PlayerProfile {
  id: string;
  name: string;
  headshot?: string;
  position?: string;
  jersey?: string;
  height?: string;
  weight?: string;
  age?: number;
  team?: TeamRef;
}

export type LogSeasonType = 'regular' | 'playoffs';

export interface GameLogEntry {
  gameId: string;
  date: string;
  opponent: TeamRef;
  atVs: string;
  result: string;
  score: string;
  seasonType: LogSeasonType;
  /** Keyed by column label, e.g. PTS, REB, 3PT ("3-7"). */
  stats: Record<string, string>;
}

export interface GameLog {
  labels: string[];
  games: GameLogEntry[];
}

export interface TeamStatTable {
  columns: { key: string; label: string }[];
  rows: { teamId: string; values: Record<string, number | undefined> }[];
}

/** One assisted basket: `passerId` assisted `scorerId`. */
export interface AssistEvent {
  teamId: string;
  passerId: string;
  scorerId: string;
  points: number;
}

/** Aggregated passer → scorer pairs for one team. */
export interface AssistPairs {
  /** [athleteId, short name] */
  players: [string, string][];
  /** [passerId, scorerId, assists, points] */
  pairs: [string, string, number, number][];
}

export interface FlowPoint {
  /** Seconds since tip-off. */
  t: number;
  period: number;
  clock: string;
  home: number;
  away: number;
  /** Home win probability 0-1, when ESPN provides it. */
  homeWin?: number;
}

export interface Shot {
  teamId: string;
  athleteId: string;
  /** Feet across the court, 0-50. */
  x: number;
  /** Feet from the baseline, 0-47. */
  y: number;
  made: boolean;
  value: number;
  text: string;
  period: number;
  clock: string;
}

export interface PlayByPlay {
  assists: AssistEvent[];
  flow: FlowPoint[];
  shots: Shot[];
  names: Record<string, string>;
}
