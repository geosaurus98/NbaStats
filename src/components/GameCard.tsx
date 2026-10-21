import { Link } from 'react-router-dom';
import type { Competitor, Game } from '../api/types';
import { formatTime } from '../lib/dates';
import { TeamLogo } from './TeamLogo';

function Row({ c, game }: { c: Competitor; game: Game }) {
  const lost = game.state === 'post' && c.winner === false;
  return (
    <div className={`gc-row${lost ? ' lost' : ''}`}>
      <TeamLogo team={c.team} />
      <span className="gc-team">
        {c.team.shortName}
        {c.record && <small> {c.record}</small>}
      </span>
      {game.state !== 'pre' && <span className="gc-score">{c.score ?? '-'}</span>}
    </div>
  );
}

export function GameCard({ game, favourite }: { game: Game; favourite?: boolean }) {
  const status =
    game.state === 'pre' ? formatTime(game.date) : game.state === 'in' ? game.statusDetail : game.statusDetail || 'Final';
  const leaders = [game.away, game.home]
    .map((c) => ({ c, top: c.leaders.find((l) => /^(pts|points)$/i.test(l.category)) }))
    .filter((x) => x.top);

  return (
    <Link to={`/game/${game.id}`} className={`game-card state-${game.state}${favourite ? ' fav' : ''}`}>
      <div className="gc-head">
        <span className={`gc-status${game.state === 'in' ? ' live' : ''}`}>
          {favourite && '★ '}
          {status}
        </span>
        {game.broadcasts.length > 0 && <span className="muted">{game.broadcasts.slice(0, 2).join(', ')}</span>}
      </div>
      {game.note && <div className="gc-note">{game.note}</div>}
      <Row c={game.away} game={game} />
      <Row c={game.home} game={game} />
      {game.state !== 'pre' && leaders.length > 0 && (
        <div className="gc-leaders">
          {leaders.map(({ c, top }) => (
            <span key={c.team.id}>
              {c.team.abbr}: {top!.athlete} {top!.value} pts
            </span>
          ))}
        </div>
      )}
      {game.state === 'pre' && game.venue && <div className="gc-leaders muted">{game.venue}</div>}
    </Link>
  );
}
