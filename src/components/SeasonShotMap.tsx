// Season shot map: one square per area of the court, sized by how often they
// shot from there and coloured by FG% against the league from the same
// distance (blue = better, red = worse, grey = about average). Areas are big
// by default so each holds enough shots to compare; finer detail is a click away.
import { useState } from 'react';
import { type BinRow, coarsenCells, COURT_H, COURT_W, leagueByDistance, shotCells, type ShotCell, zoneOf, ZONES } from '../lib/pbpStats';
import { useWidth } from './Charts';
import { CourtLines } from './GameCharts';

/** FG% difference that gets the full colour. */
const FULL_DIFF = 0.12;


export function SeasonShotMap({
  bins,
  size,
  league,
  leagueSize,
  title,
  minShare = 0.004,
}: {
  bins: BinRow[];
  size: number;
  league: BinRow[];
  leagueSize: number;
  title?: string;
  /** Hide bins with fewer than this share of all attempts (noise). */
  minShare?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<ShotCell | null>(null);
  const [fine, setFine] = useState(false);
  const leagueDist = leagueByDistance(league, leagueSize);
  const cells = shotCells(bins, size, leagueDist).filter((c) => c.y <= COURT_H);
  const total = cells.reduce((s, c) => s + c.att, 0);
  if (total < 50) return null;
  // Big areas: twice the bin size each way (4 ft squares for teams, 6 ft for players).
  const areas = fine ? cells : coarsenCells(cells, 2);
  const shown = areas.filter((c) => c.att / total >= (fine ? minShare : minShare * 2));
  const sorted = shown.map((c) => c.att).sort((a, b) => a - b);
  const maxAtt = sorted[Math.floor(sorted.length * 0.9)] || 1;
  const w = Math.min(width, 520);
  const scale = w / COURT_W;
  const h = COURT_H * scale;

  const colour = (diff: number) => {
    const t = Math.min(1, Math.abs(diff) / FULL_DIFF);
    const pole = diff >= 0 ? 'var(--pos)' : 'var(--neg)';
    return `color-mix(in srgb, ${pole} ${Math.round(15 + 85 * t)}%, var(--neutral))`;
  };

  // Zone splits (all attempts, not just shown squares) vs league.
  const zone = (list: ShotCell[]) => {
    const m = new Map<string, [number, number]>();
    for (const c of list) {
      const z = zoneOf(c, c.value);
      const v = m.get(z) ?? [0, 0];
      v[0] += c.att;
      v[1] += c.made;
      m.set(z, v);
    }
    return m;
  };
  const mine = zone(cells);
  const lg = zone(shotCells(league, leagueSize, leagueDist));
  const lgTotal = [...lg.values()].reduce((s, v) => s + v[0], 0);

  return (
    <div className="card shotmap" ref={ref}>
      {title && <h3>{title}</h3>}
      <div className="legend">
        <span><i className="swatch" style={{ background: 'var(--neg)' }} />Worse than league</span>
        <span><i className="swatch" style={{ background: 'var(--neutral)' }} />About average</span>
        <span><i className="swatch" style={{ background: 'var(--pos)' }} />Better than league</span>
        <span className="muted">Bigger square = more shots from there</span>
        <span className="chips tight shotmap-detail">
          <button className={!fine ? 'chip active' : 'chip'} aria-pressed={!fine} onClick={() => setFine(false)}>Bigger areas</button>
          <button className={fine ? 'chip active' : 'chip'} aria-pressed={fine} onClick={() => setFine(true)}>Finer detail</button>
        </span>
      </div>
      <div className="shot-wrap" style={{ width: w }}>
        <svg width={w} height={h} role="img" aria-label="Season shot frequency and accuracy by court location" className="court">
          <CourtLines scale={scale} />
          {shown.map((c, i) => {
            const side = Math.min(1, Math.max(fine ? 0.3 : 0.4, Math.sqrt(c.att / maxAtt))) * c.size * scale - 1.5;
            return (
              <rect
                key={i}
                x={c.x * scale - side / 2}
                y={c.y * scale - side / 2}
                width={side}
                height={side}
                rx={1.5}
                className="shot-bin"
                style={{ fill: colour(c.diff) }}
                onPointerEnter={() => setTip(c)}
                onPointerLeave={() => setTip(null)}
              />
            );
          })}
        </svg>
        {tip && (
          <div className="tooltip" style={{ left: Math.min(tip.x * scale + 12, w - 190), top: tip.y * scale + 12 }}>
            <div className="tt-row">
              <b>{Math.round(tip.pct * 100)}%</b>
              <span>
                {tip.made}/{tip.att} · {tip.diff >= 0 ? '+' : ''}
                {Math.round(tip.diff * 100)} vs league
              </span>
            </div>
            <div className="tt-title">
              {Math.round(Math.hypot(tip.x - 25, tip.y - 5.25))} ft · {tip.value === 3 ? '3-pointers' : '2-pointers'}
            </div>
          </div>
        )}
      </div>
      <table className="zones wide">
        <thead>
          <tr>
            <th className="left">Zone</th>
            <th>Share</th>
            <th>FG%</th>
            <th>League</th>
          </tr>
        </thead>
        <tbody>
          {ZONES.map(({ id: z, label, title }) => {
            const [att, made] = mine.get(z) ?? [0, 0];
            const [la, lm] = lg.get(z) ?? [0, 0];
            const pct = att ? made / att : 0;
            const lpct = la ? lm / la : 0;
            return (
              <tr key={z}>
                <td className="left" title={title}>{label}</td>
                <td>
                  {Math.round((att / total) * 100)}% <span className="muted small">({Math.round((la / lgTotal) * 100)}%)</span>
                </td>
                <td className={pct > lpct ? 'win' : pct < lpct ? 'loss' : undefined}>{att ? `${(pct * 100).toFixed(1)}%` : '-'}</td>
                <td className="muted">{(lpct * 100).toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted small">Share = part of all shots taken from that zone (league share in brackets). {fine ? 'Finer detail shows every small square, so a few shots can swing the colour.' : 'Each square covers a bigger area so it holds enough shots to compare fairly with the league; hover for the numbers.'}</p>
    </div>
  );
}
