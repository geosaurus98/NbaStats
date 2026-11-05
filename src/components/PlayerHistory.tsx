// Player page → Game log: their record against each opponent, and games missed
// by season. Salaries page: the contract-year watch.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadSnapshot, seasonSnapshot } from '../api/espn';
import { linesYears, loadLines } from '../api/linesStore';
import { useAsync } from '../hooks/useAsync';
import type { SeasonLines } from '../lib/boxTotals';
import { formatShortDate } from '../lib/dates';
import { availability, contractYears, vsTeams } from '../lib/playerHistory';
import { Empty, Loading } from './Status';
import { TeamLogo } from './TeamLogo';

type TeamLite = { id: string; abbr: string; name: string; shortName: string; logo?: string };

/** Teams by id, from every bundled season (ids are stable across seasons). */
function allTeams(): Map<string, TeamLite> {
  const out = new Map<string, TeamLite>();
  for (const y of linesYears()) for (const t of seasonSnapshot(y)?.teams ?? []) if (!out.has(t.id)) out.set(t.id, t);
  return out;
}

const useAllLines = () =>
  useAsync(async () => {
    const years = linesYears();
    await Promise.all(years.map((y) => loadSnapshot(y).catch(() => undefined)));
    return (await Promise.all(years.map((y) => loadLines(y)))).filter((l): l is SeasonLines => !!l);
  }, []);

const seasonName = (y: number) => `${y - 1}-${String(y).slice(2)}`;

