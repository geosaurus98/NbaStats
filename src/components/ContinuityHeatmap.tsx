// Franchises × seasons, shaded by the share of the roster that was with the
// franchise the season before. Dynasties read as solid stripes, rebuilds as
// breaks.
import { useState } from 'react';
import { FRANCHISES } from '../lib/franchises';
import type { ContinuityCell } from '../lib/history';
import { seasonLabel } from '../lib/teammates';
import { useWidth } from './Charts';

const LABEL_W = 42;
const ROW_H = 16;

export function ContinuityHeatmap({ data, from, onPick }: { data: Map<string, ContinuityCell[]>; from: number; onPick?: (franchise: string, season: number) => void }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<{ id: string; c: ContinuityCell; x: number; y: number } | null>(null);
  const to = Math.max(...[...data.values()].flatMap((cells) => cells.map((c) => c.season)));
  const seasons = to - from + 1;
  const cell = Math.max(6, Math.floor((width - LABEL_W - 4) / seasons));
  const svgW = LABEL_W + cell * seasons + 4;
  const rows = FRANCHISES.map((f) => f.id);
  const height = rows.length * ROW_H + 24;
  const firstTick = Math.ceil(from / 10) * 10;

  return (
    <div className="heatmap" ref={ref}>
      <div className="heatmap-scroll">
        <svg width={svgW} height={height} role="img" aria-label="Roster continuity by franchise and season">
          {Array.from({ length: Math.floor((to - firstTick) / 10) + 1 }, (_, k) => firstTick + k * 10).map((y) => (
            <text key={y} className="tick" x={LABEL_W + (y - from) * cell + cell / 2} y={height - 6} textAnchor="middle">{y}</text>
          ))}
          {rows.map((id, r) => (
            <g key={id} transform={`translate(0 ${r * ROW_H})`}>
              <text className="tick heat-label" x={LABEL_W - 6} y={ROW_H / 2} dy="0.32em" textAnchor="end">{id}</text>
              {(data.get(id) ?? [])
                .filter((c) => c.season >= from)
                .map((c) => (
                  <rect
                    key={c.season}
                    className="heat-cell"
                    x={LABEL_W + (c.season - from) * cell}
                    y={1}
                    width={cell - 1}
                    height={ROW_H - 2}
                    style={{ fillOpacity: 0.06 + 0.94 * c.share }}
                    onPointerEnter={() => setTip({ id, c, x: LABEL_W + (c.season - from) * cell, y: r * ROW_H })}
                    onPointerLeave={() => setTip(null)}
                    onClick={() => onPick?.(id, c.season)}
                  />
                ))}
            </g>
          ))}
        </svg>
      </div>
      {tip && (
        <div className="tooltip" style={{ left: Math.min(tip.x + 14, width - 200), top: tip.y + 20 }}>
          <div className="tt-row">
            <b>{Math.round(tip.c.share * 100)}%</b>
            <span>returning</span>
          </div>
          <div className="tt-title">
            {tip.id} {seasonLabel(tip.c.season)} · {tip.c.returning} of {tip.c.roster} players were there the year before
          </div>
        </div>
      )}
      <div className="legend heat-legend">
        <span>0%</span>
        <i className="heat-ramp" />
        <span>100% of the roster back from last season</span>
      </div>
    </div>
  );
}
