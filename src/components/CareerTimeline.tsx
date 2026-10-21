// Careers as bars along a shared timeline: one row per player, one bar per
// spell with a franchise. Optional highlight bands mark seasons the players
// were teammates.
import { useState } from 'react';
import { franchiseById } from '../lib/franchises';
import type { Segment } from '../lib/history';
import { seasonLabel } from '../lib/teammates';
import { useWidth } from './Charts';

export interface TimelineRow {
  name: string;
  segments: Segment[];
}

const ROW_H = 34;
const LABEL_W = 130;

export function CareerTimeline({ rows, shared = [] }: { rows: TimelineRow[]; shared?: number[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<{ s: Segment; x: number; y: number } | null>(null);
  const all = rows.flatMap((r) => r.segments);
  if (all.length === 0) return null;
  const from = Math.min(...all.map((s) => s.from)) - 1;
  const to = Math.max(...all.map((s) => s.to));
  const labelW = width < 500 ? 0 : LABEL_W;
  const iw = width - labelW - 16;
  const x = (season: number) => labelW + ((season - from) / (to - from)) * iw;
  const span = to - from;
  const step = span > 30 ? 10 : span > 12 ? 5 : span > 5 ? 2 : 1;
  const ticks: number[] = [];
  for (let y = Math.ceil(from / step) * step; y <= to; y += step) ticks.push(y);
  const height = rows.length * ROW_H + (labelW ? 0 : rows.length * 16) + 26;
  const rowY = (i: number) => i * (ROW_H + (labelW ? 0 : 16)) + (labelW ? 0 : 16);

  return (
    <div className="chart timeline" ref={ref}>
      <svg width={width} height={height} role="img" aria-label="Career timeline by franchise">
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={x(t)} x2={x(t)} y1={0} y2={height - 22} />
            <text className="tick" x={x(t)} y={height - 8} textAnchor="middle">{t}</text>
          </g>
        ))}
        {/* A season's bar spans from the previous year's end to its own. */}
        {shared.map((season) => (
          <rect key={season} className="shared-band" x={x(season - 1)} width={Math.max(2, x(season) - x(season - 1))} y={0} height={height - 22} />
        ))}
        {rows.map((r, i) => (
          <g key={r.name} transform={`translate(0 ${rowY(i)})`}>
            {labelW > 0 ? (
              <text className="timeline-name" x={0} y={ROW_H / 2} dy="0.32em">{r.name}</text>
            ) : (
              <text className="timeline-name" x={0} y={-4}>{r.name}</text>
            )}
            {r.segments.map((s, k) => {
              // A season split by a trade gives each team half of it.
              const start = r.segments[k - 1]?.to === s.from ? s.from - 0.5 : s.from - 1;
              const end = r.segments[k + 1]?.from === s.to ? s.to - 0.5 : s.to;
              const x0 = x(start) + 1;
              const w = Math.max(3, x(end) - x(start) - 2);
              const label = s.defunct ? s.code : s.key;
              return (
                <g
                  key={k}
                  onPointerEnter={() => setTip({ s, x: x0 + w / 2, y: rowY(i) })}
                  onPointerLeave={() => setTip(null)}
                >
                  <rect className={`seg ${s.defunct ? 'defunct' : k % 2 ? 'alt' : ''}`} x={x0} y={4} width={w} height={ROW_H - 8} rx={4} />
                  {w > label.length * 7 + 6 && (
                    <text className="seg-label" x={x0 + w / 2} y={ROW_H / 2} dy="0.32em" textAnchor="middle">{label}</text>
                  )}
                </g>
              );
            })}
          </g>
        ))}
      </svg>
      {tip && (
        <div className="tooltip" style={{ left: Math.min(tip.x, width - 200), top: tip.y + ROW_H }}>
          <div className="tt-row">
            <b>{tip.s.defunct ? tip.s.code : (franchiseById(tip.s.key)?.name ?? tip.s.key)}</b>
          </div>
          <div className="tt-title">
            {tip.s.from === tip.s.to ? seasonLabel(tip.s.from) : `${seasonLabel(tip.s.from)} to ${seasonLabel(tip.s.to)}`}
            {tip.s.code !== tip.s.key && !tip.s.defunct ? ` · as ${tip.s.code}` : ''}
            {tip.s.league !== 'NBA' ? ` · ${tip.s.league}` : ''}
          </div>
        </div>
      )}
    </div>
  );
}
