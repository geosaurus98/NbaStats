import { useSearchParams } from 'react-router-dom';
import { fetchScoreboard } from '../api/espn';
import { GameCard } from '../components/GameCard';
import { Empty, ErrorBox, Loading } from '../components/Status';
import { useAsync } from '../hooks/useAsync';
import { addDays, formatDay } from '../lib/dates';
import { defaultDate } from '../lib/seasons';
import { useSeason } from '../SeasonContext';

export function Scores() {
  const { season } = useSeason();
  const [params, setParams] = useSearchParams();
  const date = params.get('date') ?? defaultDate(season);
  const setDate = (d: string) => setParams({ date: d });

  const { data, error, loading } = useAsync(
    (fresh) => fetchScoreboard(date, fresh),
    [date],
    (games) => (games.some((g) => g.state === 'in') ? 30_000 : undefined),
  );

  const results = data?.filter((g) => g.state === 'post') ?? [];
  const live = data?.filter((g) => g.state === 'in') ?? [];
  const fixtures = data?.filter((g) => g.state === 'pre') ?? [];

  return (
    <section>
      <div className="page-head">
        <h1>Scores &amp; fixtures</h1>
        <div className="date-nav">
          <button onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">‹</button>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <button onClick={() => setDate(addDays(date, 1))} aria-label="Next day">›</button>
        </div>
      </div>
      <p className="muted">
        {formatDay(date)}
        {(date < season.start || date > season.end) && ` · outside the ${season.label} season`}
        {' · '}
        <button className="link" onClick={() => setDate(season.start)}>Opening night</button>
        {' · '}
        <button className="link" onClick={() => setDate(season.regularEnd)}>Final regular-season day</button>
      </p>

      {loading && !data && <Loading />}
      {error && <ErrorBox error={error} />}
      {data && data.length === 0 && <Empty>No games on this date.</Empty>}

      {live.length > 0 && <GameGrid title="Live" games={live} />}
      {fixtures.length > 0 && <GameGrid title="Upcoming" games={fixtures} />}
      {results.length > 0 && <GameGrid title="Results" games={results} />}
    </section>
  );
}

function GameGrid({ title, games }: { title: string; games: Parameters<typeof GameCard>[0]['game'][] }) {
  return (
    <>
      <h2>{title}</h2>
      <div className="grid">
        {games.map((g) => (
          <GameCard key={g.id} game={g} />
        ))}
      </div>
    </>
  );
}
