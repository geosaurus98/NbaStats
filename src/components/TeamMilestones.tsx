// My team: career milestones coming up for the team's players and anyone you
// follow, with how many games each should take at their current pace.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { seasonSnapshot } from '../api/espn';
import { useCareers } from './CareerStats';
import { useFollowed } from '../lib/follow';
import { milestones } from '../lib/milestones';
import { useTeammateGraph } from '../lib/teammateStore';

export function TeamMilestones({ teamId, season }: { teamId: string; season: number }) {
  const careers = useCareers();
  const graph = useTeammateGraph();
  const [followed] = useFollowed();
  const snap = seasonSnapshot(season);
  const list = useMemo(() => {
    const box = snap?.box?.['2'];
    if (!careers.data || !graph || !box) return undefined;
    const mine = new Set([...box.players.filter((r) => r[1] === teamId).map((r) => r[0] as string), ...followed]);
    return milestones(careers.data, graph, box, 82)
      .filter((m) => mine.has(m.espnId))
      .sort((a, b) => a.gamesAway - b.gamesAway)
      .slice(0, 8);
  }, [careers.data, graph, snap, teamId, followed.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!list) return null;
  const names = snap?.players ?? {};
  return (
    <div className="card">
      <h3>Milestones coming up</h3>
      {!list.length ? (
        <p className="muted small">No career milestones within reach this season for your team's players{followed.length ? ' or the players you follow' : ''}.</p>
      ) : (
        <ul className="recap-list">
          {list.map((m) => (
            <li key={`${m.espnId}-${m.stat}-${m.target}`}>
              <Link to={`/player/${m.espnId}`}>{names[m.espnId] ?? m.espnId}</Link>: {m.remaining.toLocaleString()} {m.label} from {m.what}{' '}
              <span className="muted small">· about {m.gamesAway} game{m.gamesAway === 1 ? '' : 's'}{followed.includes(m.espnId) ? ' · following' : ''}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">Career totals including this season, at this season's per-game pace. Follow players (☆ on their page) to add them here. <Link to="/leaders?tab=milestones">Every milestone →</Link></p>
    </div>
  );
}
