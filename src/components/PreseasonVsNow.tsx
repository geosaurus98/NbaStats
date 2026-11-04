// Projections → Preseason vs now: each team's projected wins and title odds on
// opening night (from its rating going into the season, before any games)
// against the projection today, to see who is beating or missing expectations.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { oddsPct } from '../lib/format';
import { seededRandom } from '../lib/games';
import { isFinal } from '../lib/league';
import { simulate } from '../lib/projections';
import type { Model } from '../pages/Projections';
import { TeamLogo } from './TeamLogo';

const SIMS = 1000;

export function PreseasonVsNow({ model, season }: { model: Model; season: number }) {
  const [sort, setSort] = useState<'diff' | 'now' | 'pre'>('diff');
  const pre = useMemo(() => {
    const first = Math.min(...model.games.map((g) => Date.parse(g.date)));
    return simulate(model.games, model.conferences, model.start, SIMS, seededRandom(season + 1), first - 1);
  }, [model, season]);
  const played = model.games.filter(isFinal).length;
  const rows = model.teams
    .map((t) => {
      const p = pre.get(t.id);
      const n = model.odds.get(t.id);
      const rec = model.standings.flatMap((c) => c.rows).find((r) => r.team.id === t.id);
      return p && n ? { team: t, pre: p, now: n, diff: n.avgWins - p.avgWins, w: rec?.wins ?? 0, l: rec?.losses ?? 0 } : undefined;
    })
    .filter((r) => !!r)
    .sort((a, b) => (sort === 'diff' ? b.diff - a.diff : sort === 'now' ? b.now.avgWins - a.now.avgWins : b.pre.avgWins - a.pre.avgWins));
  const head = (key: typeof sort, label: string) => (
    <th className={`sortable${sort === key ? ' sorted' : ''}`} aria-sort={sort === key ? 'descending' : 'none'}>
      <button className="link" onClick={() => setSort(key)}>{label}</button>
    </th>
  );
  const risers = [...rows].sort((a, b) => b.diff - a.diff);
  return (
    <>
      <p className="muted">
        Opening night: each team's rating going into the season (last season's Elo, pulled a quarter of the way back to average) with the whole schedule
        still to play. Now: today's ratings and results{played ? `, ${played.toLocaleString()} games in` : ''}. Both are {SIMS.toLocaleString()}-season simulations.
      </p>
      {played > 0 && (
        <div className="two-col">
          {[['Beating expectations', risers.slice(0, 5)], ['Falling short', risers.slice(-5).reverse()]].map(([title, list]) => (
            <div key={title as string} className="card">
              <h3>{title as string}</h3>
              <ul className="recap-list">
                {(list as typeof rows).map((r) => (
                  <li key={r.team.id}>
                    <Link to={`/team/${r.team.id}`} className="team-cell"><TeamLogo team={r.team} size={18} />{r.team.abbr}</Link>{' '}
                    <b className={r.diff >= 0 ? 'win' : 'loss'}>{r.diff >= 0 ? '+' : ''}{r.diff.toFixed(1)} wins</b>{' '}
                    <span className="muted small">{r.pre.avgWins.toFixed(1)} → {r.now.avgWins.toFixed(1)} projected · {r.w}-{r.l}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="left">Team</th>
              <th>W-L</th>
              {head('pre', 'Opening-night wins')}
              {head('now', 'Projected now')}
              {head('diff', 'Change')}
              <th>Title then</th>
              <th>Title now</th>
              <th>Playoffs then</th>
              <th>Playoffs now</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.team.id}>
                <td className="left"><Link to={`/team/${r.team.id}`} className="team-cell"><TeamLogo team={r.team} size={18} />{r.team.abbr}</Link></td>
                <td>{r.w}-{r.l}</td>
                <td>{r.pre.avgWins.toFixed(1)}</td>
                <td>{r.now.avgWins.toFixed(1)}</td>
                <td className={r.diff >= 0.5 ? 'win' : r.diff <= -0.5 ? 'loss' : 'muted'}>{r.diff >= 0 ? '+' : ''}{r.diff.toFixed(1)}</td>
                <td className="muted">{oddsPct(r.pre.champion)}</td>
                <td>{oddsPct(r.now.champion)}</td>
                <td className="muted">{oddsPct(r.pre.playoffs)}</td>
                <td>{oddsPct(r.now.playoffs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">Ratings only carry over the team, not the summer's trades and signings, so a team that changed a lot will look like it is beating or missing a projection that never knew about the moves.</p>
    </>
  );
}
