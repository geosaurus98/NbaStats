// Insights tabs built from per-game lines, clutch totals, lineup combinations
// and the schedule: player of the night, hot & cold, clutch, duos & trios and
// schedule ahead.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchLeagueGames, seasonSnapshot, type SeasonType } from '../api/espn';
import { loadLines } from '../api/linesStore';
import type { TeamRef } from '../api/types';
import { useAsync } from '../hooks/useAsync';
import { L } from '../lib/boxTotals';
import { C } from '../lib/clutch';
import { formatDay, toISODate } from '../lib/dates';
import { form, nightlyBest, usDay, type NightBest } from '../lib/gameLines';
import { isFinal } from '../lib/league';
import { scheduleAhead, type ScheduleAhead } from '../lib/scheduleAhead';
import { Empty, ErrorBox, Loading } from './Status';
import { TeamLogo } from './TeamLogo';

const sign = (v: number, dp = 1) => `${v > 0 ? '+' : ''}${v.toFixed(dp)}`;

function useSnapshotBits(season: number) {
  const snap = seasonSnapshot(season);
  const teams = new Map((snap?.teams ?? []).map((t) => [t.id, t]));
  const name = (id: string) => snap?.players?.[id] ?? id;
  return { snap, teams, name };
}

function TeamTag({ team }: { team?: TeamRef }) {
  return team ? (
    <Link to={`/team/${team.id}`} className="team-cell muted small">
      <TeamLogo team={team} size={16} /> {team.abbr}
    </Link>
  ) : null;
}

const statLine = (l: number[]) => {
  const parts = [`${l[L.pts]} pts`, `${l[L.oreb] + l[L.dreb]} reb`, `${l[L.ast]} ast`];
  if (l[L.stl] >= 3) parts.push(`${l[L.stl]} stl`);
  if (l[L.blk] >= 3) parts.push(`${l[L.blk]} blk`);
  parts.push(`${l[L.fgm]}/${l[L.fga]} FG`);
  if (l[L.tpm] >= 3) parts.push(`${l[L.tpm]} threes`);
  return parts.join(' · ');
};

// ---------------------------------------------------------------- Player of the night

