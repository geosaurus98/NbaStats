// Draft grades: each pick's career value against what that slot usually
// produces, adjusted for how long the class has had to build careers.
import { allStarCounts, totals, type CareerData } from './careers';
import type { FranchiseData } from './franchiseData';
import { franchiseValue } from './franchiseHistory';
import { franchiseOf } from './franchises';

export interface DraftPick {
  season: number;
  pick: number;
  team: string;
  name: string;
  player: number;
  value: number;
}

export interface GradedPick extends DraftPick {
  expected: number;
  /** Career value above what the slot usually gives (same units as value). */
  surplus: number;
}

/** Usual career value at each pick (1-60), smoothed over neighbouring picks. */
export function slotValues(picks: DraftPick[], from: number, to: number): number[] {
  const sum = Array(61).fill(0);
  const n = Array(61).fill(0);
  for (const p of picks) {
    if (p.season < from || p.season > to || p.pick < 1 || p.pick > 60) continue;
    sum[p.pick] += p.value;
    n[p.pick]++;
  }
  const raw = sum.map((s, i) => (n[i] ? s / n[i] : 0));
  return raw.map((_, i) => {
    if (i === 0) return 0;
    const w = i <= 5 ? 0 : i <= 14 ? 1 : 2;
    const xs = raw.slice(Math.max(1, i - w), Math.min(60, i + w) + 1);
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  });
}

/**
 * Grades every pick. A class's expected values are scaled by how much value
 * its whole class has produced so far against a typical class, so a class
 * only three seasons in is compared fairly.
 */
export function gradePicks(picks: DraftPick[], from = 1990): GradedPick[] {
  const years = [...new Set(picks.map((p) => p.season))].sort((a, b) => a - b);
  const last = years[years.length - 1] ?? 0;
  // Slot values from classes whose careers are mostly done.
  const slots = slotValues(picks, from, last - 10);
  const typical = slots.slice(1, 61).reduce((a, b) => a + b, 0);
  const byYear = new Map<number, number>();
  for (const p of picks) if (p.pick <= 60) byYear.set(p.season, (byYear.get(p.season) ?? 0) + p.value);
  return picks
    .filter((p) => p.season >= from && p.pick >= 1 && p.pick <= 60)
    .map((p) => {
      const scale = typical ? Math.min(1.5, (byYear.get(p.season) ?? 0) / typical) : 1;
      const expected = slots[p.pick] * scale;
      return { ...p, expected, surplus: p.value - expected };
    });
}

export interface ClassGrade {
  team: string;
  season: number;
  picks: GradedPick[];
  surplus: number;
  grade: string;
}

const LETTERS: [number, string][] = [[1.5, 'A+'], [1, 'A'], [0.6, 'A-'], [0.3, 'B+'], [0.1, 'B'], [-0.1, 'B-'], [-0.3, 'C+'], [-0.5, 'C'], [-0.8, 'C-'], [-1.2, 'D'], [-Infinity, 'F']];

/** Letter grade for a z-score of class surplus. */
export const letter = (z: number) => LETTERS.find(([min]) => z >= min)![1];

/** Each team's draft class for one season, graded against every team-class since `from`. */
export function classGrades(graded: GradedPick[], season: number): ClassGrade[] {
  const classes = new Map<string, GradedPick[]>();
  for (const p of graded) {
    const k = `${p.season}|${p.team}`;
    classes.set(k, [...(classes.get(k) ?? []), p]);
  }
  // Spread of class surplus within the same draft, so recent drafts aren't graded on a bigger scale.
  const same = [...classes.entries()].filter(([k]) => Number(k.split('|')[0]) === season).map(([, ps]) => ps.reduce((a, p) => a + p.surplus, 0));
  const m = same.reduce((a, b) => a + b, 0) / (same.length || 1);
  const sd = Math.sqrt(same.reduce((a, b) => a + (b - m) ** 2, 0) / (same.length || 1)) || 1;
  return [...classes.entries()]
    .filter(([k]) => Number(k.split('|')[0]) === season)
    .map(([k, ps]) => {
      const surplus = ps.reduce((a, p) => a + p.surplus, 0);
      return { team: k.split('|')[1], season, picks: ps.sort((a, b) => a.pick - b.pick), surplus, grade: letter((surplus - m) / sd) };
    })
    .sort((a, b) => b.surplus - a.surplus);
}

/** Total surplus by team over a span of drafts: who drafts best. */
export function teamDrafting(graded: GradedPick[], from: number, to: number): { team: string; surplus: number; hits: number; picks: number }[] {
  const by = new Map<string, { team: string; surplus: number; hits: number; picks: number }>();
  for (const p of graded) {
    if (p.season < from || p.season > to) continue;
    const r = by.get(p.team) ?? { team: p.team, surplus: 0, hits: 0, picks: 0 };
    r.surplus += p.surplus;
    r.picks++;
    if (p.surplus > Math.max(2000, p.expected)) r.hits++;
    by.set(p.team, r);
  }
  return [...by.values()].sort((a, b) => b.surplus - a.surplus);
}


/** Every NBA/BAA pick with its career value (franchise ids, not historical codes). */
export function draftPicksFrom(fd: FranchiseData, careers: CareerData): DraftPick[] {
  const stars = allStarCounts(careers);
  return fd.draft
    .filter((d) => d[1] !== 1)
    .map((d) => {
      const t = d[5] >= 0 ? totals(careers.seasons[d[5]] ?? []) : undefined;
      return { season: d[0], pick: d[2], team: franchiseOf(d[4])?.id ?? d[4], name: d[6], player: d[5], value: t ? franchiseValue(t.values) + (stars.get(d[5]) ?? 0) * 2000 : 0 };
    });
}

/** Drafts held during a tenure (dates as Basketball-Reference gives them: "1994-07-21", "1967", "present"). */
export function draftsDuring(start: string, end: string): (year: number) => boolean {
  const from = start.length === 4 ? `${start}-01-01` : start;
  const to = end === 'present' || !end ? '9999-12-31' : end.length === 4 ? `${end}-12-31` : end;
  return (year) => `${year}-06-25` >= from && `${year}-06-25` <= to;
}
