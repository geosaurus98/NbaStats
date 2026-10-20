// Small dependency-free SVG charts: a line chart with a snapping crosshair
// tooltip, and a column chart with per-bar tooltips. Colors come from CSS
// tokens (--series-N, --pos, --neg) so light/dark themes swap in one place.
import { useEffect, useRef, useState, type PointerEvent, type ReactNode, type RefObject } from 'react';

function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(320);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

function niceTicks(min: number, max: number, count = 5): number[] {
  if (min === max) return [min];
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

const M = { top: 12, right: 64, bottom: 28, left: 40 };

export interface LineSeries {
  id: string;
  label: string;
  values: number[];
  /** CSS color for highlighted series; omitted = muted context line. */
  color?: string;
}

export function LineChart({
  series,
  height = 260,
  xLabel,
  xTick = (i) => String(i + 1),
  yFormat = (v) => String(v),
  zeroLine = false,
  ariaLabel,
}: {
  series: LineSeries[];
  height?: number;
  /** Full label for the tooltip. */
  xLabel: (i: number) => string;
  /** Short axis tick label. */
  xTick?: (i: number) => string;
  yFormat?: (v: number) => string;
  zeroLine?: boolean;
  ariaLabel: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = Math.max(0, ...series.map((s) => s.values.length));
  const all = series.flatMap((s) => s.values);
  if (n === 0 || all.length === 0) return null;

  let lo = Math.min(...all, zeroLine ? 0 : Infinity);
  let hi = Math.max(...all, zeroLine ? 0 : -Infinity);
  if (lo === hi) [lo, hi] = [lo - 1, hi + 1];
  const ticks = niceTicks(lo, hi);
  lo = Math.min(lo, ticks[0]);
  hi = Math.max(hi, ticks[ticks.length - 1]);

  const iw = width - M.left - M.right;
  const ih = height - M.top - M.bottom;
  const x = (i: number) => M.left + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => M.top + ih - ((v - lo) / (hi - lo)) * ih;
  const path = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');

  const context = series.filter((s) => !s.color);
  const focus = series.filter((s) => s.color);
  const xTicks = niceTicks(0, n - 1, Math.min(6, n - 1)).filter((t) => Number.isInteger(t));

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * iw;
    setHover(Math.max(0, Math.min(n - 1, Math.round((px / iw) * (n - 1)))));
  };

  return (
    <div className="chart" ref={ref}>
      {focus.length >= 2 && (
        <div className="legend">
          {focus.map((s) => (
            <span key={s.id}>
              <i className="key-line" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
          {context.length > 0 && (
            <span>
              <i className="key-line context" />
              Other teams
            </span>
          )}
        </div>
      )}
      <svg width={width} height={height} role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line className={zeroLine && t === 0 ? 'axis' : 'grid'} x1={M.left} x2={M.left + iw} y1={y(t)} y2={y(t)} />
            <text className="tick" x={M.left - 6} y={y(t)} dy="0.32em" textAnchor="end">{yFormat(t)}</text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} className="tick" x={x(t)} y={height - 8} textAnchor="middle">{xTick(t)}</text>
        ))}
        {context.map((s) => (
          <path key={s.id} className="line context" d={path(s.values)} />
        ))}
        {focus.map((s) => (
          <g key={s.id}>
            <path className="line" d={path(s.values)} style={{ stroke: s.color }} />
            {s.values.length > 0 && (
              <>
                <circle className="dot" cx={x(s.values.length - 1)} cy={y(s.values[s.values.length - 1])} r={4} style={{ fill: s.color }} />
                <text className="end-label" x={x(s.values.length - 1) + 8} y={y(s.values[s.values.length - 1])} dy="0.32em">
                  {yFormat(s.values[s.values.length - 1])}
                </text>
              </>
            )}
          </g>
        ))}
        {hover !== null && (
          <g>
            <line className="crosshair" x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + ih} />
            {focus.map((s) =>
              s.values[hover] != null ? (
                <circle key={s.id} className="dot" cx={x(hover)} cy={y(s.values[hover])} r={4} style={{ fill: s.color }} />
              ) : null,
            )}
          </g>
        )}
        <rect
          x={M.left}
          y={M.top}
          width={iw}
          height={ih}
          fill="transparent"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      {hover !== null && (
        <Tooltip left={x(hover)} width={width}>
          <div className="tt-title">{xLabel(hover)}</div>
          {focus.map((s) => (
            <div key={s.id} className="tt-row">
              <i className="key-line" style={{ background: s.color }} />
              <b>{s.values[hover] != null ? yFormat(s.values[hover]) : '–'}</b>
              <span>{s.label}</span>
            </div>
          ))}
        </Tooltip>
      )}
    </div>
  );
}

