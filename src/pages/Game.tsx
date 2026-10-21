import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchSummary } from '../api/espn';
import { aggregateAssists } from '../api/normalize';
import type { Competitor, TeamBox } from '../api/types';
import { AssistNetwork } from '../components/AssistNetwork';
import { GameFlow, ShotChart } from '../components/GameCharts';
import { PlayFeed } from '../components/PlayFeed';
import { ErrorBox, Loading } from '../components/Status';
import { TeamLogo } from '../components/TeamLogo';
import { useAsync } from '../hooks/useAsync';
import { formatDay, formatTime, toISODate } from '../lib/dates';

export function Game() {
  const { id = '' } = useParams();
  const { data, error, loading } = useAsync(
    (fresh) => fetchSummary(id, fresh),
    [id],
    (s) => (s.game.state === 'in' ? 30_000 : undefined),
  );
  const updated = useMemo(() => new Date(), [data]);

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox error={error} />;
  if (!data) return null;

  const { game, teams, pbp } = data;
  const assists = aggregateAssists(pbp.assists, pbp.names);
  const periods = Math.max(game.home.linescores.length, game.away.linescores.length);
  const day = game.date ? toISODate(new Date(game.date)) : '';

  return (
    <section>
      <p className="muted">
        <Link to={day ? `/scores?date=${day}` : '/scores'}>← {day ? formatDay(day) : 'Scores'}</Link>
        {game.venue && ` · ${game.venue}`}
        {game.note && ` · ${game.note}`}
      </p>
      <div className="scorebug">
        <BugTeam c={game.away} showScore={game.state !== 'pre'} />
        <div className={`bug-status${game.state === 'in' ? ' live' : ''}`}>
          {game.state === 'pre' ? formatTime(game.date) : game.statusDetail}
          {game.state === 'in' && (
            <div className="updated muted">● Live · refreshes every 30s · {updated.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</div>
          )}
        </div>
        <BugTeam c={game.home} showScore={game.state !== 'pre'} />
      </div>

      {periods > 0 && (
        <div className="table-wrap narrow">
          <table>
            <thead>
              <tr>
                <th className="left">Team</th>
                {Array.from({ length: periods }, (_, i) => (
                  <th key={i}>{i < 4 ? `Q${i + 1}` : `OT${i > 4 ? i - 3 : ''}`}</th>
                ))}
                <th>T</th>
              </tr>
            </thead>
            <tbody>
              {[game.away, game.home].map((c) => (
                <tr key={c.team.id}>
                  <td className="left">{c.team.abbr}</td>
                  {Array.from({ length: periods }, (_, i) => (
                    <td key={i}>{c.linescores[i] ?? '-'}</td>
                  ))}
                  <td><b>{c.score}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {teams.length === 2 && teams[0].teamStats.length > 0 && <TeamComparison a={teams[0]} b={teams[1]} />}

      <GameFlow game={game} pbp={pbp} />

      {Object.keys(assists).length > 0 && (
        <>
          <h2>Who assisted whom</h2>
          <div className="two-col">
            {[game.away.team, game.home.team].map((t) =>
              assists[t.id] ? (
                <div key={t.id} className="card">
                  <AssistNetwork data={assists[t.id]} title={t.name} />
                </div>
              ) : null,
            )}
          </div>
        </>
      )}

      <ShotChart game={game} pbp={pbp} />

      <PlayFeed game={game} feed={pbp.feed} />

      {teams.map((t) => (
        <BoxScore key={t.team.id} box={t} />
      ))}
      {teams.length === 0 && game.state === 'pre' && <p className="muted">Box score will appear once the game tips off.</p>}
    </section>
  );
}

function BugTeam({ c, showScore }: { c: Competitor; showScore: boolean }) {
  return (
    <Link to={`/team/${c.team.id}`} className={`bug-team${c.winner === false ? ' lost' : ''}`}>
      <TeamLogo team={c.team} size={56} />
      <div>
        <div className="bug-name">{c.team.shortName}</div>
        {c.record && <div className="muted small">{c.record}</div>}
      </div>
      {showScore && <div className="bug-score">{c.score ?? '-'}</div>}
    </Link>
  );
}

const COMPARE = ['FG', 'Field Goal %', '3PT', 'Three Point %', 'FT', 'Free Throw %', 'Rebounds', 'Assists', 'Steals', 'Blocks', 'Turnovers', 'Points in Paint', 'Fast Break Points', 'Largest Lead'];

function TeamComparison({ a, b }: { a: TeamBox; b: TeamBox }) {
  const bMap = new Map(b.teamStats.map((s) => [s.label, s.value]));
  const rows = a.teamStats.filter((s) => COMPARE.includes(s.label) && bMap.has(s.label));
  if (rows.length === 0) return null;
  return (
    <>
      <h2>Team stats</h2>
      <div className="table-wrap narrow">
        <table>
          <thead>
            <tr>
              <th>{a.team.abbr}</th>
              <th />
              <th>{b.team.abbr}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.label}>
                <td>{s.value}</td>
                <td className="muted">{s.label}</td>
                <td>{bMap.get(s.label)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function BoxScore({ box }: { box: TeamBox }) {
  const played = box.players.filter((p) => !p.dnp);
  const dnp = box.players.filter((p) => p.dnp);
  return (
    <>
      <h2 className="team-title">
        <TeamLogo team={box.team} size={24} /> {box.team.name}
      </h2>
      <div className="table-wrap">
        <table className="box">
          <thead>
            <tr>
              <th className="left">Player</th>
              {box.labels.map((l) => (
                <th key={l}>{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {played.map((p, i) => (
              <tr key={p.id || p.name} className={p.starter && !played[i + 1]?.starter ? 'cut' : undefined}>
                <td className="left nowrap">
                  {p.id ? <Link to={`/player/${p.id}`}>{p.name}</Link> : p.name}{' '}
                  {p.position && <span className="muted small">{p.position}</span>}
                </td>
                {p.stats.map((s, j) => (
                  <td key={j} className={box.labels[j] === 'PTS' ? 'sorted' : undefined}>{s}</td>
                ))}
              </tr>
            ))}
            {box.totals.length > 0 && (
              <tr className="totals">
                <td className="left">Totals</td>
                {box.totals.map((s, j) => (
                  <td key={j}>{s}</td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {dnp.length > 0 && (
        <p className="muted small">
          DNP: {dnp.map((p) => `${p.name}${p.reason ? ` (${p.reason.toLowerCase()})` : ''}`).join(', ')}
        </p>
      )}
    </>
  );
}
