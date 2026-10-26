// Player measures from the season data: active and longest streaks, playing
// archetypes, and lineup combinations summed from five-man lineups.
import { L, P, type BoxTotals, type SeasonLines } from './boxTotals';
import type { TeamLineupSeason } from './lineups';
import type { ShotSplits } from './shotTypes';

export const STREAKS = [
  { id: 'pts20', label: '20+ points', test: (l: number[]) => l[L.pts] >= 20 },
  { id: 'pts30', label: '30+ points', test: (l: number[]) => l[L.pts] >= 30 },
  { id: 'dd', label: 'Double-doubles', test: (l: number[]) => [l[L.pts], l[L.oreb] + l[L.dreb], l[L.ast], l[L.stl], l[L.blk]].filter((v) => v >= 10).length >= 2 },
  { id: 'tpm3', label: '3+ threes', test: (l: number[]) => l[L.tpm] >= 3 },
  { id: 'ast10', label: '10+ assists', test: (l: number[]) => l[L.ast] >= 10 },
  { id: 'reb10', label: '10+ rebounds', test: (l: number[]) => l[L.oreb] + l[L.dreb] >= 10 },
  { id: 'win', label: 'Wins (played)', test: () => false },
] as const;
export type StreakId = (typeof STREAKS)[number]['id'];

export interface Streak {
  id: string;
  /** Games in the current run (0 = ended last game). */
  active: number;
  longest: number;
  /** Date the longest run ended. */
  longestEnd: string;
}

/** Streaks over the games each player played (regular season). */
export function streaks(data: SeasonLines, which: StreakId): Streak[] {
  const games = data.games.filter(([, , type]) => type === 2).sort((a, b) => a[1].localeCompare(b[1]));
  const test = STREAKS.find((s) => s.id === which)!.test;
  const run = new Map<number, { cur: number; best: number; end: string }>();
  for (const [, date, , , , , lines] of games) {
    let home = 0;
    let away = 0;
    for (const l of lines) {
      if (l[L.home]) home += l[L.pts];
      else away += l[L.pts];
    }
    for (const l of lines) {
      if (l[L.min] <= 0) continue;
      const hit = which === 'win' ? (l[L.home] ? home > away : away > home) : test(l);
      const r = run.get(l[L.p]) ?? { cur: 0, best: 0, end: '' };
      r.cur = hit ? r.cur + 1 : 0;
      if (r.cur > r.best) [r.best, r.end] = [r.cur, date];
      run.set(l[L.p], r);
    }
  }
  return [...run].filter(([, r]) => r.best >= 2).map(([p, r]) => ({ id: data.ids[p], active: r.cur, longest: r.best, longestEnd: r.end }));
}

/** The eight archetypes and the profile that defines each (standard scores; unlisted features count as average). */
export const ARCHETYPES = [
  { id: 'creator', label: 'Shot creator', desc: 'High-usage scorers who make their own shots', z: { usg: 1.6, ast: 0.6, selfMade: 1.2, par3: 0.2 } },
  { id: 'playmaker', label: 'Playmaker', desc: 'Run the offence and set others up', z: { ast: 2, usg: 0.4, selfMade: 0.5, reb: -0.6 } },
  { id: 'slasher', label: 'Slasher', desc: 'Attack the rim and draw fouls', z: { rim: 1.4, ftr: 1, par3: -0.8, usg: 0.4 } },
  { id: 'shooter', label: 'Shooter', desc: 'Spot-up and movement threes, mostly off passes', z: { par3: 1.6, selfMade: -1, usg: -0.2, rim: -0.8 } },
  { id: 'wing', label: '3-and-D wing', desc: 'Threes plus steals and deflections, low usage', z: { par3: 0.9, stl: 0.9, usg: -0.8, selfMade: -0.4 } },
  { id: 'stretch', label: 'Stretch big', desc: 'Bigs who rebound and shoot threes', z: { reb: 1, blk: 0.6, par3: 0.8 } },
  { id: 'roller', label: 'Rim-running big', desc: 'Dunks, lobs and putbacks: finishes plays inside', z: { reb: 1.4, rim: 1.6, par3: -1.3, selfMade: -1, usg: -0.4 } },
  { id: 'protector', label: 'Rim protector', desc: 'Blocks and defensive rebounds anchor the defence', z: { blk: 2.2, reb: 1.2, par3: -1, usg: -0.6 } },
] as const;
export type ArchetypeId = (typeof ARCHETYPES)[number]['id'];
const FEATURES = ['usg', 'ast', 'reb', 'stl', 'blk', 'par3', 'rim', 'ftr', 'selfMade'] as const;
type Feature = (typeof FEATURES)[number];