export interface Column {
  value: number;
  label: string;
  detail?: string;
}

/** Columns from a zero baseline; positive in --pos, negative in --neg. */
export function ColumnChart({
  columns,
  height = 220,
  yFormat = (v) => String(v),
  ariaLabel,
  onSelect,
}: {
  columns: Column[];
  height?: number;
  yFormat?: (v: number) => string;
  ariaLabel: string;
  onSelect?: (i: number) => void;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  if (columns.length === 0) return null;

  const vals = columns.map((c) => c.value);
  const ticks = niceTicks(Math.min(0, ...vals), Math.max(0, ...vals));
  const lo = Math.min(0, ticks[0]);
  const hi = Math.max(0, ticks[ticks.length - 1]);
  const m = { ...M, right: 12 };
  const iw = width - m.left - m.right;
  const ih = height - m.top - m.bottom;
  const band = iw / columns.length;
  const barW = Math.max(1, Math.min(24, band - 2));
  const y = (v: number) => m.top + ih - ((v - lo) / (hi - lo || 1)) * ih;
  const r = Math.min(4, barW / 2);

  // Rounded at the data end, square at the baseline.
  const barPath = (i: number, v: number) => {
    const x0 = m.left + i * band + (band - barW) / 2;
    const x1 = x0 + barW;
    const b = y(0);
    const t = y(v);
    const h = Math.abs(b - t);
    const rr = Math.min(r, h);
    if (v >= 0) return `M${x0},${b}V${t + rr}Q${x0},${t} ${x0 + rr},${t}H${x1 - rr}Q${x1},${t} ${x1},${t + rr}V${b}Z`;
    return `M${x0},${b}V${t - rr}Q${x0},${t} ${x0 + rr},${t}H${x1 - rr}Q${x1},${t} ${x1},${t - rr}V${b}Z`;
  };

  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line className={t === 0 ? 'axis' : 'grid'} x1={m.left} x2={m.left + iw} y1={y(t)} y2={y(t)} />
            <text className="tick" x={m.left - 6} y={y(t)} dy="0.32em" textAnchor="end">{yFormat(t)}</text>
          </g>
        ))}
        {columns.map((c, i) => (
          <g key={i}>
            <path className={`bar${hover === i ? ' hot' : ''}`} d={barPath(i, c.value)} style={{ fill: c.value >= 0 ? 'var(--pos)' : 'var(--neg)' }} />
            <rect
              x={m.left + i * band}
              y={m.top}
              width={band}
              height={ih}
              fill="transparent"
              style={{ cursor: onSelect ? 'pointer' : undefined }}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              onClick={() => onSelect?.(i)}
            />
          </g>
        ))}
      </svg>
      {hover !== null && (
        <Tooltip left={m.left + hover * band + band / 2} width={width}>
          <div className="tt-title">{columns[hover].label}</div>
          <div className="tt-row">
            <b>{yFormat(columns[hover].value)}</b>
            {columns[hover].detail && <span>{columns[hover].detail}</span>}
          </div>
        </Tooltip>
      )}
    </div>
  );
}

function Tooltip({ left, width, children }: { left: number; width: number; children: ReactNode }) {
  const flip = left > width * 0.6;
  return (
    <div className="tooltip" style={flip ? { right: width - left + 12 } : { left: left + 12 }}>
      {children}
    </div>
  );
}
