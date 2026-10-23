// Leaders → Milestone watch: active players about to reach a round number or
// pass someone on an all-time list.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { seasonSnapshot } from '../api/espn';
import { milestones, MILESTONE_STATS } from '../lib/milestones';
import { useTeammateGraph } from '../lib/teammateStore';
import { useCareers } from './CareerStats';
import { Empty, ErrorBox, Loading } from './Status';

export function MilestoneWatch({ season }: { season: number }) {
  const graph = useTeammateGraph();
  const careers = useCareers();
  const [stat, setStat] = useState<string>('all');
  const snap = seasonSnapshot(season);
  const list = useMemo(() => (graph && careers.data && snap?.box?.['2'] ? milestones(careers.data, graph, snap.box['2']) : []), [graph, careers.data, snap]);
  if (careers.error) return <ErrorBox error={careers.error} />;
  if (!graph || !careers.data) return <Loading label="Loading every career…" />;
  if (snap?.complete !== false) return <Empty>Milestone watch follows the season in progress. Pick 2026-27 in the season picker.</Empty>;
  const rows = list.filter((m) => stat === 'all' || m.stat === stat).slice(0, 40);
  const teams = new Map(snap.teams.map((t) => [t.id, t]));
  const teamOf = new Map(snap.box!['2'].players.map((r) => [r[0], r[1]]));
  return (
    <>
      <p className="muted">Career totals (every season before this one plus this season's box scores) and what each player reaches next, with how many games it should take at this season's pace.</p>
      <div className="chips tight">
        <button className={stat === 'all' ? 'chip active' : 'chip'} onClick={() => setStat('all')}>All</button>
        {MILESTONE_STATS.map((s) => (
          <button key={s.key} className={stat === s.key ? 'chip active' : 'chip'} onClick={() => setStat(s.key)}>{s.label[0].toUpperCase() + s.label.slice(1)}</button>
        ))}
      </div>
      {rows.length === 0 ? (
        <Empty>No milestones within 30 games.</Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="left">Player</th>
                <th className="left">Next</th>
                <th>Career</th>
                <th>To go</th>
                <th title="At this season's per-game rate">Games away</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={`${m.espnId}-${m.stat}-${m.target}`}>
                  <td className="left nowrap">
                    <Link to={`/player/${m.espnId}`}>{graph.data.players[m.player][0]}</Link>{' '}
                    <span className="muted small">{teams.get(String(teamOf.get(m.espnId)))?.abbr}</span>
                  </td>
                  <td className="left">{m.what}</td>
                  <td>{m.total.toLocaleString()} <span className="muted small">{m.label}</span></td>
                  <td>{m.remaining.toLocaleString()}</td>
                  <td className="sorted">{m.gamesAway === 1 ? 'next game' : `~${m.gamesAway}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small">History totals include ABA and BAA seasons. Totals update with the daily data refresh.</p>
    </>
  );
}
