import { useSearchParams } from 'react-router-dom';
import { fetchScoreboard } from '../api/espn';
import { GameCard } from '../components/GameCard';
import { MyTeamCard } from '../components/MyTeamCard';
import { Empty, ErrorBox, Loading } from '../components/Status';
import { useAsync } from '../hooks/useAsync';
import { addDays, formatDay } from '../lib/dates';
import { defaultDate } from '../lib/seasons';
import { useFavourite } from '../FavouriteContext';
import { useSeason } from '../SeasonContext';
import type { Game } from '../api/types';

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

  const { favouriteId } = useFavourite();
  const isFav = (g: Game) => !!favouriteId && (g.home.team.id === favouriteId || g.away.team.id === favouriteId);
  // Favourite team's game first within each group.
  const group = (state: Game['state']) =>
    (data ?? []).filter((g) => g.state === state).sort((a, b) => Number(isFav(b)) - Number(isFav(a)));
  const results = group('post');
  const live = group('in');
  const fixtures = group('pre');

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

      <MyTeamCard season={season.year} />

      {loading && !data && <Loading />}
      {error && <ErrorBox error={error} />}
      {data && data.length === 0 && <Empty>No games on this date.</Empty>}

      {live.length > 0 && <GameGrid title="Live" games={live} isFav={isFav} />}
      {fixtures.length > 0 && <GameGrid title="Upcoming" games={fixtures} isFav={isFav} />}
      {results.length > 0 && <GameGrid title="Results" games={results} isFav={isFav} />}
    </section>
  );
}

function GameGrid({ title, games, isFav }: { title: string; games: Game[]; isFav: (g: Game) => boolean }) {
  return (
    <>
      <h2>{title}</h2>
      <div className="grid">
        {games.map((g) => (
          <GameCard key={g.id} game={g} favourite={isFav(g)} />
        ))}
      </div>
    </>
  );
}
