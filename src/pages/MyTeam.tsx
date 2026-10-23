// My team: everything about your favourite team in one place.
import { Link } from 'react-router-dom';
import { fetchLeagueGames, fetchStandings } from '../api/espn';
import type { TeamRef } from '../api/types';
import { MyTeamCard } from '../components/MyTeamCard';
import { SeasonPace } from '../components/SeasonPace';
import { ErrorBox, Loading } from '../components/Status';
import { FormStrip, InjuryList, LeaderList } from '../components/TeamBits';
import { TeamLogo } from '../components/TeamLogo';
import { useFavourite } from '../FavouriteContext';
import { useAsync } from '../hooks/useAsync';
import { formatShortDate, formatTime } from '../lib/dates';
import { FRANCHISES } from '../lib/franchises';
import { isFinal } from '../lib/league';
import { pickOdds, shareTies } from '../lib/lottery';
import { scheduleAhead } from '../lib/scheduleAhead';
import { predict, results, seasonElo } from '../lib/teamContext';
import { useSeason } from '../SeasonContext';
import { buildModel } from './Projections';

const pct = (v: number) => (v >= 0.995 ? '>99%' : v > 0 && v < 0.005 ? '<1%' : `${Math.round(v * 100)}%`);

export function MyTeam() {
  const { favouriteId, toggleFavourite } = useFavourite();
  const { season } = useSeason();
  const league = useAsync(() => fetchLeagueGames(season.year, 2), [season.year]);

  if (!favouriteId) {
    return (
      <section>
        <h1>My team</h1>
        <p className="muted">Pick your team to see its next game, form, leaders, injuries, odds and schedule in one place. You can change it any time with the ☆ on a team page.</p>
        {league.error && <ErrorBox error={league.error} />}
        <div className="team-picker">
          {(league.data?.teams ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)).map((t) => (
            <button key={t.id} className="card team-pick" onClick={() => toggleFavourite(t.id)}>
              <TeamLogo team={t} size={36} />
              <span>{t.name}</span>
            </button>
          ))}
        </div>
      </section>
    );
  }
  return <Hub teamId={favouriteId} />;
}

