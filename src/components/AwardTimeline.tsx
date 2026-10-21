// Awards page: how the model's ladder moved through the season, rebuilt week
// by week from every game's player lines.
import { useMemo } from 'react';
import type { SeasonSnapshot } from '../api/snapshot';
import { loadLines } from '../api/linesStore';
import { useAsync } from '../hooks/useAsync';
import { candidates, rankAward, type AwardId } from '../lib/awards';
import { formatShortDate } from '../lib/dates';
import { snapshotBefore } from '../lib/gameLines';
import { LineChart } from './Charts';

// Three validated series colours; anyone else in the race is a muted context line.
const COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)'];
const WEEK = 7 * 864e5;

export function AwardTimeline({ snap, award }: { snap: SeasonSnapshot; award: AwardId }) {
  const lines = useAsync(() => loadLines(snap.year), [snap.year]);
  const model = useMemo(() => {
    if (!lines.data) return undefined;
    const dates = lines.data.games.filter((g) => g[2] === 2).map((g) => g[1]).sort();
    if (dates.length < 50) return undefined;
    const first = new Date(dates[0]).getTime() + 3 * WEEK; // a few weeks in, so the ladder means something
    const last = new Date(dates[dates.length - 1]).getTime() + 864e5;
    const cuts: string[] = [];
    for (let t = first; t < last; t += WEEK) cuts.push(new Date(t).toISOString());
    cuts.push(new Date(last).toISOString());
    const weeks = cuts.map((cut) => {
      const s = snapshotBefore(snap, lines.data!, cut);
      const { list, leagueDrtg } = candidates(s);
      return rankAward(award, list, leagueDrtg).filter((r) => r.eligible);
    });
    // Everyone who was top three at some point (up to five players).
    const best = new Map<string, number>();
    for (const w of weeks) w.slice(0, 3).forEach((r, k) => best.set(r.c.id, Math.min(best.get(r.c.id) ?? 99, k)));
    const ids = [...best].sort((a, b) => a[1] - b[1] || 0).map(([id]) => id);
    const finalOrder = weeks[weeks.length - 1].map((r) => r.c.id);
    ids.sort((a, b) => (finalOrder.indexOf(a) + 1 || 999) - (finalOrder.indexOf(b) + 1 || 999));
    return {
      cuts,
      series: ids.slice(0, 5).map((id, k) => ({
        id,
        label: snap.players?.[id] ?? id,
        color: COLORS[k],
        values: weeks.map((w) => {
          const r = w.find((x) => x.c.id === id);
          return r ? Math.round(r.score * 10) / 10 : null;
        }),
      })),
    };
  }, [lines.data, snap, award]);

  if (!model || model.series.length === 0) return null;
  return (
    <div className="card">
      <h3>The race through the season</h3>
      <LineChart
        ariaLabel="Model score week by week for the leading candidates"
        series={model.series}
        xLabel={(i) => `Through ${formatShortDate(model.cuts[i])}`}
        xTick={(i) => formatShortDate(model.cuts[i])}
        yFormat={(v) => v.toFixed(0)}
      />
      <div className="chips tight">
        {model.series.filter((s) => s.color).map((s) => (
          <span key={s.id} className="chip static"><span className="legend-dot" style={{ background: s.color }} /> {s.label}</span>
        ))}
      </div>
      <p className="muted small">{model.series.some((s) => !s.color) ? `Grey: ${model.series.filter((s) => !s.color).map((s) => s.label).join(', ')}. ` : ''}Model score each week, from games up to that date. The weekly scores leave out on/off splits (only kept for the whole season), so the last point can differ slightly from the table.</p>
    </div>
  );
}
