// Rankings → Timeouts (do they stop the other team's run?) and Insights →
// Referees (each official's games: fouls, free throws, scoring, home record).
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { seasonSnapshot } from '../api/espn';
import { loadLines } from '../api/linesStore';
import { useAsync } from '../hooks/useAsync';
import { refereeTable, type RefRow } from '../lib/referees';
import { RUN, WINDOW } from '../lib/timeouts';
import { Empty, Loading } from './Status';
import { TeamLogo } from './TeamLogo';

const f1 = (v: number) => v.toFixed(1);
const sgn = (v: number) => { const r = Math.round(v * 10) / 10; return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r).toFixed(1)}`; };
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '–');

export function TimeoutTable({ season }: { season: number }) {
  const snap = seasonSnapshot(season);
  const data = snap?.timeouts?.['2'];
  const [sort, setSort] = useState<'net' | 'per' | 'runs'>('net');
  if (!data || !Object.keys(data.teams).length) return <Empty>Timeout data is collected by the daily data job from each game’s play-by-play; this season doesn’t have it yet.</Empty>;
  const teams = new Map(snap.teams.map((t) => [t.id, t]));
  const rows = Object.entries(data.teams).map(([id, [g, to, runTo, runNet, runStop, noTo, noNet, noStop]]) => ({ id, g, to, runTo, runNet, runStop, noTo, noNet, noStop }));
  const total = (k: 'runTo' | 'runNet' | 'runStop' | 'noTo' | 'noNet' | 'noStop') => rows.reduce((a, r) => a + r[k], 0);
  const league = { runTo: total('runTo'), runNet: total('runNet'), runStop: total('runStop'), noTo: total('noTo'), noNet: total('noNet'), noStop: total('noStop') };
  const avg = (net: number, n: number) => (n ? net / n : 0);
  rows.sort((a, b) => (sort === 'net' ? avg(b.runNet, b.runTo) - avg(a.runNet, a.runTo) : sort === 'per' ? b.to / b.g - a.to / a.g : b.runTo - a.runTo));
  const head = (key: typeof sort, label: string, title: string) => (
    <th className={`sortable${sort === key ? ' sorted' : ''}`} aria-sort={sort === key ? 'descending' : 'none'} title={title}>
      <button className="link" onClick={() => setSort(key)}>{label}</button>
    </th>
  );
  return (
    <>
      <p className="muted">
        When the other team goes on a run of {RUN} or more unanswered points, does calling a timeout stop it? For each timeout called during a run, the score over the next {WINDOW / 60} minutes of game time,
        against runs where no timeout came within 30 seconds.
      </p>
      <div className="stat-tiles">
        <div className="tile"><div className="tile-value">{sgn(avg(league.runNet, league.runTo))}</div><div className="tile-label">League: net points in the {WINDOW / 60} minutes after a timeout during a run ({league.runTo.toLocaleString()} timeouts)</div></div>
        <div className="tile"><div className="tile-value">{sgn(avg(league.noNet, league.noTo))}</div><div className="tile-label">…and after a run with no timeout ({league.noTo.toLocaleString()} runs)</div></div>
        <div className="tile"><div className="tile-value">{pct(league.runStop, league.runTo)} <span className="muted small">vs {pct(league.noStop, league.noTo)}</span></div><div className="tile-label">Scored next: after a timeout vs without one</div></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="left">Team</th>
              {head('per', 'Timeouts / g', 'Team timeouts called per game')}
              {head('runs', 'During runs', `Timeouts called while the opponent was on a run of ${RUN}+`)}
              {head('net', 'Net after', `Average point margin over the next ${WINDOW / 60} minutes after those timeouts`)}
              <th title="How often the team scored next after those timeouts">Scored next</th>
              <th title={`Opponent runs of ${RUN}+ with no timeout`}>Runs, no timeout</th>
              <th title="Average margin over the next two minutes after those runs">Net after</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const t = teams.get(r.id);
              const net = avg(r.runNet, r.runTo);
              return (
                <tr key={r.id}>
                  <td className="left">{t ? <Link to={`/team/${t.id}`} className="team-cell"><TeamLogo team={t} size={18} />{t.abbr}</Link> : r.id}</td>
                  <td>{f1(r.to / r.g)}</td>
                  <td>{r.runTo}</td>
                  <td className={r.runTo ? (net > 0 ? 'win' : net < 0 ? 'loss' : undefined) : 'muted'}>{r.runTo ? sgn(net) : '–'}</td>
                  <td>{pct(r.runStop, r.runTo)}</td>
                  <td className="muted">{r.noTo}</td>
                  <td className="muted">{r.noTo ? sgn(avg(r.noNet, r.noTo)) : '–'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted small">Regular season. Official and TV timeouts don’t count, and a run that ends in a timeout counts once. Small samples swing a lot: a team calls only a few dozen timeouts during runs in a season. Runs tend to end anyway, timeout or not, which is why the “no timeout” column matters.</p>
    </>
  );
}

export function RefereeTable({ season }: { season: number }) {
  const snap = seasonSnapshot(season);
  const lines = useAsync(() => loadLines(season), [season]);
  const [sort, setSort] = useState<keyof Omit<RefRow, 'name'>>('fouls');
  const table = useMemo(() => (lines.data && snap?.officials ? refereeTable(lines.data, snap.officials, 8) : undefined), [lines.data, snap]);
  if (!snap?.officials || !Object.keys(snap.officials).length) return <Empty>Referee assignments are collected by the daily data job; this season doesn’t have them yet.</Empty>;
  if (lines.loading || !table) return <Loading />;
  const { refs, league } = table;
  if (!refs.length) return <Empty>No official has worked enough games yet.</Empty>;
  const rows = [...refs].sort((a, b) => (sort === 'homeWins' ? b.homeWins / b.games - a.homeWins / a.games : (b[sort] as number) - (a[sort] as number)));
  const head = (key: typeof sort, label: string, title: string) => (
    <th className={`sortable${sort === key ? ' sorted' : ''}`} aria-sort={sort === key ? 'descending' : 'none'} title={title}>
      <button className="link" onClick={() => setSort(key)}>{label}</button>
    </th>
  );
  const vs = (v: number, base: number) => <span className="small muted">{sgn(v - base)}</span>;
  return (
    <>
      <p className="muted">Every referee who has worked {8}+ regular-season games, with what happened in those games: fouls and free throws (both teams), scoring, how the home team did, and whether the visitors were called for more fouls. League average across {league.games.toLocaleString()} games: {f1(league.fouls)} fouls, {f1(league.fta)} free throws, {f1(league.points)} points, home teams {pct(league.homeWins, league.games)}.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="left">Referee</th>
              {head('games', 'Games', 'Regular-season games worked')}
              {head('fouls', 'Fouls', 'Personal fouls per game, both teams (and against the league average)')}
              {head('fta', 'FTA', 'Free-throw attempts per game, both teams')}
              {head('points', 'Points', 'Points per game, both teams')}
              {head('homeWins', 'Home win %', 'Home team’s record in their games')}
              {head('foulGap', 'Road − home fouls', 'Away fouls minus home fouls, per game')}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td className="left nowrap">{r.name}</td>
                <td>{r.games}</td>
                <td>{f1(r.fouls)} {vs(r.fouls, league.fouls)}</td>
                <td>{f1(r.fta)} {vs(r.fta, league.fta)}</td>
                <td>{f1(r.points)}</td>
                <td>{pct(r.homeWins, r.games)}</td>
                <td>{sgn(r.foulGap)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">Each game counts for every official in its crew, so a referee’s numbers also reflect who they worked with and which teams were playing. Over a season most referees end up close to the league average; the gaps here are mostly noise until a few dozen games in.</p>
    </>
  );
}