export function PlayerOfTheNight({ season }: { season: number }) {
  const lines = useAsync(() => loadLines(season), [season]);
  const { teams, name } = useSnapshotBits(season);
  const [shown, setShown] = useState(21);
  const nights = useMemo(() => (lines.data ? nightlyBest(lines.data) : []), [lines.data]);
  const best = useMemo(() => nights.flatMap((n) => n.best).sort((a, b) => b.gmsc - a.gmsc).slice(0, 10), [nights]);

  if (lines.error) return <ErrorBox error={lines.error} />;
  if (lines.loading) return <Loading label="Loading every box score…" />;
  if (!nights.length) return <Empty>No games played yet.</Empty>;
  const row = (b: NightBest, i?: number) => (
    <div key={`${b.gameId}-${b.playerId}`} className="night-row">
      <div>
        {i != null && <span className="muted">{i + 1}. </span>}
        <Link to={`/player/${b.playerId}`}><b>{name(b.playerId)}</b></Link> <TeamTag team={teams.get(b.teamId)} />
        <span className="muted small"> vs {teams.get(b.oppId)?.abbr} · <Link to={`/game/${b.gameId}`}>{b.won ? 'W' : 'L'}</Link></span>
        <div className="small">{statLine(b.line)}</div>
      </div>
      <span className="night-score" title="Game Score">{b.gmsc.toFixed(1)}</span>
    </div>
  );
  return (
    <>
      <p className="muted">Each night's best single game by Game Score, a one-number box-score rating (points, efficiency, rebounds, assists, steals, blocks, minus turnovers and fouls). Regular season.</p>
      <div className="two-col">
        <div className="card">
          <h3>Night by night</h3>
          {nights.slice(0, shown).map((n) => (
            <div key={n.day} className="night">
              <div className="muted small">{formatDay(n.day)}</div>
              {row(n.best[0])}
              {n.best.slice(1).map((b) => (
                <div key={b.playerId} className="night-runner muted small">
                  also: <Link to={`/player/${b.playerId}`}>{name(b.playerId)}</Link> {statLine(b.line)}
                </div>
              ))}
            </div>
          ))}
          {shown < nights.length && <button className="chip" onClick={() => setShown((s) => s + 30)}>Show more nights</button>}
        </div>
        <div className="card">
          <h3>Best games of the season</h3>
          {best.map((b, i) => (
            <div key={`${b.gameId}-${b.playerId}`}>
              {row(b, i)}
              <div className="muted small night-date">{formatDay(b.day)}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Hot & cold

export function HotCold({ season }: { season: number }) {
  const lines = useAsync(() => loadLines(season), [season]);
  const { snap, teams, name } = useSnapshotBits(season);
  const [n, setN] = useState(10);
  const players = useMemo(() => (lines.data ? form(lines.data, n) : []), [lines.data, n]);
  const teamForm = useMemo(() => {
    const games = (snap?.games['2'] ?? []).filter((g) => g[4] != null && !(g[4] === 0 && g[5] === 0) && !/cup championship/i.test(g[6] ?? '')).sort((a, b) => a[1].localeCompare(b[1]));
    const by = new Map<string, { margin: number; won: boolean }[]>();
    for (const g of games) {
      const m = g[4]! - g[5]!;
      by.set(g[2], [...(by.get(g[2]) ?? []), { margin: m, won: m > 0 }]);
      by.set(g[3], [...(by.get(g[3]) ?? []), { margin: -m, won: m < 0 }]);
    }
    return [...by]
      .filter(([, gs]) => gs.length >= 2 * n)
      .map(([id, gs]) => {
        const recent = gs.slice(-n);
        const avg = (xs: typeof gs) => xs.reduce((a, x) => a + x.margin, 0) / xs.length;
        return { id, season: avg(gs), recent: avg(recent), w: recent.filter((x) => x.won).length, all: gs };
      })
      .sort((a, b) => b.recent - b.season - (a.recent - a.season));
  }, [snap, n]);

  if (lines.error) return <ErrorBox error={lines.error} />;
  if (lines.loading) return <Loading label="Loading every box score…" />;
  if (!players.length) return <Empty>Too early in the season: players need {2 * n}+ games.</Empty>;
  const diff = (s: (typeof players)[number]) => s.recent.gmsc - s.season.gmsc;
  const sorted = [...players].sort((a, b) => diff(b) - diff(a));
  const table = (title: string, rows: typeof players) => (
    <div className="table-wrap">
      <h3 className="table-title">{title}</h3>
      <table>
        <thead>
          <tr>
            <th className="left">Player</th>
            <th title="Points per game, season">PTS</th>
            <th title={`Points per game, last ${n}`}>Last {n}</th>
            <th title="Game Score per game: last games minus season">Form</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.playerId}>
              <td className="left nowrap"><Link to={`/player/${s.playerId}`}>{name(s.playerId)}</Link> <TeamTag team={teams.get(s.teamId)} /></td>
              <td>{s.season.pts.toFixed(1)}</td>
              <td>{s.recent.pts.toFixed(1)}</td>
              <td className={diff(s) > 0 ? 'win' : 'loss'}>{sign(diff(s))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  const last = (snap?.games['2'] ?? []).filter((g) => g[4] != null).map((g) => g[1]).sort().pop();
  return (
    <>
      <p className="muted">
        Who's playing above or below their season so far, by Game Score per game over the last {n} games. Regulars only (20+ minutes a game).
        {last ? ` Through ${formatDay(usDay(last))}.` : ''}
      </p>
      <div className="chips tight">
        {[5, 10, 15].map((k) => (
          <button key={k} className={k === n ? 'chip active' : 'chip'} onClick={() => setN(k)}>Last {k}</button>
        ))}
      </div>
      <div className="two-col">
        {table('🔥 Hot', sorted.slice(0, 12))}
        {table('🧊 Cold', sorted.slice(-12).reverse())}
      </div>
      <div className="table-wrap">
        <h3 className="table-title">Teams: last {n} vs season</h3>
        <table>
          <thead>
            <tr>
              <th className="left">Team</th>
              <th>Last {n}</th>
              <th title="Average margin, season">Season margin</th>
              <th title={`Average margin, last ${n}`}>Last {n} margin</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            {teamForm.map((t) => (
              <tr key={t.id}>
                <td className="left nowrap"><TeamTag team={teams.get(t.id)} /> <span className="hide-sm">{teams.get(t.id)?.shortName}</span></td>
                <td>{t.w}-{n - t.w}</td>
                <td>{sign(t.season)}</td>
                <td>{sign(t.recent)}</td>
                <td className={t.recent - t.season > 0 ? 'win' : 'loss'}>{sign(t.recent - t.season)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Clutch

export function Clutch({ season, type }: { season: number; type: SeasonType }) {
  const { snap, teams, name } = useSnapshotBits(season);
  const [sort, setSort] = useState<'pts' | 'fg' | 'ts'>('pts');
  const data = snap?.clutch?.[String(type)];
  if (!data) return <Empty>No clutch data for this season yet: it's built from play-by-play by the daily snapshot.</Empty>;
  const minFga = type === 3 ? 8 : 30;
  const rows = data.players
    .map((r) => {
      const tsa = 2 * (r[C.fga] + 0.44 * r[C.fta]);
      return { r, fg: r[C.fga] ? r[C.fgm] / r[C.fga] : 0, ts: tsa ? r[C.pts] / tsa : 0 };
    })
    .filter((x) => sort === 'pts' || x.r[C.fga] >= minFga)
    .sort((a, b) => (sort === 'pts' ? b.r[C.pts] - a.r[C.pts] : sort === 'fg' ? b.fg - a.fg : b.ts - a.ts))
    .slice(0, 25);
  const teamRows = [...data.teams].sort((a, b) => b[2] / Math.max(1, b[1]) - a[2] / Math.max(1, a[1]));
  const pct = (v: number) => (v * 100).toFixed(1);
  return (
    <>
      <p className="muted">Clutch time is the NBA's definition: the last five minutes of the fourth quarter or overtime with the score within five.</p>
      <div className="chips tight">
        <button className={sort === 'pts' ? 'chip active' : 'chip'} onClick={() => setSort('pts')}>Most clutch points</button>
        <button className={sort === 'fg' ? 'chip active' : 'chip'} onClick={() => setSort('fg')}>Best FG% ({minFga}+ shots)</button>
        <button className={sort === 'ts' ? 'chip active' : 'chip'} onClick={() => setSort('ts')}>Best true shooting ({minFga}+ shots)</button>
      </div>
      <div className="two-col">
        <div className="table-wrap">
          <h3 className="table-title">Players</h3>
          <table>
            <thead>
              <tr>
                <th className="left">Player</th>
                <th title="Games with clutch shots">G</th>
                <th>PTS</th>
                <th>FG</th>
                <th>FG%</th>
                <th className="hide-sm">3P</th>
                <th className="hide-sm">FT</th>
                <th className="hide-sm">TS%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ r, fg, ts }) => (
                <tr key={r[0]}>
                  <td className="left nowrap"><Link to={`/player/${r[0]}`}>{name(r[0])}</Link> <TeamTag team={teams.get(r[1])} /></td>
                  <td>{r[C.games]}</td>
                  <td className={sort === 'pts' ? 'sorted' : undefined}>{r[C.pts]}</td>
                  <td>{r[C.fgm]}/{r[C.fga]}</td>
                  <td className={sort === 'fg' ? 'sorted' : undefined}>{pct(fg)}</td>
                  <td className="hide-sm">{r[C.tpm]}/{r[C.tpa]}</td>
                  <td className="hide-sm">{r[C.ftm]}/{r[C.fta]}</td>
                  <td className={sort === 'ts' ? 'sorted hide-sm' : 'hide-sm'}>{pct(ts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-wrap">
          <h3 className="table-title">Teams in clutch games</h3>
          <table>
            <thead>
              <tr>
                <th className="left">Team</th>
                <th title="Games that reached clutch time">G</th>
                <th>W-L</th>
                <th>Win %</th>
                <th title="Points scored minus allowed in clutch time">Clutch +/-</th>
              </tr>
            </thead>
            <tbody>
              {teamRows.map((t) => (
                <tr key={t[0]}>
                  <td className="left nowrap"><TeamTag team={teams.get(t[0])} /> <span className="hide-sm">{teams.get(t[0])?.shortName}</span></td>
                  <td>{t[1]}</td>
                  <td>{t[2]}-{t[3]}</td>
                  <td className="sorted">{(t[2] / Math.max(1, t[1])).toFixed(3).replace(/^0/, '')}</td>
                  <td>{sign(t[4] - t[5], 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Duos & trios

export function Combos({ season, type }: { season: number; type: SeasonType }) {
  const { snap, teams, name } = useSnapshotBits(season);
  const [size, setSize] = useState<2 | 3>(2);
  const [team, setTeam] = useState('');
  const [worst, setWorst] = useState(false);
  const byTeam = snap?.lineups?.[String(type)];
  const minSec = (type === 3 ? 0.15 : 1) * (size === 2 ? 400 : 250) * 60;
  const rows = useMemo(() => {
    const out: { team: string; ids: string[]; sec: number; net: number }[] = [];
    for (const [tid, t] of Object.entries(byTeam ?? {})) {
      if (team && tid !== team) continue;
      for (const [ids, sec, pf, pa] of (size === 2 ? t.pairs : t.trios) ?? []) {
        if (sec >= minSec) out.push({ team: tid, ids, sec, net: ((pf - pa) / sec) * 2880 });
      }
    }
    return out.sort((a, b) => (worst ? a.net - b.net : b.net - a.net)).slice(0, 25);
  }, [byTeam, size, team, worst, minSec]);
  if (!byTeam) return <Empty>No lineup data for this season.</Empty>;
  const surname = (id: string) => name(id).split(' ').slice(1).join(' ') || name(id);
  return (
    <>
      <p className="muted">The two- and three-man combinations that outscore opponents by the most per 48 minutes together, from every substitution in the play-by-play. At least {Math.round(minSec / 60)} minutes together.</p>
      <div className="actions">
        <button className={size === 2 ? 'chip active' : 'chip'} onClick={() => setSize(2)}>Duos</button>
        <button className={size === 3 ? 'chip active' : 'chip'} onClick={() => setSize(3)}>Trios</button>
        <button className={!worst ? 'chip active' : 'chip'} onClick={() => setWorst(false)}>Best</button>
        <button className={worst ? 'chip active' : 'chip'} onClick={() => setWorst(true)}>Worst</button>
        <select value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Team">
          <option value="">All teams</option>
          {[...teams.values()].sort((a, b) => a.name.localeCompare(b.name)).map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th className="left">Players</th>
              <th className="left">Team</th>
              <th>Minutes</th>
              <th title="Points scored minus allowed per 48 minutes together">+/- per 48</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.team + r.ids.join()}>
                <td>{i + 1}</td>
                <td className="left">
                  {r.ids.map((id, k) => (
                    <span key={id}>
                      {k > 0 && ' + '}
                      <Link to={`/player/${id}`} title={name(id)}>{surname(id)}</Link>
                    </span>
                  ))}
                </td>
                <td className="left"><TeamTag team={teams.get(r.team)} /></td>
                <td>{Math.round(r.sec / 60)}</td>
                <td className={r.net > 0 ? 'win' : 'loss'}>{sign(r.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">Lineups between quarters are inferred, so minutes can be a little off. Each team keeps its 40 most-used duos and trios.</p>
    </>
  );
}

// ---------------------------------------------------------------- Schedule ahead

const SCHEDULE_SORTS: { id: keyof ScheduleAhead; label: string; desc: boolean }[] = [
  { id: 'oppPct', label: 'Toughest opponents', desc: true },
  { id: 'vsWinning', label: 'Most games vs winning teams', desc: true },
  { id: 'backToBacks', label: 'Most back-to-backs', desc: true },
  { id: 'road', label: 'Most road games', desc: true },
  { id: 'longestTrip', label: 'Longest road trip', desc: true },
];

export function ScheduleAheadTab({ season, start, end }: { season: number; start: string; end: string }) {
  const league = useAsync(() => fetchLeagueGames(season, 2), [season]);
  const today = toISODate(new Date());
  const [asOf, setAsOf] = useState(() => (today > start && today < end ? today : ''));
  const [sort, setSort] = useState(SCHEDULE_SORTS[0]);
  if (league.error) return <ErrorBox error={league.error} />;
  if (!league.data) return <Loading />;
  const games = league.data.games;
  const dates = games.map((g) => g.date.slice(0, 10)).sort();
  // Completed seasons default to the halfway point so there's something left to look at.
  const date = asOf || dates[Math.floor(dates.length / 2)] || start;
  const rows = scheduleAhead(league.data.teams, games, `${date}T12:00Z`)
    .filter((r) => r.left > 0)
    .sort((a, b) => ((b[sort.id] as number) - (a[sort.id] as number)) * (sort.desc ? 1 : -1) || b.oppPct - a.oppPct);
  const played = games.filter(isFinal).length;
  return (
    <>
      <p className="muted">
        What's left of every team's regular season from a date: how good the remaining opponents are (by their record on that date), back-to-backs and
        road trips. {played < games.length ? '' : 'This season is over, so pick a date to look ahead from.'}
      </p>
      <div className="actions">
        <label className="small">
          From{' '}
          <input type="date" value={date} min={start} max={end} onChange={(e) => setAsOf(e.target.value)} />
        </label>
        {SCHEDULE_SORTS.map((s) => (
          <button key={s.id} className={s.id === sort.id ? 'chip active' : 'chip'} onClick={() => setSort(s)}>{s.label}</button>
        ))}
      </div>
      {rows.length === 0 ? (
        <Empty>No games left after {formatDay(date)}.</Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th className="left">Team</th>
                <th>Left</th>
                <th title="Average win % of remaining opponents">Opp. win %</th>
                <th title="Remaining games against teams above .500">vs .500+</th>
                <th>Home</th>
                <th>Road</th>
                <th title="Second night of back-to-backs">B2B</th>
                <th title="Most consecutive road games">Longest trip</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.team.id}>
                  <td>{i + 1}</td>
                  <td className="left nowrap"><TeamTag team={r.team} /> <span className="hide-sm">{r.team.shortName}</span></td>
                  <td>{r.left}</td>
                  <td className={sort.id === 'oppPct' ? 'sorted' : undefined}>{r.oppPct.toFixed(3).replace(/^0/, '')}</td>
                  <td className={sort.id === 'vsWinning' ? 'sorted' : undefined}>{r.vsWinning}</td>
                  <td>{r.home}</td>
                  <td className={sort.id === 'road' ? 'sorted' : undefined}>{r.road}</td>
                  <td className={sort.id === 'backToBacks' ? 'sorted' : undefined}>{r.backToBacks}</td>
                  <td className={sort.id === 'longestTrip' ? 'sorted' : undefined}>{r.longestTrip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
