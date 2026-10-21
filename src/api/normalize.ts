// Converts raw ESPN API payloads into the app's own types. ESPN's shapes vary
// between endpoints (e.g. scores are strings on the scoreboard but objects on
// team schedules), so every accessor here is defensive.
import type {
  AssistEvent,
  FeedItem,
  AssistPairs,
  Competitor,
  Conference,
  FlowPoint,
  Game,
  GameLog,
  GameLogEntry,
  GameState,
  GameSummary,
  Leader,
  LeaderTable,
  PlayByPlay,
  PlayerLine,
  PlayerProfile,
  Shot,
  StandingRow,
  TeamBox,
  TeamRef,
  TeamStatTable,
} from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

function num(v: Raw): number | undefined {
  if (v == null) return undefined;
  if (typeof v === 'object') return num(v.value ?? v.displayValue);
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
}

export function normalizeTeam(t: Raw = {}): TeamRef {
  return {
    id: String(t.id ?? ''),
    name: t.displayName ?? t.name ?? 'TBD',
    shortName: t.shortDisplayName ?? t.name ?? t.abbreviation ?? 'TBD',
    abbr: t.abbreviation ?? '',
    logo: t.logo ?? t.logos?.[0]?.href,
    color: t.color ? `#${t.color}` : undefined,
  };
}

function gameLeaders(list: Raw[] = []): Leader[] {
  return list
    .map((cat: Raw): Leader | null => {
      const top = cat.leaders?.[0];
      if (!top) return null;
      return {
        category: cat.abbreviation ?? cat.shortDisplayName ?? cat.name ?? '',
        athlete: top.athlete?.shortName ?? top.athlete?.displayName ?? '',
        athleteId: top.athlete?.id ? String(top.athlete.id) : undefined,
        value: top.displayValue ?? '',
      };
    })
    .filter((l): l is Leader => l !== null);
}

function normalizeCompetitor(c: Raw): Competitor {
  const record =
    c.records?.find((r: Raw) => r.type === 'total' || r.name === 'overall')?.summary ??
    c.records?.[0]?.summary ??
    c.record?.[0]?.displayValue;
  return {
    team: normalizeTeam(c.team),
    homeAway: c.homeAway === 'away' ? 'away' : 'home',
    score: num(c.score),
    winner: typeof c.winner === 'boolean' ? c.winner : undefined,
    record,
    linescores: (c.linescores ?? []).map((l: Raw) => num(l) ?? 0),
    leaders: gameLeaders(c.leaders),
  };
}

function normalizeState(status: Raw = {}): GameState {
  const s = status.type?.state;
  return s === 'in' || s === 'post' ? s : 'pre';
}

/** Works for scoreboard events, team-schedule events and summary headers. */
export function normalizeGame(e: Raw): Game {
  const comp = e.competitions?.[0] ?? {};
  const competitors: Competitor[] = (comp.competitors ?? []).map(normalizeCompetitor);
  const home = competitors.find((c) => c.homeAway === 'home') ?? competitors[0];
  const away = competitors.find((c) => c.homeAway === 'away') ?? competitors[1];
  const status = comp.status ?? e.status ?? {};
  const broadcasts: string[] = [];
  for (const b of comp.broadcasts ?? []) broadcasts.push(...(b.names ?? []));
  for (const b of comp.geoBroadcasts ?? []) {
    const name = b.media?.shortName;
    if (name && !broadcasts.includes(name)) broadcasts.push(name);
  }
  return {
    id: String(e.id ?? comp.id ?? ''),
    date: e.date ?? comp.date ?? '',
    state: normalizeState(status),
    statusDetail: status.type?.shortDetail ?? status.type?.detail ?? '',
    home,
    away,
    venue: comp.venue?.fullName,
    broadcasts,
    note: comp.notes?.[0]?.headline,
  };
}

/**
 * Postponed/cancelled games stay in ESPN's lists (as 0-0 "finals") next to
 * their make-up games; they never happened, so drop them.
 */
export function wasPostponed(e: Raw): boolean {
  const comp = e?.competitions?.[0] ?? {};
  const status = comp.status ?? e?.status ?? {};
  if (/POSTPONED|CANCELED|CANCELLED|SUSPENDED/i.test(status.type?.name ?? '')) return true;
  const scores = (comp.competitors ?? []).map((c: Raw) => num(c.score));
  return status.type?.state === 'post' && scores.length === 2 && scores.every((v: number | undefined) => !v);
}

