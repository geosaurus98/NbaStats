import { Link } from 'react-router-dom';
import { fetchTeams } from '../api/espn';
import { FavouriteStar } from '../components/FavouriteStar';
import { ErrorBox, Loading } from '../components/Status';
import { TeamLogo } from '../components/TeamLogo';
import { useAsync } from '../hooks/useAsync';
import { useSeason } from '../SeasonContext';

export function Teams() {
  const { season } = useSeason();
  const { data, error, loading } = useAsync(() => fetchTeams(season.year), [season.year]);
  return (
    <section>
      <h1>Teams</h1>
      {loading && <Loading />}
      {error && <ErrorBox error={error} />}
      <div className="team-grid">
        {data?.map((t) => (
          <Link key={t.id} to={`/team/${t.id}`} className="team-tile" style={{ borderTopColor: t.color }}>
            <TeamLogo team={t} size={48} />
            <span>{t.name}</span>
            <FavouriteStar teamId={t.id} teamName={t.name} />
          </Link>
        ))}
      </div>
    </section>
  );
}
