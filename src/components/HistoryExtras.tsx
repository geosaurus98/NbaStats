// History tabs: players compared across eras, this date in a franchise's
// history, draft lottery history since 1985 and Hall of Fame odds.
import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchScoreboard, mapLimit } from '../api/espn';
import type { Game } from '../api/types';
import { useFavourite } from '../FavouriteContext';
import { useAsync } from '../hooks/useAsync';
import { loadCareers } from '../lib/careers';
import { adjustedSeasons, careerAverage, eraContexts } from '../lib/eras';
import { loadFranchiseData } from '../lib/franchiseData';
import { FRANCHISES } from '../lib/franchises';
import { hallOfFameOdds, HOF_FEATURES } from '../lib/hallOfFame';
import { biggestJumps, lotteryHistory } from '../lib/lotteryHistory';
import { seasonLabel, type Graph } from '../lib/teammates';
import { LineChart } from './Charts';
import { PlayerInput } from './PlayerInput';
import { Empty, ErrorBox, Loading } from './Status';

const SLOT_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)'];
const DEFAULTS = ['Wilt Chamberlain', 'Michael Jordan', 'Nikola Jokić'];

export function EraCompare({ graph }: { graph: Graph }) {
  const data = useAsync(async () => {
    const [careers, fr] = await Promise.all([loadCareers(), loadFranchiseData()]);
    return { careers, eras: eraContexts(careers, fr) };
  }, []);
  const find = (name: string) => graph.data.players.findIndex((p) => p[0] === name || p[0].normalize('NFD').replace(/[̀-ͯ]/g, '') === name.normalize('NFD').replace(/[̀-ͯ]/g, ''));
  const [picked, setPicked] = useState<number[]>(() => DEFAULTS.map(find).filter((p) => p >= 0));
  const years = useMemo(() => (data.data ? [...data.data.eras.keys()].sort((a, b) => a - b) : []), [data.data]);
  const [refYear, setRefYear] = useState<number | undefined>(undefined);
  const best = useMemo(() => {
    if (!data.data) return [];
    const ref = data.data.eras.get(refYear ?? years[years.length - 1]);
    if (!ref) return [];
    return data.data.careers.seasons
      .flatMap((rows, player) => adjustedSeasons(rows, data.data!.eras, ref).filter((s) => s.g >= 50).map((s) => ({ player, ...s })))
      .sort((a, b) => b.adj.pts - a.adj.pts)
      .slice(0, 20);
  }, [data.data, refYear, years]);
  if (data.loading) return <Loading />;
  if (data.error || !data.data) return <ErrorBox error={data.error ?? new Error('No career data')} />;
  const { careers, eras } = data.data;
  const year = refYear ?? years[years.length - 1];
  const ref = eras.get(year)!;
  const rows = picked.map((p, i) => {
    const seasons = adjustedSeasons(careers.seasons[p] ?? [], eras, ref);
    return { p, i, seasons, avg: careerAverage(seasons), peak: [...seasons].filter((s) => s.g >= 30).sort((a, b) => b.adj.pts - a.adj.pts)[0] };
  });
  const xs = [...new Set(rows.flatMap((r) => r.seasons.map((_, k) => k)))].sort((a, b) => a - b);
  const name = (p: number) => graph.data.players[p]?.[0] ?? '';
  const f1 = (v: number) => v.toFixed(1);
  return (
    <>
      <p className="muted">
        Per-game numbers rescaled to one season's conditions: counting stats by pace (possessions per game), points also by how efficiently the league scored. Early eras played much faster, so there were more rebounds to go round; scoring was faster too but less efficient, so their points move less than you might think.
      </p>
      <div className="era-controls">
        {[0, 1, 2].map((i) => (
          <PlayerInput key={i} graph={graph} label={`Player ${i + 1}`} value={picked[i]} onPick={(p) => setPicked((s) => { const n = [...s]; n[i] = p; return n; })} />
        ))}
        <label className="player-input">
          <span className="muted small">Adjust to</span>
          <select value={year} onChange={(e) => setRefYear(Number(e.target.value))}>
            {[...years].reverse().map((y) => (
              <option key={y} value={y}>{seasonLabel(y)}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="left">Player</th>
              <th>Games</th>
              <th title="Career points per game: as played → adjusted">PTS</th>
              <th>REB</th>
              <th>AST</th>
              <th className="left" title="Best adjusted scoring season (30+ games)">Peak season</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.p}>
                <td className="left nowrap"><i className="key-line" style={{ background: SLOT_COLORS[r.i] }} /> {name(r.p)}</td>
                <td>{r.avg.g}</td>
                <td><span className="muted">{f1(r.avg.pts)} →</span> <b>{f1(r.avg.adjPts)}</b></td>
                <td><span className="muted">{f1(r.avg.trb)} →</span> <b>{f1(r.avg.adjTrb)}</b></td>
                <td><span className="muted">{f1(r.avg.ast)} →</span> <b>{f1(r.avg.adjAst)}</b></td>
                <td className="left small">{r.peak ? `${seasonLabel(r.peak.season)}: ${f1(r.peak.raw.pts)} → ${f1(r.peak.adj.pts)} pts` : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {xs.length > 1 && (
        <div className="card">
          <h3>Adjusted points per game by season of career</h3>
          <LineChart
            series={rows.map((r) => ({ id: String(r.p), label: name(r.p), color: SLOT_COLORS[r.i], values: xs.map((k) => (r.seasons[k] ? Math.round(r.seasons[k].adj.pts * 10) / 10 : null)) }))}
            height={260}
            xLabel={(i) => `Season ${xs[i] + 1}`}
            xTick={(i) => String(xs[i] + 1)}
            ariaLabel={`Era-adjusted points per game by season of career, at ${seasonLabel(year)} pace and scoring`}
          />
        </div>
      )}
      <div className="table-wrap">
        <h3 className="table-title">Best adjusted scoring seasons (at {seasonLabel(year)} conditions, 50+ games)</h3>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th className="left">Player</th>
              <th className="left">Season</th>
              <th>As played</th>
              <th>Adjusted</th>
            </tr>
          </thead>
          <tbody>
            {best.map((b, i) => (
              <tr key={`${b.player}-${b.season}`}>
                <td className="muted">{i + 1}</td>
                <td className="left nowrap">{name(b.player)}</td>
                <td className="left">{seasonLabel(b.season)}</td>
                <td className="muted">{f1(b.raw.pts)}</td>
                <td><b>{f1(b.adj.pts)}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">League pace from Basketball-Reference since 1973-74; earlier seasons are estimated from shots per minute. NBA seasons from 1951-52 (when minutes were first recorded).</p>
    </>
  );
}

/** Every season's game for one franchise on today's date (ESPN scoreboards back to 2001-02), plus the night's best scorers. */
export function OnThisDate() {
  const { favouriteId } = useFavourite();
  const [teamId, setTeamId] = useState(favouriteId ?? '13');
  const today = new Date();
  const md = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const inSeason = !['07', '08', '09'].includes(md.slice(0, 2));
  const { data, loading, error } = useAsync(async () => {
    if (!inSeason) return [];
    const thisYear = today.getFullYear();
    const years = Array.from({ length: thisYear - 2002 + 1 }, (_, i) => thisYear - 1 - i).filter((y) => y >= 2002);
    const out = await mapLimit(years, 4, async (y) => ({ year: y, games: await fetchScoreboard(`${y}-${md}`).catch(() => [] as Game[]) }));
    return out.filter((d) => d.games.length);
  }, [md]);
  const team = FRANCHISES.find((f) => f.espnId === teamId);
  const mine = (data ?? []).flatMap((d) => d.games.filter((g) => g.home.team.id === teamId || g.away.team.id === teamId).map((g) => ({ year: d.year, g })));
  const scorers = (data ?? [])
    .flatMap((d) => d.games.flatMap((g) => [g.home, g.away].flatMap((c) => c.leaders.filter((l) => /points/i.test(l.category)).map((l) => ({ year: d.year, g, team: c.team.abbr, name: l.athlete, id: l.athleteId, pts: parseFloat(l.value) || 0 })))))
    .sort((a, b) => b.pts - a.pts)
    .slice(0, 15);
  const label = today.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  return (
    <>
      <p className="muted">Every {team?.name ?? 'team'} game played on {label} since 2001-02, and the best scoring nights on this date, from ESPN's scoreboards. Needs an internet connection.</p>
      <label className="player-input">
        <span className="muted small">Team</span>
        <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
          {FRANCHISES.map((f) => (
            <option key={f.espnId} value={f.espnId}>{f.name}</option>
          ))}
        </select>
      </label>
      {!inSeason && <Empty>No NBA games are played on {label}: the season runs October to June.</Empty>}
      {loading && <Loading label={`Loading ${label} in past seasons…`} />}
      {error && <ErrorBox error={error} />}
      {data && inSeason && (
        <div className="two-col">
          <div className="table-wrap">
            <h3 className="table-title">{team?.name} on {label}</h3>
            {mine.length ? (
              <table>
                <tbody>
                  {mine.map(({ year, g }) => {
                    const us = g.home.team.id === teamId ? g.home : g.away;
                    const them = us === g.home ? g.away : g.home;
                    const top = us.leaders.find((l) => /points/i.test(l.category));
                    const won = (us.score ?? 0) > (them.score ?? 0);
                    return (
                      <tr key={g.id}>
                        <td className="left">{year}</td>
                        <td className={won ? 'win' : 'loss'}><b>{won ? 'W' : 'L'}</b></td>
                        <td className="left nowrap"><Link to={`/game/${g.id}`}>{us === g.home ? 'vs' : '@'} {them.team.abbr} {us.score}-{them.score}</Link></td>
                        <td className="left small muted">{top ? `${top.athlete} ${top.value}` : ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="small">No games on this date since 2001-02.</p>
            )}
            {mine.length > 0 && <p className="small">Record on {label}: <b>{mine.filter(({ g }) => { const us = g.home.team.id === teamId ? g.home : g.away; const them = us === g.home ? g.away : g.home; return (us.score ?? 0) > (them.score ?? 0); }).length}-{mine.filter(({ g }) => { const us = g.home.team.id === teamId ? g.home : g.away; const them = us === g.home ? g.away : g.home; return (us.score ?? 0) < (them.score ?? 0); }).length}</b></p>}
          </div>
          <div className="table-wrap">
            <h3 className="table-title">Biggest scoring nights on {label}</h3>
            <table>
              <tbody>
                {scorers.map((s) => (
                  <tr key={s.g.id + s.name}>
                    <td className="left nowrap">{s.id ? <Link to={`/player/${s.id}`}>{s.name}</Link> : s.name} <span className="muted small">{s.team}</span></td>
                    <td><b>{s.pts}</b></td>
                    <td className="left small"><Link to={`/game/${s.g.id}`}>{s.year}: {s.g.away.team.abbr} {s.g.away.score} @ {s.g.home.team.abbr} {s.g.home.score}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

export function LotteryHistory() {
  const fd = useAsync(() => loadFranchiseData(), []);
  const [open, setOpen] = useState<number | null>(null);
  const years = useMemo(() => (fd.data ? lotteryHistory(fd.data) : []), [fd.data]);
  if (fd.loading) return <Loading />;
  if (!years.length) return <Empty>No draft data.</Empty>;
  const jumps = biggestJumps(years, 12);
  const worstWon = years.filter((y) => y.picks[0]?.rank === 1).length;
  const counts = [1, 2, 3, 4].map((pick) => years.filter((y) => y.picks.find((p) => p.pick === pick)?.rank === 1).length);
  return (
    <>
      <p className="muted">
        Every draft lottery since 1985: the non-playoff teams by record and who picked at the top. The worst team has picked first in {worstWon} of {years.length} drafts, second {counts[1]}, third {counts[2]} and fourth {counts[3]} times. Odds were flattened in 1990, 1994 and 2019.
      </p>
      <div className="two-col">
        <div className="table-wrap">
          <h3 className="table-title">Biggest lottery jumps</h3>
          <table>
            <thead>
              <tr>
                <th className="left">Year</th>
                <th className="left">Team</th>
                <th title="Rank among non-playoff teams by record">From</th>
                <th>To</th>
                <th className="left">Pick</th>
              </tr>
            </thead>
            <tbody>
              {jumps.map((j) => (
                <tr key={j.year + j.team}>
                  <td className="left">{j.year}</td>
                  <td className="left nowrap">{j.name}</td>
                  <td>{j.rank}</td>
                  <td><b>{j.pick}</b></td>
                  <td className="left small">{j.player}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-wrap">
          <h3 className="table-title">Every draft's top four</h3>
          <table>
            <tbody>
              {years.map((y) => (
                <Fragment key={y.year}>
                  <tr className="clickable" onClick={() => setOpen(open === y.year ? null : y.year)}>
                    <td className="left"><b>{y.year}</b></td>
                    {y.picks.map((p) => (
                      <td key={p.pick} className="left small" title={p.rank ? `${p.team} had the #${p.rank} worst record` : `${p.team}: pick acquired from another team`}>
                        {p.pick}. {p.team} <span className={p.rank && p.rank > p.pick ? 'win' : 'muted'}>{p.rank ? `(${p.rank})` : '(via)'}</span>
                      </td>
                    ))}
                  </tr>
                  {open === y.year && (
                    <tr>
                      <td colSpan={5} className="left small">
                        {y.picks.map((p) => `${p.pick}. ${p.player}`).join(' · ')}
                        <br />
                        <span className="muted">By record: {y.order.map((t, i) => `${i + 1}. ${t[0]} ${t[2]}-${t[3]}`).join(', ')}</span>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          <p className="muted small">In brackets: the picking team's rank by record ("via" = the pick came from another team). Click a year for the players and the full order.</p>
        </div>
      </div>
    </>
  );
}

export function HallOfFameOdds({ graph }: { graph: Graph }) {
  const data = useAsync(() => loadCareers(), []);
  const model = useMemo(() => {
    if (!data.data?.hof?.length) return undefined;
    const latest = Math.max(...data.data.seasons.flatMap((rows) => rows.map((r) => r[0])));
    return { latest, ...hallOfFameOdds(data.data, latest) };
  }, [data.data]);
  if (data.loading) return <Loading />;
  if (!model) return <Empty>Hall of Fame odds start with the next daily data update.</Empty>;
  const name = (p: number) => graph.data.players[p]?.[0] ?? '';
  const active = model.candidates.filter((c) => c.last >= model.latest - 1).slice(0, 40);
  const retired = model.candidates.filter((c) => c.last < model.latest - 1).slice(0, 15);
  const table = (rows: typeof active, title: string) => (
    <div className="table-wrap">
      <h3 className="table-title">{title}</h3>
      <table>
        <thead>
          <tr>
            <th className="left">Player</th>
            <th>Odds</th>
            <th />
            <th title="All-Star selections">AS</th>
            <th title="All-NBA teams (1st, 2nd and 3rd)">All-NBA</th>
            <th title="MVPs">MVP</th>
            <th title="Championships">Rings</th>
            <th title="Career points">Points</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.player}>
              <td className="left nowrap"><Link to={`/history?tab=careers&p=${encodeURIComponent(name(c.player))}`}>{name(c.player)}</Link></td>
              <td><b>{c.prob >= 0.995 ? '>99%' : c.prob < 0.01 ? '<1%' : `${Math.round(c.prob * 100)}%`}</b></td>
              <td className="bar-cell"><span className="bar" style={{ width: `${Math.max(2, c.prob * 100)}%` }} /></td>
              <td>{c.features[0]}</td>
              <td>{c.features[1].toFixed(1)}</td>
              <td>{c.features[2]}</td>
              <td>{c.features[3]}</td>
              <td>{Math.round(c.features[4] * 1000).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <>
      <p className="muted">
        A logistic regression trained on every player retired at least five seasons whose career started in 1960 or later, on who actually reached the Naismith Hall of Fame as a player, from: {HOF_FEATURES.join(', ')}. It gets {Math.round(model.accuracy * 100)}% of those right. Careers through {seasonLabel(model.latest)}; active players get credit only for what they've done so far.
      </p>
      <div className="two-col">
        {table(active, 'Active players')}
        {table(retired, 'Recently retired (not yet eligible or not yet in)')}
      </div>
      <p className="muted small">All-NBA is weighted 1 for first team, 0.6 second, 0.4 third. The Hall also honours college, international and coaching careers, which this can't see.</p>
    </>
  );
}
