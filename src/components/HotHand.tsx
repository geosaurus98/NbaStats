// Insights → Hot hand: do players shoot better right after a make? Compares
// field-goal % after a make with after a miss, and allows for "heat check"
// shots by comparing each with what the player's own rates by shot type predict.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { seasonSnapshot, snapshotPlayers, type SeasonType } from '../api/espn';
import { hotHandRow } from '../lib/hotHand';
import { Empty } from './Status';
import { Tile } from './Tile';
import { NetBar } from './TeamLineups';

const pct1 = (v: number) => `${(v * 100).toFixed(1)}%`;
const pts = (v: number) => `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)}`;

export function HotHandView({ season, type }: { season: number; type: SeasonType }) {
  const snap = seasonSnapshot(season);
  const names = snapshotPlayers(season);
  const abbr = useMemo(() => new Map((snap?.teams ?? []).map((t) => [t.id, t.abbr])), [snap]);
  const team = useMemo(() => new Map((snap?.box?.['2']?.players ?? []).map((r) => [r[0], r[1]])), [snap]);
  const [sort, setSort] = useState<'adj' | 'raw'>('adj');
  const data = snap?.hotHand?.[String(type)];
  const { rows, minAtt } = useMemo(() => {
    if (!data) return { rows: [], minAtt: 0 };
    const all = Object.entries(data.players).map(([id, c]) => ({ id, make: hotHandRow(c, 'make'), miss: hotHandRow(c, 'miss') }));
    // 100+ shots in each split over a full season; less early on.
    const most = Math.max(0, ...all.map((r) => Math.min(r.make.att, r.miss.att)));
    const minAtt = Math.max(20, Math.min(100, Math.round(most * 0.3)));
    const rows = all.flatMap(({ id, make, miss }) => {
      if (make.att < minAtt || miss.att < minAtt) return [];
      return [{ id, make, miss, raw: make.pct - miss.pct, adj: make.pct - make.expected - (miss.pct - miss.expected), heat: make.threeShare - miss.threeShare }];
    });
    return { rows, minAtt };
  }, [data]);
  if (!data) return <Empty>The hot-hand test starts with the next daily data update.</Empty>;
  const lg = { make: hotHandRow(data.league, 'make'), miss: hotHandRow(data.league, 'miss'), make2: hotHandRow(data.league, 'make2'), miss2: hotHandRow(data.league, 'miss2') };
  if (lg.make.att < 100) return <Empty>Too early in the season for the hot-hand test.</Empty>;
  const sorted = [...rows].sort((a, b) => b[sort] - a[sort]);
  const show = [...sorted.slice(0, 12), ...sorted.slice(-8).filter((r) => !sorted.slice(0, 12).includes(r))];
  const max = Math.max(0.05, ...show.map((r) => Math.abs(r[sort])));
  return (
    <>
      <p className="muted">
        Is the hot hand real? Every field-goal attempt is sorted by whether the same player made or missed their previous shot in that game. Players often take harder shots after a make (the "heat check"), so each split is also compared with what the player's own rates by shot type would predict.
      </p>
      <div className="stat-tiles">
        <Tile label={`League FG% after a make (${lg.make.att.toLocaleString()} shots)`} value={pct1(lg.make.pct)} />
        <Tile label={`After a miss (${lg.miss.att.toLocaleString()} shots)`} value={pct1(lg.miss.pct)} />
        <Tile label="After two makes in a row" value={pct1(lg.make2.pct)} />
        <Tile label="After two misses in a row" value={pct1(lg.miss2.pct)} />
        <Tile label="Share of threes after a make / after a miss" value={`${Math.round(lg.make.threeShare * 100)}% / ${Math.round(lg.miss.threeShare * 100)}%`} />
      </div>
      <div className="segmented">
        <button className={sort === 'adj' ? 'active' : ''} onClick={() => setSort('adj')}>Allowing for shot difficulty</button>
        <button className={sort === 'raw' ? 'active' : ''} onClick={() => setSort('raw')}>Raw FG%</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="left">Player</th>
              <th title="FG% on shots right after a make (attempts)">After make</th>
              <th title="FG% on shots right after a miss (attempts)">After miss</th>
              <th title="After make minus after miss">Raw</th>
              <th title="The same gap, after allowing for the types of shot taken">Adjusted</th>
              <th />
              <th title="Change in the share of shots that are threes after a make (percentage points)">Heat check</th>
            </tr>
          </thead>
          <tbody>
            {show.map((r) => (
              <tr key={r.id}>
                <td className="left nowrap"><Link to={`/player/${r.id}`}>{names[r.id] ?? r.id}</Link> <span className="muted small">{abbr.get(team.get(r.id) ?? '')}</span></td>
                <td>{pct1(r.make.pct)} <span className="muted small">{r.make.att}</span></td>
                <td>{pct1(r.miss.pct)} <span className="muted small">{r.miss.att}</span></td>
                <td className={sort === 'raw' ? 'strong' : 'muted'}>{pts(r.raw)}</td>
                <td className={sort === 'adj' ? 'strong' : 'muted'}>{pts(r.adj)}</td>
                <td className="net-cell"><NetBar v={r[sort]} max={max} /></td>
                <td className="muted">{pts(r.heat)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        Players with {minAtt}+ shots in each split; the {Math.min(12, sorted.length)} hottest and coolest. Gaps of a few points are normal noise at these sample sizes: research on years of data finds at most a small hot-hand effect once shot difficulty is accounted for.
      </p>
    </>
  );
}
