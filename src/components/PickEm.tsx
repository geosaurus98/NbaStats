// Projections → Pick'em: pick the winners of the next games and see how you do
// against the Elo model over the season. Picks are saved in this browser.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatShortDate, formatTime } from '../lib/dates';
import { ELO_MEAN, winProb } from '../lib/projections';
import { openGames, scorePicks, type Picks } from '../lib/pickem';
import type { Model } from '../pages/Projections';
import { TeamLogo } from './TeamLogo';

const pct = ([w, l]: [number, number]) => (w + l ? `${Math.round((w / (w + l)) * 100)}%` : '–');

function load(key: string): Picks {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '{}') as Picks;
  } catch {
    return {};
  }
}

export function PickEm({ model, season }: { model: Model; season: number }) {
  const key = `nba-pickem-${season}`;
  const [picks, setPicks] = useState<Picks>(() => load(key));
  const save = (next: Picks) => {
    setPicks(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Private browsing: picks last until the page closes.
    }
  };
  const predictions = useMemo(() => new Map(model.elo.predictions.map((p) => [p.game.id, p.pHome])), [model]);
  const score = useMemo(() => scorePicks(picks, model.games, predictions), [picks, model.games, predictions]);
  const open = openGames(model.games);
  const chance = (h: string, a: string) => winProb(model.elo.ratings.get(h) ?? ELO_MEAN, model.elo.ratings.get(a) ?? ELO_MEAN);
  const picked = open.filter((g) => picks[g.id]).length;
  const [you, mod] = [score.you, score.model];
  const lead = you[0] - mod[0];
  return (
    <>
      <p className="muted">Pick the winner of each upcoming game. Once games finish, you’re scored against the model’s pre-game favourite on the same games. Picks lock at tip-off and are saved in this browser.</p>
      {you[0] + you[1] > 0 && (
        <div className="stat-tiles">
          <div className="tile">
            <div className="tile-value">{you[0]}-{you[1]}</div>
            <div className="tile-label">You ({pct(you)})</div>
          </div>
          <div className="tile">
            <div className="tile-value">{mod[0]}-{mod[1]}</div>
            <div className="tile-label">The model on the same games ({pct(mod)})</div>
          </div>
          <div className="tile">
            <div className={`tile-value ${lead > 0 ? 'win' : lead < 0 ? 'loss' : ''}`}>{lead > 0 ? `+${lead}` : lead < 0 ? `−${-lead}` : 'Level'}</div>
            <div className="tile-label">{lead > 0 ? 'Ahead of the model' : lead < 0 ? 'Behind the model' : 'With the model'}{score.against[0] ? ` · ${score.against[1]} of ${score.against[0]} right when you went against it` : ''}</div>
          </div>
        </div>
      )}
      <h3>{open.length ? `Next games (${picked} of ${open.length} picked)` : 'No games to pick right now'}</h3>
      {open.length > 0 && (
        <ul className="pick-list">
          {open.map((g) => {
            const p = chance(g.home.team.id, g.away.team.id);
            const mine = picks[g.id];
            return (
              <li key={g.id} className="card pick-row">
                <span className="muted small pick-when">{formatShortDate(g.date)} · {formatTime(g.date)}</span>
                {[
                  [g.away, 1 - p],
                  [g.home, p],
                ].map(([c, chanceOf], k) => {
                  const side = c as (typeof g)['home'];
                  const on = mine === side.team.id;
                  return (
                    <button key={side.team.id} className={`chip pick-team${on ? ' active' : ''}`} aria-pressed={on} onClick={() => save({ ...picks, [g.id]: side.team.id })}>
                      <TeamLogo team={side.team} size={18} /> {k === 1 ? '@ ' : ''}{side.team.abbr}
                      <span className="small pick-chance">{Math.round((chanceOf as number) * 100)}%</span>
                    </button>
                  );
                })}
              </li>
            );
          })}
        </ul>
      )}
      {open.length > 0 && <p className="muted small">Percentages are the model’s chance for each side right now. <button className="link" onClick={() => save({ ...picks, ...Object.fromEntries(open.map((g) => [g.id, chance(g.home.team.id, g.away.team.id) >= 0.5 ? g.home.team.id : g.away.team.id])) })}>Fill in the model’s favourites</button></p>}
      {score.results.length > 0 && (
        <>
          <h3>Your results</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="left">Date</th>
                  <th className="left">Game</th>
                  <th className="left">Your pick</th>
                  <th className="left">Model’s pick</th>
                  <th>Final</th>
                </tr>
              </thead>
              <tbody>
                {score.results.slice(0, 30).map((r) => {
                  const g = r.game;
                  const abbr = (id: string) => (id === g.home.team.id ? g.home.team.abbr : g.away.team.abbr);
                  const modelPick = r.pHome >= 0.5 ? g.home.team.id : g.away.team.id;
                  return (
                    <tr key={g.id}>
                      <td className="left muted small nowrap">{formatShortDate(g.date)}</td>
                      <td className="left nowrap"><Link to={`/game/${g.id}`}>{g.away.team.abbr} @ {g.home.team.abbr}</Link></td>
                      <td className={`left ${r.youRight ? 'win' : 'loss'}`}>{abbr(r.pick)} {r.youRight ? '✓' : '✗'}</td>
                      <td className={`left ${r.modelRight ? 'win' : 'loss'}`}>{abbr(modelPick)} <span className="muted small">{Math.round(Math.max(r.pHome, 1 - r.pHome) * 100)}%</span> {r.modelRight ? '✓' : '✗'}</td>
                      <td className="nowrap">{g.away.score}-{g.home.score}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
