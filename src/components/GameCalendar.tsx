// Player page: the season as a calendar, one square per day, shaded by how
// well they played (points or Game Score); × marks team games they missed.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { seasonSnapshot } from '../api/espn';
import { loadLines } from '../api/linesStore';
import { useAsync } from '../hooks/useAsync';
import { gameScore, L } from '../lib/boxTotals';
import { usDay } from '../lib/gameLines';

const METRICS = {
  pts: { label: 'Points', steps: [10, 20, 30, 40], unit: 'points' },
  gmsc: { label: 'Game Score', steps: [5, 10, 15, 20], unit: 'Game Score' },
} as const;
type Metric = keyof typeof METRICS;

interface Day {
  day: string;
  gameId: string;
  opp: string;
  home: boolean;
  playoffs: boolean;
  line?: number[];
}

const dayNum = (d: string) => Date.parse(`${d}T00:00:00Z`) / 864e5;
const fromNum = (n: number) => new Date(n * 864e5).toISOString().slice(0, 10);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function GameCalendar({ playerId, season }: { playerId: string; season: number }) {
  const navigate = useNavigate();
  const [metric, setMetric] = useState<Metric>('pts');
  const [hover, setHover] = useState<Day | null>(null);
  const lines = useAsync(() => loadLines(season), [season]);
  const days = useMemo(() => {
    const d = lines.data;
    if (!d) return undefined;
    const idx = d.ids.indexOf(playerId);
    if (idx < 0) return undefined;
    const games = [...d.games].sort((a, b) => a[1].localeCompare(b[1]));
    // Team games they missed count from their first appearance, for the team they last played for.
    let team = '';
    const out = new Map<string, Day>();
    for (const [gameId, date, type, homeId, awayId, , gameLines] of games) {
      const line = gameLines.find((l) => l[L.p] === idx && l[L.min] > 0);
      if (line) team = line[L.home] ? homeId : awayId;
      else if (!team || (homeId !== team && awayId !== team)) continue;
      const home = homeId === team;
      out.set(usDay(date), { day: usDay(date), gameId, opp: home ? awayId : homeId, home, playoffs: type === 3, line });
    }
    return out;
  }, [lines.data, playerId]);
  if (!days || days.size < 3) return null;
  const snap = seasonSnapshot(season);
  const abbr = new Map((snap?.teams ?? []).map((t) => [t.id, t.abbr]));
  const m = METRICS[metric];
  const value = (l: number[]) => (metric === 'pts' ? l[L.pts] : gameScore(l));
  const shade = (v: number) => m.steps.filter((s) => v >= s).length + 1;
  const keys = [...days.keys()].sort();
  // Weeks start on Monday.
  const first = dayNum(keys[0]);
  const start = first - ((new Date(first * 864e5).getUTCDay() + 6) % 7);
  const end = dayNum(keys[keys.length - 1]);
  const weeks = Math.floor((end - start) / 7) + 1;
  const played = [...days.values()].filter((x) => x.line);
  const missed = days.size - played.length;
  const CELL = 14;
  const GAP = 3;
  const LEFT = 22;
  const TOP = 16;
  const width = LEFT + weeks * (CELL + GAP);
  const monthLabels: { x: number; label: string }[] = [];
  for (let w = 0; w < weeks; w++) {
    const d = new Date((start + w * 7) * 864e5);
    const prev = new Date((start + (w - 1) * 7) * 864e5);
    if (w === 0 || d.getUTCMonth() !== prev.getUTCMonth()) monthLabels.push({ x: LEFT + w * (CELL + GAP), label: MONTHS[d.getUTCMonth()] });
  }
  const describe = (x: Day) => {
    const head = `${new Date(`${x.day}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}: ${x.home ? 'vs' : '@'} ${abbr.get(x.opp) ?? ''}${x.playoffs ? ' (playoffs)' : ''}`;
    if (!x.line) return `${head}, didn't play`;
    const l = x.line;
    return `${head}, ${l[L.pts]} pts, ${l[L.oreb] + l[L.dreb]} reb, ${l[L.ast]} ast in ${l[L.min]} min (Game Score ${gameScore(l).toFixed(1)})`;
  };
  return (
    <div className="card">
      <div className="page-head">
        <h3>Season calendar</h3>
        <div className="chips tight">
          {(Object.keys(METRICS) as Metric[]).map((k) => (
            <button key={k} className={k === metric ? 'chip active' : 'chip'} onClick={() => setMetric(k)}>{METRICS[k].label}</button>
          ))}
        </div>
      </div>
      <div className="calendar-scroll">
        <svg width={width} height={TOP + 7 * (CELL + GAP)} role="img" aria-label={`Calendar of every game this season, shaded by ${m.unit}`}>
          {monthLabels.map((ml) => (
            <text key={ml.x} x={ml.x} y={10} className="tick">{ml.label}</text>
          ))}
          {['M', '', 'W', '', 'F', '', 'S'].map((d, i) => (
            <text key={i} x={0} y={TOP + i * (CELL + GAP) + CELL - 3} className="tick">{d}</text>
          ))}
          {Array.from({ length: weeks * 7 }, (_, i) => {
            const n = start + i;
            if (n < first || n > end) return null;
            const key = fromNum(n);
            const x = days.get(key);
            const w = Math.floor(i / 7);
            const px = LEFT + w * (CELL + GAP);
            const py = TOP + (i % 7) * (CELL + GAP);
            if (!x) return <rect key={key} x={px} y={py} width={CELL} height={CELL} rx={3} className="cal-empty" />;
            const cls = x.line ? `cal-day seq-${shade(value(x.line))}` : 'cal-day cal-missed';
            return (
              <g key={key} onMouseEnter={() => setHover(x)} onMouseLeave={() => setHover(null)} onClick={() => navigate(`/game/${x.gameId}`)} style={{ cursor: 'pointer' }}>
                <rect x={px} y={py} width={CELL} height={CELL} rx={3} className={`${cls}${x.playoffs ? ' cal-playoffs' : ''}${hover === x ? ' cal-hover' : ''}`}>
                  <title>{describe(x)}</title>
                </rect>
                {!x.line && <text x={px + CELL / 2} y={py + CELL - 3.5} textAnchor="middle" className="cal-x">×</text>}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="small cal-detail">{hover ? describe(hover) : `${played.length} games played${missed ? `, ${missed} missed` : ''}. Hover a day for the line; click to open the game.`}</p>
      <div className="legend small">
        <span>{m.label}:</span>
        {[0, ...m.steps].map((s, i) => (
          <span key={s}><i className={`key-sq seq-${i + 1}`} />{i === 0 ? `under ${m.steps[0]}` : i === m.steps.length ? `${s}+` : `${s}-${m.steps[i] - 1}`}</span>
        ))}
        <span><i className="key-sq cal-missed-key">×</i>missed</span>
      </div>
    </div>
  );
}