export function normalizeScoreboard(raw: Raw): Game[] {
  return (raw?.events ?? []).filter((e: Raw) => !wasPostponed(e)).map(normalizeGame).filter((g: Game) => g.home && g.away);
}

function statLookup(stats: Raw[] = []) {
  return (key: string): Raw | undefined => {
    const k = key.toLowerCase();
    return stats.find(
      (s) => s.name?.toLowerCase() === k || s.type?.toLowerCase() === k || s.abbreviation?.toLowerCase() === k,
    );
  };
}

export function normalizeStandings(raw: Raw): Conference[] {
  const groups: Raw[] = raw?.children?.length ? raw.children : [raw];
  return groups
    .map((g: Raw) => {
      const rows: StandingRow[] = (g.standings?.entries ?? []).map((entry: Raw) => {
        const s = statLookup(entry.stats);
        const display = (k: string) => s(k)?.displayValue ?? s(k)?.summary ?? '-';
        return {
          team: normalizeTeam(entry.team),
          wins: num(s('wins')) ?? 0,
          losses: num(s('losses')) ?? 0,
          pct: num(s('winPercent')) ?? 0,
          gb: display('gamesBehind'),
          streak: display('streak'),
          seed: num(s('playoffSeed')),
          home: display('home'),
          road: display('road'),
          last10: display('lasttengames'),
          ppg: num(s('avgPointsFor')),
          oppPpg: num(s('avgPointsAgainst')),
        };
      });
      rows.sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99) || b.pct - a.pct);
      return { name: g.name ?? 'League', rows };
    })
    .filter((c) => c.rows.length > 0);
}

export function normalizeTeamSchedule(raw: Raw): { team?: TeamRef; games: Game[] } {
  return {
    team: raw?.team ? normalizeTeam(raw.team) : undefined,
    games: (raw?.events ?? []).filter((e: Raw) => !wasPostponed(e)).map(normalizeGame).filter((g: Game) => g.home && g.away),
  };
}

export function normalizeSummary(raw: Raw): GameSummary {
  const header = raw?.header ?? {};
  const game = normalizeGame({ ...header, competitions: header.competitions });
  if (!game.venue && raw?.gameInfo?.venue?.fullName) game.venue = raw.gameInfo.venue.fullName;

  const teamStats = new Map<string, { label: string; value: string }[]>();
  for (const t of raw?.boxscore?.teams ?? []) {
    teamStats.set(
      String(t.team?.id),
      (t.statistics ?? []).map((s: Raw) => ({ label: s.label ?? s.name, value: s.displayValue ?? '' })),
    );
  }

  const teams: TeamBox[] = (raw?.boxscore?.players ?? []).map((p: Raw) => {
    const block = p.statistics?.[0] ?? {};
    const team = normalizeTeam(p.team);
    const players: PlayerLine[] = (block.athletes ?? []).map((a: Raw) => ({
      id: String(a.athlete?.id ?? ''),
      name: a.athlete?.displayName ?? '',
      shortName: a.athlete?.shortName,
      position: a.athlete?.position?.abbreviation,
      starter: !!a.starter,
      dnp: !!a.didNotPlay || !a.stats?.length,
      reason: a.reason,
      stats: a.stats ?? [],
    }));
    return {
      team,
      labels: block.labels ?? block.names ?? [],
      players,
      totals: block.totals ?? [],
      teamStats: teamStats.get(team.id) ?? [],
    };
  });

  return { game, teams, pbp: normalizePlays(raw, teams) };
}

const QUARTER_S = 12 * 60;
const OT_S = 5 * 60;

function clockSeconds(clock: string): number {
  const [m, sec] = clock.includes(':') ? clock.split(':') : ['0', clock];
  return Number(m) * 60 + parseFloat(sec || '0');
}

/** Seconds since tip-off at a given period and game clock. */
export function elapsedSeconds(period: number, clock: string): number {
  const left = clockSeconds(clock);
  if (period <= 4) return (period - 1) * QUARTER_S + (QUARTER_S - left);
  return 4 * QUARTER_S + (period - 5) * OT_S + (OT_S - left);
}

