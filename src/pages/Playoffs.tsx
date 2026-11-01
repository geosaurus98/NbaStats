import { createContext, useContext } from 'react';
import { Link } from 'react-router-dom';
import { fetchLeagueGames, fetchStandings, seasonSnapshot } from '../api/espn';
import { loadLines } from '../api/linesStore';
import type { Conference } from '../api/types';
import type { SeasonLines } from '../lib/boxTotals';
import { oddsPath, projectedFirstRound, roundPoints, scoreBracket, seriesLeaders, seriesProb, useBracket, type BracketPicks } from '../lib/playoffMode';
import { ELO_MEAN, ratingsAt, runElo, type EloRun } from '../lib/projections';
import { Empty, ErrorBox, Loading } from '../components/Status';
import { TeamLogo } from '../components/TeamLogo';
import { useAsync } from '../hooks/useAsync';
import { buildBracket, type Series } from '../lib/league';
import { useSeason } from '../SeasonContext';

const ROUND_NAMES = ['First round', 'Conference semifinals', 'Conference finals', 'NBA Finals'];

function lookups(confs: Conference[]) {
  const seeds = new Map<string, number>();
  const conferences = new Map<string, string>();
  for (const c of confs) {
    c.rows.forEach((r, i) => {
      seeds.set(r.team.id, r.seed ?? i + 1);
      conferences.set(r.team.id, c.name);
    });
  }
  return { seeds, conferences };
}

export function Playoffs() {
  const { season } = useSeason();
  const { data, error, loading } = useAsync(async () => {
    const [standings, league, regular, lines] = await Promise.all([fetchStandings(season.year), fetchLeagueGames(season.year, 3), fetchLeagueGames(season.year, 2), loadLines(season.year)]);
    const { seeds, conferences } = lookups(standings);
    // Elo over the regular season and the playoffs so far drives the series odds.
    const elo = runElo([...regular.games, ...league.games]);
    return { series: buildBracket(league.games, seeds, conferences), conferenceNames: standings.map((c) => c.name), standings, elo, lines };
  }, [season.year]);
  const [picks, setPicks] = useBracket(season.year);

  const west = data?.conferenceNames.find((n) => /west/i.test(n));
  const east = data?.conferenceNames.find((n) => /east/i.test(n));
  const pick = (conf: string | undefined, round: number) =>
    data?.series.filter((s) => s.round === round && s.conference === conf) ?? [];
  const finals = data?.series.find((s) => s.round === 4);
  const champion = finals?.winner;

  return (
    <section>
      <h1>{season.label} playoffs</h1>
      {loading && <Loading label="Loading every team's playoff games…" />}
      {error && <ErrorBox error={error} />}
      {data && data.series.length === 0 && <Projected standings={data.standings} elo={data.elo} />}
      {data && (!champion || picks.champion || Object.keys(picks.series).length > 0) && <Challenge picks={picks} setPicks={setPicks} series={data.series} standings={data.standings} />}

      {champion && (
        <div className="champion">
          <TeamLogo team={champion} size={44} />
          <div>
            <div className="muted small">{season.label} NBA champions</div>
            <div className="champion-name">{champion.name}</div>
          </div>
        </div>
      )}

      {data && data.series.length > 0 && (
        <Ctx.Provider value={{ elo: data.elo, lines: data.lines, names: seasonSnapshot(season.year)?.players ?? {}, picks, setPicks }}>
        <div className="bracket">
          {[1, 2, 3].map((round) => (
            <BracketColumn key={`w${round}`} title={`West · ${ROUND_NAMES[round - 1]}`} series={pick(west, round)} />
          ))}
          <BracketColumn title={ROUND_NAMES[3]} series={finals ? [finals] : []} finals />
          {[3, 2, 1].map((round) => (
            <BracketColumn key={`e${round}`} title={`East · ${ROUND_NAMES[round - 1]}`} series={pick(east, round)} />
          ))}
        </div>
        </Ctx.Provider>
      )}
      <p className="muted small">Play-in games aren't shown. Click a series to see its games, how the odds moved after each one and the series leaders. Series odds come from each team's Elo rating with home court (2-2-1-1-1).</p>
    </section>
  );
}

function BracketColumn({ title, series, finals }: { title: string; series: Series[]; finals?: boolean }) {
  return (
    <div className={`bracket-col${finals ? ' finals' : ''}`}>
      <div className="bracket-title">{title}</div>
      <div className="bracket-cells">
        {series.length === 0 && <div className="series empty">TBD</div>}
        {series.map((s) => (
          <SeriesCard key={s.key} s={s} />
        ))}
      </div>
    </div>
  );
}

