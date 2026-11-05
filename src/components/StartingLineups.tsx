// Starting lineups through the season: on the team page, every change to the
// starting five and how the team did with each; in Rankings, how settled each
// team's starting five has been.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { seasonSnapshot } from '../api/espn';
import { loadLines } from '../api/linesStore';
import { useAsync } from '../hooks/useAsync';
import type { SeasonLines } from '../lib/boxTotals';
import { formatShortDate } from '../lib/dates';
import { fives, starterGames, stretches } from '../lib/starters';
import { Empty, Loading } from './Status';
import { TeamLogo } from './TeamLogo';

const sgn = (v: number) => { const r = Math.round(v * 10) / 10; return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r).toFixed(1)}`; };
/** Up to four most-used fives get a colour in the strip; the rest are grey. */
const COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-7)'];

/** Short names for a team's starters: surnames, or full names where two of them share one. */
function useNames(lines: SeasonLines | undefined, season: number) {
  const names = seasonSnapshot(season)?.players ?? {};
  const full = (p: number) => (lines ? names[lines.ids[p]] ?? lines.ids[p] : String(p));
  const surname = (p: number) => full(p).split(' ').slice(1).join(' ') || full(p);
  return (pool: number[]) => {
    const count = new Map<string, number>();
    for (const p of new Set(pool)) count.set(surname(p), (count.get(surname(p)) ?? 0) + 1);
    return (p: number) => ((count.get(surname(p)) ?? 0) > 1 ? full(p) : surname(p));
  };
}

export function StartingLineups({ teamId, season }: { teamId: string; season: number }) {
  const lines = useAsync(() => loadLines(season), [season]);
  const namer = useNames(lines.data, season);
  const data = useMemo(() => {
    if (!lines.data) return undefined;
    const games = starterGames(lines.data, teamId);
    return { games, stretches: stretches(games), fives: fives(games) };
  }, [lines.data, teamId]);
  if (lines.loading) return <Loading />;
  if (!data || !data.games.length) return null;
  const name = namer(data.games.flatMap((g) => g.five));
  const top = data.fives.slice(0, 4);
  const colorOf = (five: number[]) => COLORS[top.findIndex((f) => f.five.join() === five.join())] ?? 'var(--neutral)';
  const changes = data.stretches.slice(1).reverse().slice(0, 12);
  return (
    <div className="card">
      <h3>Starting lineups</h3>
      <p className="muted small">{data.fives.length} different starting five{data.fives.length === 1 ? '' : 's'} in {data.games.length} games. Each square is a game, coloured by who started.</p>
      <div className="starter-strip" role="group" aria-label={`Starting five in each of ${data.games.length} games`}>
        {data.games.map((g) => (
          <Link key={g.gameId} to={`/game/${g.gameId}`} className="starter-cell" style={{ background: colorOf(g.five) }} title={`${formatShortDate(g.date)}: ${g.five.map(name).join(', ')} (${g.margin > 0 ? 'W' : 'L'} ${sgn(g.margin)})`} aria-label={`${formatShortDate(g.date)}, ${g.margin > 0 ? 'won' : 'lost'} by ${Math.abs(g.margin)}`} />
        ))}
      </div>
      <div className="two-col">
        <div className="table-wrap">
          <h4 className="table-title">Most-used starting fives</h4>
          <table>
            <thead>
              <tr>
                <th className="left">Five</th>
                <th>G</th>
                <th>W-L</th>
                <th title="Average margin per game">Net</th>
              </tr>
            </thead>
            <tbody>
              {data.fives.slice(0, 6).map((f, i) => (
                <tr key={f.five.join()}>
                  <td className="left small">{i < COLORS.length && <span className="swatch" style={{ background: COLORS[i] }} aria-hidden />} {f.five.map(name).join(', ')}</td>
                  <td>{f.games}</td>
                  <td>{f.wins}-{f.games - f.wins}</td>
                  <td className={f.net > 0 ? 'win' : f.net < 0 ? 'loss' : undefined}>{sgn(f.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Starting lineup changes">
          <h4 className="table-title">Changes, latest first</h4>
          {changes.length ? (
            <table>
              <thead>
                <tr>
                  <th className="left">From</th>
                  <th className="left">Change</th>
                  <th>G</th>
                  <th title="Record and average margin with that five">W-L · net</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((s) => (
                  <tr key={s.from}>
                    <td className="left muted small nowrap">{formatShortDate(s.from)}</td>
                    <td className="left small">{s.in.map(name).join(', ')} in{s.out.length ? <span className="muted"> for {s.out.map(name).join(', ')}</span> : null}</td>
                    <td>{s.games}</td>
                    <td className="nowrap">{s.wins}-{s.games - s.wins} <span className={s.net > 0 ? 'win' : 'loss'}>{sgn(s.net)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted small">Same five every game so far.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function StarterStability({ season }: { season: number }) {
  const lines = useAsync(() => loadLines(season), [season]);
  const snap = seasonSnapshot(season);
  const namer = useNames(lines.data, season);
  const rows = useMemo(() => {
    if (!lines.data || !snap) return undefined;
    return snap.teams
      .map((t) => {
        const games = starterGames(lines.data!, t.id);
        const f = fives(games);
        const top = f[0];
        const rest = games.filter((g) => top && g.five.join() !== top.five.join());
        const restWins = rest.filter((g) => g.margin > 0).length;
        return { team: t, pool: games.flatMap((g) => g.five), games: games.length, count: f.length, changes: Math.max(0, stretches(games).length - 1), top, rest: rest.length, restWins, restNet: rest.length ? rest.reduce((a, g) => a + g.margin, 0) / rest.length : 0 };
      })
      .filter((r) => r.games > 0)
      .sort((a, b) => a.count - b.count || (b.top?.games ?? 0) - (a.top?.games ?? 0));
  }, [lines.data, snap]);
  if (lines.loading) return <Loading />;
  if (!rows?.length) return <Empty>Needs this season’s box scores.</Empty>;
  return (
    <>
      <p className="muted">How settled each team’s starting five has been: how many different fives have started, how often the lineup changed, and the record with the most-used five against every other five.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="left">Team</th>
              <th title="Different starting fives used">Fives</th>
              <th title="Games where the starting five differed from the game before">Changes</th>
              <th className="left">Most-used five</th>
              <th>G</th>
              <th>W-L · net</th>
              <th title="Record and average margin with any other five">Other fives</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.team.id}>
                <td className="left"><Link to={`/team/${r.team.id}?tab=lineups`} className="team-cell"><TeamLogo team={r.team} size={18} />{r.team.abbr}</Link></td>
                <td>{r.count}</td>
                <td>{r.changes}</td>
                <td className="left small">{r.top?.five.map(namer(r.pool)).join(', ')}</td>
                <td>{r.top?.games}</td>
                <td className="nowrap">{r.top && `${r.top.wins}-${r.top.games - r.top.wins}`} <span className={r.top && r.top.net > 0 ? 'win' : 'loss'}>{r.top && sgn(r.top.net)}</span></td>
                <td className="nowrap muted">{r.rest ? <>{r.restWins}-{r.rest - r.restWins} {sgn(r.restNet)}</> : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">Regular season. Open a team for every change to its starting five, game by game.</p>
    </>
  );
}
