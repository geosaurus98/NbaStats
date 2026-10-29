// Game page: a shareable recap image of a finished game: the score, the
// quarters, the top three performers and the win-probability swing.
import { useMemo, useRef } from 'react';
import type { GameSummary } from '../api/types';
import { gameScore, lineValues } from '../lib/boxTotals';
import { formatDay, toISODate } from '../lib/dates';
import { saveSvgAsPng, shareSvgAsPng } from '../lib/svgImage';

const css = (name: string, fallback: string) => (typeof document === 'undefined' ? fallback : getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback);
const W = 640;
const H = 380;

export function RecapCard({ summary }: { summary: GameSummary }) {
  const svg = useRef<SVGSVGElement>(null);
  const { game, teams, pbp } = summary;
  const model = useMemo(() => {
    const stars = teams.flatMap((t) =>
      t.players.flatMap((p) => {
        const v = !p.dnp ? lineValues(t.labels, p.stats) : undefined;
        if (!v) return [];
        const l = [0, 0, 0, ...v];
        return [{ name: p.name, team: t.team.abbr, gs: gameScore(l), pts: v[1], reb: v[8] + v[9], ast: v[10], stl: v[11], blk: v[12], tpm: v[4] }];
      }),
    );
    stars.sort((a, b) => b.gs - a.gs);
    const flow = pbp.flow;
    const wp = flow.filter((f) => f.homeWin != null);
    let homeLead = 0;
    let awayLead = 0;
    for (const f of flow) {
      homeLead = Math.max(homeLead, f.home - f.away);
      awayLead = Math.max(awayLead, f.away - f.home);
    }
    return { stars: stars.slice(0, 3), wp, homeLead, awayLead };
  }, [teams, pbp]);
  if (game.state !== 'post' || model.stars.length === 0) return null;
  const c = { bg: css('--surface', '#ffffff'), text: css('--text', '#15181d'), muted: css('--muted', '#69707c'), line: css('--border', '#e2e5ea'), home: css('--series-1', '#2a78d6'), away: css('--series-2', '#eb6834') };
  const font = 'system-ui, -apple-system, Segoe UI, sans-serif';
  const homeWon = (game.home.score ?? 0) > (game.away.score ?? 0);
  const day = game.date ? formatDay(toISODate(new Date(game.date))) : '';
  const periods = Math.max(game.home.linescores.length, game.away.linescores.length);
  // Win probability strip.
  const chart = { x: 24, y: 262, w: W - 48, h: 70 };
  const last = model.wp.length ? Math.max(...model.wp.map((f) => f.t)) : 1;
  const path = model.wp.map((f, i) => `${i ? 'L' : 'M'}${(chart.x + (f.t / last) * chart.w).toFixed(1)},${(chart.y + (1 - f.homeWin!) * chart.h).toFixed(1)}`).join(' ');
  const statLine = (s: (typeof model.stars)[number]) => [`${s.pts} pts`, `${s.reb} reb`, `${s.ast} ast`, s.stl >= 3 ? `${s.stl} stl` : '', s.blk >= 3 ? `${s.blk} blk` : '', s.tpm >= 4 ? `${s.tpm} threes` : ''].filter(Boolean).join(' · ');
  const filename = `${game.away.team.abbr}-at-${game.home.team.abbr}-${game.date?.slice(0, 10) ?? ''}.png`;
  const text = `🏀 ${game.away.team.abbr} ${game.away.score}, ${game.home.team.abbr} ${game.home.score}. ${model.stars[0].name}: ${statLine(model.stars[0])}`;
  const share = async () => {
    if (!(await shareSvgAsPng(svg.current, W, H, filename, text))) await saveSvgAsPng(svg.current, W, H, filename);
  };
  const side = (comp: typeof game.home, x: number, anchor: 'start' | 'end', color: string, won: boolean) => (
    <g>
      <rect x={anchor === 'start' ? x : x - 6} y={34} width={6} height={56} rx={3} fill={color} />
      <text x={anchor === 'start' ? x + 16 : x - 16} y={56} textAnchor={anchor} fontFamily={font} fontSize="16" fill={c.muted}>{comp.team.name}</text>
      <text x={anchor === 'start' ? x + 16 : x - 16} y={92} textAnchor={anchor} fontFamily={font} fontSize="38" fontWeight={won ? 800 : 500} fill={won ? c.text : c.muted}>{comp.score}</text>
    </g>
  );
  return (
    <div className="card recap-card">
      <div className="page-head">
        <h3>Recap card</h3>
        <div className="actions">
          <button className="chip" onClick={() => saveSvgAsPng(svg.current, W, H, filename)}>⬇ Save as image</button>
          <button className="chip" onClick={share}>Share</button>
        </div>
      </div>
      <svg ref={svg} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Recap: ${text}`} style={{ maxWidth: W }}>
        <rect width={W} height={H} rx="16" fill={c.bg} stroke={c.line} />
        <text x={W / 2} y={24} textAnchor="middle" fontFamily={font} fontSize="12" fill={c.muted}>{[game.statusDetail, day, game.note].filter(Boolean).join(' · ')}</text>
        {side(game.away, 24, 'start', c.away, !homeWon)}
        {side(game.home, W - 24, 'end', c.home, homeWon)}
        {periods > 0 && (
          <g fontFamily={font} fontSize="12" fill={c.muted} textAnchor="middle">
            {Array.from({ length: periods }, (_, i) => {
              const x = W / 2 - ((periods - 1) * 34) / 2 + i * 34;
              return (
                <g key={i}>
                  <text x={x} y={50}>{i < 4 ? `Q${i + 1}` : `OT${i > 4 ? i - 3 : ''}`}</text>
                  <text x={x} y={68} fill={c.text}>{game.away.linescores[i] ?? ''}</text>
                  <text x={x} y={86} fill={c.text}>{game.home.linescores[i] ?? ''}</text>
                </g>
              );
            })}
          </g>
        )}
        <line x1={24} x2={W - 24} y1={110} y2={110} stroke={c.line} />
        <text x={24} y={134} fontFamily={font} fontSize="12" fontWeight="700" fill={c.muted}>TOP PERFORMERS</text>
        {model.stars.map((s, i) => (
          <g key={s.name} fontFamily={font}>
            <text x={24} y={160 + i * 30} fontSize="16" fontWeight="700" fill={c.text}>{s.name} <tspan fontSize="12" fontWeight="400" fill={c.muted}>{s.team}</tspan></text>
            <text x={W - 24} y={160 + i * 30} textAnchor="end" fontSize="14" fill={c.text}>{statLine(s)}</text>
          </g>
        ))}
        <text x={24} y={chart.y - 10} fontFamily={font} fontSize="12" fontWeight="700" fill={c.muted}>
          {model.wp.length ? 'WIN PROBABILITY' : 'SCORE'} <tspan fontWeight="400">· biggest leads {game.away.team.abbr} {model.awayLead}, {game.home.team.abbr} {model.homeLead}</tspan>
        </text>
        {model.wp.length > 1 && (
          <g>
            <rect x={chart.x} y={chart.y} width={chart.w} height={chart.h} fill="none" stroke={c.line} rx="4" />
            <line x1={chart.x} x2={chart.x + chart.w} y1={chart.y + chart.h / 2} y2={chart.y + chart.h / 2} stroke={c.line} strokeDasharray="3 3" />
            <path d={path} fill="none" stroke={homeWon ? c.home : c.away} strokeWidth="2" />
            <text x={chart.x + 6} y={chart.y + 14} fontFamily={font} fontSize="10" fill={c.muted}>{game.home.team.abbr}</text>
            <text x={chart.x + 6} y={chart.y + chart.h - 6} fontFamily={font} fontSize="10" fill={c.muted}>{game.away.team.abbr}</text>
          </g>
        )}
        <text x={24} y={H - 14} fontFamily={font} fontSize="11" fill={c.muted}>NBA Stats Hub</text>
      </svg>
    </div>
  );
}
