// Player page: a one-image season card (averages and league percentiles),
// drawn as SVG so it can be saved as a PNG.
import { useMemo, useRef } from 'react';
import { saveSvgAsPng } from '../lib/svgImage';
import { seasonSnapshot } from '../api/espn';
import { P } from '../lib/boxTotals';
import { ShareButton } from './ShareButton';

const STATS: { key: string; label: string; value: (r: (string | number)[]) => number; fmt: (v: number) => string }[] = [
  { key: 'pts', label: 'Points', value: (r) => n(r, 'pts') / n(r, 'gp'), fmt: (v) => v.toFixed(1) },
  { key: 'reb', label: 'Rebounds', value: (r) => (n(r, 'oreb') + n(r, 'dreb')) / n(r, 'gp'), fmt: (v) => v.toFixed(1) },
  { key: 'ast', label: 'Assists', value: (r) => n(r, 'ast') / n(r, 'gp'), fmt: (v) => v.toFixed(1) },
  { key: 'stl', label: 'Steals', value: (r) => n(r, 'stl') / n(r, 'gp'), fmt: (v) => v.toFixed(1) },
  { key: 'blk', label: 'Blocks', value: (r) => n(r, 'blk') / n(r, 'gp'), fmt: (v) => v.toFixed(1) },
  { key: 'tpm', label: 'Threes', value: (r) => n(r, 'tpm') / n(r, 'gp'), fmt: (v) => v.toFixed(1) },
  { key: 'ts', label: 'True shooting', value: (r) => n(r, 'pts') / Math.max(1, 2 * (n(r, 'fga') + 0.44 * n(r, 'fta'))), fmt: (v) => `${(v * 100).toFixed(1)}%` },
  { key: 'pm', label: '+/- per game', value: (r) => n(r, 'pm') / n(r, 'gp'), fmt: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}` },
];
function n(r: (string | number)[], k: keyof typeof P) {
  return r[P[k]] as number;
}

const css = (name: string, fallback: string) => (typeof document === 'undefined' ? fallback : getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback);

export function PlayerCard({ playerId, name, team, season, seasonLabel }: { playerId: string; name: string; team?: string; season: number; seasonLabel: string }) {
  const svg = useRef<SVGSVGElement>(null);
  const model = useMemo(() => {
    const box = seasonSnapshot(season)?.box?.['2'];
    const me = box?.players.find((r) => r[0] === playerId);
    if (!box || !me) return undefined;
    const teamGames = Math.max(...box.teams.map((t) => t[1] as number));
    // Comparison pool: regulars (15+ minutes a game, a quarter of the season played).
    const pool = box.players.filter((r) => n(r, 'gp') >= Math.max(1, teamGames * 0.25) && n(r, 'min') / n(r, 'gp') >= 15);
    return {
      gp: n(me, 'gp'),
      mpg: n(me, 'min') / n(me, 'gp'),
      poolSize: pool.length,
      rows: STATS.map((s) => {
        const v = s.value(me);
        const below = pool.filter((r) => s.value(r) < v).length;
        return { ...s, v, pctile: pool.length ? Math.round((below / pool.length) * 100) : 0 };
      }),
    };
  }, [playerId, season]);
  if (!model) return null;

  const colors = { bg: css('--surface', '#ffffff'), text: css('--text', '#15181d'), muted: css('--muted', '#69707c'), track: css('--border', '#e2e5ea'), bar: css('--series-1', '#2a78d6') };
  const W = 640;
  const rowH = 30;
  const top = 96;
  const H = top + model.rows.length * rowH + 40;

  const download = () => saveSvgAsPng(svg.current, W, H, `${name.replace(/\s+/g, '-')}-${seasonLabel}.png`);

  return (
    <div className="card player-card">
      <div className="page-head">
        <h3>Season card</h3>
        <div className="actions">
          <button className="chip" onClick={download}>⬇ Save as image</button>
          <ShareButton compact={false} label="Share" text={`🏀 ${name}, ${seasonLabel}: ${model.rows.slice(0, 3).map((r) => `${r.fmt(r.v)} ${r.label.toLowerCase()}`).join(', ')}`} />
        </div>
      </div>
      <svg ref={svg} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${name} ${seasonLabel} season card`} style={{ maxWidth: W }}>
        <rect width={W} height={H} rx="14" fill={colors.bg} stroke={colors.track} />
        <text x="24" y="40" fontFamily="system-ui, sans-serif" fontSize="24" fontWeight="800" fill={colors.text}>{name}</text>
        <text x="24" y="64" fontFamily="system-ui, sans-serif" fontSize="14" fill={colors.muted}>
          {[team, seasonLabel, `${model.gp} games`, `${model.mpg.toFixed(1)} min`].filter(Boolean).join(' · ')}
        </text>
        <text x={W - 24} y="40" textAnchor="end" fontFamily="system-ui, sans-serif" fontSize="12" fill={colors.muted}>Percentile among {model.poolSize} regulars</text>
        {model.rows.map((r, i) => {
          const y = top + i * rowH;
          const x0 = 200;
          const w = W - x0 - 90;
          return (
            <g key={r.key}>
              <text x="24" y={y + 4} fontFamily="system-ui, sans-serif" fontSize="14" fill={colors.text}>{r.label}</text>
              <text x="180" y={y + 4} textAnchor="end" fontFamily="system-ui, sans-serif" fontSize="14" fontWeight="700" fill={colors.text}>{r.fmt(r.v)}</text>
              <rect x={x0} y={y - 7} width={w} height="10" rx="5" fill={colors.track} />
              <rect x={x0} y={y - 7} width={Math.max(4, (w * r.pctile) / 100)} height="10" rx="5" fill={colors.bar} />
              <text x={W - 24} y={y + 4} textAnchor="end" fontFamily="system-ui, sans-serif" fontSize="13" fill={colors.muted}>{r.pctile}th</text>
            </g>
          );
        })}
        <text x="24" y={H - 16} fontFamily="system-ui, sans-serif" fontSize="11" fill={colors.muted}>NBA Stats Hub · regular season · percentile = share of regulars below</text>
      </svg>
    </div>
  );
}