// ESPN fills non-shot plays with a sentinel coordinate around -2^31.
const validCoord = (c: Raw) => c && Number.isFinite(c.x) && Number.isFinite(c.y) && c.x >= 0 && c.x <= 50 && c.y >= -6 && c.y <= 94;

/** ESPN measures y from the hoop; the app measures from the baseline. */
export const HOOP_FROM_BASELINE = 5.25;

/** Assists, score flow and shots from the summary's play-by-play. */
export function normalizePlays(raw: Raw, teams: TeamBox[] = []): PlayByPlay {
  const plays: Raw[] = raw?.plays ?? [];
  const winById = new Map<string, number>();
  for (const w of raw?.winprobability ?? []) {
    if (w.playId != null && Number.isFinite(w.homeWinPercentage)) winById.set(String(w.playId), w.homeWinPercentage);
  }
  const names: Record<string, string> = {};
  for (const t of teams) for (const p of t.players) if (p.id) names[p.id] = p.shortName ?? p.name;

  const assists: AssistEvent[] = [];
  const feed: FeedItem[] = [];
  const flow: FlowPoint[] = [];
  const shots: Shot[] = [];
  let last = '';
  for (const p of plays) {
    const period = num(p.period?.number) ?? 1;
    const clock = p.clock?.displayValue ?? '0:00';
    const home = num(p.homeScore) ?? 0;
    const away = num(p.awayScore) ?? 0;
    const teamId = String(p.team?.id ?? '');
    const ids: string[] = (p.participants ?? []).map((x: Raw) => String(x.athlete?.id ?? ''));
    if (p.text) feed.push({ id: String(p.id ?? feed.length), period, clock, text: p.text, teamId, home, away, scoring: !!p.scoringPlay });

    if (p.scoringPlay && ids.length >= 2 && /assist/i.test(p.text ?? '')) {
      assists.push({ teamId, scorerId: ids[0], passerId: ids[1], points: num(p.scoreValue) ?? 2 });
    }
    // Field-goal attempts only (free throws have no meaningful location).
    if (p.shootingPlay && validCoord(p.coordinate) && !/free throw/i.test(p.type?.text ?? '')) {
      shots.push({
        teamId,
        athleteId: ids[0] ?? '',
        x: p.coordinate.x,
        y: Math.max(0, p.coordinate.y + HOOP_FROM_BASELINE),
        made: !!p.scoringPlay,
        value: num(p.pointsAttempted) ?? 2,
        text: p.text ?? '',
        period,
        clock,
      });
    }
    const key = `${home}-${away}`;
    const homeWin = winById.get(String(p.id));
    if (key !== last || homeWin != null || flow.length === 0) {
      flow.push({ t: elapsedSeconds(period, clock), period, clock, home, away, homeWin });
      last = key;
    }
  }
  return { feed, assists, flow, shots, names };
}

/** Totals assist events into passer → scorer pairs per team. */
export function aggregateAssists(events: AssistEvent[], names: Record<string, string>): Record<string, AssistPairs> {
  const byTeam = new Map<string, Map<string, [string, string, number, number]>>();
  for (const e of events) {
    if (!e.passerId || !e.scorerId) continue;
    const team = byTeam.get(e.teamId) ?? new Map();
    byTeam.set(e.teamId, team);
    const key = `${e.passerId}>${e.scorerId}`;
    const pair = team.get(key) ?? [e.passerId, e.scorerId, 0, 0];
    pair[2] += 1;
    pair[3] += e.points;
    team.set(key, pair);
  }
  const out: Record<string, AssistPairs> = {};
  for (const [teamId, pairs] of byTeam) {
    const list = [...pairs.values()].sort((a, b) => b[2] - a[2]);
    const ids = new Set(list.flatMap((p) => [p[0], p[1]]));
    out[teamId] = { players: [...ids].map((id) => [id, names[id] ?? id]), pairs: list };
  }
  return out;
}

