// Player development: Insights → Development (who changed most from last
// season, by part of the game) and the player page's season-by-season chart.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadSnapshot, seasonSnapshot } from '../api/espn';
import { useAsync } from '../hooks/useAsync';
import { loadCareers } from '../lib/careers';
import { changes, fromBox, fromCareer, leagueBySeason, METRICS, type Metric, type Profile } from '../lib/development';
import { loadTeammateGraph } from '../lib/teammateStore';
import { LineChart } from './Charts';
import { Empty, Loading } from './Status';

function MetricChips({ value, onChange }: { value: Metric; onChange: (m: Metric) => void }) {
  return (
    <div className="chips" role="group" aria-label="Part of the game">
      {METRICS.map((m) => (
        <button key={m.id} className={`chip${value === m.id ? ' active' : ''}`} aria-pressed={value === m.id} onClick={() => onChange(m.id)}>{m.label}</button>
      ))}
    </div>
  );
}

const signed = (m: (typeof METRICS)[number], v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${m.fmt(Math.abs(v))}`;

export function DevelopmentTable({ season }: { season: number }) {
  const [metric, setMetric] = useState<Metric>('pts36');
  const snap = seasonSnapshot(season);
  const prev = useAsync(() => loadSnapshot(season - 1).catch(() => undefined), [season]);
  const m = METRICS.find((x) => x.id === metric)!;
  const rows = useMemo(() => {
    const now = snap?.box?.['2'];
    const before = prev.data?.box?.['2'];
    if (!now || !before) return undefined;
    const teamGames = Math.max(0, ...now.teams.map((t) => t[1]));
    return changes(now.players, before.players, season, metric, teamGames);
  }, [snap, prev.data, season, metric]);
  if (prev.loading) return <Loading />;
  if (!rows) return <Empty>Needs this season’s and last season’s box scores.</Empty>;
  const teams = new Map((snap?.teams ?? []).map((t) => [t.id, t]));
  const names = snap?.players ?? {};
  const table = (title: string, list: typeof rows) => (
    <div className="table-wrap">
      <h3 className="table-title">{title}</h3>
      <table>
        <thead>
          <tr>
            <th className="left">Player</th>
            <th>Last season</th>
            <th>Now</th>
            <th>Change</th>
            <th className="hide-sm" title="Minutes per game, last season → now">MIN</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => {
            const t = teams.get(r.teamId);
            return (
              <tr key={r.id}>
                <td className="left nowrap"><Link to={`/player/${r.id}?tab=career`}>{names[r.id] ?? r.id}</Link> {t && <span className="muted small">{t.abbr}</span>}</td>
                <td className="muted">{m.fmt(r.before[metric])}</td>
                <td>{m.fmt(r.now[metric])}</td>
                <td className={r.change > 0 ? 'win' : r.change < 0 ? 'loss' : undefined}>{signed(m, r.change)}</td>
                <td className="hide-sm muted small nowrap">{r.before.mpg.toFixed(0)} → {r.now.mpg.toFixed(0)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
  return (
    <>
      <p className="muted">How each player’s game has changed since last season: pick a part of the game. Players need 20+ games and 10+ minutes last season, and 10+ minutes this season.</p>
      <MetricChips value={metric} onChange={setMetric} />
      <div className="two-col">
        {table(`Biggest rises in ${m.what}`, rows.slice(0, 15))}
        {table(`Biggest drops in ${m.what}`, [...rows].reverse().slice(0, 15))}
      </div>
      <p className="muted small">Per-36 numbers put bench players and starters on the same footing; a jump in minutes usually means a bigger role.</p>
    </>
  );
}

/** Player page → Career: the player's numbers season by season against the league. */
export function PlayerDevelopment({ playerId, season }: { playerId: string; season: number }) {
  const [metric, setMetric] = useState<Metric>('pts36');
  const snap = seasonSnapshot(season);
  const data = useAsync(async () => {
    const [careers, graph] = await Promise.all([loadCareers(), loadTeammateGraph()]);
    const idx = graph.data.espn?.[playerId];
    if (idx == null) return undefined;
    const rows: Profile[] = (careers.seasons[idx] ?? []).map(fromCareer).filter((p): p is Profile => !!p);
    // Traded seasons appear once per team plus a total; keep one row per season (the biggest, i.e. the total).
    const bySeason = new Map<number, Profile>();
    for (const p of rows) if (!bySeason.has(p.season) || bySeason.get(p.season)!.g < p.g) bySeason.set(p.season, p);
    const row = snap?.box?.['2']?.players.find((r) => r[0] === playerId);
    const now = row && fromBox(row, season);
    if (now && now.g >= 3 && !bySeason.has(season)) bySeason.set(season, now);
    const list = [...bySeason.values()].sort((a, b) => a.season - b.season).slice(-10);
    return { list, league: leagueBySeason(careers, list.map((p) => p.season)) };
  }, [playerId, season]);
  if (!data.data || data.data.list.length < 2) return null;
  const { list, league } = data.data;
  const m = METRICS.find((x) => x.id === metric)!;
  const label = (s: number) => `${s - 1}-${String(s).slice(2)}`;
  return (
    <div className="card">
      <h3>Development</h3>
      <p className="muted small">{m.label} ({m.what}) each season, against the league average for players with 500+ minutes.</p>
      <MetricChips value={metric} onChange={setMetric} />
      <LineChart
        ariaLabel={`${m.label} by season`}
        height={220}
        series={[
          { id: 'league', label: 'League average', values: list.map((p) => league.get(p.season)?.[metric] ?? null) },
          { id: 'player', label: 'This player', values: list.map((p) => p[metric]), color: 'var(--series-1)' },
        ]}
        xLabel={(i) => `${label(list[i].season)} · ${list[i].g} games, ${list[i].mpg.toFixed(1)} min`}
        xTick={(i) => `'${String(list[i].season).slice(2)}`}
        yFormat={(v) => m.fmt(v)}
        contextLabel="League average"
      />
      {list[list.length - 1].season === season && <p className="muted small">This season so far ({list[list.length - 1].g} games) is from our box scores; the league line joins it once the season is in the history data.</p>}
    </div>
  );
}
