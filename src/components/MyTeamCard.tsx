import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchTeamSchedule } from '../api/espn';
import type { Game } from '../api/types';
import { useFavourite } from '../FavouriteContext';
import { useAsync } from '../hooks/useAsync';
import { formatDay, formatTime, toISODate } from '../lib/dates';
import { isFinal, sides, won } from '../lib/league';
import { TeamLogo } from './TeamLogo';

function countdown(ms: number): string {
  if (ms <= 0) return 'starting now';
  const m = Math.floor(ms / 60_000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  return d > 0 ? `in ${d}d ${h}h` : h > 0 ? `in ${h}h ${m % 60}m` : `in ${m % 60}m`;
}

/** Favourite team's next game (with countdown) or, if none left, its last result. */
export function MyTeamCard({ season }: { season: number }) {
  const { favouriteId } = useFavourite();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const { data } = useAsync(async () => {
    if (!favouriteId) return undefined;
    const [reg, post] = await Promise.all([
      fetchTeamSchedule(favouriteId, season, 2),
      fetchTeamSchedule(favouriteId, season, 3).catch(() => ({ games: [] as Game[], team: undefined })),
    ]);
    return { team: reg.team, games: [...reg.games, ...post.games].sort((a, b) => a.date.localeCompare(b.date)) };
  }, [favouriteId, season]);

  if (!favouriteId) {
    return (
      <div className="my-team muted small">
        Tip: open any team and tap ☆ Favourite to pin their games here and see a countdown to their next game.
      </div>
    );
  }
  if (!data) return null;

  const live = data.games.find((g) => g.state === 'in');
  const next = data.games.find((g) => g.state === 'pre');
  const last = [...data.games].reverse().find(isFinal);
  const g = live ?? next ?? last;
  if (!g) return null;
  const [us, them] = sides(g, favouriteId);
  const team = data.team ?? us.team;

  let headline: string;
  if (g === live) headline = `LIVE · ${g.statusDetail} · ${us.score}-${them.score}`;
  else if (g === next) headline = `Next game ${countdown(new Date(g.date).getTime() - now)} · ${formatDay(toISODate(new Date(g.date)))} ${formatTime(g.date)}`;
  else headline = `Last game: ${won(g, favouriteId) ? 'W' : 'L'} ${us.score}-${them.score} · ${formatDay(toISODate(new Date(g.date)))}`;

  return (
    <Link to={`/game/${g.id}`} className="my-team card">
      <TeamLogo team={team} size={40} />
      <div>
        <div className="muted small">★ My team · {team.name}</div>
        <div className="my-team-line">
          {us.homeAway === 'home' ? 'vs' : '@'} {them.team.name}
        </div>
        <div className={g === live ? 'live small' : 'small'}>{headline}</div>
      </div>
    </Link>
  );
}
