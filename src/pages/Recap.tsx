// This week in the NBA: a Monday-to-Sunday round-up of records, standings
// movers, upsets, the best performances and new season highs.
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchLeagueGames, fetchStandings, seasonSnapshot } from '../api/espn';
import { loadLines } from '../api/linesStore';
import { Empty, ErrorBox, Loading } from '../components/Status';
import { TeamLogo } from '../components/TeamLogo';
import { useAsync } from '../hooks/useAsync';
import { L } from '../lib/boxTotals';
import { addDays, formatDay, formatShortDate, usDate } from '../lib/dates';
import { runElo } from '../lib/projections';
import { bestGames, newSeasonHighs, playersOfWeek, standingsMovers, weekRecords, weeksWithGames } from '../lib/recap';
import { useSeason } from '../SeasonContext';

const pct = (p: number) => `${Math.round(p * 100)}%`;

export function Recap() {
  const { season } = useSeason();
  const [params, setParams] = useSearchParams();
  const data = useAsync(async () => {
    const [league, standings, lines] = await Promise.all([fetchLeagueGames(season.year, 2), fetchStandings(season.year), loadLines(season.year)]);
    return { league, standings, lines, elo: runElo(league.games) };
  }, [season.year]);
  const weeks = useMemo(() => (data.data ? weeksWithGames(data.data.league.games) : []), [data.data]);
  const asked = params.get('week');
  const week = asked && weeks.includes(asked) ? asked : weeks[0];
  const model = useMemo(() => {
    if (!data.data || !week) return undefined;
    const { league, standings, lines, elo } = data.data;
    const conf = new Map(standings.flatMap((c) => c.rows.map((r) => [r.team.id, c.name] as [string, string])));
    const upsets = elo.predictions
      .filter(({ game }) => {
        const d = usDate(new Date(game.date));
        return d >= week && d <= addDays(week, 6);
      })
      .map(({ game, pHome }) => {
        const homeWon = (game.home.score ?? 0) > (game.away.score ?? 0);
        return { game, p: homeWon ? pHome : 1 - pHome, winner: homeWon ? game.home : game.away, loser: homeWon ? game.away : game.home };
      })
      .filter((u) => u.p < 0.4)
      .sort((a, b) => a.p - b.p)
      .slice(0, 5);
    return {
      records: weekRecords(league.games, week),
      movers: standingsMovers(league.games, conf, week).slice(0, 6),
      upsets,
      best: lines ? bestGames(lines, week) : [],
      players: lines ? playersOfWeek(lines, week) : [],
      highs: lines ? newSeasonHighs(lines, week).slice(0, 8) : [],
      conf,
    };
  }, [data.data, week]);

  if (data.error) return <ErrorBox error={data.error} />;
  if (!data.data) return <Loading label="Rounding up the week…" />;
  if (!week || !model) return <Empty>No games in {season.label} yet.</Empty>;
  const teams = new Map(data.data.league.teams.map((t) => [t.id, t]));
  const names = seasonSnapshot(season.year)?.players ?? {};
  const i = weeks.indexOf(week);
  const go = (w: string | undefined) => w && setParams({ week: w }, { replace: true });
  const team = (id: string) => teams.get(id);
  const games = model.records.reduce((s, r) => s + r.w, 0);
  const top = model.records[0];
  const pow = model.players[0];
  const name = (id: string) => names[id] ?? id;
  const T = ({ id }: { id: string }) => {
    const t = team(id);
    return t ? <Link to={`/team/${id}`} className="team-cell"><TeamLogo team={t} size={20} />{t.abbr}</Link> : <span>{id}</span>;
  };

  return (
    <section>
      <div className="page-head">
        <h1>This week in the NBA</h1>
        <div className="date-nav">
          <button onClick={() => go(weeks[i + 1])} disabled={i >= weeks.length - 1} aria-label="Previous week">‹</button>
          <select value={week} onChange={(e) => go(e.target.value)} aria-label="Week">
            {weeks.map((w) => (
              <option key={w} value={w}>Week of {formatShortDate(`${w}T12:00:00Z`)}</option>
            ))}
          </select>
          <button onClick={() => go(weeks[i - 1])} disabled={i <= 0} aria-label="Next week">›</button>
        </div>
      </div>
      <h2 className="sr-only">Summary</h2>
      <p className="muted">{formatDay(week)} to {formatDay(addDays(week, 6))} (US dates) · {games} game{games === 1 ? '' : 's'}{i === 0 ? ' · the latest week, so far' : ''}</p>

      <div className="stat-tiles">
        {top && (
          <div className="tile">
            <div className="tile-value"><T id={top.teamId} /></div>
            <div className="tile-label">Team of the week · {top.w}-{top.l}, {top.margin > 0 ? '+' : ''}{top.margin} points</div>
          </div>
        )}
        {pow && (
          <div className="tile">
            <div className="tile-value"><Link to={`/player/${pow.playerId}`}>{name(pow.playerId)}</Link></div>
            <div className="tile-label">Player of the week · {pow.pts.toFixed(1)} pts, {pow.reb.toFixed(1)} reb, {pow.ast.toFixed(1)} ast in {pow.games} games</div>
          </div>
        )}
        {model.upsets[0] && (
          <div className="tile">
            <div className="tile-value"><Link to={`/game/${model.upsets[0].game.id}`}>{model.upsets[0].winner.team.abbr} over {model.upsets[0].loser.team.abbr}</Link></div>
            <div className="tile-label">Upset of the week · {pct(model.upsets[0].p)} chance beforehand</div>
          </div>
        )}
      </div>

      <div className="two-col">
        <div className="card">
          <h3>Best performances</h3>
          <ol className="recap-list">
            {model.best.map((b) => (
              <li key={`${b.gameId}-${b.playerId}`}>
                <Link to={`/player/${b.playerId}`}>{name(b.playerId)}</Link> <span className="muted small">{team(b.teamId)?.abbr} · {formatShortDate(`${b.day}T12:00:00Z`)}</span>
                <div className="small">
                  <Link to={`/game/${b.gameId}`}>{b.line[L.pts]} pts, {b.line[L.oreb] + b.line[L.dreb]} reb, {b.line[L.ast]} ast</Link> <span className="muted">· Game Score {b.gameScore.toFixed(1)}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="card">
          <h3>Players of the week</h3>
          <div className="table-wrap flush">
            <table>
              <thead>
                <tr>
                  <th className="left">Player</th>
                  <th>G</th>
                  <th>PTS</th>
                  <th>REB</th>
                  <th>AST</th>
                  <th title="Average Game Score">GmSc</th>
                </tr>
              </thead>
              <tbody>
                {model.players.map((p) => (
                  <tr key={p.playerId}>
                    <td className="left nowrap"><Link to={`/player/${p.playerId}`}>{name(p.playerId)}</Link> <span className="muted small">{team(p.teamId)?.abbr}</span></td>
                    <td>{p.games}</td>
                    <td>{p.pts.toFixed(1)}</td>
                    <td>{p.reb.toFixed(1)}</td>
                    <td>{p.ast.toFixed(1)}</td>
                    <td><b>{p.gameScore.toFixed(1)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {model.highs.length > 0 && (
            <>
              <h3>New season highs</h3>
              <ul className="recap-list small">
                {model.highs.map((h) => (
                  <li key={h.playerId}><Link to={`/player/${h.playerId}`}>{name(h.playerId)}</Link>: <Link to={`/game/${h.gameId}`}>{h.pts} points</Link> <span className="muted">(was {h.previous})</span></li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <h3>Records this week</h3>
          <div className="table-wrap flush">
            <table>
              <thead>
                <tr>
                  <th className="left">Team</th>
                  <th>W-L</th>
                  <th>Margin</th>
                </tr>
              </thead>
              <tbody>
                {[...model.records.slice(0, 5), ...model.records.slice(-3)].map((r, k) => (
                  <tr key={r.teamId} className={k === 5 ? 'cut' : undefined}>
                    <td className="left"><T id={r.teamId} /></td>
                    <td>{r.w}-{r.l}</td>
                    <td className={r.margin > 0 ? 'win' : r.margin < 0 ? 'loss' : undefined}>{r.margin > 0 ? '+' : ''}{r.margin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">The five best weeks and the three worst.</p>
        </div>
        <div className="card">
          <h3>Standings movers</h3>
          {model.movers.length ? (
            <ul className="recap-list">
              {model.movers.map((m) => (
                <li key={m.teamId}>
                  <T id={m.teamId} /> <span className={m.to < m.from ? 'win' : 'loss'}>{m.to < m.from ? '▲' : '▼'} {Math.abs(m.from - m.to)}</span>{' '}
                  <span className="muted small">{m.from} → {m.to} in the {model.conf.get(m.teamId)?.replace(' Conference', '')}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">No changes in either conference.</p>
          )}
          <h3>Upsets</h3>
          {model.upsets.length ? (
            <ul className="recap-list">
              {model.upsets.map((u) => (
                <li key={u.game.id}>
                  <Link to={`/game/${u.game.id}`}>{u.winner.team.abbr} {u.winner.score}, {u.loser.team.abbr} {u.loser.score}</Link> <span className="muted small">· {pct(u.p)} chance beforehand</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">No big upsets: favourites (by Elo) won every game.</p>
          )}
        </div>
      </div>
      <p className="muted small">Weeks run Monday to Sunday on US dates. Upsets use each team's Elo rating going into the game, with home court. <Link to="/projections?tab=ratings">Power ratings →</Link></p>
    </section>
  );
}
