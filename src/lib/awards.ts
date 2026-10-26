// A simple, transparent awards model: MVP, Defensive Player of the Year and
// Rookie of the Year ladders from season box-score totals, team records and
// on/off splits. Weights were checked against the real 2024-25 voting.
import type { SeasonSnapshot } from '../api/snapshot';
import { nameKey, P, type PlayerTotalsRow } from './boxTotals';

export type AwardId = 'mvp' | 'dpoy' | 'roy';

export const AWARDS: { id: AwardId; name: string; short: string }[] = [
  { id: 'mvp', name: 'Most Valuable Player', short: 'MVP' },
  { id: 'dpoy', name: 'Defensive Player of the Year', short: 'DPOY' },
  { id: 'roy', name: 'Rookie of the Year', short: 'ROY' },
];

export interface Candidate {
  id: string;
  name: string;
  teamId: string;
  gp: number;
  teamGames: number;
  mpg: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  /** Defensive rebounds per game. */
  drpg: number;
  ts: number | undefined;
  /** Game Score per game (Hollinger): one-number box-score production. */
  gmsc: number;
  winPct: number;
  /** Plus-minus per game. */
  pm: number;
  /** Team net points per 48 with him on court minus with him off. */
  onOffNet?: number;
  /** Points per 48 the team allows with him off minus with him on (positive = better defence with him). */
  onOffDef?: number;
  /** Team points allowed per 100 possessions. */
  teamDrtg: number;
  rookie: boolean;
}

export interface Ranked {
  c: Candidate;
  score: number;
  /** Parts of the score, for the "why" line. */
  parts: { label: string; value: number }[];
  eligible: boolean;
}

/** Players must play 65 of 82 games for MVP and DPOY; pro-rated during the season. */
export const MIN_GAMES_SHARE = 65 / 82;

export function candidates(snap: SeasonSnapshot): { list: Candidate[]; leagueDrtg: number } {
  const box = snap.box?.['2'];
  if (!box) return { list: [], leagueDrtg: 0 };
  const record = new Map<string, [number, number]>();
  for (const [, , h, a, hs, as, note] of snap.games['2'] ?? []) {
    if (hs == null || as == null || (hs === 0 && as === 0) || /cup championship/i.test(note ?? '')) continue;
    for (const [t, won] of [[h, hs > as], [a, as > hs]] as const) {
      const r = record.get(t) ?? [0, 0];
      r[won ? 0 : 1]++;
      record.set(t, r);
    }
  }
  const teams = new Map(box.teams.map((t) => [t[0], t]));
  const opp = box.teams.reduce((n, t) => n + t[3], 0);
  const oppPoss = box.teams.reduce((n, t) => n + t[5], 0);
  const leagueDrtg = oppPoss ? (opp / oppPoss) * 100 : 0;
  const onOff = new Map<string, { net: number; def: number }>();
  for (const team of Object.values(snap.lineups?.['2'] ?? {})) {
    for (const [id, onS, onPF, onPA, gS, gPF, gPA] of team.onOff) {
      const offS = gS - onS;
      if (onS < 60 || offS < 600) continue;
      onOff.set(id, {
        net: ((onPF - onPA) / onS - (gPF - onPF - (gPA - onPA)) / offS) * 2880,
        def: ((gPA - onPA) / offS - onPA / onS) * 2880,
      });
    }
  }
  const rookies = new Set(box.rookies ?? []);
  const list = box.players
    .filter((r) => (r[P.gp] as number) > 0)
    .map((r: PlayerTotalsRow): Candidate => {
      const v = (k: keyof typeof P) => r[P[k]] as number;
      const g = v('gp');
      const team = teams.get(r[1]);
      const [w, l] = record.get(r[1]) ?? [0, 0];
      const tsa = 2 * (v('fga') + 0.44 * v('fta'));
      const gmsc = v('pts') + 0.4 * v('fgm') - 0.7 * v('fga') - 0.4 * (v('fta') - v('ftm')) + 0.7 * v('oreb') + 0.3 * v('dreb') + v('stl') + 0.7 * v('ast') + 0.7 * v('blk') - 0.4 * v('pf') - v('tov');
      const oo = onOff.get(r[0]);
      return {
        id: r[0],
        name: snap.players?.[r[0]] ?? r[0],
        teamId: r[1],
        gp: g,
        teamGames: team?.[1] ?? g,
        mpg: v('min') / g,
        ppg: v('pts') / g,
        rpg: (v('oreb') + v('dreb')) / g,
        apg: v('ast') / g,
        spg: v('stl') / g,
        bpg: v('blk') / g,
        drpg: v('dreb') / g,
        ts: tsa ? v('pts') / tsa : undefined,
        gmsc: gmsc / g,
        winPct: w + l ? w / (w + l) : 0.5,
        pm: v('pm') / g,
        onOffNet: oo?.net,
        onOffDef: oo?.def,
        teamDrtg: team && team[5] ? (team[3] / team[5]) * 100 : leagueDrtg,
        rookie: rookies.has(r[0]),
      };
    });
  return { list, leagueDrtg };
}

const availability = (c: Candidate, share: number) => Math.min(1, c.gp / Math.max(1, share * c.teamGames));
const meetsGames = (c: Candidate) => c.gp >= Math.floor(MIN_GAMES_SHARE * c.teamGames);

