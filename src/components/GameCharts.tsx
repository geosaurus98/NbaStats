// Play-by-play charts for one game: score margin over time, win probability,
// and a half-court shot chart.
import { useState } from 'react';
import type { Game, PlayByPlay, Shot } from '../api/types';
import { LineChart, useWidth } from './Charts';

const QUARTER_S = 720;
const OT_S = 300;

function periodTicks(maxT: number) {
  const ticks = [{ at: 0, label: 'Tip' }];
  for (let q = 1; q <= 4; q++) ticks.push({ at: q * QUARTER_S, label: q < 4 ? `Q${q + 1}` : 'End' });
  for (let ot = 1; 4 * QUARTER_S + ot * OT_S <= maxT + 1; ot++) ticks.push({ at: 4 * QUARTER_S + ot * OT_S, label: `OT${ot}` });
  return ticks.filter((t) => t.at <= maxT + 1);
}

const periodName = (p: number) => (p <= 4 ? `Q${p}` : `OT${p - 4}`);

export function GameFlow({ game, pbp }: { game: Game; pbp: PlayByPlay }) {
  const flow = pbp.flow;
  if (flow.length < 5) return null;
  const end = Math.max(4 * QUARTER_S, flow[flow.length - 1].t);
  // Pin both ends so the line spans the whole game.
  const pts = [...flow, { ...flow[flow.length - 1], t: end }];
  const xs = pts.map((p) => p.t);
  const margin = pts.map((p) => p.home - p.away);
  const home = game.home.team.abbr;
  const away = game.away.team.abbr;
  const lead = (v: number) => (v === 0 ? 'Tied' : v > 0 ? `${home} +${v}` : `${away} +${-v}`);
  const label = (i: number) => `${periodName(pts[i].period)} ${pts[i].clock} · ${away} ${pts[i].away}-${pts[i].home} ${home}`;
  const ticks = periodTicks(end);
  const hasWin = pts.filter((p) => p.homeWin != null).length > 10;
  let lastWin = 0.5;
  const win = pts.map((p) => (lastWin = p.homeWin ?? lastWin));
  const biggest = (sign: 1 | -1) => Math.max(0, ...margin.map((m) => m * sign));

  return (
    <div className="two-col charts">
      <div className="card">
        <h3>Game flow</h3>
        <LineChart
          ariaLabel={`Score margin through the game; above zero ${home} leads`}
          series={[{ id: 'margin', label: 'Lead', values: margin, color: 'var(--series-1)' }]}
          xs={xs}
          xTickValues={ticks}
          xLabel={label}
          yFormat={lead}
          zeroLine
          step
        />
        <p className="muted small">
          Above the line: {home} leading (biggest lead {biggest(1)}). Below: {away} leading (biggest lead {biggest(-1)}).
        </p>
      </div>
      {hasWin && (
        <div className="card">
          <h3>Win probability</h3>
          <LineChart
            ariaLabel={`ESPN's estimated chance that ${home} wins, through the game`}
            series={[{ id: 'wp', label: `${home} win chance`, values: win, color: 'var(--series-2)' }]}
            xs={xs}
            xTickValues={ticks}
            xLabel={label}
            yFormat={(v) => `${Math.round(v * 100)}%`}
            yDomain={[0, 1]}
          />
          <p className="muted small">ESPN's estimate of {home}'s chance to win after each play (100% − this is {away}'s).</p>
        </div>
      )}
    </div>
  );
}

// Half-court geometry in feet (baseline at the top).
const COURT_W = 50;
const COURT_H = 47;
const HOOP = { x: 25, y: 5.25 };
const THREE_R = 23.75;
const CORNER_X = 3;
const cornerY = HOOP.y + Math.sqrt(THREE_R ** 2 - (HOOP.x - CORNER_X) ** 2);

function zone(s: Shot): 'Paint' | 'Mid-range' | '3PT' {
  if (s.value === 3) return '3PT';
  if (s.x >= 17 && s.x <= 33 && s.y <= 19) return 'Paint';
  return 'Mid-range';
}

export function ShotChart({ game, pbp }: { game: Game; pbp: PlayByPlay }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [teamId, setTeamId] = useState(game.away.team.id);
  const [tip, setTip] = useState<{ s: Shot; px: number; py: number } | null>(null);
  const shots = pbp.shots.filter((s) => s.teamId === teamId && s.y <= COURT_H);
  if (pbp.shots.length < 10) return null;

  const w = Math.min(width, 520);
  const scale = w / COURT_W;
  const h = COURT_H * scale;
  const X = (ft: number) => ft * scale;
  const zones = (['Paint', 'Mid-range', '3PT'] as const).map((z) => {
    const list = shots.filter((s) => zone(s) === z);
    const made = list.filter((s) => s.made).length;
    return { z, made, att: list.length };
  });
  const arc = `M${X(CORNER_X)},0 V${X(cornerY)} A${X(THREE_R)},${X(THREE_R)} 0 0 0 ${X(COURT_W - CORNER_X)},${X(cornerY)} V0`;

  return (
    <div className="card" ref={ref}>
      <div className="page-head">
        <h3>Shot chart</h3>
        <div className="segmented">
          {[game.away.team, game.home.team].map((t) => (
            <button key={t.id} className={t.id === teamId ? 'active' : ''} onClick={() => setTeamId(t.id)}>{t.abbr}</button>
          ))}
        </div>
      </div>
      <div className="legend">
        <span><i className="shot-key made" />Made</span>
        <span><i className="shot-key missed" />Missed</span>
      </div>
      <div className="shot-wrap" style={{ width: w }}>
        <svg width={w} height={h} role="img" aria-label="Shot locations on a half court" className="court">
          <rect x={0} y={0} width={w} height={h} className="court-line" />
          <rect x={X(17)} y={0} width={X(16)} height={X(19)} className="court-line" />
          <circle cx={X(25)} cy={X(19)} r={X(6)} className="court-line" />
          <path d={`M${X(21)},${X(HOOP.y)} A${X(4)},${X(4)} 0 0 0 ${X(29)},${X(HOOP.y)}`} className="court-line" />
          <path d={arc} className="court-line" />
          <line x1={X(22)} x2={X(28)} y1={X(4)} y2={X(4)} className="court-line" />
          <circle cx={X(HOOP.x)} cy={X(HOOP.y)} r={X(0.75)} className="court-line" />
          {shots
            .slice()
            .sort((a, b) => Number(a.made) - Number(b.made))
            .map((s, i) => (
              <circle
                key={i}
                cx={X(s.x)}
                cy={X(s.y)}
                r={Math.max(3.5, X(0.6))}
                className={s.made ? 'shot made' : 'shot missed'}
                onPointerEnter={() => setTip({ s, px: X(s.x), py: X(s.y) })}
                onPointerLeave={() => setTip(null)}
              />
            ))}
        </svg>
        {tip && (
          <div className="tooltip" style={{ left: Math.min(tip.px + 10, w - 200), top: tip.py + 10 }}>
            <div className="tt-title">{periodName(tip.s.period)} {tip.s.clock}</div>
            <div className="tt-row"><span>{tip.s.text}</span></div>
          </div>
        )}
      </div>
      <table className="zones">
        <tbody>
          {zones.map((z) => (
            <tr key={z.z}>
              <td className="left">{z.z}</td>
              <td>{z.made}/{z.att}</td>
              <td className="muted">{z.att ? `${Math.round((z.made / z.att) * 100)}%` : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
