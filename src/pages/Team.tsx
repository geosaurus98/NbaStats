import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fetchTeamSchedule, seasonShots, type SeasonType } from '../api/espn';
import type { Game } from '../api/types';
import { ColumnChart, LineChart } from '../components/Charts';
import { FavouriteStar } from '../components/FavouriteStar';
import { Empty, ErrorBox, Loading } from '../components/Status';
import { TeamLogo } from '../components/TeamLogo';
import { SeasonShotMap } from '../components/SeasonShotMap';
import { TeamAssists } from '../components/TeamAssists';
import { TeamLineups } from '../components/TeamLineups';
import { Tile } from '../components/Tile';
import { useAsync } from '../hooks/useAsync';
import { SeasonPace } from '../components/SeasonPace';
import { EloHistory } from '../components/MoreGraphs';
import { PairHeatmap, PointsBySource } from '../components/ShotGraphs';
import { QuarterSplits } from '../components/TeamAnalytics';
import { InjuryList } from '../components/TeamBits';
import { TeamPayroll } from '../components/TeamPayroll';
import { DEFAULT_SEASON } from '../lib/seasons';
import { formatShortDate, formatTime, parseISODate, toISODate } from '../lib/dates';
import { downloadFile, gamesToICS } from '../lib/ics';
import { countsInStandings, isFinal, raceSeries, sides, won } from '../lib/league';
import { FRANCHISES } from '../lib/franchises';
import { useSeason } from '../SeasonContext';
import { SeasonTypeToggle } from '../components/SeasonTypeToggle';

export function Team() {
  const { id = '' } = useParams();
  const { season } = useSeason();
  const navigate = useNavigate();
  const [type, setType] = useState<SeasonType>(2);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const { data, error, loading } = useAsync(
    () => fetchTeamSchedule(id, season.year, type),
    [id, season.year, type],
  );

  const games = data?.games ?? [];
  const results = games.filter(isFinal);
  const fixtures = games.filter((g) => !isFinal(g));
  const counted = results.filter(countsInStandings);
  const wins = counted.filter((g) => won(g, id)).length;
  const pf = counted.reduce((s, g) => s + (sides(g, id)[0].score ?? 0), 0);
  const pa = counted.reduce((s, g) => s + (sides(g, id)[1].score ?? 0), 0);
  const team = data?.team ?? (games[0] && sides(games[0], id)[0].team);
  const recent = counted.slice(-10);
  const shots = seasonShots(season.year, type);
  const recentWins = recent.filter((g) => won(g, id)).length;

  const exportICS = () => {
    if (!team) return;
    const label = type === 3 ? 'playoffs' : 'season';
    downloadFile(`${team.abbr}-${season.label}-${label}.ics`, gamesToICS(games, `${team.name} ${season.label}`), 'text/calendar');
  };

  return (
    <section>
      <div className="page-head">
        <h1 className="team-title">
          {team && <TeamLogo team={team} size={40} />}
          {team?.name ?? 'Team'} <span className="muted">{season.label}</span>
          {team && <FavouriteStar teamId={team.id} teamName={team.name} />}
        </h1>
        <SeasonTypeToggle value={type} onChange={setType} />
      </div>
      <div className="actions">
        {games.length > 0 && (
          <button className="chip" onClick={exportICS}>
            📅 Add {fixtures.length > 0 ? 'fixtures' : 'schedule'} to calendar (.ics)
          </button>
        )}
        <Link className="chip" to={`/h2h?a=${id}`}>Compare head-to-head</Link>
        {FRANCHISES.find((f) => f.espnId === id) && (
          <Link className="chip" to={`/franchise/${FRANCHISES.find((f) => f.espnId === id)!.id}`}>Franchise history →</Link>
        )}
      </div>
      {loading && <Loading />}
      {error && <ErrorBox error={error} />}
      {data && games.length === 0 && <Empty>No games found for this selection.</Empty>}

      {results.length > 0 && (
        <div className="stat-tiles">
          <Tile label="Record" value={`${wins}-${counted.length - wins}`} />
          <Tile label="Points per game" value={(pf / counted.length).toFixed(1)} />
          <Tile label="Points allowed" value={(pa / counted.length).toFixed(1)} />
          <Tile label="Average margin" value={signed((pf - pa) / counted.length)} />
          <Tile label="Last 10" value={`${recentWins}-${recent.length - recentWins}`} />
        </div>
      )}

      {results.length > 1 && <TeamCharts id={id} results={results} onSelect={(g) => navigate(`/game/${g.id}`)} />}

      {type === 2 && results.length > 0 && <SeasonPace teamId={id} season={season.year} />}

      {type === 2 && results.length > 0 && <EloHistory teamId={id} season={season.year} />}

      {season.year === DEFAULT_SEASON && <TeamPayroll teamId={id} />}

      {season.year === DEFAULT_SEASON && (
        <div className="card">
          <h3>Injury report</h3>
          <InjuryList teamId={id} />
        </div>
      )}

      {results.length > 0 && <TeamAssists teamId={id} season={season.year} seasonType={type} />}

      {results.length > 0 && <TeamLineups teamId={id} season={season.year} seasonType={type} />}

      <PairHeatmap teamId={id} season={season.year} type={type} />

      {type === 2 && <PointsBySource teamId={id} season={season.year} />}

      <QuarterSplits teamId={id} season={season.year} type={type} />

      {shots?.teams[id] && (
        <>
          <h2>Where they shoot from</h2>
          <SeasonShotMap bins={shots.teams[id]} size={shots.teamSize} league={shots.league} leagueSize={shots.teamSize} />
        </>
      )}

      {games.length > 0 && (
        <div className="page-head">
          <h2>Schedule</h2>
          <div className="segmented">
            <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>List</button>
            <button className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}>Calendar</button>
          </div>
        </div>
      )}

      {view === 'calendar' && games.length > 0 && <TeamCalendar id={id} games={games} />}

      {view === 'list' && fixtures.length > 0 && (
        <>
          <h3>Fixtures ({fixtures.length})</h3>
          <ScheduleTable games={fixtures} id={id} />
        </>
      )}
      {view === 'list' && results.length > 0 && (
        <>
          <h3>Results ({results.length})</h3>
          <ScheduleTable games={[...results].reverse()} id={id} />
        </>
      )}
    </section>
  );
}

