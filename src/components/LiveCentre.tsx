// Live game centre: the state of a game in progress at a glance: win
// probability and how it has moved, the current run, who is on the floor
// (with their lines and foul trouble), team fouls and the latest plays.
import { Link } from 'react-router-dom';
import type { GameSummary, TeamBox } from '../api/types';
import { currentRun, foulTrouble, mmss, onCourt, teamFouls } from '../lib/liveGame';
import { TeamLogo } from './TeamLogo';

const periodName = (p: number) => (p <= 4 ? `Q${p}` : `OT${p - 4}`);

export function LiveCentre({ summary }: { summary: GameSummary }) {
  const { game, teams, pbp } = summary;
  const feed = pbp.feed;
  const last = feed[feed.length - 1];
  const period = last?.period ?? 1;
  const home = game.home.team;
  const away = game.away.team;
  const court = onCourt(teams, feed);
  const run = currentRun(feed, home.id, away.id);
  const fouls = teamFouls(feed, period);
  const wpPlays = feed.filter((f) => f.wp != null);
  const wp = wpPlays[wpPlays.length - 1]?.wp;
  const before = last ? wpPlays.filter((f) => f.t <= last.t - 300).pop()?.wp : undefined;
  const favHome = wp == null || wp >= 0.5;
  const fav = favHome ? home : away;
  const favWp = wp == null ? undefined : favHome ? wp : 1 - wp;
  const swing = wp != null && before != null ? Math.round((wp - before) * 100) : undefined;
  const runTeam = run && (run.teamId === home.id ? home : away);
  return (
    <div className="live-centre">
      <div className="stat-tiles">
        {favWp != null && (
          <div className="tile">
            <div className="tile-value">{Math.round(favWp * 100)}%</div>
            <div className="tile-label">{fav.abbr} win probability{swing ? ` · ${swing > 0 ? home.abbr : away.abbr} +${Math.abs(swing)} in the last 5 min` : ''}</div>
            <div className="wp-bar" aria-hidden>
              <span style={{ width: `${(1 - (wp ?? 0.5)) * 100}%`, background: 'var(--series-2)' }} />
              <span style={{ width: `${(wp ?? 0.5) * 100}%`, background: 'var(--series-1)' }} />
            </div>
            <div className="wp-ends small muted"><span>{away.abbr}</span><span>{home.abbr}</span></div>
          </div>
        )}
        <div className="tile">
          <div className="tile-value">{run && runTeam ? `${run.for}-${run.against}` : '–'}</div>
          <div className="tile-label">{run && runTeam ? `${runTeam.abbr} run over ${mmss(run.seconds)}` : 'No run going'}</div>
        </div>
        {[away, home].map((t) => {
          const n = fouls.get(t.id) ?? 0;
          return (
            <div key={t.id} className="tile">
              <div className="tile-value">{n}</div>
              <div className="tile-label">{t.abbr} team fouls in {periodName(period)}{n >= 5 ? ' · opponent in the bonus' : ''}</div>
            </div>
          );
        })}
      </div>
      <h3>On the floor</h3>
      <div className="two-col">
        {[away, home].map((t) => {
          const box = teams.find((b) => b.team.id === t.id);
          return box ? <Floor key={t.id} box={box} ids={court.get(t.id) ?? []} period={period} /> : null;
        })}
      </div>
      <h3>Latest plays</h3>
      <ol className="feed">
        {feed.slice(-8).reverse().map((f) => (
          <li key={f.id} className={f.scoring ? 'scoring' : undefined}>
            <span className="feed-time muted small">{periodName(f.period)} {f.clock}</span>
            <span className="feed-team small">{f.teamId === home.id ? home.abbr : f.teamId === away.id ? away.abbr : ''}</span>
            <span className="feed-text">{f.text}</span>
            <span className="feed-score small">{away.abbr} {f.away}-{f.home} {home.abbr}</span>
          </li>
        ))}
      </ol>
      <p className="muted small">Who's on the floor is worked out from ESPN's substitutions, so it can lag a play behind. Players in foul trouble are flagged (2 fouls in the 1st, 3 in the 2nd, 4 in the 3rd, 5 in the 4th).</p>
    </div>
  );
}

function Floor({ box, ids, period }: { box: TeamBox; ids: string[]; period: number }) {
  const col = (l: string) => box.labels.indexOf(l);
  const [pts, reb, ast, pf, min, pm] = ['PTS', 'REB', 'AST', 'PF', 'MIN', '+/-'].map(col);
  const players = ids.map((id) => box.players.find((p) => p.id === id)).filter((p) => !!p);
  const bench = box.players.filter((p) => !p.dnp && p.id && !ids.includes(p.id) && pf >= 0 && foulTrouble(Number(p.stats[pf]) || 0, period));
  return (
    <div className="table-wrap flush">
      <h4 className="team-title"><TeamLogo team={box.team} size={20} /> {box.team.shortName ?? box.team.name}</h4>
      <table>
        <thead>
          <tr>
            <th className="left">Player</th>
            <th>MIN</th>
            <th>PTS</th>
            <th>REB</th>
            <th>AST</th>
            <th>PF</th>
            <th>+/-</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => {
            const fouls = Number(p.stats[pf]) || 0;
            return (
              <tr key={p.id}>
                <td className="left nowrap"><Link to={`/player/${p.id}`}>{p.shortName ?? p.name}</Link></td>
                <td>{p.stats[min] ?? '-'}</td>
                <td>{p.stats[pts] ?? '-'}</td>
                <td>{p.stats[reb] ?? '-'}</td>
                <td>{p.stats[ast] ?? '-'}</td>
                <td className={foulTrouble(fouls, period) ? 'loss' : undefined}>{fouls}{foulTrouble(fouls, period) && <span aria-label="foul trouble"> ⚠</span>}</td>
                <td>{p.stats[pm] ?? '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {bench.length > 0 && <p className="small muted">On the bench in foul trouble: {bench.map((p) => `${p.shortName ?? p.name} (${p.stats[pf]})`).join(', ')}</p>}
    </div>
  );
}
