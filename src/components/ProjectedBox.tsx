// Before tip-off: a projected box score for both teams, and on the scores page
// the night's likeliest 30-point games, double-doubles and triple-doubles.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { seasonSnapshot } from '../api/espn';
import { loadLines } from '../api/linesStore';
import type { Game } from '../api/types';
import { useAsync } from '../hooks/useAsync';
import { allowedFactors, projectTeam, type Projection } from '../lib/playerProjection';
import { TeamLogo } from './TeamLogo';

const pct = (p: number) => (p >= 0.995 ? '>99%' : p < 0.005 ? '<1%' : `${Math.round(p * 100)}%`);

/** Players listed as out on the injury report. */
const outList = (season: number) => new Set((seasonSnapshot(season)?.injuries ?? []).filter((i) => /^out/i.test(i.status)).map((i) => i.athleteId));

function useProjections(season: number, games: Game[]) {
  const lines = useAsync(() => loadLines(season), [season]);
  return useMemo(() => {
    if (!lines.data) return undefined;
    const factors = allowedFactors(lines.data);
    const out = outList(season);
    return games.map((g) => ({
      game: g,
      away: projectTeam(lines.data!, g.away.team.id, g.home.team.id, out, factors),
      home: projectTeam(lines.data!, g.home.team.id, g.away.team.id, out, factors),
    }));
  }, [lines.data, games, season]);
}

export function ProjectedBox({ game, season }: { game: Game; season: number }) {
  const games = useMemo(() => [game], [game]);
  const proj = useProjections(season, games)?.[0];
  if (!proj || (!proj.home.length && !proj.away.length)) return null;
  const names = seasonSnapshot(season)?.players ?? {};
  const table = (rows: Projection[], team: Game['home']['team']) => (
    <div className="table-wrap flush">
      <h4 className="team-title"><TeamLogo team={team} size={20} /> {team.shortName}</h4>
      <table>
        <thead>
          <tr>
            <th className="left">Player</th>
            <th>MIN</th>
            <th>PTS</th>
            <th>REB</th>
            <th>AST</th>
            <th>3PM</th>
            <th title="Chance of 30+ points">30+</th>
            <th title="Chance of a double-double">DD</th>
            <th title="Chance of a triple-double">TD</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 8).map((p) => (
            <tr key={p.playerId}>
              <td className="left nowrap"><Link to={`/player/${p.playerId}`}>{names[p.playerId] ?? p.playerId}</Link></td>
              <td>{p.mean.min.toFixed(0)}</td>
              <td><b>{p.mean.pts.toFixed(1)}</b></td>
              <td>{p.mean.reb.toFixed(1)}</td>
              <td>{p.mean.ast.toFixed(1)}</td>
              <td>{p.mean.tpm.toFixed(1)}</td>
              <td className="muted">{pct(p.p30)}</td>
              <td className="muted">{pct(p.pDouble)}</td>
              <td className="muted">{pct(p.pTriple)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <div className="card">
      <h3>Projected box score</h3>
      <div className="two-col">
        {table(proj.away, game.away.team)}
        {table(proj.home, game.home.team)}
      </div>
      <p className="muted small">From each player's last ten games (60%) and his season (40%), nudged by how much the opponent usually allows. Players listed as out are left off; minutes are a guess. Chances are for 30+ points, a double-double and a triple-double.</p>
    </div>
  );
}

/** Scores page: the night's likeliest big games across every game still to tip off. */
export function TonightProjections({ games, season }: { games: Game[]; season: number }) {
  const upcoming = useMemo(() => games.filter((g) => g.state === 'pre'), [games]);
  const proj = useProjections(season, upcoming);
  if (!proj || !upcoming.length) return null;
  const all = proj.flatMap((p) => [...p.home, ...p.away].map((x) => ({ ...x, game: p.game })));
  if (!all.length) return null;
  const names = seasonSnapshot(season)?.players ?? {};
  const abbr = (x: (typeof all)[number]) => (x.teamId === x.game.home.team.id ? x.game.home.team.abbr : x.game.away.team.abbr);
  const list = (title: string, key: 'p30' | 'pDouble' | 'pTriple') => (
    <div>
      <h4>{title}</h4>
      <ol className="recap-list small">
        {[...all].sort((a, b) => b[key] - a[key]).slice(0, 5).map((x) => (
          <li key={x.playerId}>
            <Link to={`/player/${x.playerId}`}>{names[x.playerId] ?? x.playerId}</Link> <span className="muted">{abbr(x)}</span> · <Link to={`/game/${x.game.id}`}>{pct(x[key])}</Link>
          </li>
        ))}
      </ol>
    </div>
  );
  return (
    <div className="card">
      <h3>Tonight's best bets</h3>
      <div className="all-teams">
        {list('30-point games', 'p30')}
        {list('Double-doubles', 'pDouble')}
        {list('Triple-doubles', 'pTriple')}
      </div>
      <p className="muted small">From recent form, the season and the opponent's defence. Open a game for its full projected box score.</p>
    </div>
  );
}
