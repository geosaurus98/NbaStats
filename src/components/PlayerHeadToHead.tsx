// Compare → Head-to-head: games the chosen players have played against each
// other in the seasons the site has box scores for.
import { Link } from 'react-router-dom';
import { loadLines } from '../api/linesStore';
import { snapshotYears } from '../api/snapshotStore';
import { useAsync } from '../hooks/useAsync';
import { formatShortDate } from '../lib/dates';
import { headToHead } from '../lib/playerH2H';
import { seasonInfo } from '../lib/seasons';

export function PlayerHeadToHead({ players }: { players: { id: string; name: string }[] }) {
  const years = snapshotYears();
  const lines = useAsync(() => Promise.all(years.map((y) => loadLines(y))), [years.join()]);
  if (players.length < 2 || !lines.data) return null;
  const seasons = lines.data.filter((l) => !!l);
  const pairs = players.flatMap((a, i) => players.slice(i + 1).map((b) => [a, b] as const));
  const span = `${seasonInfo(years[years.length - 1]).label} to ${seasonInfo(years[0]).label}`;
  return (
    <>
      <h2>Head-to-head</h2>
      {pairs.map(([a, b]) => {
        const r = headToHead(seasons, a.id, b.id);
        return (
          <div key={`${a.id}-${b.id}`} className="card">
            <h3>{a.name} v {b.name}</h3>
            {!r.games.length ? (
              <p className="muted small">They haven't played against each other from {span} (or were teammates).</p>
            ) : (
              <>
                <div className="table-wrap flush">
                  <table>
                    <thead>
                      <tr>
                        <th className="left">Player</th>
                        <th>G</th>
                        <th>W</th>
                        <th>PTS</th>
                        <th>REB</th>
                        <th>AST</th>
                        <th>Best</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.summary.map((s, i) => (
                        <tr key={s.playerId}>
                          <td className="left"><Link to={`/player/${s.playerId}`}>{[a, b][i].name}</Link></td>
                          <td>{s.games}</td>
                          <td className={s.wins > s.games / 2 ? 'win' : s.wins < s.games / 2 ? 'loss' : undefined}>{s.wins}</td>
                          <td>{s.pts.toFixed(1)}</td>
                          <td>{s.reb.toFixed(1)}</td>
                          <td>{s.ast.toFixed(1)}</td>
                          <td className="muted">{s.best} pts</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="recap-list small">
                  {r.games.slice(0, 6).map((g) => (
                    <li key={g.gameId}>
                      <Link to={`/game/${g.gameId}`}>{formatShortDate(g.date)}</Link>: {g.lines.map((l, i) => `${[a, b][i].name.split(' ').pop()} ${l[0]}/${l[1]}/${l[2]}`).join(' · ')} <span className="muted">({[a, b][g.winner].name.split(' ').pop()}'s team won)</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="muted small">Games on opposite teams from {span}, regular season and playoffs. Points/rebounds/assists.</p>
          </div>
        );
      })}
    </>
  );
}
