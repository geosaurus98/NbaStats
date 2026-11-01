import { useFollowed } from '../lib/follow';

/** Follow a player to see their games, streaks and injury news on the Alerts page. */
export function FollowButton({ playerId, name }: { playerId: string; name: string }) {
  const [ids, toggle] = useFollowed();
  const on = ids.includes(playerId);
  return (
    <button className={`star${on ? ' on' : ''}`} aria-pressed={on} title={on ? `Stop following ${name}` : `Follow ${name} on the Alerts page`} onClick={() => toggle(playerId)}>
      {on ? '★' : '☆'}
      <span className="star-label">{on ? 'Following' : 'Follow'}</span>
    </button>
  );
}
