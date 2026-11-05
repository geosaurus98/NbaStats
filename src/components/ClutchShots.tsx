// Insights → Clutch shots: every shot in the last minute that would tie the
// game or put the shooter's team ahead, who takes them and who makes them.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { seasonSnapshot, snapshotGameMap, type SeasonType } from '../api/espn';
import { LAST, S, shooterTable } from '../lib/clutchShots';
import { formatShortDate } from '../lib/dates';
import { Empty } from './Status';
import { TeamLogo } from './TeamLogo';

const pct = (m: number, a: number) => (a ? `${Math.round((m / a) * 100)}%` : '–');
const clock = (left: number) => (left >= 10 ? `0:${String(Math.floor(left)).padStart(2, '0')}` : `${left.toFixed(1)}s`);

export function ClutchShots({ season, type }: { season: number; type: SeasonType }) {
  const snap = seasonSnapshot(season);
  const shots = snap?.clutchShots?.[String(type)];
  const [view, setView] = useState<'players' | 'teams' | 'log'>('players');
  const games = useMemo(() => snapshotGameMap(season, type), [season, type]);
  const players = useMemo(() => (shots ? shooterTable(shots) : []), [shots]);
  if (!snap || !shots) return <Empty>The clutch shot log is collected by the daily data job from each game’s play-by-play; this season doesn’t have it yet.</Empty>;
  if (!shots.length) return <Empty>No last-minute tying or go-ahead shots yet.</Empty>;
  const teams = new Map(snap.teams.map((t) => [t.id, t]));
  const names = snap.players ?? {};
  const made = shots.filter((s) => s[S.made]).length;
  const threes = shots.filter((s) => s[S.value] === 3);
  const winners = shots.filter((s) => s[S.made] && s[S.won] && s[S.left] <= 5).length;
  const teamRows = [...new Set(shots.map((s) => s[S.team]))]
    .map((id) => {
      const mine = shots.filter((s) => s[S.team] === id);
      const m = mine.filter((s) => s[S.made]);
      return { id, attempts: mine.length, made: m.length, won: m.filter((s) => s[S.won]).length };
    })
    .sort((a, b) => b.made - a.made || a.attempts - b.attempts);
  const log = [...shots].sort((a, b) => (games.get(b[S.game])?.date ?? '').localeCompare(games.get(a[S.game])?.date ?? '') || a[S.left] - b[S.left]).slice(0, 40);
  const team = (id: string) => {
    const t = teams.get(id);
    return t ? <Link to={`/team/${t.id}`} className="team-cell"><TeamLogo team={t} size={18} />{t.abbr}</Link> : id;
  };
  return (
    <>
      <p className="muted">Every shot in the last {LAST} seconds of the fourth quarter or overtime that would tie the game or put the shooter’s team ahead. Free throws aren’t included.</p>
      <div className="stat-tiles">
        <div className="tile"><div className="tile-value">{made} of {shots.length}</div><div className="tile-label">Made ({pct(made, shots.length)})</div></div>
        <div className="tile"><div className="tile-value">{pct(threes.filter((s) => s[S.made]).length, threes.length)}</div><div className="tile-label">On threes ({threes.length} tried)</div></div>
        <div className="tile"><div className="tile-value">{winners}</div><div className="tile-label">Made in the last 5 seconds, by a team that went on to win</div></div>
      </div>
      <div className="chips" role="group" aria-label="View">
        {(['players', 'teams', 'log'] as const).map((v) => (
          <button key={v} className={`chip${view === v ? ' active' : ''}`} aria-pressed={view === v} onClick={() => setView(v)}>{v === 'players' ? 'Shooters' : v === 'teams' ? 'Teams' : 'Every shot'}</button>
        ))}
      </div>
      {view === 'players' && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="left">Player</th>
                <th>Made</th>
                <th>Tried</th>
                <th>%</th>
                <th title="Made shots that tied the game">To tie</th>
                <th title="Made shots that put the team ahead">To lead</th>
                <th title="Games won after a made clutch shot">Won</th>
              </tr>
            </thead>
            <tbody>
              {players.filter((r) => r.attempts >= 2).slice(0, 30).map((r) => (
                <tr key={r.playerId}>
                  <td className="left nowrap"><Link to={`/player/${r.playerId}`}>{names[r.playerId] ?? r.playerId}</Link> <span className="muted small">{teams.get(r.teamId)?.abbr}</span></td>
                  <td><b>{r.made}</b></td>
                  <td>{r.attempts}</td>
                  <td>{pct(r.made, r.attempts)}</td>
                  <td>{r.ties}</td>
                  <td>{r.leads}</td>
                  <td>{r.wonAfter}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {view === 'teams' && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="left">Team</th>
                <th>Made</th>
                <th>Tried</th>
                <th>%</th>
                <th title="Games won after a made clutch shot">Won after a make</th>
              </tr>
            </thead>
            <tbody>
              {teamRows.map((r) => (
                <tr key={r.id}>
                  <td className="left">{team(r.id)}</td>
                  <td><b>{r.made}</b></td>
                  <td>{r.attempts}</td>
                  <td>{pct(r.made, r.attempts)}</td>
                  <td>{r.won}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {view === 'log' && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="left">Date</th>
                <th className="left">Shooter</th>
                <th className="left">Situation</th>
                <th>Left</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {log.map((s, i) => {
                const g = games.get(s[S.game]);
                const t = teams.get(s[S.team]);
                const opp = g && (g.home.team.id === s[S.team] ? g.away.team : g.home.team);
                const sit = s[S.deficit] === 0 ? `tied, ${s[S.value]} to lead` : `down ${s[S.deficit]}, a ${s[S.value]} to ${s[S.value] === s[S.deficit] ? 'tie' : 'lead'}`;
                return (
                  <tr key={`${s[S.game]}-${i}`}>
                    <td className="left muted small nowrap"><Link to={`/game/${s[S.game]}`}>{g ? formatShortDate(g.date) : s[S.game]}</Link></td>
                    <td className="left nowrap"><Link to={`/player/${s[S.player]}`}>{names[s[S.player]] ?? s[S.player]}</Link> <span className="muted small">{t?.abbr}{opp ? ` v ${opp.abbr}` : ''}</span></td>
                    <td className="left small">{sit}{s[S.period] > 4 ? ' (OT)' : ''}</td>
                    <td>{clock(s[S.left])}</td>
                    <td className={s[S.made] ? 'win' : 'loss'}>{s[S.made] ? 'Made' : 'Missed'}{s[S.made] ? (s[S.won] ? ', won' : ', lost') : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