/** Ranks every candidate for one award, best first. */
export function rankAward(award: AwardId, list: Candidate[], leagueDrtg: number): Ranked[] {
  const out: Ranked[] = [];
  for (const c of list) {
    let parts: { label: string; value: number }[];
    let eligible: boolean;
    if (award === 'mvp') {
      if (c.mpg < 20) continue;
      eligible = meetsGames(c);
      parts = [
        { label: 'production', value: c.gmsc * availability(c, 0.9) },
        { label: 'team record', value: 30 * (c.winPct - 0.5) },
        { label: 'plus-minus', value: 0.25 * c.pm },
        { label: 'on/off', value: 0.1 * (c.onOffNet ?? 0) },
      ];
    } else if (award === 'dpoy') {
      if (c.mpg < 24) continue;
      eligible = meetsGames(c);
      parts = [
        { label: 'steals', value: 2.2 * c.spg },
        { label: 'blocks', value: 2.4 * c.bpg },
        { label: 'defensive rebounds', value: 0.3 * c.drpg },
        { label: 'on/off defence', value: 0.2 * (c.onOffDef ?? 0) },
        { label: 'team defence', value: 0.4 * (leagueDrtg - c.teamDrtg) * (c.mpg / 34) },
        // Voters rarely pick high-usage scorers; this nudges towards defensive specialists.
        { label: 'scoring load', value: -0.08 * c.ppg },
      ];
    } else {
      if (!c.rookie || c.mpg < 12) continue;
      eligible = true;
      parts = [
        { label: 'production', value: c.gmsc * availability(c, 0.85) },
        { label: 'minutes', value: 0.1 * c.mpg },
        { label: 'team record', value: 6 * (c.winPct - 0.5) },
      ];
    }
    out.push({ c, score: parts.reduce((n, p) => n + p.value, 0), parts, eligible });
  }
  return out.sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score);
}

/** Real voting (top vote-getters and their share of the maximum points), where the source has it. */
export const ACTUAL: Record<number, Partial<Record<AwardId, [string, number][]>>> = {
  2025: {
    mvp: [['Shai Gilgeous-Alexander', 0.913], ['Nikola Jokić', 0.787], ['Giannis Antetokounmpo', 0.47], ['Jayson Tatum', 0.311], ['Donovan Mitchell', 0.074], ['LeBron James', 0.016], ['Cade Cunningham', 0.012], ['Anthony Edwards', 0.012]],
    dpoy: [['Evan Mobley', 0.57], ['Dyson Daniels', 0.394], ['Draymond Green', 0.308], ['Luguentz Dort', 0.218], ['Amen Thompson', 0.186], ['Ivica Zubac', 0.068], ['Jaren Jackson Jr.', 0.018], ['Giannis Antetokounmpo', 0.01]],
    roy: [['Stephon Castle', 0.964], ['Zaccharie Risacher', 0.49], ['Jaylen Wells', 0.246], ['Alex Sarr', 0.068], ['Zach Edey', 0.02], ["Kel'el Ware", 0.008]],
  },
};

export function actualVotes(season: number, award: AwardId): Map<string, { share: number; rank: number }> | undefined {
  const rows = ACTUAL[season]?.[award];
  return rows && new Map(rows.map(([name, share], i) => [nameKey(name), { share, rank: i + 1 }]));
}

/**
 * Chance each candidate finishes first. Each player's expected final score
 * blends this season's score with last season's (`prior`), leaning on this
 * season more as games are played; the rest of the season is then simulated
 * by adding random noise that shrinks as fewer games are left. Players who
 * can't reach the games minimum any more are left out.
 */
export function awardOdds(ranked: Ranked[], award: AwardId, prior?: Map<string, number>, totalGames = 82, sims = 4000): Map<string, number> {
  // This season's top 40, plus last season's top 15 wherever they are now.
  const priorTop = new Set([...(prior ?? [])].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([id]) => id));
  const pool = [...ranked].sort((a, b) => b.score - a.score).filter((r, i) => i < 40 || priorTop.has(r.c.id));
  if (!pool.length) return new Map();
  const played = Math.max(...pool.map((r) => r.c.teamGames));
  const left = Math.max(0, totalGames - played) / totalGames;
  const possible = pool.filter((r) => award === 'roy' || r.c.gp + (r.c.teamGames ? (totalGames - r.c.teamGames) * 0.9 : 0) >= Math.floor(MIN_GAMES_SHARE * totalGames));
  if (!possible.length) return new Map();
  if (left === 0) return new Map([[[...possible].sort((a, b) => b.score - a.score)[0].c.id, 1]]);
  const top = [...possible].sort((a, b) => b.score - a.score).slice(0, 10).map((r) => r.score);
  const mean = top.reduce((a, b) => a + b, 0) / top.length;
  const spread = Math.sqrt(top.reduce((a, b) => a + (b - mean) ** 2, 0) / top.length) || 1;
  // Players with no score last season start from a modest baseline.
  const baseline = [...possible].sort((a, b) => b.score - a.score)[Math.min(possible.length - 1, 19)].score;
  const priorValues = [...(prior?.values() ?? [])].sort((a, b) => b - a);
  const priorBase = priorValues[19] ?? baseline;
  const done = 1 - left;
  const expected = possible.map((r) => {
    const p = prior?.get(r.c.id);
    return { id: r.c.id, mean: prior ? done * r.score + (1 - done) * (p ?? priorBase) : r.score };
  });
  const sd = spread * (0.3 + 1.5 * Math.sqrt(left));
  // A fixed-seed generator keeps the odds stable between page loads.
  let seed = 12345;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const normal = () => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
  const wins = new Map<string, number>();
  for (let s = 0; s < sims; s++) {
    let best = -Infinity;
    let who = '';
    for (const e of expected) {
      const v = e.mean + sd * normal();
      if (v > best) [best, who] = [v, e.id];
    }
    wins.set(who, (wins.get(who) ?? 0) + 1);
  }
  return new Map([...wins].map(([id, n]) => [id, n / sims]));
}
