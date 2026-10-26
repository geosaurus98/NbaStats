// A scatter plot with labelled axes, optional average guide lines, muted
// context points, direct labels for highlighted points and a hover tooltip.
import { useState } from 'react';
import { useWidth } from './Charts';

export interface ScatterPoint {
  id: string;
  x: number;
  y: number;
  label: string;
  /** Tooltip lines under the label. */
  detail?: string[];
  /** Drawn in the accent colour and labelled on the chart. */
  highlight?: boolean;
  /** Drawn faint, behind everything (e.g. past seasons). */
  context?: boolean;
  /** Shown as a short label next to the dot when highlighted. */
  short?: string;
}

const PAD = { left: 52, right: 16, top: 14, bottom: 40 };

function ticks(min: number, max: number, n = 5): number[] {
  const span = max - min || 1;
  const step = 10 ** Math.floor(Math.log10(span / n));
  const nice = [1, 2, 2.5, 5, 10].map((m) => m * step).find((s) => span / s <= n) ?? step * 10;
  const out: number[] = [];
  for (let v = Math.ceil(min / nice) * nice; v <= max + 1e-9; v += nice) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

export function ScatterPlot({
  points,
  xLabel,
  yLabel,
  xFormat = (v) => String(v),
  yFormat = (v) => String(v),
  guides,
  diagonal = false,
  height = 380,
  ariaLabel,
  onPick,
}: {
  points: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  xFormat?: (v: number) => string;
  yFormat?: (v: number) => string;
  /** Average lines, e.g. the league mean on each axis. */
  guides?: { x?: number; y?: number };
  /** A dashed y = x line (e.g. actual vs expected). */
  diagonal?: boolean;
  height?: number;
  ariaLabel: string;
  onPick?: (p: ScatterPoint) => void;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<ScatterPoint | null>(null);
  if (!points.length) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const padX = (Math.max(...xs) - Math.min(...xs)) * 0.05 || 1;
  const padY = (Math.max(...ys) - Math.min(...ys)) * 0.06 || 1;
  const [x0, x1] = [Math.min(...xs) - padX, Math.max(...xs) + padX];
  const [y0, y1] = [Math.min(...ys) - padY, Math.max(...ys) + padY];
  const sx = (v: number) => PAD.left + ((v - x0) / (x1 - x0)) * (width - PAD.left - PAD.right);
  const sy = (v: number) => height - PAD.bottom - ((v - y0) / (y1 - y0)) * (height - PAD.top - PAD.bottom);
  const order = [...points].sort((a, b) => Number(!!b.context) - Number(!!a.context) || Number(!!a.highlight) - Number(!!b.highlight));

  return (
    <div className="chart scatter" ref={ref} onMouseLeave={() => setHover(null)}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel}>
        {ticks(y0, y1).map((t) => (
          <g key={`y${t}`}>
            <line x1={PAD.left} x2={width - PAD.right} y1={sy(t)} y2={sy(t)} className="grid" />
            <text x={PAD.left - 6} y={sy(t) + 4} textAnchor="end" className="tick">{yFormat(t)}</text>
          </g>
        ))}
        {ticks(x0, x1, Math.max(3, Math.floor(width / 110))).map((t) => (
          <text key={`x${t}`} x={sx(t)} y={height - PAD.bottom + 16} textAnchor="middle" className="tick">{xFormat(t)}</text>
        ))}
        {guides?.x != null && <line x1={sx(guides.x)} x2={sx(guides.x)} y1={PAD.top} y2={height - PAD.bottom} className="guide" />}
        {guides?.y != null && <line x1={PAD.left} x2={width - PAD.right} y1={sy(guides.y)} y2={sy(guides.y)} className="guide" />}
        {diagonal && (() => {
          const lo = Math.max(x0, y0);
          const hi = Math.min(x1, y1);
          return hi > lo ? <line x1={sx(lo)} y1={sy(lo)} x2={sx(hi)} y2={sy(hi)} className="guide" /> : null;
        })()}
        <text x={(PAD.left + width - PAD.right) / 2} y={height - 6} textAnchor="middle" className="axis-label">{xLabel}</text>
        <text x={12} y={(PAD.top + height - PAD.bottom) / 2} textAnchor="middle" className="axis-label" transform={`rotate(-90 12 ${(PAD.top + height - PAD.bottom) / 2})`}>{yLabel}</text>
        {order.map((p) => (
          <g key={p.id}>
            <circle
              cx={sx(p.x)}
              cy={sy(p.y)}
              r={p.context ? 3 : p.highlight ? 5.5 : 4.5}
              className={p.context ? 'dot context' : p.highlight ? 'dot hl' : 'dot'}
              onMouseEnter={() => setHover(p)}
              onClick={() => onPick?.(p)}
              style={onPick && !p.context ? { cursor: 'pointer' } : undefined}
            />
            {p.highlight && (
              <text x={sx(p.x) + 8} y={sy(p.y) + 4} className="dot-label">{p.short ?? p.label}</text>
            )}
          </g>
        ))}
        {/* Bigger invisible hit targets so small dots are easy to hover. */}
        {order.filter((p) => !p.context).map((p) => (
          <circle key={`hit${p.id}`} cx={sx(p.x)} cy={sy(p.y)} r={9} fill="transparent" onMouseEnter={() => setHover(p)} onClick={() => onPick?.(p)} style={onPick ? { cursor: 'pointer' } : undefined} />
        ))}
        {hover && <circle cx={sx(hover.x)} cy={sy(hover.y)} r={8} className="dot-ring" />}
      </svg>
      {hover && (
        <div className="tooltip" style={{ left: Math.min(sx(hover.x) + 12, width - 200), top: Math.max(0, sy(hover.y) - 50) }}>
          <b>{hover.label}</b>
          <div className="muted">{xLabel}: {xFormat(hover.x)}</div>
          <div className="muted">{yLabel}: {yFormat(hover.y)}</div>
          {hover.detail?.map((d) => (
            <div key={d} className="muted">{d}</div>
          ))}
        </div>
      )}
    </div>
  );
}
