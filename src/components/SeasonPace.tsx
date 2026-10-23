// This season against last season, game by game: wins after each game
// number, and where the team stood at the same point a year ago.
import { fetchLeagueGames } from '../api/espn';
import { useAsync } from '../hooks/useAsync';
import { SEASONS } from '../lib/seasons';
import { results } from '../lib/teamContext';
import { LineChart } from './Charts';

export function SeasonPace({ teamId, season }: { teamId: string; season: number }) {
  const prevSeason = SEASONS.find((s) => s.year === season - 1);
  const { data } = useAsync(async () => {
    if (!prevSeason) return undefined;
    const [now, prev] = await Promise.all([fetchLeagueGames(season, 2), fetchLeagueGames(season - 1, 2)]);
    return { now: results(now.games, teamId), prev: results(prev.games, teamId) };
  }, [teamId, season]);
  if (!prevSeason || !data || !data.now.length || !data.prev.length) return null;
  const cum = (rs: typeof data.now) => rs.reduce<number[]>((acc, r) => [...acc, (acc[acc.length - 1] ?? 0) + (r.won ? 1 : 0)], []);
  const now = cum(data.now);
  const prev = cum(data.prev);
  const n = now.length;
  const w = now[n - 1];
  const pw = prev[Math.min(n, prev.length) - 1];
  const diff = w - pw;
  const pace = Math.round((w / n) * 82);
  const thisLabel = SEASONS.find((s) => s.year === season)?.label ?? String(season);
  return (
    <div className="card">
      <h3>{thisLabel} vs {prevSeason.label}</h3>
      <p>
        After {n} game{n === 1 ? '' : 's'}: <b>{w}-{n - w}</b>, against <b>{pw}-{Math.min(n, prev.length) - pw}</b> at the same point last season (
        <span className={diff > 0 ? 'win' : diff < 0 ? 'loss' : ''}>{diff > 0 ? `${diff} ahead` : diff < 0 ? `${-diff} behind` : 'level'}</span>
        ). On pace for <b>{pace}</b> wins; last season finished {prev[prev.length - 1]}-{prev.length - prev[prev.length - 1]}.
      </p>
      <LineChart
        ariaLabel="Wins after each game, this season and last"
        series={[
          { id: 'now', label: thisLabel, values: [...now, ...Array(Math.max(0, prev.length - n)).fill(null)], color: 'var(--series-1)' },
          { id: 'prev', label: prevSeason.label, values: prev, color: 'var(--series-2)' },
        ]}
        xLabel={(i) => `After game ${i + 1}`}
        xTick={(i) => String(i + 1)}
        yFormat={(v) => String(v)}
        height={220}
        step
      />
    </div>
  );
}
