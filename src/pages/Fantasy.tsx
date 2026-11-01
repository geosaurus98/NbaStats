// Fantasy hub: season rankings in common scoring formats (or nine-category
// value), hot pickups whose recent form is well above their season, and how
// many games each team plays this week and next.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { seasonSnapshot, snapshotPlayers } from '../api/espn';
import { loadLines } from '../api/linesStore';
import { Empty, Loading } from '../components/Status';
import { useAsync } from '../hooks/useAsync';
import { formatShortDate, toISODate } from '../lib/dates';
import { fantasyTable, fantasyWeeks, FORMATS, gamesInWeek, type FormatId } from '../lib/fantasy';
import { useSeason } from '../SeasonContext';

type Mode = FormatId | 'nine';
const CATS = [
  ['pts', 'PTS'],
  ['reb', 'REB'],
  ['ast', 'AST'],
  ['stl', 'STL'],
  ['blk', 'BLK'],
  ['tpm', '3PM'],
  ['fg', 'FG%'],
  ['ft', 'FT%'],
  ['tov', 'TO'],
] as const;

export function Fantasy() {
  const { season } = useSeason();
  const snap = seasonSnapshot(season.year);
  const names = snapshotPlayers(season.year);
  const [mode, setMode] = useState<Mode>('espn');
  const { data, loading } = useAsync(() => loadLines(season.year), [season.year]);
  const rows = useMemo(() => (data ? fantasyTable(data, mode === 'nine' ? 'espn' : mode) : []), [data, mode]);
  const abbr = useMemo(() => new Map((snap?.teams ?? []).map((t) => [t.id, t.abbr])), [snap]);
  if (loading) return <Loading />;
  if (!rows.length) return <Empty>No games for this season yet.</Empty>;
  const maxG = Math.max(...rows.map((r) => r.games));
  const qualified = rows.filter((r) => r.games >= Math.max(1, maxG * 0.3));
  const value = (r: (typeof rows)[number]) => (mode === 'nine' ? r.nineCat : r.fppg);
  const ranked = [...qualified].sort((a, b) => value(b) - value(a));
  const rank = new Map(ranked.map((r, i) => [r.id, i + 1]));
  // Hot pickups: outside the top 100, recent form well above the season, minutes holding up.
  const pickups = rows
    .filter((r) => (rank.get(r.id) ?? 999) > 100 && r.games >= 5 && r.recentMpg >= 18 && r.recent > r.fppg * 1.15)
    .sort((a, b) => b.recent - a.recent)
    .slice(0, 15);
  const today = toISODate(new Date());
  const weeks = fantasyWeeks(today);
  const sched = weeks.map(([a, b]) => gamesInWeek(snap?.games['2'] ?? [], a, b));
  const teamIds = (snap?.teams ?? []).map((t) => t.id);
  const schedRows = teamIds.map((id) => ({ id, w: sched.map((s) => s.get(id) ?? { games: 0, b2b: 0, days: [] }) })).sort((a, b) => b.w[0].games - a.w[0].games || b.w[1].games - a.w[1].games);
  const hasSchedule = sched.some((s) => s.size > 0);
  const fmt = (v: number) => v.toFixed(1);
  return (
    <section>
      <div className="page-head">
        <h1>{season.label} fantasy hub</h1>
      <h2 className="sr-only">Fantasy rankings</h2>
        <div className="chips tight">
          {(Object.keys(FORMATS) as FormatId[]).map((f) => (
            <button key={f} className={mode === f ? 'chip active' : 'chip'} aria-pressed={mode === f} onClick={() => setMode(f)}>{FORMATS[f].label}</button>
          ))}
          <button className={mode === 'nine' ? 'chip active' : 'chip'} aria-pressed={mode === 'nine'} onClick={() => setMode('nine')}>9-category</button>
        </div>
      </div>
      <p className="muted">
        {mode === 'nine'
          ? 'Nine-category value: each category is a standard score against regular rotation players, with FG% and FT% weighted by attempts, added up.'
          : `${FORMATS[mode].label} scoring: ${Object.entries(FORMATS[mode].w).map(([k, w]) => `${k.toUpperCase()} ${w > 0 ? '+' : ''}${w}`).join(', ')}${'dd' in FORMATS[mode] ? ', double-double +1.5, triple-double +3' : ''}.`}
      </p>
      <div className="two-col">
        <div className="table-wrap">
          <h3 className="table-title">Hot pickups (outside the top 100)</h3>
          {pickups.length ? (
            <table>
              <thead>
                <tr>
                  <th className="left">Player</th>
                  <th title="Fantasy points per game, last 5 games">Last 5</th>
                  <th title="Season fantasy points per game">Season</th>
                  <th title="Minutes per game, last 5 / season">MPG</th>
                  <th title="Games this week / next week">Games</th>
                </tr>
              </thead>
              <tbody>
                {pickups.map((r) => (
                  <tr key={r.id}>
                    <td className="left nowrap"><Link to={`/player/${r.id}`}>{names[r.id] ?? r.id}</Link> <span className="muted small">{abbr.get(r.team)}</span></td>
                    <td><b>{fmt(r.recent)}</b></td>
                    <td className="muted">{fmt(r.fppg)}</td>
                    <td className="muted">{fmt(r.recentMpg)} / {fmt(r.mpg)}</td>
                    <td>{hasSchedule ? `${sched[0].get(r.team)?.games ?? 0} / ${sched[1].get(r.team)?.games ?? 0}` : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="small">No obvious risers right now.</p>
          )}
          <p className="muted small">Players outside the top 100 by {mode === 'nine' ? '9-category value' : 'fantasy points'} averaging 15%+ more over their last five games, on 18+ minutes. Ranked by recent form; points format shown.</p>
        </div>
        <div className="table-wrap">
          <h3 className="table-title">Games per team</h3>
          {hasSchedule ? (
            <table>
              <thead>
                <tr>
                  <th className="left">Team</th>
                  <th title={`${formatShortDate(`${weeks[0][0]}T12:00:00Z`)} to ${formatShortDate(`${weeks[0][1]}T12:00:00Z`)}`}>This week</th>
                  <th title={`${formatShortDate(`${weeks[1][0]}T12:00:00Z`)} to ${formatShortDate(`${weeks[1][1]}T12:00:00Z`)}`}>Next week</th>
                  <th title="Back-to-backs this week / next">B2B</th>
                </tr>
              </thead>
              <tbody>
                {schedRows.map((r) => (
                  <tr key={r.id}>
                    <td className="left"><Link to={`/team/${r.id}`}>{abbr.get(r.id)}</Link></td>
                    <td className={r.w[0].games >= 4 ? 'win' : r.w[0].games <= 2 ? 'loss' : undefined}><b>{r.w[0].games}</b></td>
                    <td className={r.w[1].games >= 4 ? 'win' : r.w[1].games <= 2 ? 'loss' : undefined}>{r.w[1].games}</td>
                    <td className="muted">{r.w[0].b2b} / {r.w[1].b2b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="small">No games scheduled in the next two weeks for this season.</p>
          )}
          <p className="muted small">Monday-to-Sunday weeks. Four-game weeks in green are where streamers come from.</p>
        </div>
      </div>
      <div className="table-wrap">
        <h3 className="table-title">Season rankings</h3>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th className="left">Player</th>
              <th>G</th>
              <th>MPG</th>
              {mode === 'nine' ? CATS.map(([, l]) => <th key={l}>{l}</th>) : <th title="Fantasy points per game">FP/G</th>}
              <th title={mode === 'nine' ? 'Total of the nine standard scores' : 'Last 5 games'}>{mode === 'nine' ? 'Value' : 'Last 5'}</th>
            </tr>
          </thead>
          <tbody>
            {ranked.slice(0, 100).map((r, i) => (
              <tr key={r.id}>
                <td className="muted">{i + 1}</td>
                <td className="left nowrap"><Link to={`/player/${r.id}`}>{names[r.id] ?? r.id}</Link> <span className="muted small">{abbr.get(r.team)}</span></td>
                <td>{r.games}</td>
                <td>{fmt(r.mpg)}</td>
                {mode === 'nine' ? (
                  CATS.map(([k]) => (
                    <td key={k} className={r.cats[k] >= 1 ? 'win' : r.cats[k] <= -1 ? 'loss' : 'muted'}>{r.cats[k].toFixed(1)}</td>
                  ))
                ) : (
                  <td><b>{fmt(r.fppg)}</b></td>
                )}
                <td className={mode === 'nine' ? 'strong' : r.recent > r.fppg * 1.1 ? 'win' : r.recent < r.fppg * 0.9 ? 'loss' : 'muted'}>{mode === 'nine' ? r.nineCat.toFixed(1) : fmt(r.recent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">Regular season, players in 30%+ of games. 9-category cells are standard scores (green = a strength, red = a weakness).</p>
    </section>
  );
}
