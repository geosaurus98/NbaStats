import { fetchTeamAssists, type SeasonType } from '../api/espn';
import { useAsync } from '../hooks/useAsync';
import { AssistMatrix, AssistNetwork } from './AssistNetwork';
import { ErrorBox, Loading } from './Status';

/** Season-long "who assists whom" for a team. */
export function TeamAssists({ teamId, season, seasonType }: { teamId: string; season: number; seasonType: SeasonType }) {
  const { data, error, loading } = useAsync(() => fetchTeamAssists(teamId, season, seasonType), [teamId, season, seasonType]);
  if (loading) return <Loading label="Loading play-by-play…" />;
  if (error) return <ErrorBox error={error} />;
  if (!data?.pairs) return null;
  const total = data.pairs.pairs.reduce((s, p) => s + p[2], 0);
  return (
    <>
      <h2>Who assists whom</h2>
      <p className="muted small">
        {total.toLocaleString()} assisted baskets from {data.partial ? `the last ${data.games}` : `all ${data.games}`} games' play-by-play
        {data.partial ? ' (the full season is added once it ends)' : ''}. Top 10 players by passing involvement.
      </p>
      <div className="card">
        <AssistNetwork data={data.pairs} />
      </div>
      <h3>Every passer → scorer pair</h3>
      <AssistMatrix data={data.pairs} />
    </>
  );
}
