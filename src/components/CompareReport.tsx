// Compare page: a full side-by-side report for the chosen players from the
// season data: advanced stats, shot diet, archetype, career arc by age and
// contract value. Works offline, unlike the live game logs above it.
import { useMemo } from 'react';
import { DEFAULT_SEASON } from '../lib/seasons';
import { seasonSnapshot } from '../api/espn';
import { loadSnapshot } from '../api/snapshotStore';
import { useAsync } from '../hooks/useAsync';
import { playerAdvanced } from '../lib/advanced';
import { byAge } from '../lib/aging';
import { loadCareers } from '../lib/careers';
import { ARCHETYPES, archetypes } from '../lib/playerExtras';
import { money } from '../lib/salaryCap';
import { SHOT_TYPES } from '../lib/shotTypes';
import { loadTeammateGraph } from '../lib/teammateStore';
import { LineChart } from './Charts';
import { useTeamSeasons } from './TeamAnalytics';
import { per48 } from './TeamLineups';
import { pct1 } from '../lib/format';

const COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)'];

export function CompareReport({ ids, season, names }: { ids: string[]; season: number; names: (id: string) => string }) {
  const snap = seasonSnapshot(season);
  const teams = useTeamSeasons(season, 2);
  const capYear = DEFAULT_SEASON;
  const extra = useAsync(async () => {
    const [careers, graph, current] = await Promise.all([loadCareers(), loadTeammateGraph(), loadSnapshot(capYear)]);
    return { careers, graph, current };
  }, [capYear]);
  const adv = useMemo(() => (snap?.box?.['2'] && teams.data ? playerAdvanced(snap.box['2'], teams.data.seasons) : []), [snap, teams.data]);
  const arch = useMemo(() => (snap?.box?.['2'] ? archetypes(snap.box['2'], snap.shotSplits?.['2']) : []), [snap]);
  if (!snap?.box || ids.length < 2) return null;
  const rows = ids.map((id, i) => {
    const a = adv.find((p) => p.id === id);
    const splits = snap.shotSplits?.['2']?.players[id];
    const att = splits ? Object.values(splits.types).reduce((s, c) => s + (c?.[0] ?? 0), 0) : 0;
    const team = snap.lineups?.['2']?.[a?.team ?? ''];
    const oo = team?.onOff.find((r) => r[0] === id);
    const onOff = oo ? per48(oo[2], oo[3], oo[1]) - per48(oo[5] - oo[2], oo[6] - oo[3], oo[4] - oo[1]) : undefined;
    const pay = extra.data?.current?.payroll ? Object.values(extra.data.current.payroll).flat().find((p) => p.espn === id) : undefined;
    const idx = extra.data?.graph.data.espn?.[id];
    const arc = idx != null && extra.data ? byAge(extra.data.careers.seasons[idx] ?? []) : undefined;
    return { id, i, a, splits, att, onOff, pay, arc, arch: arch.find((p) => p.id === id), wpa: snap.wpa?.['2']?.players.find((r) => r[0] === id)?.[3] };
  });
  const best = (vals: (number | undefined)[], low = false) => {
    const xs = vals.filter((v): v is number => v != null);
    return xs.length ? (low ? Math.min(...xs) : Math.max(...xs)) : undefined;
  };
  const statRows: { label: string; get: (r: (typeof rows)[number]) => number | undefined; fmt: (v: number) => string; low?: boolean }[] = [
    { label: 'PER', get: (r) => r.a?.per, fmt: (v) => v.toFixed(1) },
    { label: 'Win Shares', get: (r) => r.a?.ws, fmt: (v) => v.toFixed(1) },
    { label: 'WS/48', get: (r) => r.a?.ws48, fmt: (v) => v.toFixed(3).replace(/^0/, '') },
    { label: 'True shooting', get: (r) => r.a?.ts, fmt: pct1 },
    { label: 'Usage', get: (r) => r.a?.usg, fmt: pct1 },
    { label: 'Offensive rating', get: (r) => r.a?.ortg, fmt: (v) => v.toFixed(0) },
    { label: 'Defensive rating', get: (r) => r.a?.drtg, fmt: (v) => v.toFixed(0), low: true },
    { label: 'On/off swing (per 48)', get: (r) => r.onOff, fmt: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}` },
    { label: 'Win prob. added', get: (r) => r.wpa, fmt: (v) => `${v > 0 ? '+' : ''}${v.toFixed(2)}` },
    { label: 'Salary', get: (r) => r.pay?.salaries[0] ?? undefined, fmt: (v) => money(v), low: true },
    { label: 'Win Shares per $10M', get: (r) => (r.pay?.salaries[0] && r.a ? r.a.ws / (r.pay.salaries[0] / 1e7) : undefined), fmt: (v) => v.toFixed(2) },
  ];
  const types = SHOT_TYPES.filter((t) => rows.some((r) => r.splits && (r.splits.types[t.id]?.[0] ?? 0) / Math.max(1, r.att) >= 0.04));
  const ages = [...new Set(rows.flatMap((r) => [...(r.arc?.keys() ?? [])]))].sort((a, b) => a - b);
  return (
    <>
      <h2>Full report</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <td className="left" />
              {rows.map((r) => (
                <th key={r.id}><i className="key-line" style={{ background: COLORS[r.i] }} /> {names(r.id)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="left">Archetype</td>
              {rows.map((r) => (
                <td key={r.id} className="small">{r.arch ? ARCHETYPES.find((a) => a.id === r.arch!.archetype)?.label : '–'}</td>
              ))}
            </tr>
            {statRows.map((s) => {
              const vals = rows.map(s.get);
              const top = best(vals, s.low);
              return (
                <tr key={s.label}>
                  <td className="left">{s.label}</td>
                  {vals.map((v, i) => (
                    <td key={rows[i].id} className={v != null && v === top && vals.filter((x) => x != null).length > 1 ? 'strong' : undefined}>{v == null ? '–' : s.fmt(v)}</td>
                  ))}
                </tr>
              );
            })}
            {types.map((t) => (
              <tr key={t.id}>
                <td className="left muted">{t.label} (share · FG%)</td>
                {rows.map((r) => {
                  const c = r.splits?.types[t.id];
                  return <td key={r.id} className="small">{c && r.att ? `${Math.round((c[0] / r.att) * 100)}% · ${c[0] >= 5 ? pct1(c[1] / c[0]) : '–'}` : '–'}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">Regular season. Bold = best of the group. Salaries are this season's (Basketball-Reference); on/off is team margin per 48 with the player on court minus on the bench.</p>
      {ages.length > 1 && (
        <div className="card">
          <h3>Points per game by age</h3>
          <LineChart
            series={rows.map((r) => ({ id: r.id, label: names(r.id), color: COLORS[r.i], values: ages.map((a) => { const v = r.arc?.get(a); return v && v.g >= 10 ? Math.round(v.pts * 10) / 10 : null; }) }))}
            height={240}
            xLabel={(i) => `Age ${ages[i]}`}
            xTick={(i) => String(ages[i])}
            ariaLabel="Points per game by age for each player"
          />
          <p className="muted small">Completed seasons (Basketball-Reference), 10+ games.</p>
        </div>
      )}
    </>
  );
}
