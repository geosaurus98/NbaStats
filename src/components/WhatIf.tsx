// Projections → What if: pick winners for the coming games and watch the
// standings, seeding and lottery places change.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Game } from '../api/types';
import { formatDay, toISODate } from '../lib/dates';
import { isFinal } from '../lib/league';
import { winProb } from '../lib/projections';
import { whatIfStandings, type Picks } from '../lib/whatIf';
import type { Model } from '../pages/Projections';
import { Empty } from './Status';
import { TeamLogo } from './TeamLogo';

const RANGES = [7, 14, 30];

function load(key: string): Picks {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '{}') as Picks;
  } catch {
    return {};
  }
}

export function WhatIf({ model, season }: { model: Model; season: number }) {
  const key = `nba-hub-whatif-${season}`;
  const [picks, setPicks] = useState<Picks>(() => load(key));
  const [days, setDays] = useState(7);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(picks));
    } catch {
      /* storage unavailable */
    }
  }, [key, picks]);

  const upcoming = useMemo(() => {
    const until = Date.now() + days * 864e5;
    return model.games.filter((g) => !isFinal(g) && new Date(g.date).getTime() <= until).sort((a, b) => a.date.localeCompare(b.date));
  }, [model.games, days]);
  const before = useMemo(() => whatIfStandings(model.teams, model.games, {}, model.conferences), [model]);
  const after = useMemo(() => whatIfStandings(model.teams, model.games, picks, model.conferences), [model, picks]);
  const prob = (g: Game) => winProb(model.elo.ratings.get(g.home.team.id) ?? 1505, model.elo.ratings.get(g.away.team.id) ?? 1505);
  const picked = upcoming.filter((g) => picks[g.id]).length;

  if (!upcoming.length && !Object.keys(picks).length) return <Empty>No games left to pick this regular season.</Empty>;
  const pick = (g: Game, teamId: string) => setPicks((p) => (p[g.id] === teamId ? Object.fromEntries(Object.entries(p).filter(([k]) => k !== g.id)) : { ...p, [g.id]: teamId }));
  const byDay = new Map<string, Game[]>();
  for (const g of upcoming) {
    const d = toISODate(new Date(g.date));
    byDay.set(d, [...(byDay.get(d) ?? []), g]);
  }

  return (
    <>
      <p className="muted">Tap the team you think wins each game. The standings below update with your picks (unpicked games are left out). Your picks are saved on this device.</p>
      <div className="actions">
        {RANGES.map((d) => (
          <button key={d} className={d === days ? 'chip active' : 'chip'} onClick={() => setDays(d)}>Next {d} days</button>
        ))}
        <button className="chip" onClick={() => setPicks((p) => ({ ...p, ...Object.fromEntries(upcoming.map((g) => [g.id, prob(g) >= 0.5 ? g.home.team.id : g.away.team.id])) }))}>Pick all favourites</button>
        <button className="chip" onClick={() => setPicks({})}>Clear picks</button>
        <span className="muted small">{picked} of {upcoming.length} picked</span>
      </div>
      <div className="whatif">
        <div className="card whatif-games">
          {[...byDay].map(([d, gs]) => (
            <div key={d}>
              <div className="muted small whatif-day">{formatDay(d)}</div>
              {gs.map((g) => {
                const p = prob(g);
                return (
                  <div key={g.id} className="whatif-game">
                    {[g.away, g.home].map((c, k) => {
                      const on = picks[g.id] === c.team.id;
                      const chance = k ? p : 1 - p;
                      return (
                        <button key={c.team.id} className={`whatif-side${on ? ' on' : ''}${picks[g.id] && !on ? ' off' : ''}`} onClick={() => pick(g, c.team.id)} aria-pressed={on} title={`${c.team.name}: model gives ${Math.round(chance * 100)}%`}>
                          <TeamLogo team={c.team} size={18} /> {c.team.abbr} <span className="muted small">{Math.round(chance * 100)}%</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="two-col whatif-tables">
          {[...after].map(([conf, rows]) => {
            const was = new Map((before.get(conf) ?? []).map((s) => [s.record.team.id, s.seed]));
            return (
              <div key={conf} className="table-wrap">
                <h3 className="table-title">{conf}</h3>
                <table>
                  <tbody>
                    {rows.map((s) => {
                      const move = (was.get(s.record.team.id) ?? s.seed) - s.seed;
                      return (
                        <tr key={s.record.team.id} className={`zone-${s.zone}`}>
                          <td>{s.seed}</td>
                          <td className="left nowrap">
                            <Link to={`/team/${s.record.team.id}`} className="team-cell"><TeamLogo team={s.record.team} size={16} /> {s.record.team.abbr}</Link>
                          </td>
                          <td>{s.record.wins}-{s.record.losses}</td>
                          <td className="small">{move > 0 ? <span className="win">▲{move}</span> : move < 0 ? <span className="loss">▼{-move}</span> : ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </div>
      <p className="muted small">1–6 go straight to the playoffs, 7–10 to the play-in, 11–15 into the lottery. Ties are broken by wins then name, not the NBA's full tiebreakers.</p>
    </>
  );
}
