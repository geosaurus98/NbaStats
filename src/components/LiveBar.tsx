// "Live now" strip under the header whenever games are in progress today.
import { Link } from 'react-router-dom';
import { fetchScoreboard } from '../api/espn';
import { useAsync } from '../hooks/useAsync';
import { usDate } from '../lib/dates';
import { alertsOn, useGameAlerts } from '../lib/gameAlerts';
import { useFavourite } from '../FavouriteContext';

// Every minute while games are on, otherwise every ten.
const LIVE_POLL_MS = 60_000;
const IDLE_POLL_MS = 10 * 60_000;

export function LiveBar() {
  // ESPN keys games by the US date, which is behind for viewers in Asia and Oceania.
  const today = usDate();
  const { favouriteId } = useFavourite();
  // Fresh every poll; errors (offline, blocked) just hide the bar. With game alerts on, it also checks every
  // minute from 15 minutes before the favourite team's game.
  const soon = (games: Awaited<ReturnType<typeof fetchScoreboard>>) =>
    alertsOn() && games.some((g) => g.state === 'pre' && (g.home.team.id === favouriteId || g.away.team.id === favouriteId) && Date.parse(g.date) - Date.now() < 15 * 60_000);
  const { data } = useAsync(
    () => fetchScoreboard(today, true).catch(() => []),
    [today],
    (games) => (games.some((g) => g.state === 'in') || soon(games) ? LIVE_POLL_MS : IDLE_POLL_MS),
  );
  useGameAlerts(data, favouriteId ?? undefined);
  const live = (data ?? []).filter((g) => g.state === 'in');
  if (live.length === 0) return null;
  return (
    <div className="live-bar">
      <div className="live-inner">
        <span className="live-dot">LIVE</span>
        {live.map((g) => (
          <Link key={g.id} to={`/game/${g.id}`} className="live-game">
            {g.away.team.abbr} {g.away.score} – {g.home.score} {g.home.team.abbr} <span className="muted small">{g.statusDetail}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
