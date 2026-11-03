// Draft hub → Lottery & order: the lottery order from the standings (or
// projected final records), each team's odds for every pick and a button that
// runs a lottery. Drafts up to 2026 use the 14-team lottery; 2027 on use the
// new 3-2-1 lottery (16 teams, 37 balls, every lottery pick drawn).
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchLeagueGames } from '../api/espn';
import type { TeamRef } from '../api/types';
import { useAsync } from '../hooks/useAsync';
import { isFinal, teamRecords } from '../lib/league';
import { lotteryField, lotteryFormat, lotteryOdds, runLottery } from '../lib/lottery';
import type { Model } from '../pages/Projections';
import { TeamLogo } from './TeamLogo';
import { ordinal } from '../lib/format';

interface Entry {
  team: TeamRef;
  w: number;
  l: number;
  /** Sort key: win % (current) or projected wins. */
  key: number;
  label: string;
}

const pct = (v: number) => (v === 0 ? '' : v >= 0.995 ? '>99' : v < 0.005 ? '<1' : String(Math.round(v * 100)));

export function DraftLottery({ model, season }: { model: Model; season: number }) {
  const playoffs = useAsync(() => fetchLeagueGames(season, 3).catch(() => undefined), [season]);
  const remaining = model.games.filter((g) => !isFinal(g)).length;
  const [mode, setMode] = useState<'current' | 'projected'>('current');
  const [draw, setDraw] = useState<number[] | undefined>();
  const projected = mode === 'projected' && remaining > 0;

  const format = lotteryFormat(season);
  const { order, slots } = useMemo(() => {
    const records = teamRecords(model.teams, model.games);
    const playoffTeams = new Set((playoffs.data?.games ?? []).flatMap((g) => [g.home.team.id, g.away.team.id]));
    const winPct = (r: (typeof records)[number]) => (r.wins + r.losses ? r.wins / (r.wins + r.losses) : 0.5);
    const entries = new Map<string, Entry>(
      records.map((r) => {
        const o = model.odds.get(r.team.id);
        const e: Entry = projected && o ? { team: r.team, w: r.wins, l: r.losses, key: Math.round(o.avgWins * 10) / 10, label: `${o.avgWins.toFixed(1)} proj. W` } : { team: r.team, w: r.wins, l: r.losses, key: winPct(r), label: `${r.wins}-${r.losses}` };
        return [r.team.id, e];
      }),
    );
    const field = lotteryField(
      [...entries.values()].map((e) => ({ id: e.team.id, conference: model.conferences.get(e.team.id) ?? '', key: e.key })),
      format,
      projected ? undefined : playoffTeams,
    );
    return { slots: field.lottery, order: { lottery: field.lottery.map((s) => entries.get(s.id)!), rest: field.rest.map((id) => entries.get(id)!) } };
  }, [model, playoffs.data, projected, format]);

  const odds = useMemo(() => lotteryOdds(slots, format), [slots, format]);
  const top = format === 'classic' ? 4 : 5;
  const totalWeight = slots.reduce((s, t) => s + t.weight, 0);
  const max = Math.max(...odds.flat());
  const drawn = draw?.length === order.lottery.length ? draw : undefined;

  return (
    <>
      <p className="muted">
        {format === 'classic' ? (
          'The 14 teams that miss the playoffs share 1,000 lottery combinations, worst record first. Four picks are drawn, so the worst team can fall to 5th.'
        ) : (
          <>The new <b>3-2-1 lottery</b> (2027 to 2029 drafts): 16 teams share 37 balls and all 16 lottery picks are drawn. Teams outside the play-in get 3 balls, but the three worst records are relegated to 2 (and can't fall below 12th); the 9th and 10th seeds get 2, and the losers of the 7-v-8 play-in games get 1.</>
        )}
        {remaining > 0 ? ` ${remaining.toLocaleString()} regular-season games still to play.` : ''}
      </p>
      <div className="actions">
        {remaining > 0 && (
          <>
            <button className={mode === 'current' ? 'chip active' : 'chip'} aria-pressed={mode === 'current'} onClick={() => setMode('current')}>Current standings</button>
            <button className={mode === 'projected' ? 'chip active' : 'chip'} aria-pressed={mode === 'projected'} onClick={() => setMode('projected')}>Projected final records</button>
          </>
        )}
        <button className="chip active" onClick={() => setDraw(runLottery(slots, format, Math.random))}>🎲 Simulate the lottery</button>
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
              <th title={format === 'classic' ? 'Lottery combinations out of 1,000' : 'Lottery balls out of 37'}>{format === 'classic' ? 'Odds #1' : 'Balls'}</th>
              {format === '321' && <th>Odds #1</th>}
              <th>Top {top}</th>
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
                  {format === '321' && <div className="muted small">{slots[i].group}</div>}
                </td>
                {format === 'classic' ? (
                  <td className="sorted">{(slots[i].weight / 10).toFixed(1)}%</td>
                ) : (
                  <>
                    <td>{slots[i].weight}</td>
                    <td className="sorted">{((slots[i].weight / totalWeight) * 100).toFixed(1)}%</td>
                  </>
                )}
                <td>{(odds[i].slice(0, top).reduce((a, b) => a + b, 0) * 100).toFixed(1)}%</td>
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
        <h3>Picks {order.lottery.length + 1}–30</h3>
        <div className="lottery-rest">
          {order.rest.map((e, i) => (
            <span key={e.team.id} className="nowrap">
              <b>{i + order.lottery.length + 1}.</b> <TeamLogo team={e.team} size={16} /> {e.team.abbr} <span className="muted small">{e.label}</span>
            </span>
          ))}
        </div>
      </div>
      <p className="muted small">
        {format === 'classic'
          ? "Percentages are exact, from every possible draw. Tied teams share their combinations equally (the league breaks the tie for the leftover combination by coin flip). "
          : 'Percentages come from 100,000 simulated draws. Seeds come from the standings, and until the play-in is played the 8th seeds are taken to lose the 7-v-8 game. Not modelled: no team can win No. 1 two years running or pick in the top five three drafts in a row, and the league can reduce a tanking team\'s odds. '}
        Traded and protected picks aren't tracked, so this is the order before trades.
        {format === 'classic' && remaining > 0 && mode === 'current' ? ' Until the play-in, the lottery teams are those outside the top eight in each conference.' : ''}
      </p>
    </>
  );
}
