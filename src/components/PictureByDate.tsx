// Standings → On any date: the playoff picture as it stood on any day of the
// season, with a slider, and how each team's seed has moved since.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchLeagueGames } from '../api/espn';
import type { Conference } from '../api/types';
import { useAsync } from '../hooks/useAsync';
import { addDays, formatDay } from '../lib/dates';
import { gameDays, tableBefore } from '../lib/recap';
import { ErrorBox, Loading } from './Status';
import { TeamLogo } from './TeamLogo';

export function PictureByDate({ season, conferences }: { season: number; conferences: Conference[] }) {
  const league = useAsync(() => fetchLeagueGames(season, 2), [season]);
  const conf = useMemo(() => new Map(conferences.flatMap((c) => c.rows.map((r) => [r.team.id, c.name] as [string, string]))), [conferences]);
  const days = useMemo(() => (league.data ? gameDays(league.data.games) : []), [league.data]);
  const [index, setIndex] = useState<number | undefined>();
  if (league.error) return <ErrorBox error={league.error} />;
  if (!league.data) return <Loading />;
  if (!days.length) return <p className="muted">No games yet this season.</p>;
  const i = index ?? days.length - 1;
  const day = days[i];
  const table = tableBefore(league.data.games, conf, addDays(day, 1));
  const latest = tableBefore(league.data.games, conf, addDays(days[days.length - 1], 1));
  const nowRank = new Map([...latest.values()].flat().map((r) => [r.teamId, r.rank]));
  const teams = new Map(league.data.teams.map((t) => [t.id, t]));
  return (
    <>
      <div className="card date-slider">
        <label>
          <span className="small muted">Standings after</span> <b>{formatDay(day)}</b> <span className="small muted">(US date)</span>
          <input type="range" min={0} max={days.length - 1} value={i} onChange={(e) => setIndex(Number(e.target.value))} aria-label="Day of the season" />
        </label>
        <div className="chips tight">
          <button className="chip" onClick={() => setIndex(Math.max(0, i - 7))} disabled={i === 0}>‹ Week</button>
          <button className="chip" onClick={() => setIndex(Math.max(0, i - 1))} disabled={i === 0}>‹ Day</button>
          <button className="chip" onClick={() => setIndex(Math.min(days.length - 1, i + 1))} disabled={i === days.length - 1}>Day ›</button>
          <button className="chip" onClick={() => setIndex(Math.min(days.length - 1, i + 7))} disabled={i === days.length - 1}>Week ›</button>
          <button className="chip" onClick={() => setIndex(undefined)} disabled={index === undefined}>Latest</button>
        </div>
      </div>
      <div className="two-col">
        {[...table].map(([name, rows]) => (
          <div key={name} className="table-wrap">
            <h3 className="table-title">{name}</h3>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th className="left">Team</th>
                  <th>W-L</th>
                  <th title="Seed now compared with this date">Since</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, k) => {
                  const t = teams.get(r.teamId);
                  const move = r.rank - (nowRank.get(r.teamId) ?? r.rank);
                  return (
                    <tr key={r.teamId} className={k === 5 ? 'cut playoff' : k === 9 ? 'cut playin' : undefined}>
                      <td>{r.rank}</td>
                      <td className="left">{t && <Link to={`/team/${r.teamId}`} className="team-cell"><TeamLogo team={t} size={18} />{t.name}</Link>}</td>
                      <td>{r.w}-{r.l}</td>
                      <td className={move > 0 ? 'win small' : move < 0 ? 'loss small' : 'muted small'}>{move > 0 ? `▲ ${move}` : move < 0 ? `▼ ${-move}` : '–'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
      <p className="muted small">Seeds by win %, ties by wins (the league's tiebreakers aren't applied). Line after 6th: guaranteed playoff spots; after 10th: the play-in cut-off. "Since" is how far each team has moved up or down from that date to today.</p>
    </>
  );
}
