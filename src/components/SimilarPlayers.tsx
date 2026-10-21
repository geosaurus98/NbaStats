// History → Similar players: the seasons, from any year since 1979-80, whose
// era-adjusted stat profile is closest to a chosen player-season.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { buildSeasonPoints, similarSeasons } from '../lib/similar';
import { findPlayer, seasonLabel, type Graph } from '../lib/teammates';
import { useCareers } from './CareerStats';
import { PlayerInput } from './PlayerInput';
import { ErrorBox, Loading } from './Status';

const f1 = (v: number) => v.toFixed(1);

export function SimilarPlayers({ graph, params, setParam }: { graph: Graph; params: URLSearchParams; setParam: (u: Record<string, string | undefined>) => void }) {
  const careers = useCareers();
  const points = useMemo(() => (careers.data ? buildSeasonPoints(careers.data) : []), [careers.data]);
  const p = findPlayer(graph.data, params.get('p') ?? 'Victor Wembanyama');
  const mine = points.filter((x) => x.player === p).sort((a, b) => b.season - a.season);
  const season = Number(params.get('s')) || mine.reduce((best, x) => (x.perGame.pts * x.g > best.perGame.pts * best.g ? x : best), mine[0] ?? ({} as never))?.season;
  const target = mine.find((x) => x.season === season) ?? mine[0];
  const matches = useMemo(() => (target ? similarSeasons(points, target, 12) : []), [points, target]);

  if (careers.error) return <ErrorBox error={careers.error} />;
  if (!careers.data) return <Loading label="Loading every season since 1979-80…" />;
  const name = (i: number) => graph.data.players[i][0];
  const careerLink = (i: number) => `/history?tab=careers&p=${encodeURIComponent(name(i))}`;
  const row = (x: (typeof points)[number]) => [x.perGame.mpg, x.perGame.pts, x.perGame.trb, x.perGame.ast, x.perGame.stl, x.perGame.blk, x.perGame.tpm];

  return (
    <>
      <p className="muted">Pick a player and season to find the seasons with the most similar stat profile since 1979-80. Stats are per 36 minutes and measured against each season's league average, so pace and the three-point boom don't skew it.</p>
      <div className="degrees-controls">
        <PlayerInput graph={graph} label="Player" value={p} onPick={(i) => setParam({ p: name(i), s: undefined })} />
        {mine.length > 0 && (
          <label className="small">
            Season{' '}
            <select value={target?.season} onChange={(e) => setParam({ s: e.target.value })}>
              {mine.map((x) => (
                <option key={x.season} value={x.season}>{seasonLabel(x.season)}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      {!target ? (
        <p className="muted">No qualifying seasons (800+ minutes, since 1979-80) for this player.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="left">Season</th>
                <th>Match</th>
                <th>Age</th>
                <th>MIN</th>
                <th>PTS</th>
                <th>REB</th>
                <th>AST</th>
                <th className="hide-sm">STL</th>
                <th className="hide-sm">BLK</th>
                <th className="hide-sm">3PM</th>
                <th className="hide-sm">TS%</th>
              </tr>
            </thead>
            <tbody>
              {[{ point: target, similarity: 100 }, ...matches].map(({ point: x, similarity }, k) => (
                <tr key={`${x.player}-${x.season}`} className={k === 0 ? 'similar-target' : undefined}>
                  <td className="left nowrap">
                    <Link to={careerLink(x.player)}>{name(x.player)}</Link> <span className="muted small">{seasonLabel(x.season)}</span>
                  </td>
                  <td>
                    {k === 0 ? <span className="muted small">target</span> : (
                      <span className="sim-cell"><span className="pbar-track"><span className="pbar-fill" style={{ width: `${similarity}%`, background: 'var(--series-1)' }} /></span>{similarity}</span>
                    )}
                  </td>
                  <td>{x.age > 0 ? x.age : '–'}</td>
                  {row(x).map((v, i) => (
                    <td key={i} className={i >= 4 ? 'hide-sm' : undefined}>{f1(v)}</td>
                  ))}
                  <td className="hide-sm">{(x.perGame.ts * 100).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small">
        Compares points, rebounds, assists, steals, blocks, three- and free-throw attempts (per 36 minutes, against the league average), true shooting and
        minutes per game. NBA seasons with 800+ minutes. The table shows plain per-game numbers.
      </p>
    </>
  );
}
