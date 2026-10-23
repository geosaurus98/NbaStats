// Small team panels shared by game previews and the team hub: injuries,
// recent form and leaders.
import { Link } from 'react-router-dom';
import { fetchInjuries, fetchLeagueGames } from '../api/espn';
import type { Game, Injury, TeamRef } from '../api/types';
import { useAsync } from '../hooks/useAsync';
import { formatShortDate } from '../lib/dates';
import { headToHead, predict, results, seasonElo, teamLeaders } from '../lib/teamContext';
import { TeamLogo } from './TeamLogo';

const statusClass = (s: string) => (/out/i.test(s) ? 'loss' : /day|question|doubt|probable/i.test(s) ? 'muted' : '');

export function InjuryList({ teamId, compact = false }: { teamId: string; compact?: boolean }) {
  const { data, error } = useAsync(() => fetchInjuries(), []);
  if (error) return <p className="muted small">Injury report unavailable.</p>;
  if (!data) return <p className="muted small">Loading injury report…</p>;
  const rows = data.filter((i) => i.teamId === teamId);
  if (!rows.length) return <p className="muted small">No injuries reported.</p>;
  return (
    <ul className="injuries">
      {rows.map((i: Injury) => (
        <li key={i.athleteId}>
          <Link to={`/player/${i.athleteId}`}>{i.name}</Link> <b className={statusClass(i.status)}>{i.status}</b>
          {!compact && i.comment && <div className="muted small">{i.comment}</div>}
          {i.returnDate && <span className="muted small"> · expected back {formatShortDate(i.returnDate)}</span>}
        </li>
      ))}
    </ul>
  );
}

export function FormStrip({ games, teamId, n = 10 }: { games: Game[]; teamId: string; n?: number }) {
  const rs = results(games, teamId).slice(-n);
  if (!rs.length) return <span className="muted small">No games yet</span>;
  const w = rs.filter((r) => r.won).length;
  return (
    <span className="form-strip" title={`Last ${rs.length}: ${w}-${rs.length - w}`}>
      {rs.map((r) => (
        <Link key={r.game.id} to={`/game/${r.game.id}`} className={r.won ? 'form-w' : 'form-l'} title={`${r.won ? 'W' : 'L'} ${r.us}-${r.them} ${r.home ? 'vs' : '@'} ${r.game[r.home ? 'away' : 'home'].team.abbr}, ${formatShortDate(r.game.date)}`}>
          {r.won ? 'W' : 'L'}
        </Link>
      ))}
      <span className="muted small"> {w}-{rs.length - w}</span>
    </span>
  );
}

export function LeaderList({ season, teamId }: { season: number; teamId: string }) {
  const rows = teamLeaders(season, teamId, 4);
  if (!rows.length) return <p className="muted small">No games yet.</p>;
  return (
    <table className="leader-list">
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="left"><Link to={`/player/${r.id}`}>{r.name}</Link></td>
            <td><b>{r.ppg.toFixed(1)}</b> <span className="muted small">pts</span></td>
            <td>{r.rpg.toFixed(1)} <span className="muted small">reb</span></td>
            <td>{r.apg.toFixed(1)} <span className="muted small">ast</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Before a game: the model's pick, form, this season's meetings, leaders and injuries. */
export function GamePreview({ game, season }: { game: Game; season: number }) {
  const model = useAsync(async () => {
    const [{ games }, elo] = await Promise.all([fetchLeagueGames(season, 2), seasonElo(season)]);
    return { games, elo };
  }, [season, game.id]);
  if (!model.data) return model.error ? null : <p className="muted">Loading preview…</p>;
  const { games, elo } = model.data;
  const p = predict(elo, game.home.team.id, game.away.team.id);
  const fav: TeamRef = p.margin >= 0 ? game.home.team : game.away.team;
  const favWin = p.margin >= 0 ? p.homeWin : 1 - p.homeWin;
  const meetings = headToHead(games, game.home.team.id, game.away.team.id);
  return (
    <div className="card preview">
      <h3>Preview</h3>
      <div className="preview-pick">
        <TeamLogo team={fav} size={32} />
        <div>
          <div>
            The model picks <b>{fav.name}</b> by <b>{Math.abs(p.margin).toFixed(1)}</b> · <b>{Math.round(favWin * 100)}%</b> to win
          </div>
          <div className="preview-bar" aria-label={`${game.away.team.abbr} ${Math.round((1 - p.homeWin) * 100)}%, ${game.home.team.abbr} ${Math.round(p.homeWin * 100)}%`}>
            <span style={{ width: `${(1 - p.homeWin) * 100}%`, background: 'var(--series-2)' }}>{game.away.team.abbr}</span>
            <span style={{ width: `${p.homeWin * 100}%`, background: 'var(--series-1)' }}>{game.home.team.abbr}</span>
          </div>
          <div className="muted small">From Elo ratings (last season carried over, home court worth about 3.5 points).</div>
        </div>
      </div>
      <div className="two-col preview-teams">
        {[game.away, game.home].map((c) => (
          <div key={c.team.id}>
            <h4><TeamLogo team={c.team} size={20} /> {c.team.name} <span className="muted small">{c.homeAway === 'home' ? 'home' : 'away'}</span></h4>
            <div className="small">Form: <FormStrip games={games} teamId={c.team.id} /></div>
            <LeaderList season={season} teamId={c.team.id} />
            <div className="small muted">Injuries</div>
            <InjuryList teamId={c.team.id} compact />
          </div>
        ))}
      </div>
      <p className="small">
        <b>This season:</b>{' '}
        {meetings.length
          ? meetings.map((g, i) => (
              <span key={g.id}>
                {i > 0 && ' · '}
                <Link to={`/game/${g.id}`}>{formatShortDate(g.date)}: {g.away.team.abbr} {g.away.score} @ {g.home.team.abbr} {g.home.score}</Link>
              </span>
            ))
          : 'first meeting'}
        {' · '}
        <Link to={`/h2h?a=${game.away.team.id}&b=${game.home.team.id}`}>Full head-to-head →</Link>
      </p>
    </div>
  );
}
