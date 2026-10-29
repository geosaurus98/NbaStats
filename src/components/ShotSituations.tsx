// Insights → Shot situations: shooting by time into the possession (ESPN has
// no shot clock, so it's time since the ball changed hands), second chances,
// shots out of timeouts, and the score at the time.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { seasonSnapshot, snapshotPlayers, type SeasonType } from '../api/espn';
import { situationEfg, SITUATIONS, type SituationId } from '../lib/situations';
import { Empty } from './Status';

const pct1 = (v: number) => `${(v * 100).toFixed(1)}%`;

export function ShotSituations({ season, type }: { season: number; type: SeasonType }) {
  const snap = seasonSnapshot(season);
  const names = snapshotPlayers(season);
  const [pick, setPick] = useState<SituationId>('late');
  const [hover, setHover] = useState<SituationId | null>(null);
  const data = snap?.situations?.[String(type)];
  const abbr = useMemo(() => new Map((snap?.teams ?? []).map((t) => [t.id, t.abbr])), [snap]);
  const teamOf = useMemo(() => new Map((snap?.box?.['2']?.players ?? []).map((r) => [r[0], r[1]])), [snap]);
  if (!data) return <Empty>Shot situations start with the next daily data update.</Empty>;
  const league = SITUATIONS.map((s) => ({ ...s, ...situationEfg(data.league, s.id) }));
  if (league[0].att < 100) return <Empty>Too early in the season for shot situations.</Empty>;
  const max = Math.max(...league.map((l) => l.efg));
  const lg = league.find((l) => l.id === pick)!;
  const minAtt = Math.max(15, Math.round(Math.max(...Object.values(data.players).map((c) => situationEfg(c, pick).att)) * 0.25));
  const players = Object.entries(data.players)
    .map(([id, c]) => ({ id, ...situationEfg(c, pick), all: SITUATIONS.filter((s) => s.group === 'clock').reduce((n, s) => n + situationEfg(c, s.id).att, 0) }))
    .filter((p) => p.att >= minAtt)
    .sort((a, b) => b.efg - a.efg);
  const teams = Object.entries(data.teams)
    .map(([id, c]) => ({ id, ...situationEfg(c, pick) }))
    .sort((a, b) => b.efg - a.efg);
  const show = [...players.slice(0, 15), ...players.slice(-5).filter((p) => !players.slice(0, 15).includes(p))];
  return (
    <>
      <p className="muted">
        ESPN's play-by-play has no shot clock, so possessions are timed from when the ball changed hands (a defensive rebound, a turnover, the other team scoring or a new quarter). Second chances are shots after an offensive rebound. eFG% counts threes as 1.5 makes.
      </p>
      <div className="card">
        <h3>League eFG% by situation</h3>
        <div className="sit-bars">
          {league.map((l) => (
            <button key={l.id} className={`sit-row${l.id === pick ? ' active' : ''}${hover && hover !== l.id ? ' dim' : ''}`} onClick={() => setPick(l.id)} onMouseEnter={() => setHover(l.id)} onMouseLeave={() => setHover(null)}>
              <span className="sit-label">{l.label}</span>
              <span className="sit-track"><span className="sit-fill" style={{ width: `${(l.efg / max) * 100}%` }} /></span>
              <b>{pct1(l.efg)}</b>
              <span className="muted small">{l.att.toLocaleString()} shots · {Math.round(l.threeShare * 100)}% threes</span>
            </button>
          ))}
        </div>
        <p className="muted small">Click a situation to rank players and teams by it.</p>
      </div>
      <div className="two-col">
        <div className="table-wrap">
          <h3 className="table-title">Players: {lg.label.toLowerCase()} (league {pct1(lg.efg)})</h3>
          <table>
            <thead>
              <tr>
                <th className="left">Player</th>
                <th>Shots</th>
                <th title="Share of their shots in this situation">Share</th>
                <th>eFG%</th>
                <th title="Against the league in this situation">vs lg</th>
              </tr>
            </thead>
            <tbody>
              {show.map((p) => (
                <tr key={p.id}>
                  <td className="left nowrap"><Link to={`/player/${p.id}`}>{names[p.id] ?? p.id}</Link> <span className="muted small">{abbr.get(teamOf.get(p.id) ?? '')}</span></td>
                  <td>{p.att}</td>
                  <td className="muted">{p.all ? `${Math.round((p.att / p.all) * 100)}%` : '–'}</td>
                  <td><b>{pct1(p.efg)}</b></td>
                  <td className={p.efg >= lg.efg ? 'win' : 'loss'}>{p.efg >= lg.efg ? '+' : ''}{((p.efg - lg.efg) * 100).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">Players with {minAtt}+ such shots; the best 15 and worst 5.</p>
        </div>
        <div className="table-wrap">
          <h3 className="table-title">Teams</h3>
          <table>
            <thead>
              <tr>
                <th className="left">Team</th>
                <th>Shots</th>
                <th>eFG%</th>
                <th title="Share of those shots that were threes">3PA share</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.id}>
                  <td className="left"><Link to={`/team/${t.id}`}>{abbr.get(t.id) ?? t.id}</Link></td>
                  <td>{t.att}</td>
                  <td className={t.efg >= lg.efg ? 'win' : 'loss'}>{pct1(t.efg)}</td>
                  <td className="muted">{Math.round(t.threeShare * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
