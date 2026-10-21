// Projections → Draft lottery, Tankathon-style: the lottery order from the
// standings (or projected final records), each team's exact odds for every
// pick, and a button that runs a lottery.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchLeagueGames } from '../api/espn';
import type { TeamRef } from '../api/types';
import { useAsync } from '../hooks/useAsync';
import { isFinal, teamRecords } from '../lib/league';
import { drawLottery, pickOdds, shareTies } from '../lib/lottery';
import type { Model } from '../pages/Projections';
import { TeamLogo } from './TeamLogo';

interface Entry {
  team: TeamRef;
  w: number;
  l: number;
  /** Sort key: win % (current) or projected wins. */
  key: number;
  label: string;
}

const pct = (v: number) => (v === 0 ? '' : v >= 0.995 ? '>99' : v < 0.005 ? '<1' : String(Math.round(v * 100)));
const ordinal = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 >= 11 && n % 100 <= 13 ? 0 : n % 10] ?? 'th'}`;

export function DraftLottery({ model, season }: { model: Model; season: number }) {
  const playoffs = useAsync(() => fetchLeagueGames(season, 3).catch(() => undefined), [season]);
  const remaining = model.games.filter((g) => !isFinal(g)).length;
  const [mode, setMode] = useState<'current' | 'projected'>('current');
  const [draw, setDraw] = useState<number[] | undefined>();
  const projected = mode === 'projected' && remaining > 0;

  const order = useMemo(() => {
    const records = teamRecords(model.teams, model.games);
    const playoffTeams = new Set((playoffs.data?.games ?? []).flatMap((g) => [g.home.team.id, g.away.team.id]));
    const byConf = new Map<string, typeof records>();
    for (const r of records) {
      const c = model.conferences.get(r.team.id) ?? '';
      byConf.set(c, [...(byConf.get(c) ?? []), r]);
    }
    const winPct = (r: (typeof records)[number]) => (r.wins + r.losses ? r.wins / (r.wins + r.losses) : 0.5);
    let inPlayoffs: (id: string) => boolean;
    if (projected) {
      const odds = [...model.odds.values()].sort((a, b) => b.playoffs - a.playoffs);
      const top = new Set(odds.slice(0, 16).map((o) => o.teamId));
      inPlayoffs = (id) => top.has(id);
    } else if (playoffTeams.size >= 16) {
      inPlayoffs = (id) => playoffTeams.has(id);
    } else {
      // Season still going: the top eight in each conference (after the play-in, two of 7-10 miss out, so this is approximate).
      const top = new Set([...byConf.values()].flatMap((rs) => [...rs].sort((a, b) => winPct(b) - winPct(a)).slice(0, 8).map((r) => r.team.id)));
      inPlayoffs = (id) => top.has(id);
    }
    const entries: Entry[] = records.map((r) => {
      const o = model.odds.get(r.team.id);
      return projected && o
        ? { team: r.team, w: r.wins, l: r.losses, key: o.avgWins, label: `${o.avgWins.toFixed(1)} proj. W` }
        : { team: r.team, w: r.wins, l: r.losses, key: winPct(r), label: `${r.wins}-${r.losses}` };
    });
    const asc = (a: Entry, b: Entry) => a.key - b.key || a.team.name.localeCompare(b.team.name);
    const lottery = entries.filter((e) => !inPlayoffs(e.team.id)).sort(asc).slice(0, 14);
    const rest = entries.filter((e) => !lottery.includes(e)).sort(asc);
    return { lottery, rest };
  }, [model, playoffs.data, projected]);

  const keys = order.lottery.map((e) => (projected ? Math.round(e.key * 10) / 10 : e.key));
  const weights = shareTies(keys);
  const odds = useMemo(() => pickOdds(weights), [weights.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const max = Math.max(...odds.flat());
  const drawn = draw?.length === order.lottery.length ? draw : undefined;

  return (
    <>
      <p className="muted">
        The 14 teams that miss the playoffs share 1,000 lottery combinations, worst record first. Four picks are drawn, so the worst team can fall to 5th.
        {remaining > 0 ? ` ${remaining.toLocaleString()} regular-season games still to play.` : ''}
      </p>
      <div className="actions">
        {remaining > 0 && (
          <>
            <button className={mode === 'current' ? 'chip active' : 'chip'} onClick={() => setMode('current')}>Current standings</button>
            <button className={mode === 'projected' ? 'chip active' : 'chip'} onClick={() => setMode('projected')}>Projected final records</button>
          </>
        )}
        <button className="chip active" onClick={() => setDraw(drawLottery(weights, Math.random))}>🎲 Simulate the lottery</button>
        {drawn && <button className="chip" onClick={() => setDraw(undefined)}>Reset</button>}
      </div>

      {drawn && (
        <div className="card lottery-result">
          <h3>Your lottery</h3>
          <ol>
            {drawn.map((t, pick) => {
              const e = order.lottery[t];
              const move = t - pick;
              return (
                <li key={e.team.id}>
                  <TeamLogo team={e.team} size={20} /> <Link to={`/team/${e.team.id}`}>{e.team.name}</Link>{' '}
                  {move > 0 ? <span className="win small">▲ {move}</span> : move < 0 ? <span className="loss small">▼ {-move}</span> : null}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <div className="table-wrap">
        <table className="lottery-table">
          <thead>
            <tr>
              <th>Seed</th>
              <th className="left">Team</th>
              <th title="Lottery combinations out of 1,000">Odds #1</th>
              <th>Top 4</th>
              {odds.map((_, k) => (
                <th key={k} className="lot-pick">{k + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {order.lottery.map((e, i) => (
              <tr key={e.team.id}>
                <td>{i + 1}</td>
                <td className="left nowrap">
                  <Link to={`/team/${e.team.id}`} className="team-cell"><TeamLogo team={e.team} size={18} /> {e.team.abbr}</Link>{' '}
                  <span className="muted small">{e.label}</span>
                </td>
                <td className="sorted">{(weights[i] / 10).toFixed(1)}%</td>
                <td>{(odds[i].slice(0, 4).reduce((a, b) => a + b, 0) * 100).toFixed(1)}%</td>
                {odds[i].map((p, k) => (
                  <td
                    key={k}
                    className="lot-pick"
                    title={`${e.team.abbr}: ${(p * 100).toFixed(1)}% to pick ${ordinal(k + 1)}`}
                    style={p ? { background: `color-mix(in srgb, var(--series-1) ${Math.round((p / max) * 70) + 8}%, transparent)` } : undefined}
                  >
                    {pct(p)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Picks 15–30</h3>
        <div className="lottery-rest">
          {order.rest.map((e, i) => (
            <span key={e.team.id} className="nowrap">
              <b>{i + 15}.</b> <TeamLogo team={e.team} size={16} /> {e.team.abbr} <span className="muted small">{e.label}</span>
            </span>
          ))}
        </div>
      </div>
      <p className="muted small">
        Percentages are exact, from every possible draw. Tied teams share their combinations equally (the league breaks the tie for the leftover
        combination by coin flip). Traded and protected picks aren't tracked, so this is the order before trades.
        {remaining > 0 && mode === 'current' ? ' Until the play-in, the lottery teams are those outside the top eight in each conference.' : ''}
      </p>
    </>
  );
}
