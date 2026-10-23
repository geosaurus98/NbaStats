import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchLeagueGames, fetchStandings } from '../api/espn';
import type { Conference, Game, TeamRef } from '../api/types';
import { LineChart } from '../components/Charts';
import { DraftLottery } from '../components/DraftLottery';
import { WhatIf } from '../components/WhatIf';
import { ErrorBox, Loading } from '../components/Status';
import { TeamLogo } from '../components/TeamLogo';
import { useAsync } from '../hooks/useAsync';
import { formatShortDate, formatTime } from '../lib/dates';
import { seededRandom } from '../lib/games';
import { isFinal } from '../lib/league';
import { carryOver, ELO_MEAN, ratingsAt, runElo, simulate, winProb, type EloRun, type TeamOdds } from '../lib/projections';
import { SEASONS } from '../lib/seasons';
import { useSeason } from '../SeasonContext';

const SIMS = 2000;
const HISTORY_SIMS = 300;
const SLOT_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)'];
const WEEK = 7 * 864e5;

export interface Model {
  teams: TeamRef[];
  standings: Conference[];
  conferences: Map<string, string>;
  games: Game[];
  elo: EloRun;
  odds: Map<string, TeamOdds>;
}

/** Elo for a season, seeded from the previous season's final ratings when we have it. */
export async function buildModel(season: number, sims = SIMS): Promise<Model> {
  const [league, standings] = await Promise.all([fetchLeagueGames(season, 2), fetchStandings(season)]);
  let start = new Map<string, number>();
  if (SEASONS.some((s) => s.year === season - 1)) {
    const prev = await fetchLeagueGames(season - 1, 2).catch(() => undefined);
    if (prev) start = carryOver(runElo(prev.games).ratings);
  }
  const elo = runElo(league.games, start);
  const conferences = new Map<string, string>();
  for (const c of standings) for (const r of c.rows) conferences.set(r.team.id, c.name);
  const odds = simulate(league.games, conferences, elo.ratings, sims, seededRandom(season));
  return { teams: league.teams, standings, conferences, games: league.games, elo, odds };
}

export function Projections() {
  const { season } = useSeason();
  const [params, setParams] = useSearchParams();
  const tab = (['ratings', 'lottery', 'whatif'] as const).find((t) => t === params.get('tab')) ?? 'odds';
  const { data, error, loading } = useAsync(() => buildModel(season.year), [season.year]);

  return (
    <section>
      <h1>{season.label} projections</h1>
      <div className="tabs">
        <button className={tab === 'odds' ? 'active' : ''} onClick={() => setParams({ tab: 'odds' }, { replace: true })}>Playoff odds</button>
        <button className={tab === 'ratings' ? 'active' : ''} onClick={() => setParams({ tab: 'ratings' }, { replace: true })}>Power ratings</button>
        <button className={tab === 'lottery' ? 'active' : ''} onClick={() => setParams({ tab: 'lottery' }, { replace: true })}>Draft lottery</button>
        <button className={tab === 'whatif' ? 'active' : ''} onClick={() => setParams({ tab: 'whatif' }, { replace: true })}>What if</button>
      </div>
      {loading && <Loading label="Rating every team and simulating the season…" />}
      {error && <ErrorBox error={error} />}
      {data && tab === 'odds' && <Odds model={data} season={season.year} />}
      {data && tab === 'ratings' && <Ratings model={data} />}
      {data && tab === 'lottery' && <DraftLottery model={data} season={season.year} />}
      {data && tab === 'whatif' && <WhatIf model={data} season={season.year} />}
      <p className="muted small">
        Elo ratings (FiveThirtyEight-style: margin of victory, 100-point home edge, last season carried over at 75%). Odds come from
        simulating the remaining regular season, the play-in and every playoff series {SIMS.toLocaleString()} times. Ties in the
        standings break at random, so seeding is approximate.
      </p>
    </section>
  );
}

const pct = (v: number) => (v >= 0.995 ? '>99%' : v > 0 && v < 0.005 ? '<1%' : `${Math.round(v * 100)}%`);

