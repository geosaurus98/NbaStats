// Season extras: games lost to injury, the model's report card, comebacks and
// collapses, roster continuity and how players do on rest.
import { L, type SeasonLines } from './boxTotals';
import type { DramaRow } from './pbpStats';
import type { CompactGame } from '../api/snapshot';

type LineGame = SeasonLines['games'][number];

/** Points for each side and who won, from a game's player lines. */
function result(g: LineGame): { homeWon: boolean } {
  let h = 0;
  let a = 0;
  for (const l of g[6]) (l[L.home] ? (h += l[L.pts]) : (a += l[L.pts]));
  return { homeWon: h > a };
}

const regular = (lines: SeasonLines) => lines.games.filter((g) => g[2] === 2).sort((a, b) => a[1].localeCompare(b[1]));

// ---------------------------------------------------------------------------
// Games lost to injury

export interface PlayerAbsence {
  playerId: string;
  played: number;
  missed: number;
  /** Win Shares per game played, and that times the games missed. */
  wsPerGame: number;
  wsLost: number;
  /** Team record with and without him (in his span with the team). */
  withRec: [number, number];
  withoutRec: [number, number];
}

export interface TeamAbsences {
  teamId: string;
  missed: number;
  wsLost: number;
  players: PlayerAbsence[];
}

/**
 * For each team, the games its players missed from their first appearance for
 * it (so late signings don't count) to its latest game, or to their last game
 * for it if they have since played for another team (so trades don't count).
 * Each is valued at Win Shares per game played × games missed. A missed game is
 * any team game without minutes, so coach's decisions count too.
 */
export function absences(lines: SeasonLines, wsPerGame: Map<string, number>, minGames = 3): TeamAbsences[] {
  const games = regular(lines);
  const byTeam = new Map<string, LineGame[]>();
  for (const g of games) for (const t of [g[3], g[4]]) byTeam.set(t, [...(byTeam.get(t) ?? []), g]);
  // Each player's team in their latest game: anyone whose latest game was elsewhere has moved on.
  const latestTeam = new Map<number, string>();
  for (const g of games) for (const l of g[6]) if (l[L.min] > 0) latestTeam.set(l[L.p], l[L.home] ? g[3] : g[4]);
  const out: TeamAbsences[] = [];
  for (const [teamId, tg] of byTeam) {
    const appearances = new Map<number, number[]>(); // player index -> game indexes played
    tg.forEach((g, i) => {
      const home = g[3] === teamId;
      for (const l of g[6]) if (!!l[L.home] === home && l[L.min] > 0) appearances.set(l[L.p], [...(appearances.get(l[L.p]) ?? []), i]);
    });
    const players: PlayerAbsence[] = [];
    for (const [p, idx] of appearances) {
      if (idx.length < minGames) continue;
      const played = new Set(idx);
      const id = lines.ids[p];
      const w = [0, 0] as [number, number];
      const wo = [0, 0] as [number, number];
      let missed = 0;
      const end = latestTeam.get(p) === teamId ? tg.length - 1 : idx[idx.length - 1];
      for (let i = idx[0]; i <= end; i++) {
        const g = tg[i];
        const won = result(g).homeWon === (g[3] === teamId);
        const rec = played.has(i) ? w : wo;
        rec[won ? 0 : 1]++;
        if (!played.has(i)) missed++;
      }
      const per = wsPerGame.get(id) ?? 0;
      players.push({ playerId: id, played: idx.length, missed, wsPerGame: per, wsLost: Math.max(0, per) * missed, withRec: w, withoutRec: wo });
    }
    players.sort((a, b) => b.wsLost - a.wsLost);
    out.push({ teamId, missed: players.reduce((s, p) => s + p.missed, 0), wsLost: players.reduce((s, p) => s + p.wsLost, 0), players });
  }
  return out.sort((a, b) => b.wsLost - a.wsLost);
}

// ---------------------------------------------------------------------------
// The model's report card

export interface ModelTeam {
  teamId: string;
  games: number;
  wins: number;
  /** Sum of the model's pre-game win chances. */
  expected: number;
  asFavourite: [number, number];
  asUnderdog: [number, number];
}

