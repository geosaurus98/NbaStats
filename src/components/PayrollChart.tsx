// Team payrolls as horizontal bars, each split into its players' salaries,
// against the minimum, cap, tax line and both aprons.
import { useState } from 'react';
import type { TeamRef } from '../api/types';
import type { PayrollPlayer } from '../lib/brefContracts';
import { capZone, LEVEL_LINES, money, ZONE_LABELS, type CapLevels } from '../lib/salaryCap';
import { useWidth } from './Charts';

export interface PayrollRow {
  team: TeamRef;
  /** Players with a salary this season, biggest first. */
  players: (PayrollPlayer & { salary: number })[];
  total: number;
}

/** Years left on a deal, counting this season. */
export const yearsLeft = (p: PayrollPlayer) => p.salaries.filter((v) => v != null).length;

export function payrollRows(teams: TeamRef[], payroll: Record<string, PayrollPlayer[]>): PayrollRow[] {
  return teams
    .map((team) => {
      const players = (payroll[team.id] ?? []).filter((p) => p.salaries[0]).map((p) => ({ ...p, salary: p.salaries[0]! })).sort((a, b) => b.salary - a.salary);
      return { team, players, total: players.reduce((a, p) => a + p.salary, 0) };
    })
    .sort((a, b) => b.total - a.total);
}

const ROW = 26;
const BAR = 16;
const LEFT = 52;
const RIGHT = 70;
const TOP = 40;
const SHORT: Record<string, string> = { minimum: 'Min', cap: 'Cap', tax: 'Tax', firstApron: '1st', secondApron: '2nd' };

export function PayrollChart({ rows, levels, onPick }: { rows: PayrollRow[]; levels: CapLevels; onPick?: (team: TeamRef) => void }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<{ x: number; y: number; title: string; lines: string[] } | null>(null);
  const max = Math.max(levels.secondApron * 1.06, ...rows.map((r) => r.total * 1.02));
  const plotW = width - LEFT - RIGHT;
  const narrow = width < 640;
  const x = (v: number) => LEFT + (v / max) * plotW;
  const height = TOP + rows.length * ROW + 8;
  const show = (e: React.MouseEvent, title: string, lines: string[]) => {
    const box = (e.currentTarget as SVGElement).ownerSVGElement!.getBoundingClientRect();
    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, title, lines });
  };

  return (
    <div className="chart payroll-chart" ref={ref} onMouseLeave={() => setTip(null)}>
      <svg width={width} height={height} role="img" aria-label={`Team payrolls against the ${levels.season - 1}-${String(levels.season).slice(2)} cap, tax line and aprons`}>
        {LEVEL_LINES.map((l, i) => (
          <g key={l.key}>
            <line x1={x(levels[l.key])} x2={x(levels[l.key])} y1={TOP - 6} y2={height - 6} className={l.key === 'cap' ? 'cap-line strong' : 'cap-line'} />
            {/* Narrow screens: short labels, staggered over three rows so the close-together lines don't collide. */}
            <text x={x(levels[l.key])} y={TOP - 8 - (narrow ? i % 3 : i % 2) * 10} textAnchor="middle" className="cap-label">{narrow ? SHORT[l.key] : l.label}</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const y = TOP + i * ROW + (ROW - BAR) / 2;
          let acc = 0;
          return (
            <g key={r.team.id} className={onPick ? 'payroll-row clickable' : 'payroll-row'} onClick={() => onPick?.(r.team)}>
              <text x={LEFT - 8} y={y + BAR / 2 + 4} textAnchor="end" className="payroll-team">{r.team.abbr}</text>
              {r.players.map((p) => {
                const x0 = x(acc);
                acc += p.salary;
                const w = Math.max(0, x(acc) - x0 - 2);
                return (
                  <rect
                    key={p.bref}
                    x={x0}
                    y={y}
                    width={w}
                    height={BAR}
                    rx={w > 6 ? 3 : 0}
                    className="payroll-seg"
                    onMouseMove={(e) => show(e, p.name, [`${money(p.salary)} · ${((p.salary / levels.cap) * 100).toFixed(1)}% of the cap`, `${r.team.abbr} · ${yearsLeft(p)} season${yearsLeft(p) === 1 ? '' : 's'} left`])}
                  />
                );
              })}
              <text
                x={x(r.total) + 6}
                y={y + BAR / 2 + 4}
                className="payroll-total"
                onMouseMove={(e) => show(e, r.team.name, [money(r.total), ZONE_LABELS[capZone(r.total, levels)]])}
              >
                {money(r.total)}
              </text>
            </g>
          );
        })}
      </svg>
      {tip && (
        <div className="tooltip" style={{ left: Math.min(tip.x + 12, width - 190), top: tip.y + 14 }}>
          <b>{tip.title}</b>
          {tip.lines.map((l) => (
            <div key={l} className="muted">{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}
