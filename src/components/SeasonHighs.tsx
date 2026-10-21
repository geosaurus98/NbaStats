import { Link } from 'react-router-dom';
import { fetchSeasonHighs, type SeasonType } from '../api/espn';
import { useAsync } from '../hooks/useAsync';
import { formatShortDate } from '../lib/dates';
import { HIGH_CATEGORIES } from '../lib/playerStats';
import { Empty, ErrorBox, Loading } from './Status';

export function SeasonHighs({ season, seasonType }: { season: number; seasonType: SeasonType }) {
  const { data: result, error, loading } = useAsync(() => fetchSeasonHighs(season, seasonType), [season, seasonType]);
  const data = result && { highs: result, poolSize: result.poolSize };

  if (loading) return <Loading label="Loading game logs for the league's top players… (this takes a few seconds)" />;
  if (error) return <ErrorBox error={error} />;
  if (!data || data.poolSize === 0) return <Empty>No games yet.</Empty>;

  return (
    <>
      <div className="highs-grid">
        {HIGH_CATEGORIES.map((c) => (
          <div key={c.label} className="table-wrap">
            <h3 className="table-title">{c.title}</h3>
            <table>
              <tbody>
                {data.highs.byCategory[c.label].map((h, i) => (
                  <tr key={`${h.athleteId}-${h.game.gameId}`}>
                    <td>{i + 1}</td>
                    <td className="left">
                      <Link to={`/player/${h.athleteId}`}>{h.athlete}</Link> <span className="muted small">{h.team}</span>
                    </td>
                    <td className="left muted small nowrap">
                      <Link to={`/game/${h.game.gameId}`}>
                        {formatShortDate(h.game.date)} {h.game.atVs} {h.game.opponent.abbr}
                      </Link>
                    </td>
                    <td className="sorted">{h.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        <div className="table-wrap">
          <h3 className="table-title">Most triple-doubles</h3>
          {data.highs.tripleDoubles.length === 0 ? (
            <p className="muted small pad">None among these players.</p>
          ) : (
            <table>
              <tbody>
                {data.highs.tripleDoubles.map((p, i) => (
                  <tr key={p.athleteId}>
                    <td>{i + 1}</td>
                    <td className="left">
                      <Link to={`/player/${p.athleteId}`}>{p.athlete}</Link> <span className="muted small">{p.team}</span>
                    </td>
                    <td className="sorted">{p.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <p className="muted small">
        Best single games by the top {result!.poolDepth} qualified players in points, rebounds and assists ({data.poolSize}{' '}
        players), so a one-off big night from a bench player may be missing.
      </p>
    </>
  );
}