/** ESPN "byathlete" statistics endpoint → flat leaderboard table. */
export function normalizeLeaders(raw: Raw, wanted: { category: string; name: string; label: string }[]): LeaderTable {
  const catDefs: Raw[] = raw?.categories ?? [];
  const columns = wanted.filter((w) => {
    const def = catDefs.find((c) => c.name === w.category);
    return !def || (def.names ?? []).includes(w.name);
  });
  const rows = (raw?.athletes ?? []).map((a: Raw) => {
    const values: Record<string, string> = {};
    for (const col of columns) {
      const def = catDefs.find((c) => c.name === col.category);
      const idx = (def?.names ?? []).indexOf(col.name);
      const cat = (a.categories ?? []).find((c: Raw) => c.name === col.category);
      const v = idx >= 0 ? (cat?.totals?.[idx] ?? cat?.values?.[idx]) : undefined;
      values[`${col.category}.${col.name}`] = v == null ? '-' : String(v);
    }
    return {
      athlete: a.athlete?.displayName ?? '',
      athleteId: String(a.athlete?.id ?? ''),
      team: a.athlete?.teamShortName ?? a.athlete?.team?.abbreviation ?? '',
      values,
    };
  });
  return { columns: columns.map((c) => ({ key: `${c.category}.${c.name}`, label: c.label })), rows };
}

export function normalizeAthlete(raw: Raw): PlayerProfile {
  const a = raw?.athlete ?? raw ?? {};
  return {
    id: String(a.id ?? ''),
    name: a.displayName ?? a.fullName ?? '',
    headshot: a.headshot?.href,
    position: a.position?.displayName ?? a.position?.abbreviation,
    jersey: a.displayJersey ?? (a.jersey ? `#${a.jersey}` : undefined),
    height: a.displayHeight,
    weight: a.displayWeight,
    age: num(a.age),
    team: a.team ? normalizeTeam(a.team) : undefined,
  };
}

/**
 * Game log: `events` is a map of game metadata keyed by id, while the stat lines
 * live under seasonTypes[].categories[].events[] in `labels` column order.
 */
export function normalizeGameLog(raw: Raw): GameLog {
  const labels: string[] = raw?.labels ?? [];
  const meta: Record<string, Raw> = raw?.events ?? {};
  const games: GameLogEntry[] = [];
  const seen = new Set<string>();
  for (const st of raw?.seasonTypes ?? []) {
    const name: string = st.displayName ?? '';
    const seasonType = /regular/i.test(name) ? 'regular' : /post|playoff/i.test(name) ? 'playoffs' : null;
    if (!seasonType) continue;
    for (const cat of st.categories ?? []) {
      for (const ev of cat.events ?? []) {
        const id = String(ev.eventId ?? '');
        if (!id || seen.has(id) || !ev.stats?.length) continue;
        seen.add(id);
        const m = meta[id] ?? {};
        const stats: Record<string, string> = {};
        labels.forEach((l, i) => (stats[l] = String(ev.stats[i] ?? '')));
        games.push({
          gameId: id,
          date: m.gameDate ?? '',
          opponent: normalizeTeam(m.opponent),
          atVs: m.atVs ?? '',
          result: m.gameResult ?? '',
          score: m.score ?? '',
          seasonType,
          stats,
        });
      }
    }
  }
  games.sort((a, b) => a.date.localeCompare(b.date));
  return { labels, games };
}

/** ESPN "byteam" statistics endpoint → per-team numeric columns. */
export function normalizeTeamStats(raw: Raw, wanted: { category: string; name: string; label: string }[]): TeamStatTable {
  const catDefs: Raw[] = raw?.categories ?? [];
  const columns = wanted.filter((w) => (catDefs.find((c) => c.name === w.category)?.names ?? []).includes(w.name));
  const rows = (raw?.teams ?? []).map((t: Raw) => {
    const values: Record<string, number | undefined> = {};
    for (const col of columns) {
      const idx = catDefs.find((c) => c.name === col.category).names.indexOf(col.name);
      const cat = (t.categories ?? []).find((c: Raw) => c.name === col.category);
      values[`${col.category}.${col.name}`] = num(cat?.values?.[idx] ?? cat?.totals?.[idx]);
    }
    return { teamId: String(t.team?.id ?? ''), values };
  });
  return { columns: columns.map((c) => ({ key: `${c.category}.${c.name}`, label: c.label })), rows };
}
