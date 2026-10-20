import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchTeamSchedule, type SeasonType } from '../api/espn';
import type { Game } from '../api/types';
import { Empty, ErrorBox, Loading } from '../components/Status';
import { TeamLogo } from '../components/TeamLogo';
import { useAsync } from '../hooks/useAsync';
import { formatShortDate, formatTime } from '../lib/dates';
import { useSeason } from '../SeasonContext';
import { SeasonTypeToggle } from './Leaders';

export function Team() {
  const { id = '' } = useParams();
  const { season } = useSeason();
  const [type, setType] = useState<SeasonType>(2);
  const { data, error, loading } = useAsync(
    () => fetchTeamSchedule(id, season.year, type),
    [id, season.year, type],
  );

  const games = data?.games ?? [];
  const results = games.filter((g) => g.state === 'post');
  const fixtures = games.filter((g) => g.state !== 'post');
  const side = (g: Game) => (g.home.team.id === id ? g.home : g.away);
  const opp = (g: Game) => (g.home.team.id === id ? g.away : g.home);
  const wins = results.filter((g) => side(g).winner).length;
  const pf = results.reduce((s, g) => s + (side(g).score ?? 0), 0);
  const pa = results.reduce((s, g) => s + (opp(g).score ?? 0), 0);
  const team = data?.team ?? (games[0] && side(games[0]).team);

  return (
    <section>
      <div className="page-head">
        <h1 className="team-title">
          {team && <TeamLogo team={team} size={40} />}
          {team?.name ?? 'Team'} <span className="muted">{season.label}</span>
        </h1>
        <SeasonTypeToggle value={type} onChange={setType} />
      </div>
      {loading && <Loading />}
      {error && <ErrorBox error={error} />}
      {data && games.length === 0 && <Empty>No games found for this selection.</Empty>}

      {results.length > 0 && (
        <div className="stat-tiles">
          <Tile label="Record" value={`${wins}-${results.length - wins}`} />
          <Tile label="PPG" value={(pf / results.length).toFixed(1)} />
          <Tile label="Opp PPG" value={(pa / results.length).toFixed(1)} />
          <Tile label="Net / game" value={signed((pf - pa) / results.length)} />
          <Tile label="Last 10" value={lastN(results, side, 10)} />
        </div>
      )}

      {fixtures.length > 0 && (
        <>
          <h2>Fixtures ({fixtures.length})</h2>
          <ScheduleTable games={fixtures} opp={opp} side={side} />
        </>
      )}
      {results.length > 0 && (
        <>
          <h2>Results ({results.length})</h2>
          <ScheduleTable games={[...results].reverse()} opp={opp} side={side} />
        </>
      )}
    </section>
  );
}

function signed(n: number) {
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}`;
}

function lastN(results: Game[], side: (g: Game) => Game['home'], n: number) {
  const recent = results.slice(-n);
  const w = recent.filter((g) => side(g).winner).length;
  return `${w}-${recent.length - w}`;
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="tile">
      <div className="tile-value">{value}</div>
      <div className="tile-label">{label}</div>
    </div>
  );
}

function ScheduleTable({
  games,
  opp,
  side,
}: {
  games: Game[];
  opp: (g: Game) => Game['home'];
  side: (g: Game) => Game['home'];
}) {
  return (
    <div className="table-wrap">
      <table>
        <tbody>
          {games.map((g) => {
            const o = opp(g);
            const us = side(g);
            return (
              <tr key={g.id}>
                <td className="left nowrap">{formatShortDate(g.date)}</td>
                <td className="left">
                  <Link to={`/team/${o.team.id}`} className="team-cell">
                    <span className="muted">{us.homeAway === 'home' ? 'vs' : '@'}</span>
                    <TeamLogo team={o.team} size={20} />
                    {o.team.name}
                  </Link>
                </td>
                <td className="left">
                  {g.state === 'post' ? (
                    <Link to={`/game/${g.id}`}>
                      <b className={us.winner ? 'win' : 'loss'}>{us.winner ? 'W' : 'L'}</b> {us.score}-{o.score}
                    </Link>
                  ) : g.state === 'in' ? (
                    <Link to={`/game/${g.id}`} className="live">{g.statusDetail} {us.score}-{o.score}</Link>
                  ) : (
                    <span>{formatTime(g.date)}</span>
                  )}
                </td>
                <td className="left muted hide-sm">{g.broadcasts.slice(0, 2).join(', ')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