function SeriesCard({ s }: { s: Series }) {
  // Higher seed first.
  const order = (s.seeds[0] ?? 99) <= (s.seeds[1] ?? 99) ? [0, 1] : [1, 0];
  const last = s.games[s.games.length - 1];
  const { elo, lines, names, picks, setPicks } = useContext(Ctx)!;
  const path = oddsPath(s, (id, t) => ratingsAt(elo, t).get(id) ?? ELO_MEAN);
  const now = path[path.length - 1];
  const open = s.games.every((g) => g.state === 'pre');
  const picked = picks.series[s.key];
  const leaders = lines ? seriesLeaders(s.games.map((g) => g.id), lines) : [];
  return (
    <details className="series">
      <summary>
        {order.map((i) => (
          <div key={s.teams[i].id} className={`series-row${s.winner && s.winner.id !== s.teams[i].id ? ' lost' : ''}`}>
            <span className="seed">{s.seeds[i] ?? ''}</span>
            <TeamLogo team={s.teams[i]} size={20} />
            <span className="series-team">{s.teams[i].abbr}</span>
            {!s.winner && <span className="muted small series-odds">{Math.round((i === 0 ? now : 1 - now) * 100)}%</span>}
            <b>{s.wins[i]}</b>
            {picked === s.teams[i].id && <span className={s.winner ? (s.winner.id === picked ? 'win' : 'loss') : 'muted'} title="Your pick" aria-label="Your pick">✓</span>}
          </div>
        ))}
      </summary>
      {path.length > 1 && (
        <div className="small muted">
          {s.teams[order[0]].abbr} odds: {path.map((p, k) => `${k === 0 ? 'start' : `G${k}`} ${Math.round((order[0] === 0 ? p : 1 - p) * 100)}%`).join(' → ')}
        </div>
      )}
      {open && (
        <div className="chips tight pick-row">
          <span className="small muted">Pick ({roundPoints(s.round)} pt{s.round > 1 ? 's' : ''}):</span>
          {s.teams.map((t) => (
            <button key={t.id} className={picked === t.id ? 'chip active' : 'chip'} aria-pressed={picked === t.id} onClick={() => setPicks({ ...picks, series: { ...picks.series, [s.key]: t.id } })}>{t.abbr}</button>
          ))}
        </div>
      )}
      {leaders.length > 0 && (
        <div className="small series-leaders">
          <span className="muted">Leaders (PTS/REB/AST)</span>
          {order.map((i) => s.teams[i]).map((t) => (
            <div key={t.id}>
              <b>{t.abbr}</b>{' '}
              {leaders.filter((l) => l.teamId === t.id).slice(0, 2).map((l) => `${names[l.id] ?? ''} ${l.pts.toFixed(1)}/${l.reb.toFixed(1)}/${l.ast.toFixed(1)}`).join(' · ')}
            </div>
          ))}
        </div>
      )}
      <ol className="series-games">
        {s.games.map((g, n) => (
          <li key={g.id}>
            <Link to={`/game/${g.id}`}>
              G{n + 1}:{' '}
              {g.state === 'post'
                ? `${g.away.team.abbr} ${g.away.score} @ ${g.home.team.abbr} ${g.home.score}`
                : `${g.away.team.abbr} @ ${g.home.team.abbr} · ${g.statusDetail}`}
            </Link>
          </li>
        ))}
      </ol>
      {!s.winner && last && <div className="muted small">Series in progress</div>}
    </details>
  );
}

const Ctx = createContext<{ elo: EloRun; lines?: SeasonLines; names: Record<string, string>; picks: BracketPicks; setPicks: (p: BracketPicks) => void } | undefined>(undefined);

/** If the playoffs started today: the first-round pairings with series odds. */
function Projected({ standings, elo }: { standings: Conference[]; elo: EloRun }) {
  const matchups = projectedFirstRound(standings);
  if (!matchups.length) return <Empty>No playoff games yet.</Empty>;
  const r = (id: string) => elo.ratings.get(id) ?? ELO_MEAN;
  return (
    <>
      <h2>If the playoffs started today</h2>
      <p className="muted small">First-round pairings from the current standings (seeds 7 and 8 would come out of the play-in), with each series' odds from Elo ratings and home court.</p>
      <div className="two-col">
        {standings.map((c) => (
          <div key={c.name} className="table-wrap">
            <h3 className="table-title">{c.name}</h3>
            <table>
              <tbody>
                {matchups.filter((m) => m.conference === c.name).map((m) => {
                  const p = seriesProb(r(m.teams[0].id), r(m.teams[1].id), true);
                  return (
                    <tr key={m.seeds.join()}>
                      {m.teams.map((t, i) => (
                        <td key={t.id} className="left">
                          <Link to={`/team/${t.id}`} className="team-cell"><span className="seed">{m.seeds[i]}</span><TeamLogo team={t} size={20} />{t.abbr}</Link>
                        </td>
                      ))}
                      <td>{Math.round(p * 100)}% – {Math.round((1 - p) * 100)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </>
  );
}

/** Bracket challenge: pick each series before it starts, plus a champion before the playoffs begin. */
function Challenge({ picks, setPicks, series, standings }: { picks: BracketPicks; setPicks: (p: BracketPicks) => void; series: Series[]; standings: Conference[] }) {
  const started = series.some((s) => s.games.some((g) => g.state !== 'pre'));
  const out = new Set(series.flatMap((s) => (s.winner ? s.teams.filter((t) => t.id !== s.winner!.id).map((t) => t.id) : [])));
  const teams = standings.flatMap((c) => c.rows.slice(0, 10).map((r) => r.team)).filter((t) => !out.has(t.id));
  const score = scoreBracket(picks, series);
  const champ = teams.find((t) => t.id === picks.champion) ?? standings.flatMap((c) => c.rows.map((r) => r.team)).find((t) => t.id === picks.champion);
  return (
    <div className="card challenge">
      <h3>Bracket challenge</h3>
      <p className="small">
        Pick the winner of each series before game 1 (open a series below): {roundPoints(1)} point in the first round, doubling each round, and 10 for the champion.
        {score.decided > 0 && <> <b>{score.points} points</b> so far, {score.right} of {score.decided} right.</>}
      </p>
      <label className="small">
        Your champion:{' '}
        {started ? (
          <b>{champ?.name ?? 'none picked'}</b>
        ) : (
          <select value={picks.champion ?? ''} onChange={(e) => setPicks({ ...picks, champion: e.target.value || undefined })}>
            <option value="">Pick a team…</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
      </label>
      <p className="muted small">Picks are kept in this browser{started ? '; the champion pick locked when the playoffs began' : ' and lock once the playoffs begin'}.</p>
    </div>
  );
}