export interface ModelMonth {
  month: string;
  games: number;
  correct: number;
  /** Brier score: mean squared error of the pre-game chances (0 = perfect, 0.25 = coin flip). */
  brier: number;
}

export function modelReport(predictions: { home: string; away: string; date: string; pHome: number; homeWon: boolean }[]): { teams: ModelTeam[]; months: ModelMonth[]; overall: ModelMonth } {
  const teams = new Map<string, ModelTeam>();
  const months = new Map<string, ModelMonth>();
  const all: ModelMonth = { month: 'Season', games: 0, correct: 0, brier: 0 };
  for (const g of predictions) {
    for (const [id, p, won] of [[g.home, g.pHome, g.homeWon], [g.away, 1 - g.pHome, !g.homeWon]] as const) {
      const t = teams.get(id) ?? { teamId: id, games: 0, wins: 0, expected: 0, asFavourite: [0, 0], asUnderdog: [0, 0] };
      t.games++;
      if (won) t.wins++;
      t.expected += p;
      const bucket = p >= 0.5 ? t.asFavourite : t.asUnderdog;
      bucket[won ? 0 : 1]++;
      teams.set(id, t);
    }
    const m = g.date.slice(0, 7);
    const row = months.get(m) ?? { month: m, games: 0, correct: 0, brier: 0 };
    for (const r of [row, all]) {
      r.games++;
      if (g.pHome >= 0.5 === g.homeWon) r.correct++;
      r.brier += ((g.homeWon ? 1 : 0) - g.pHome) ** 2;
    }
    months.set(m, row);
  }
  const fin = (r: ModelMonth) => ({ ...r, brier: r.games ? r.brier / r.games : 0 });
  return {
    teams: [...teams.values()].sort((a, b) => b.wins - b.expected - (a.wins - a.expected)),
    months: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)).map(fin),
    overall: fin(all),
  };
}

// ---------------------------------------------------------------------------
// Comebacks and collapses

export interface Swing {
  gameId: string;
  date: string;
  opponentId: string;
  home: boolean;
  /** Biggest deficit overcome (comebacks) or lead blown (collapses). */
  margin: number;
  score: string;
}

/** A team's biggest comebacks (won from behind) and collapses (lost from in front), from each game's play-by-play. */
export function swings(drama: DramaRow[], games: CompactGame[], teamId: string, n = 5): { comebacks: Swing[]; collapses: Swing[] } {
  const byId = new Map(games.map((g) => [g[0], g]));
  const comebacks: Swing[] = [];
  const collapses: Swing[] = [];
  for (const [gameId, , comeback] of drama) {
    const g = byId.get(gameId);
    if (!g || g[4] == null || g[5] == null || (g[2] !== teamId && g[3] !== teamId) || comeback <= 0) continue;
    const home = g[2] === teamId;
    const homeWon = g[4] > g[5];
    const won = homeWon === home;
    const s: Swing = { gameId, date: g[1], opponentId: home ? g[3] : g[2], home, margin: comeback, score: home ? `${g[4]}-${g[5]}` : `${g[5]}-${g[4]}` };
    (won ? comebacks : collapses).push(s);
  }
  const top = (xs: Swing[]) => xs.sort((a, b) => b.margin - a.margin).slice(0, n);
  return { comebacks: top(comebacks), collapses: top(collapses) };
}

// ---------------------------------------------------------------------------
// Roster continuity

export interface Continuity {
  teamId: string;
  /** Share of last season's team minutes played by players who have played for it this season. */
  share: number;
  /** The biggest minute-getters from last season who are gone. */
  gone: { playerId: string; minutes: number }[];
}

