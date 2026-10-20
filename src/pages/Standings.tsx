import { Link } from 'react-router-dom';
import { fetchStandings } from '../api/espn';
import { RaceChart } from '../components/RaceChart';
import { ErrorBox, Loading } from '../components/Status';
import { TeamLogo } from '../components/TeamLogo';
import { useAsync } from '../hooks/useAsync';
import { useSeason } from '../SeasonContext';

export function Standings() {
  const { season } = useSeason();
  const { data, error, loading } = useAsync(() => fetchStandings(season.year), [season.year]);

  return (
    <section>
      <h1>{season.label} standings</h1>
      {loading && <Loading />}
      {error && <ErrorBox error={error} />}
      <div className="two-col">
        {data?.map((conf) => (
          <div key={conf.name} className="table-wrap">
            <h2>{conf.name}</h2>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th className="left">Team</th>
                  <th>W</th>
                  <th>L</th>
                  <th>PCT</th>
                  <th>GB</th>
                  <th>Home</th>
                  <th>Road</th>
                  <th>L10</th>
                  <th>Strk</th>
                  <th>PPG</th>
                  <th>OPP</th>
                </tr>
              </thead>
              <tbody>
                {conf.rows.map((r, i) => (
                  <tr key={r.team.id} className={i === 5 ? 'cut playoff' : i === 9 ? 'cut playin' : undefined}>
                    <td>{r.seed ?? i + 1}</td>
                    <td className="left">
                      <Link to={`/team/${r.team.id}`} className="team-cell">
                        <TeamLogo team={r.team} size={20} />
                        {r.team.name}
                      </Link>
                    </td>
                    <td>{r.wins}</td>
                    <td>{r.losses}</td>
                    <td>{r.pct.toFixed(3).replace(/^0/, '')}</td>
                    <td>{r.gb}</td>
                    <td>{r.home}</td>
                    <td>{r.road}</td>
                    <td>{r.last10}</td>
                    <td>{r.streak}</td>
                    <td>{r.ppg?.toFixed(1) ?? '-'}</td>
                    <td>{r.oppPpg?.toFixed(1) ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
      <p className="muted small">Line after 6th: guaranteed playoff spots. Line after 10th: play-in cut-off.</p>
      {data && data.length > 0 && <RaceChart season={season.year} conferences={data} />}
    </section>
  );
}
