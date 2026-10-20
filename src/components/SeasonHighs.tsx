import { Link } from 'react-router-dom';
import { fetchGameLog, fetchLeaders, mapLimit, type SeasonType } from '../api/espn';
import { useAsync } from '../hooks/useAsync';
import { formatShortDate } from '../lib/dates';
import { HIGH_CATEGORIES, seasonHighs } from '../lib/playerStats';
import { Empty, ErrorBox, Loading } from './Status';

// Highs are drawn from these leaderboards' players (top 50 each), not every
// player in the league: ESPN has no single "best games" endpoint.
const POOLS = ['offensive.avgPoints', 'general.avgRebounds', 'offensive.avgAssists'];

export function SeasonHighs({ season, seasonType }: { season: number; seasonType: SeasonType }) {
  const { data, error, loading } = useAsync(async () => {
    const boards = await Promise.all(POOLS.map((sort) => fetchLeaders(season, seasonType, sort)));
    const players = new Map<string, { athleteId: string; athlete: string; team: string }>();
    for (const b of boards) for (const r of b.rows) if (r.athleteId) players.set(r.athleteId, r);
    const logs = await mapLimit([...players.values()], 6, async (p) => {
      const log = await fetchGameLog(p.athleteId, season).catch(() => undefined);
      const wanted = seasonType === 3 ? 'playoffs' : 'regular';
      return { ...p, games: log?.games.filter((g) => g.seasonType === wanted) ?? [] };
    });
    return { highs: seasonHighs(logs), poolSize: players.size };
  }, [season, seasonType]);

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
        Best single games by the top 50 qualified players in points, rebounds and assists ({data.poolSize} players), so a
        one-off big night from a bench player may be missing.
      </p>
    </>
  );
}
