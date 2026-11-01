import { describe, expect, it } from 'vitest';
import careersJson from '../data/careers.json';
import franchisesJson from '../data/franchises.json';
import { allStarCounts, totals, type CareerData } from './careers';
import { classGrades, gradePicks, teamDrafting, type DraftPick } from './draftGrades';
import type { FranchiseData } from './franchiseData';
import { franchiseValue } from './franchiseHistory';
import { franchiseOf } from './franchises';

const careers = careersJson as unknown as CareerData;
const fd = franchisesJson as unknown as FranchiseData;
const stars = allStarCounts(careers);
const picks: DraftPick[] = fd.draft
  .filter((d) => d[1] !== 1)
  .map((d) => {
    const t = d[5] >= 0 ? totals(careers.seasons[d[5]] ?? []) : undefined;
    return { season: d[0], pick: d[2], team: franchiseOf(d[4])?.id ?? d[4], name: d[6], player: d[5], value: t ? franchiseValue(t.values) + (stars.get(d[5]) ?? 0) * 2000 : 0 };
  });

describe('draft grades', () => {
  const graded = gradePicks(picks);
  it('makes famous steals big surpluses', () => {
    const jokic = graded.find((p) => p.name === 'Nikola Jokić' || p.name === 'Nikola Jokic')!;
    expect(jokic.pick).toBe(41);
    expect(jokic.surplus).toBeGreaterThan(20000);
    const bennett = graded.find((p) => p.name === 'Anthony Bennett')!;
    expect(bennett.surplus).toBeLessThan(0);
  });
  it('grades a class', () => {
    const c2014 = classGrades(graded, 2014);
    expect(c2014.length).toBeGreaterThan(20);
    const den = c2014.find((c) => c.picks.some((p) => /Joki/.test(p.name)))!;
    expect(den.grade).toMatch(/^A/);
  });
  it('ranks teams over a span', () => {
    const r = teamDrafting(graded, 2000, 2020);
    expect(r.length).toBe(30);
    expect(r[0].surplus).toBeGreaterThan(r[29].surplus);
  });
});
