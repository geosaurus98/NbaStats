// Season shot map: one square per court bin, sized by how often they shot
// from there and coloured by FG% against the league from the same distance
// (blue = better, red = worse, grey = about average).
import { useState } from 'react';
import { type BinRow, COURT_H, COURT_W, isThree, leagueByDistance, shotCells, type ShotCell } from '../lib/pbpStats';
import { useWidth } from './Charts';
import { CourtLines } from './GameCharts';

/** FG% difference that gets the full colour. */
const FULL_DIFF = 0.12;

function zoneOf(c: { x: number; y: number }): string {
  const d = Math.hypot(c.x - 25, c.y - 5.25);
  if (isThree(c)) return (c.x < 3 || c.x > 47) && c.y < 14 ? 'Corner 3' : 'Above-the-break 3';
  if (d < 4) return 'At the rim';
  if (d < 14) return 'Short range';
  return 'Mid-range';
}
const ZONES = ['At the rim', 'Short range', 'Mid-range', 'Corner 3', 'Above-the-break 3'];

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
  const leagueDist = leagueByDistance(league, leagueSize);
  const cells = shotCells(bins, size, leagueDist).filter((c) => c.y <= COURT_H);
  const total = cells.reduce((s, c) => s + c.att, 0);
  if (total < 50) return null;
  const shown = cells.filter((c) => c.att / total >= minShare);
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
      const z = zoneOf(c);
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
      </div>
      <div className="shot-wrap" style={{ width: w }}>
        <svg width={w} height={h} role="img" aria-label="Season shot frequency and accuracy by court location" className="court">
          <CourtLines scale={scale} />
          {shown.map((c, i) => {
            const side = Math.min(1, Math.max(0.3, Math.sqrt(c.att / maxAtt))) * c.size * scale - 1.5;
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
              {Math.round(Math.hypot(tip.x - 25, tip.y - 5.25))} ft · {isThree(tip) ? '3-pointer' : '2-pointer'}
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
          {ZONES.map((z) => {
            const [att, made] = mine.get(z) ?? [0, 0];
            const [la, lm] = lg.get(z) ?? [0, 0];
            const pct = att ? made / att : 0;
            const lpct = la ? lm / la : 0;
            return (
              <tr key={z}>
                <td className="left">{z}</td>
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
      <p className="muted small">Share = part of all shots taken from that zone (league share in brackets).</p>
    </div>
  );
}