export function VsTeamsCard({ playerId }: { playerId: string }) {
  const lines = useAllLines();
  const [sort, setSort] = useState<'games' | 'pts'>('pts');
  const rows = useMemo(() => (lines.data ? vsTeams(lines.data, playerId) : []), [lines.data, playerId]);
  if (lines.loading) return <Loading />;
  if (rows.length < 3) return null;
  const teams = allTeams();
  const years = (lines.data ?? []).map((l) => l.year);
  const sorted = [...rows].sort((a, b) => (sort === 'pts' ? b.pts / b.games - a.pts / a.games : b.games - a.games));
  const head = (key: typeof sort, label: string) => (
    <th className={`sortable${sort === key ? ' sorted' : ''}`} aria-sort={sort === key ? 'descending' : 'none'}>
      <button className="link" onClick={() => setSort(key)}>{label}</button>
    </th>
  );
  return (
    <div className="card">
      <h3>Against each team</h3>
      <p className="muted small">Every game since {seasonName(Math.min(...years))}, regular season and playoffs.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="left">Opponent</th>
              {head('games', 'G')}
              <th>W-L</th>
              {head('pts', 'PTS')}
              <th>REB</th>
              <th>AST</th>
              <th className="hide-sm">TS%</th>
              <th className="left hide-sm">Best game</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const t = teams.get(r.teamId);
              return (
                <tr key={r.teamId}>
                  <td className="left">{t ? <Link to={`/team/${t.id}`} className="team-cell"><TeamLogo team={t} size={18} />{t.abbr}</Link> : r.teamId}</td>
                  <td>{r.games}</td>
                  <td>{r.wins}-{r.games - r.wins}</td>
                  <td>{(r.pts / r.games).toFixed(1)}</td>
                  <td>{(r.reb / r.games).toFixed(1)}</td>
                  <td>{(r.ast / r.games).toFixed(1)}</td>
                  <td className="hide-sm">{(r.ts * 100).toFixed(1)}</td>
                  <td className="left hide-sm small"><Link to={`/game/${r.best.gameId}`}>{r.best.pts} pts</Link> <span className="muted">{formatShortDate(r.best.date)} {r.best.date.slice(0, 4)}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function InjuryHistoryCard({ playerId }: { playerId: string }) {
  const lines = useAllLines();
  const rows = useMemo(
    () =>
      (lines.data ?? []).flatMap((l) => {
        const cupFinal = new Set((seasonSnapshot(l.year)?.games['2'] ?? []).filter((g) => /cup championship/i.test(g[6] ?? '')).map((g) => g[0]));
        return availability(l, playerId, cupFinal);
      }),
    [lines.data, playerId],
  );
  if (lines.loading || !rows.length) return null;
  const teams = allTeams();
  const total = rows.reduce((a, r) => a + r.missed, 0);
  return (
    <div className="card">
      <h3>Games missed</h3>
      <p className="muted small">
        Regular-season team games without minutes, from their first game for a team to the end of that season (or a trade): injuries, rest and coach’s decisions all count.
        {total ? ` ${total} missed in all.` : ' Hasn’t missed a game.'}
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="left">Season</th>
              <th className="left">Team</th>
              <th>Played</th>
              <th>Missed</th>
              <th className="left">Longest absence</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const t = teams.get(r.teamId);
              return (
                <tr key={`${r.season}-${r.teamId}`}>
                  <td className="left nowrap">{seasonName(r.season)}</td>
                  <td className="left">{t?.abbr ?? r.teamId}</td>
                  <td>{r.played} <span className="muted small">of {r.teamGames}</span></td>
                  <td className={r.missed ? 'loss' : undefined}>{r.missed}</td>
                  <td className="left small">{r.longest ? `${r.longest.games} game${r.longest.games === 1 ? '' : 's'} (${formatShortDate(r.longest.from)}${r.longest.games > 1 ? ` – ${formatShortDate(r.longest.to)}` : ''})` : '–'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const money = (v: number) => `$${(v / 1e6).toFixed(1)}M`;
const NEXT_LABEL: Record<string, string> = { 'free agent': 'Free agent', 'player option': 'Player option', 'team option': 'Team option', 'non-guaranteed': 'Non-guaranteed', 'early termination': 'Early termination' };

export function ContractYearWatch({ season }: { season: number }) {
  const snap = seasonSnapshot(season);
  const prev = useAsync(() => loadSnapshot(season - 1).catch(() => undefined), [season]);
  const [filter, setFilter] = useState<'all' | 'free agent' | 'options'>('all');
  const rows = useMemo(() => (snap?.payroll && snap.box?.['2'] ? contractYears(snap.payroll, snap.box['2'].players, prev.data?.box?.['2']?.players) : []), [snap, prev.data]);
  if (!snap?.payroll) return null;
  if (prev.loading) return <Loading />;
  const teams = new Map(snap.teams.map((t) => [t.id, t]));
  const shown = rows.filter((r) => r.now && r.now.g >= 3 && r.now.mpg >= 15).filter((r) => filter === 'all' || (filter === 'free agent' ? r.next === 'free agent' : r.next !== 'free agent'));
  const change = (r: (typeof rows)[number]) => (r.now && r.before ? r.now.gmsc - r.before.gmsc : undefined);
  const sorted = [...shown].sort((a, b) => (change(b) ?? -99) - (change(a) ?? -99));
  return (
    <>
      <h2 id="contract-year">Contract-year watch</h2>
      <p className="muted">Rotation players whose deals end after this season, or whose next season is an option, and how they’re playing against last season (Game Score per game, a one-number box-score rating).</p>
      <div className="chips" role="group" aria-label="Contract status">
        {(['all', 'free agent', 'options'] as const).map((f) => (
          <button key={f} className={`chip${filter === f ? ' active' : ''}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f === 'all' ? 'All' : f === 'free agent' ? 'Free agents to be' : 'Options'}</button>
        ))}
      </div>
      {sorted.length === 0 ? (
        <Empty>No one matches yet.</Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="left">Player</th>
                <th className="left">Team</th>
                <th>Salary</th>
                <th className="left">Next season</th>
                <th>PTS</th>
                <th className="hide-sm">MIN</th>
                <th title="Game Score per game: last season → this season">Game Score</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const t = teams.get(r.teamId);
                const c = change(r);
                return (
                  <tr key={r.espn}>
                    <td className="left nowrap"><Link to={`/player/${r.espn}`}>{r.name}</Link></td>
                    <td className="left">{t?.abbr}</td>
                    <td>{money(r.salary)}</td>
                    <td className="left small">{NEXT_LABEL[r.next]}</td>
                    <td>{r.now!.ppg.toFixed(1)}</td>
                    <td className="hide-sm">{r.now!.mpg.toFixed(1)}</td>
                    <td className="nowrap">{r.before ? <span className="muted small">{r.before.gmsc.toFixed(1)} → </span> : null}{r.now!.gmsc.toFixed(1)}</td>
                    <td className={c === undefined ? 'muted' : c > 0 ? 'win' : 'loss'}>{c === undefined ? 'new' : `${c > 0 ? '+' : c < 0 ? '−' : ''}${Math.abs(c).toFixed(1)}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small">Contracts from Basketball-Reference. “Options” covers player and team options, non-guaranteed years and early-termination clauses.</p>
    </>
  );
}