function signed(n: number) {
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}`;
}

function TeamCharts({ id, results, onSelect }: { id: string; results: Game[]; onSelect: (g: Game) => void }) {
  const race = raceSeries(results, id);
  const label = (g: Game) => {
    const [us, them] = sides(g, id);
    return `${formatShortDate(g.date)} ${us.homeAway === 'home' ? 'vs' : '@'} ${them.team.abbr}`;
  };
  return (
    <div className="two-col charts">
      <div className="card">
        <h3>Winning margin by game</h3>
        <ColumnChart
          ariaLabel="Points margin in each game; positive is a win"
          columns={results.map((g) => {
            const [us, them] = sides(g, id);
            return { value: (us.score ?? 0) - (them.score ?? 0), label: label(g), detail: `${won(g, id) ? 'W' : 'L'} ${us.score}-${them.score}` };
          })}
          yFormat={(v) => (v > 0 ? `+${v}` : String(v))}
          onSelect={(i) => onSelect(results[i])}
        />
        <p className="muted small">Blue = win, red = loss. Click a bar to open that game.</p>
      </div>
      <div className="card">
        <h3>Games above .500</h3>
        <LineChart
          ariaLabel="Wins minus losses after each game"
          series={[{ id, label: 'Games above .500', values: race, color: 'var(--series-1)' }]}
          xLabel={(i) => (results[i] ? `Game ${i + 1} · ${label(results[i])}` : '')}
          xTick={(i) => `G${i + 1}`}
          yFormat={(v) => (v > 0 ? `+${v}` : String(v))}
          zeroLine
        />
        <p className="muted small">Wins minus losses after each game.</p>
      </div>
    </div>
  );
}

function ScheduleTable({ games, id }: { games: Game[]; id: string }) {
  return (
    <div className="table-wrap">
      <table>
        <tbody>
          {games.map((g) => {
            const [us, o] = sides(g, id);
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
                  {isFinal(g) ? (
                    <Link to={`/game/${g.id}`}>
                      <b className={won(g, id) ? 'win' : 'loss'}>{won(g, id) ? 'W' : 'L'}</b> {us.score}-{o.score}
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

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function TeamCalendar({ id, games }: { id: string; games: Game[] }) {
  const byDay = new Map<string, Game>();
  for (const g of games) byDay.set(toISODate(new Date(g.date)), g);
  const days = [...byDay.keys()].sort();
  const first = parseISODate(days[0]);
  const last = parseISODate(days[days.length - 1]);
  const months: Date[] = [];
  for (let d = new Date(first.getFullYear(), first.getMonth(), 1); d <= last; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    months.push(d);
  }

  return (
    <div className="calendar-months">
      {months.map((m) => {
        const daysInMonth = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
        const cells: (string | null)[] = Array(m.getDay()).fill(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(toISODate(new Date(m.getFullYear(), m.getMonth(), d)));
        return (
          <div key={m.toISOString()} className="card month">
            <h3>{m.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
            <div className="cal-grid">
              {WEEKDAYS.map((w) => (
                <div key={w} className="cal-head">{w}</div>
              ))}
              {cells.map((iso, i) => {
                if (!iso) return <div key={`e${i}`} />;
                const g = byDay.get(iso);
                const day = Number(iso.slice(-2));
                if (!g) return <div key={iso} className="cal-cell"><span className="cal-day">{day}</span></div>;
                const [us, o] = sides(g, id);
                const final = isFinal(g);
                const w = final && won(g, id);
                return (
                  <Link key={iso} to={`/game/${g.id}`} className={`cal-cell game${final ? (w ? ' w' : ' l') : ''}`}>
                    <span className="cal-day">{day}</span>
                    <span className="cal-opp">{us.homeAway === 'home' ? 'vs' : '@'} {o.team.abbr}</span>
                    <span className="cal-res">{final ? `${w ? 'W' : 'L'} ${us.score}-${o.score}` : formatTime(g.date)}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