function OddsBar({ v }: { v: number }) {
  return (
    <span className="odds-cell">
      <span className="odds-bar" style={{ width: `${v * 100}%` }} />
      <span className="odds-text">{pct(v)}</span>
    </span>
  );
}

function Odds({ model, season }: { model: Model; season: number }) {
  const team = new Map(model.teams.map((t) => [t.id, t]));
  const played = model.games.filter(isFinal).length;
  const left = model.games.length - played;
  const record = (id: string) => {
    const row = model.standings.flatMap((c) => c.rows).find((r) => r.team.id === id);
    return row ? `${row.wins}-${row.losses}` : '';
  };

  return (
    <>
      <p className="muted">
        {left > 0 ? `${played} games played, ${left} to go.` : 'Regular season complete: these are the pre-playoff odds.'} Ranked by projected wins.
      </p>
      <div className="two-col">
        {model.standings.map((conf) => {
          const rows = conf.rows.map((r) => model.odds.get(r.team.id)!).filter(Boolean).sort((a, b) => b.avgWins - a.avgWins);
          return (
            <div key={conf.name} className="table-wrap">
              <h3 className="table-title">{conf.name}</h3>
              <table className="odds-table">
                <thead>
                  <tr>
                    <th className="left">Team</th>
                    <th>Proj. W</th>
                    <th>Playoffs</th>
                    <th>Conf. finals</th>
                    <th>Finals</th>
                    <th>Title</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o) => (
                    <tr key={o.teamId}>
                      <td className="left nowrap">
                        <Link to={`/team/${o.teamId}`} className="team-cell">
                          {team.get(o.teamId) && <TeamLogo team={team.get(o.teamId)!} size={18} />}
                          {team.get(o.teamId)?.abbr}
                        </Link>{' '}
                        <span className="muted small">{record(o.teamId)}</span>
                      </td>
                      <td>{o.avgWins.toFixed(1)}</td>
                      <td title={`Top 6: ${pct(o.top6)} · via play-in: ${pct(o.playoffs - o.top6)}`}><OddsBar v={o.playoffs} /></td>
                      <td><OddsBar v={o.confFinals} /></td>
                      <td><OddsBar v={o.finals} /></td>
                      <td><OddsBar v={o.champion} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
      <OddsOverTime model={model} season={season} />
    </>
  );
}

/** Odds re-run from each week's standings and ratings. */
function OddsOverTime({ model, season }: { model: Model; season: number }) {
  const [metric, setMetric] = useState<'playoffs' | 'champion'>('champion');
  const finals = model.games.filter(isFinal);
  const { data, loading } = useAsync(async () => {
    if (finals.length < 30) return undefined;
    const first = Date.parse(finals[0].date) + 2 * WEEK;
    const last = Date.parse(finals[finals.length - 1].date);
    const points: { t: number; odds: Map<string, TeamOdds> }[] = [];
    for (let t = first; t <= last + 864e5; t += WEEK) {
      points.push({ t, odds: simulate(model.games, model.conferences, ratingsAt(model.elo, t), HISTORY_SIMS, seededRandom(season + t), t) });
      await new Promise((r) => setTimeout(r)); // keep the page responsive
    }
    return points;
  }, [model, season]);
  const ranked = [...model.odds.values()].sort((a, b) => b[metric] - a[metric]);
  const [picked, setPicked] = useState<string[] | null>(null);
  const ids = picked ?? ranked.slice(0, 3).map((o) => o.teamId);
  const abbr = (id: string) => model.teams.find((t) => t.id === id)?.abbr ?? id;
  if (finals.length < 30) return null;

  const toggle = (id: string) => {
    const cur = picked ?? ids;
    setPicked(cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < 3 ? [...cur, id] : cur);
  };

  return (
    <div className="card">
      <div className="page-head">
        <h3>How the odds moved</h3>
        <div className="segmented">
          <button className={metric === 'champion' ? 'active' : ''} onClick={() => setMetric('champion')}>Title</button>
          <button className={metric === 'playoffs' ? 'active' : ''} onClick={() => setMetric('playoffs')}>Make playoffs</button>
        </div>
      </div>
      <div className="chips tight">
        {ranked.map((o) => {
          const slot = ids.indexOf(o.teamId);
          return (
            <button key={o.teamId} className={slot >= 0 ? 'chip picked' : 'chip'} disabled={slot < 0 && ids.length >= 3} onClick={() => toggle(o.teamId)}>
              {slot >= 0 && <i className="key-line" style={{ background: SLOT_COLORS[slot] }} />}
              {abbr(o.teamId)}
            </button>
          );
        })}
      </div>
      {loading && <Loading label="Re-running the odds for every week of the season…" />}
      {data && (
        <LineChart
          ariaLabel={`Weekly ${metric === 'champion' ? 'title' : 'playoff'} odds for selected teams`}
          series={[
            ...model.teams.filter((t) => !ids.includes(t.id)).map((t) => ({ id: t.id, label: t.abbr, values: data.map((p) => p.odds.get(t.id)?.[metric] ?? 0) })),
            ...ids.map((id, i) => ({ id, label: abbr(id), color: SLOT_COLORS[i], values: data.map((p) => p.odds.get(id)?.[metric] ?? 0) })),
          ]}
          xLabel={(i) => `Week of ${formatShortDate(new Date(data[i].t).toISOString())}`}
          xTick={(i) => formatShortDate(new Date(data[i].t).toISOString())}
          yFormat={(v) => `${Math.round(v * 100)}%`}
          yDomain={[0, metric === 'champion' ? Math.max(0.2, ...data.flatMap((p) => ids.map((id) => p.odds.get(id)?.champion ?? 0))) : 1]}
          height={300}
        />
      )}
      <p className="muted small">Each point: odds using only the games played by that week. Pick up to three teams; others in grey.</p>
    </div>
  );
}

function Ratings({ model }: { model: Model }) {
  const team = new Map(model.teams.map((t) => [t.id, t]));
  const ranked = [...model.elo.ratings].sort((a, b) => b[1] - a[1]);
  const [picked, setPicked] = useState<string[] | null>(null);
  const ids = picked ?? ranked.slice(0, 3).map(([id]) => id);
  const preds = model.elo.predictions;
  const correct = preds.filter((p) => (p.pHome >= 0.5) === ((p.game.home.score ?? 0) > (p.game.away.score ?? 0))).length;
  const upsets = preds
    .map((p) => ({ ...p, pWinner: (p.game.home.score ?? 0) > (p.game.away.score ?? 0) ? p.pHome : 1 - p.pHome }))
    .sort((a, b) => a.pWinner - b.pWinner)
    .slice(0, 8);
  const upcoming = model.games.filter((g) => !isFinal(g) && Date.parse(g.date) > Date.now() - 864e5).slice(0, 12);
  const lastGame = preds.length ? Date.parse(preds[preds.length - 1].game.date) : Date.now();
  const twoWeeksAgo = ratingsAt(model.elo, Math.min(Date.now(), lastGame) - 2 * WEEK);

  // Weekly rating lines.
  const allPts = [...model.elo.history.values()].flat();
  const weeks: number[] = [];
  if (allPts.length) {
    const t0 = Math.min(...allPts.map((p) => p.t));
    const t1 = Math.max(...allPts.map((p) => p.t));
    for (let t = t0; t <= t1 + WEEK; t += WEEK) weeks.push(Math.min(t, t1));
  }
  const line = (id: string) => weeks.map((t) => Math.round(ratingsAt(model.elo, t).get(id) ?? ELO_MEAN));
  const toggle = (id: string) => {
    const cur = picked ?? ids;
    setPicked(cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < 3 ? [...cur, id] : cur);
  };

  return (
    <>
      <div className="degrees-main">
        <div className="card">
          <h3>Ratings through the season</h3>
          <div className="chips tight">
            {ranked.map(([id]) => {
              const slot = ids.indexOf(id);
              return (
                <button key={id} className={slot >= 0 ? 'chip picked' : 'chip'} disabled={slot < 0 && ids.length >= 3} onClick={() => toggle(id)}>
                  {slot >= 0 && <i className="key-line" style={{ background: SLOT_COLORS[slot] }} />}
                  {team.get(id)?.abbr}
                </button>
              );
            })}
          </div>
          {weeks.length > 1 && (
            <LineChart
              ariaLabel="Elo rating by week"
              series={[
                ...ranked.filter(([id]) => !ids.includes(id)).map(([id]) => ({ id, label: team.get(id)?.abbr ?? id, values: line(id) })),
                ...ids.map((id, i) => ({ id, label: team.get(id)?.abbr ?? id, color: SLOT_COLORS[i], values: line(id) })),
              ]}
              xLabel={(i) => `Week of ${formatShortDate(new Date(weeks[i]).toISOString())}`}
              xTick={(i) => formatShortDate(new Date(weeks[i]).toISOString())}
              height={320}
            />
          )}
          <p className="muted small">1505 = average. Roughly, 100 points of difference ≈ a 64% chance to win on a neutral court.</p>
        </div>
        <div className="card chain-card">
          <h3>Power ranking</h3>
          <table>
            <tbody>
              {ranked.map(([id, r], i) => {
                const change = r - (twoWeeksAgo.get(id) ?? r);
                return (
                  <tr key={id}>
                    <td>{i + 1}</td>
                    <td className="left">
                      <Link to={`/team/${id}`} className="team-cell">
                        {team.get(id) && <TeamLogo team={team.get(id)!} size={16} />} {team.get(id)?.shortName}
                      </Link>
                    </td>
                    <td className="sorted">{Math.round(r)}</td>
                    <td className={change > 0 ? 'win small' : change < 0 ? 'loss small' : 'muted small'}>
                      {Math.abs(change) < 0.5 ? '–' : `${change > 0 ? '▲' : '▼'}${Math.abs(Math.round(change))}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="muted small">Arrows: change over the last two weeks of games.</p>
        </div>
      </div>

      <div className="two-col">
        {upcoming.length > 0 && (
          <div className="card">
            <h3>Upcoming games: model's pick</h3>
            <table>
              <tbody>
                {upcoming.map((g) => {
                  const p = winProb(model.elo.ratings.get(g.home.team.id) ?? ELO_MEAN, model.elo.ratings.get(g.away.team.id) ?? ELO_MEAN);
                  const fav = p >= 0.5 ? g.home.team : g.away.team;
                  return (
                    <tr key={g.id}>
                      <td className="left nowrap muted small">{formatShortDate(g.date)} {formatTime(g.date)}</td>
                      <td className="left">{g.away.team.abbr} @ {g.home.team.abbr}</td>
                      <td className="left"><b>{fav.abbr}</b> {Math.round(Math.max(p, 1 - p) * 100)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="card">
          <h3>How good is the model?</h3>
          <p>
            The pre-game favourite won <b>{preds.length ? Math.round((correct / preds.length) * 100) : 0}%</b> of {preds.length} games this
            season.
          </p>
          <h3>Biggest upsets</h3>
          <table>
            <tbody>
              {upsets.map((u) => {
                const g = u.game;
                const homeWon = (g.home.score ?? 0) > (g.away.score ?? 0);
                return (
                  <tr key={g.id}>
                    <td className="left nowrap muted small">{formatShortDate(g.date)}</td>
                    <td className="left">
                      <Link to={`/game/${g.id}`}>
                        <b>{homeWon ? g.home.team.abbr : g.away.team.abbr}</b> beat {homeWon ? g.away.team.abbr : g.home.team.abbr} {Math.max(g.home.score!, g.away.score!)}-
                        {Math.min(g.home.score!, g.away.score!)}
                      </Link>
                    </td>
                    <td className="muted small">{Math.round(u.pWinner * 100)}% chance</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