export interface Archetyped {
  id: string;
  team: string;
  minutes: number;
  archetype: ArchetypeId;
  /** Second-closest archetype. */
  also: ArchetypeId;
}

const RIM = ['dunk', 'layup', 'tip'] as const;

/** Assigns each rotation player (15+ minutes a game, 5+ games) the archetype nearest their profile. */
export function archetypes(box: BoxTotals, splits?: ShotSplits): Archetyped[] {
  const teams = new Map(box.teams.map((t) => [t[0], t]));
  const raw = box.players.flatMap((r) => {
    const v = (k: keyof typeof P) => r[P[k]] as number;
    const g = v('gp');
    const min = v('min');
    if (g < 5 || min / g < 15 || !v('fga')) return [];
    const t = teams.get(r[1]);
    const per36 = (x: number) => (36 * x) / min;
    const usg = t && t.length > 17 ? ((v('fga') + 0.44 * v('fta') + v('tov')) * ((t[1] as number) * 48)) / (min * ((t[7] as number) + 0.44 * (t[11] as number) + (t[17] as number))) : per36(v('fga') + 0.44 * v('fta') + v('tov')) / 70;
    const s = splits?.players[r[0]];
    let rimAtt = 0;
    let att = 0;
    let made = 0;
    let assisted = 0;
    if (s) {
      for (const [type, c] of Object.entries(s.types)) {
        if (!c) continue;
        att += c[0];
        made += c[1];
        assisted += c[2];
        if ((RIM as readonly string[]).includes(type)) rimAtt += c[0];
      }
    }
    const f: Record<Feature, number> = {
      usg,
      ast: per36(v('ast')),
      reb: per36(v('oreb') + v('dreb')),
      stl: per36(v('stl')),
      blk: per36(v('blk')),
      par3: v('tpa') / v('fga'),
      rim: att ? rimAtt / att : 0.3,
      ftr: v('fta') / v('fga'),
      selfMade: made ? 1 - assisted / made : 0.5,
    };
    return [{ id: r[0], team: r[1], minutes: min, f }];
  });
  if (raw.length < 10) return [];
  const stats = Object.fromEntries(
    FEATURES.map((k) => {
      const xs = raw.map((p) => p.f[k]);
      const m = xs.reduce((a, b) => a + b, 0) / xs.length;
      const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) || 1;
      return [k, { m, sd }];
    }),
  ) as Record<Feature, { m: number; sd: number }>;
  return raw.map((p) => {
    const z = Object.fromEntries(FEATURES.map((k) => [k, (p.f[k] - stats[k].m) / stats[k].sd])) as Record<Feature, number>;
    const dist = ARCHETYPES.map((a) => ({
      id: a.id,
      d: FEATURES.reduce((s, k) => s + (z[k] - ((a.z as Partial<Record<Feature, number>>)[k] ?? 0)) ** 2, 0),
    })).sort((a, b) => a.d - b.d);
    return { id: p.id, team: p.team, minutes: p.minutes, archetype: dist[0].id, also: dist[1].id };
  });
}

/** Minutes and margin with every one of `ids` on the floor together, summed from five-man lineups. */
export function comboTotals(t: TeamLineupSeason, ids: string[]): { sec: number; pf: number; pa: number; lineups: number } {
  const out = { sec: 0, pf: 0, pa: 0, lineups: 0 };
  if (ids.length === 2) {
    const key = [...ids].sort().join(',');
    const pair = t.pairs?.find(([p]) => [...p].sort().join(',') === key);
    if (pair) return { sec: pair[1], pf: pair[2], pa: pair[3], lineups: 0 };
  }
  for (const [five, sec, pf, pa] of t.lineups) {
    if (!ids.every((id) => five.includes(id))) continue;
    out.sec += sec;
    out.pf += pf;
    out.pa += pa;
    out.lineups++;
  }
  return out;
}
