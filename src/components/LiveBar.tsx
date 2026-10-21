// "Live now" strip under the header whenever games are in progress today.
import { Link } from 'react-router-dom';
import { fetchScoreboard } from '../api/espn';
import { useAsync } from '../hooks/useAsync';
import { toISODate } from '../lib/dates';

// Every minute while games are on, otherwise every ten.
const LIVE_POLL_MS = 60_000;
const IDLE_POLL_MS = 10 * 60_000;

export function LiveBar() {
  const today = toISODate(new Date());
  // Fresh every poll; errors (offline, blocked) just hide the bar.
  const { data } = useAsync(
    () => fetchScoreboard(today, true).catch(() => []),
    [today],
    (games) => (games.some((g) => g.state === 'in') ? LIVE_POLL_MS : IDLE_POLL_MS),
  );
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