function Hub({ teamId }: { teamId: string }) {
  const { season } = useSeason();
  const { toggleFavourite } = useFavourite();
  const data = useAsync(async () => {
    const [league, standings, elo, model] = await Promise.all([
      fetchLeagueGames(season.year, 2),
      fetchStandings(season.year),
      seasonElo(season.year),
      buildModel(season.year, 500).catch(() => undefined),
    ]);
    return { league, standings, elo, model };
  }, [season.year, teamId]);

  if (data.error) return <ErrorBox error={data.error} />;
  if (!data.data) return <Loading label="Loading your team…" />;
  const { league, standings, elo, model } = data.data;
  const team: TeamRef | undefined = league.teams.find((t) => t.id === teamId);
  if (!team) return <ErrorBox error={new Error('Team not found')} />;
  const conf = standings.find((c) => c.rows.some((r) => r.team.id === teamId));
  const rows = [...(conf?.rows ?? [])].sort((a, b) => b.pct - a.pct);
  const seed = rows.findIndex((r) => r.team.id === teamId) + 1;
  const row = rows[seed - 1];
  const odds = model?.odds.get(teamId);
  const rs = results(league.games, teamId);
  const upcoming = league.games.filter((g) => !isFinal(g) && (g.home.team.id === teamId || g.away.team.id === teamId)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  const ahead = scheduleAhead(league.teams, league.games, new Date().toISOString()).find((r) => r.team.id === teamId);
  const franchise = FRANCHISES.find((f) => f.espnId === teamId);

  // Lottery chance if the season ended today (outside the top eight in the conference).
  const lotteryTeams = standings
    .flatMap((c) => [...c.rows].sort((a, b) => b.pct - a.pct).slice(8))
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 14);
  const lotIndex = lotteryTeams.findIndex((r) => r.team.id === teamId);
  const lottery = lotIndex >= 0 ? pickOdds(shareTies(lotteryTeams.map((r) => r.pct)))[lotIndex] : undefined;

  return (
    <section>
      <div className="page-head">
        <h1 className="team-title">
          <TeamLogo team={team} size={44} /> {team.name} <span className="muted">{season.label}</span>
        </h1>
        <div className="actions">
          <Link className="chip" to={`/team/${teamId}`}>Team page →</Link>
          {franchise && <Link className="chip" to={`/franchise/${franchise.id}`}>History →</Link>}
          <button className="chip" onClick={() => toggleFavourite(teamId)}>Change team</button>
        </div>
      </div>
      <MyTeamCard season={season.year} />
      <div className="stat-tiles">
        <div className="tile"><div className="tile-value">{row ? `${row.wins}-${row.losses}` : '–'}</div><div className="tile-label">Record</div></div>
        <div className="tile"><div className="tile-value">{seed ? `${seed}${['th', 'st', 'nd', 'rd'][seed] ?? 'th'}` : '–'}</div><div className="tile-label">in the {conf?.name.replace(/ Conference$/, '') ?? 'conference'}</div></div>
        {odds && <div className="tile"><div className="tile-value">{odds.avgWins.toFixed(0)}</div><div className="tile-label">Projected wins</div></div>}
        {odds && <div className="tile"><div className="tile-value">{pct(odds.playoffs)}</div><div className="tile-label">Playoff odds</div></div>}
        {odds && <div className="tile"><div className="tile-value">{pct(odds.champion)}</div><div className="tile-label">Title odds</div></div>}
        {lottery && <div className="tile"><div className="tile-value">{(lottery[0] * 100).toFixed(1)}%</div><div className="tile-label">No. 1 pick odds today</div></div>}
      </div>
      <p className="small">Last 10: <FormStrip games={league.games} teamId={teamId} />{row?.streak ? <span className="muted"> · streak {row.streak}</span> : null}</p>

      <div className="two-col home-row">
        <div className="card">
          <h3>Next games</h3>
          {upcoming.length === 0 && <p className="muted small">No games left this regular season.</p>}
          <table>
            <tbody>
              {upcoming.map((g) => {
                const home = g.home.team.id === teamId;
                const opp = home ? g.away.team : g.home.team;
                const p = predict(elo, g.home.team.id, g.away.team.id);
                const win = home ? p.homeWin : 1 - p.homeWin;
                return (
                  <tr key={g.id}>
                    <td className="left nowrap muted small">{formatShortDate(g.date)} {formatTime(g.date)}</td>
                    <td className="left nowrap"><Link to={`/game/${g.id}`}>{home ? 'vs' : '@'} <TeamLogo team={opp} size={16} /> {opp.abbr}</Link></td>
                    <td className={win >= 0.5 ? 'win' : 'loss'} title="Model's win chance">{Math.round(win * 100)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {ahead && (
            <p className="muted small">
              {ahead.left} games left · {ahead.home} home, {ahead.road} road · opponents' win % {ahead.oppPct.toFixed(3).replace(/^0/, '')} · {ahead.backToBacks} back-to-backs ·{' '}
              <Link to="/insights?tab=schedule">compare →</Link>
            </p>
          )}
        </div>
        <div className="card">
          <h3>Leaders</h3>
          <LeaderList season={season.year} teamId={teamId} />
          <h3>Injury report</h3>
          <InjuryList teamId={teamId} />
        </div>
      </div>

      <SeasonPace teamId={teamId} season={season.year} />

      {rs.length > 0 && (
        <div className="card">
          <h3>Results</h3>
          <div className="result-chips">
            {[...rs].reverse().map((r) => (
              <Link key={r.game.id} to={`/game/${r.game.id}`} className={`chip ${r.won ? 'result-w' : 'result-l'}`}>
                {r.won ? 'W' : 'L'} {r.us}-{r.them} {r.home ? 'vs' : '@'} {r.game[r.home ? 'away' : 'home'].team.abbr}
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
