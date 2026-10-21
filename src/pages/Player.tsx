import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fetchAthlete, fetchGameLog, playerAssistPartners } from '../api/espn';
import type { LogSeasonType } from '../api/types';
import { LineChart } from '../components/Charts';
import { PassingPartners } from '../components/PassingPartners';
import { Empty, ErrorBox, Loading } from '../components/Status';
import { TeamLogo } from '../components/TeamLogo';
import { Tile } from '../components/Tile';
import { useAsync } from '../hooks/useAsync';
import { formatShortDate } from '../lib/dates';
import { averages, statValue } from '../lib/playerStats';
import { useSeason } from '../SeasonContext';

const TREND_STATS = [
  { label: 'PTS', title: 'Points' },
  { label: 'REB', title: 'Rebounds' },
  { label: 'AST', title: 'Assists' },
  { label: '3PM', title: 'Threes made' },
  { label: 'MIN', title: 'Minutes' },
];

const ROLLING = 10;

export function Player() {
  const { id = '' } = useParams();
  const { season } = useSeason();
  const navigate = useNavigate();
  const [type, setType] = useState<LogSeasonType>('regular');
  const [trend, setTrend] = useState('PTS');

  const profile = useAsync(() => fetchAthlete(id), [id]);
  const log = useAsync(() => fetchGameLog(id, season.year), [id, season.year]);

  const games = log.data?.games.filter((g) => g.seasonType === type) ?? [];
  const hasPlayoffs = log.data?.games.some((g) => g.seasonType === 'playoffs');
  const avg = averages(games);
  const p = profile.data;
  const partners = playerAssistPartners(id, season.year, type === 'playoffs' ? 3 : 2);

  const values = games.map((g) => statValue(g, trend));
  const rolling = values.map((_, i) => {
    const win = values.slice(Math.max(0, i - ROLLING + 1), i + 1);
    return Math.round((win.reduce((a, b) => a + b, 0) / win.length) * 10) / 10;
  });
  const trendTitle = TREND_STATS.find((t) => t.label === trend)?.title ?? trend;
  const pct = (v?: number) => (v == null ? '-' : `${(v * 100).toFixed(1)}%`);
  const columns = log.data?.labels ?? [];

  return (
    <section>
      {profile.error && <ErrorBox error={profile.error} />}
      <div className="player-head">
        {p?.headshot && <img className="headshot" src={p.headshot} alt="" width={96} height={70} />}
        <div>
          <h1>{p?.name ?? (profile.loading ? 'Loading…' : 'Player')}</h1>
          <p className="muted">
            {p?.team && (
              <Link to={`/team/${p.team.id}`} className="team-cell">
                <TeamLogo team={p.team} size={18} /> {p.team.name}
              </Link>
            )}
            {[p?.jersey, p?.position, p?.height, p?.weight, p?.age ? `Age ${p.age}` : undefined]
              .filter(Boolean)
              .map((x) => ` · ${x}`)
              .join('')}
          </p>
        </div>
        {p?.name && (
          <Link className="chip" to={`/degrees?c=${encodeURIComponent(p.name)}`}>
            6 degrees: teammate graph
          </Link>
        )}
        {hasPlayoffs && (
          <div className="segmented push-right">
            <button className={type === 'regular' ? 'active' : ''} onClick={() => setType('regular')}>Regular season</button>
            <button className={type === 'playoffs' ? 'active' : ''} onClick={() => setType('playoffs')}>Playoffs</button>
          </div>
        )}
      </div>

      {log.loading && <Loading label="Loading game log…" />}
      {log.error && <ErrorBox error={log.error} />}
      {log.data && games.length === 0 && <Empty>No {type === 'playoffs' ? 'playoff' : 'regular-season'} games in {season.label}.</Empty>}

      {games.length > 0 && (
        <>
          <h2>{season.label} {type === 'playoffs' ? 'playoff' : 'season'} averages</h2>
          <div className="stat-tiles">
            <Tile label="Games" value={String(avg.gp)} />
            <Tile label="Points" value={avg.pts.toFixed(1)} />
            <Tile label="Rebounds" value={avg.reb.toFixed(1)} />
            <Tile label="Assists" value={avg.ast.toFixed(1)} />
            <Tile label="Steals" value={avg.stl.toFixed(1)} />
            <Tile label="Blocks" value={avg.blk.toFixed(1)} />
            <Tile label="FG%" value={pct(avg.fgPct)} />
            <Tile label="3P%" value={pct(avg.threePct)} />
            <Tile label="FT%" value={pct(avg.ftPct)} />
            <Tile label="Minutes" value={avg.min.toFixed(1)} />
          </div>

          <div className="page-head">
            <h2>{trendTitle} by game</h2>
            <div className="chips tight">
              {TREND_STATS.map((t) => (
                <button key={t.label} className={t.label === trend ? 'chip active' : 'chip'} onClick={() => setTrend(t.label)}>
                  {t.title}
                </button>
              ))}
            </div>
          </div>
          <div className="card">
            <LineChart
              ariaLabel={`${trendTitle} per game with ${ROLLING}-game average`}
              series={[
                { id: 'game', label: `${trendTitle} that game`, values, color: 'var(--series-2)' },
                { id: 'avg', label: `${ROLLING}-game average`, values: rolling, color: 'var(--series-1)' },
              ]}
              xLabel={(i) => (games[i] ? `${formatShortDate(games[i].date)} ${games[i].atVs} ${games[i].opponent.abbr}` : '')}
              xTick={(i) => (games[i] ? formatShortDate(games[i].date) : '')}
              yFormat={(v) => (Number.isInteger(v) ? String(v) : v.toFixed(1))}
            />
          </div>

          {partners && <PassingPartners to={partners.to} from={partners.from} />}

          <h2>Game log</h2>
          <div className="table-wrap">
            <table className="box">
              <thead>
                <tr>
                  <th className="left">Date</th>
                  <th className="left">Opp</th>
                  <th className="left">Result</th>
                  {columns.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...games].reverse().map((g) => (
                  <tr key={g.gameId} className="clickable" onClick={() => navigate(`/game/${g.gameId}`)}>
                    <td className="left nowrap">{formatShortDate(g.date)}</td>
                    <td className="left nowrap">
                      <span className="muted">{g.atVs}</span> {g.opponent.abbr}
                    </td>
                    <td className="left nowrap">
                      <b className={g.result === 'W' ? 'win' : 'loss'}>{g.result}</b> {g.score}
                    </td>
                    {columns.map((c) => (
                      <td key={c} className={c === trend ? 'sorted' : undefined}>{g.stats[c]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