export function continuity(prev: SeasonLines, now: SeasonLines): Continuity[] {
  const minutes = (lines: SeasonLines) => {
    const out = new Map<string, Map<string, number>>(); // team -> player id -> minutes
    for (const g of regular(lines)) {
      for (const l of g[6]) {
        if (l[L.min] <= 0) continue;
        const team = l[L.home] ? g[3] : g[4];
        const m = out.get(team) ?? new Map<string, number>();
        const id = lines.ids[l[L.p]];
        m.set(id, (m.get(id) ?? 0) + l[L.min]);
        out.set(team, m);
      }
    }
    return out;
  };
  const before = minutes(prev);
  const after = minutes(now);
  return [...before]
    .map(([teamId, m]) => {
      const kept = after.get(teamId) ?? new Map();
      const total = [...m.values()].reduce((a, b) => a + b, 0);
      const back = [...m].filter(([id]) => kept.has(id)).reduce((a, [, v]) => a + v, 0);
      const gone = [...m].filter(([id]) => !kept.has(id)).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([playerId, minutes]) => ({ playerId, minutes }));
      return { teamId, share: total ? back / total : 0, gone };
    })
    .sort((a, b) => b.share - a.share);
}

// ---------------------------------------------------------------------------
// Rest and fatigue

export interface RestSplit {
  label: string;
  games: number;
  min: number;
  pts: number;
  ts: number;
}

const restBucket = (days: number | undefined) => (days === undefined ? undefined : days <= 1 ? 'Back-to-back' : days === 2 ? '1 day of rest' : '2+ days of rest');

/** Days since each team's previous game, by game id and team. */
function restDays(lines: SeasonLines): Map<string, number> {
  const last = new Map<string, number>();
  const out = new Map<string, number>();
  for (const g of regular(lines)) {
    const day = Math.floor(Date.parse(g[1]) / 864e5);
    for (const t of [g[3], g[4]]) {
      const prev = last.get(t);
      if (prev !== undefined) out.set(`${g[0]}|${t}`, day - prev);
      last.set(t, day);
    }
  }
  return out;
}

/** A player's per-game numbers by rest: back-to-backs, one day off, two or more. */
export function restSplits(lines: SeasonLines, playerId: string, rest = restDays(lines)): RestSplit[] {
  const p = lines.ids.indexOf(playerId);
  if (p < 0) return [];
  const sums = new Map<string, { games: number; min: number; pts: number; fga: number; fta: number }>();
  for (const g of regular(lines)) {
    const l = g[6].find((x) => x[L.p] === p && x[L.min] > 0);
    if (!l) continue;
    const label = restBucket(rest.get(`${g[0]}|${l[L.home] ? g[3] : g[4]}`));
    if (!label) continue;
    const s = sums.get(label) ?? { games: 0, min: 0, pts: 0, fga: 0, fta: 0 };
    s.games++;
    s.min += l[L.min];
    s.pts += l[L.pts];
    s.fga += l[L.fga];
    s.fta += l[L.fta];
    sums.set(label, s);
  }
  return ['Back-to-back', '1 day of rest', '2+ days of rest']
    .filter((k) => sums.has(k))
    .map((label) => {
      const s = sums.get(label)!;
      return { label, games: s.games, min: s.min / s.games, pts: s.pts / s.games, ts: s.pts / Math.max(1, 2 * (s.fga + 0.44 * s.fta)) };
    });
}

/** League table: each player's points and true shooting on back-to-backs against with rest. */
export function backToBackDrops(lines: SeasonLines, minB2B = 4, minGames = 15): { playerId: string; b2b: RestSplit; rested: RestSplit }[] {
  const rest = restDays(lines);
  const counts = new Map<number, number>();
  for (const g of regular(lines)) for (const l of g[6]) if (l[L.min] > 0) counts.set(l[L.p], (counts.get(l[L.p]) ?? 0) + 1);
  const out: { playerId: string; b2b: RestSplit; rested: RestSplit }[] = [];
  for (const [p, n] of counts) {
    if (n < minGames) continue;
    const splits = restSplits(lines, lines.ids[p], rest);
    const b2b = splits.find((s) => s.label === 'Back-to-back');
    const restedRows = splits.filter((s) => s.label !== 'Back-to-back');
    if (!b2b || b2b.games < minB2B || !restedRows.length) continue;
    const g = restedRows.reduce((a, s) => a + s.games, 0);
    const avg = (k: 'min' | 'pts' | 'ts') => restedRows.reduce((a, s) => a + s[k] * s.games, 0) / g;
    out.push({ playerId: lines.ids[p], b2b, rested: { label: 'With rest', games: g, min: avg('min'), pts: avg('pts'), ts: avg('ts') } });
  }
  return out;
}
