// Home dashboard: today's games, the favourite team, a standings snapshot,
// the title race (or champion), the scoring race and today's puzzles.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { fetchLeaders, fetchScoreboard, fetchStandings, seasonSnapshot } from '../api/espn';
import type { Game } from '../api/types';
import { MyTeamCard } from '../components/MyTeamCard';
import { Empty, ErrorBox, Loading } from '../components/Status';
import { TeamLogo } from '../components/TeamLogo';
import { useFavourite } from '../FavouriteContext';
import { useAsync } from '../hooks/useAsync';
import { addDays, formatDay, formatTime, toISODate } from '../lib/dates';
import { loadOnThisDay } from '../lib/careers';
import { CHAMPIONS } from '../lib/franchiseData';
import { espnLogo, franchiseOf, FRANCHISES } from '../lib/franchises';
import { AWARDS, candidates, rankAward } from '../lib/awards';
import { L } from '../lib/boxTotals';
import { todayKey } from '../lib/games';
import { defaultDate, type Season } from '../lib/seasons';
import { useSeason } from '../SeasonContext';
import { buildModel } from './Projections';

const PTS = 'offensive.avgPoints';

export function Home() {
  const { season } = useSeason();
  const date = defaultDate(season);
  const { favouriteId } = useFavourite();
  const fav = FRANCHISES.find((f) => f.espnId === favouriteId);
  const champ = CHAMPIONS[season.year] ? franchiseOf(CHAMPIONS[season.year]) : undefined;

  return (
    <section>
      <div className="page-head">
        <h1>{season.label} at a glance</h1>
        <div className="actions">
          <Link className="chip" to="/myteam">★ My team</Link>
          <Link className="chip" to={`/scores?date=${date}`}>All scores →</Link>
        </div>
      </div>
      <MyTeamCard season={season.year} />
      <TodayGames date={date} />
      <div className="two-col home-row">
        <StandingsSnapshot season={season.year} />
        <div className="home-stack">
        {champ ? (
          <div className="card">
            <h3>Champions</h3>
            <Link to="/playoffs" className="home-champ">
              <TeamLogo team={{ id: champ.espnId, name: champ.name, shortName: champ.name, abbr: champ.id, logo: espnLogo(champ) }} size={56} />
              <div>
                <div className="muted small">{season.label} NBA champions</div>
                <div className="champion-name">{champ.name}</div>
                <div className="small">See the bracket →</div>
              </div>
            </Link>
          </div>
        ) : (
          <TitleOdds season={season} />
        )}
        <NightCard season={season.year} />
        <OnThisDayCard />
        </div>
      </div>
      <div className="two-col home-row">
        <ScoringRace season={season.year} />
        <AwardRace season={season.year} />
      </div>
      <div className="two-col home-row">
        <Puzzles />
      <div className="card">
        <h3>Explore</h3>
        <div className="chips tight">
          {fav && <Link className="chip" to={`/franchise/${fav.id}`}>{fav.name} history</Link>}
          <Link className="chip" to="/projections">Playoff odds</Link>
          <Link className="chip" to="/insights">Most exciting games</Link>
          <Link className="chip" to="/degrees">6 Degrees</Link>
          <Link className="chip" to="/history?tab=leaders">All-time leaders</Link>
          <Link className="chip" to="/history?tab=draft">Draft history</Link>
          <Link className="chip" to="/franchise/LAL">Franchise histories</Link>
          <Link className="chip" to="/history?tab=teams">Team vs team across eras</Link>
          <Link className="chip" to="/projections?tab=lottery">Draft lottery</Link>
          <Link className="chip" to="/insights?tab=hot">Hot &amp; cold</Link>
          <Link className="chip" to="/insights?tab=clutch">Clutch</Link>
          <Link className="chip" to="/history?tab=greatest">Greatest teams</Link>
          <Link className="chip" to="/history?tab=similar">Similar players</Link>
        </div>
      </div>
      </div>
    </section>
  );
}

function TodayGames({ date }: { date: string }) {
  const { data, error, loading } = useAsync(
    (fresh) => fetchScoreboard(date, fresh),
    [date],
    (games) => (games.some((g) => g.state === 'in') ? 30_000 : undefined),
  );
  const order = { in: 0, pre: 1, post: 2 } as const;
  const games = [...(data ?? [])].sort((a, b) => order[a.state] - order[b.state] || a.date.localeCompare(b.date));
  return (
    <div className="card home-row">
      <h3>Games · {formatDay(date)}</h3>
      {loading && !data && <Loading />}
      {error && <ErrorBox error={error} />}
      {data && games.length === 0 && <Empty>No games on this date. <Link to={`/scores?date=${date}`}>Browse other days →</Link></Empty>}
      <div className="home-games">
        {games.map((g) => (
          <GameRow key={g.id} game={g} />
        ))}
      </div>
    </div>
  );
}

function GameRow({ game: g }: { game: Game }) {
  const status = g.state === 'pre' ? formatTime(g.date) : g.statusDetail || 'Final';
  const side = (c: Game['home']) => (
    <span className={g.state === 'post' && !c.winner ? 'home-side muted' : 'home-side'}>
      <TeamLogo team={c.team} size={20} /> {c.team.abbr}
      {g.state !== 'pre' && <b className="home-score">{c.score}</b>}
    </span>
  );
  return (
    <Link to={`/game/${g.id}`} className="home-game">
      {side(g.away)}
      <span className="muted">@</span>
      {side(g.home)}
      <span className={g.state === 'in' ? 'live small home-status' : 'muted small home-status'}>{status}</span>
    </Link>
  );
}

function StandingsSnapshot({ season }: { season: number }) {
  const { data, error } = useAsync(() => fetchStandings(season), [season]);
  return (
    <div className="card">
      <h3>Standings</h3>
      {error && <ErrorBox error={error} />}
      {!data && !error && <Loading />}
      <div className="home-conf">
        {data?.map((c) => (
          <div key={c.name}>
            <div className="muted small">{c.name.replace(/ Conference$/, '')}</div>
            <table>
              <tbody>
                {c.rows.slice(0, 6).map((r, i) => (
                  <tr key={r.team.id}>
                    <td className="muted small">{i + 1}</td>
                    <td className="left nowrap"><Link to={`/team/${r.team.id}`}><TeamLogo team={r.team} size={18} /> {r.team.abbr}</Link></td>
                    <td>{r.wins}-{r.losses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
      <p className="small"><Link to="/standings">Full standings →</Link></p>
    </div>
  );
}

function TitleOdds({ season }: { season: Season }) {
  const { data, error } = useAsync(() => buildModel(season.year, 500), [season.year]);
  const top = data ? [...data.odds.values()].sort((a, b) => b.champion - a.champion).slice(0, 6) : [];
  const team = (id: string) => data?.teams.find((t) => t.id === id);
  const max = Math.max(0.01, ...top.map((o) => o.champion));
  return (
    <div className="card">
      <h3>Title odds</h3>
      {error && <ErrorBox error={error} />}
      {!data && !error && <Loading label="Simulating the season…" />}
      <div className="partner-bars">
        {top.map((o) => {
          const t = team(o.teamId);
          return (
            <div key={o.teamId} className="pbar">
              <span className="pbar-name">{t && <TeamLogo team={t} size={18} />} {t?.abbr}</span>
              <span className="pbar-track"><span className="pbar-fill" style={{ width: `${(o.champion / max) * 100}%`, background: 'var(--series-1)' }} /></span>
              <b className="pbar-n">{Math.round(o.champion * 100)}%</b>
            </div>
          );
        })}
      </div>
      <p className="small"><Link to="/projections">All playoff odds →</Link></p>
    </div>
  );
}

function ScoringRace({ season }: { season: number }) {
  const { data, error } = useAsync(() => fetchLeaders(season, 2, PTS), [season]);
  const rows = data?.rows.slice(0, 5) ?? [];
  return (
    <div className="card">
      <h3>Scoring leaders</h3>
      {error && <ErrorBox error={error} />}
      {!data && !error && <Loading />}
      <table>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.athleteId}>
              <td className="muted small">{i + 1}</td>
              <td className="left"><Link to={`/player/${r.athleteId}`}>{r.athlete}</Link> <span className="muted small">{r.team}</span></td>
              <td className="sorted">{r.values[PTS]} <span className="muted small">ppg</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small"><Link to="/leaders">All leaders →</Link></p>
    </div>
  );
}

function OnThisDayCard() {
  const today = new Date();
  const md = toISODate(today).slice(5);
  const days = useAsync(() => loadOnThisDay(), []);
  const yearAgo = addDays(toISODate(today), -365);
  const games = useAsync(() => fetchScoreboard(yearAgo).catch(() => []), [yearAgo]);
  const d = days.data?.[md];
  if (!d) return null;
  const link = (name: string) => `/history?tab=careers&p=${encodeURIComponent(name)}`;
  const finals = (games.data ?? []).filter((g) => g.state === 'post');
  const best = finals
    .flatMap((g) => [g.home, g.away].map((c) => ({ g, c, top: c.leaders.find((l) => /^(pts|points)$/i.test(l.category)) })))
    .filter((x) => x.top)
    .sort((a, b) => Number(b.top!.value) - Number(a.top!.value))[0];
  return (
    <div className="card">
      <h3>On this day</h3>
      <div className="muted small">{today.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}</div>
      <p className="small">
        <b>Born:</b>{' '}
        {d.born.slice(0, 5).map(([name, year, , hof], i) => (
          <span key={name}>
            {i > 0 && ', '}
            <Link to={link(name)}>{name}</Link> <span className="muted">({year}{hof ? ', Hall of Fame' : ''})</span>
          </span>
        ))}
      </p>
      {d.debut.length > 0 && (
        <p className="small">
          <b>NBA debuts:</b>{' '}
          {d.debut.slice(0, 3).map(([name, year], i) => (
            <span key={name}>
              {i > 0 && ', '}
              <Link to={link(name)}>{name}</Link> <span className="muted">({year})</span>
            </span>
          ))}
        </p>
      )}
      {finals.length > 0 && (
        <p className="small">
          <b>A year ago:</b> {finals.length} game{finals.length === 1 ? '' : 's'}
          {best && (
            <>
              {' '}· top scorer {best.top!.athlete} ({best.c.team.abbr}) with {best.top!.value} in{' '}
              <Link to={`/game/${best.g.id}`}>{best.g.away.team.abbr} {best.g.away.score} @ {best.g.home.team.abbr} {best.g.home.score}</Link>
            </>
          )}
        </p>
      )}
    </div>
  );
}

function NightCard({ season }: { season: number }) {
  const snap = seasonSnapshot(season);
  const night = snap?.nightly?.[0];
  if (!night) return null;
  const teams = new Map(snap.teams.map((t) => [t.id, t]));
  const name = (id: string) => snap.players?.[id] ?? id;
  const b = night.best[0];
  const l = b.line;
  return (
    <div className="card">
      <h3>Player of the night</h3>
      <div className="muted small">{formatDay(night.day)}</div>
      <div className="home-night">
        <div>
          <Link to={`/player/${b.playerId}`}><b>{name(b.playerId)}</b></Link> <span className="muted small">{teams.get(b.teamId)?.abbr} vs {teams.get(b.oppId)?.abbr} · {b.won ? 'W' : 'L'}</span>
          <div>
            <b>{l[L.pts]}</b> pts · <b>{l[L.oreb] + l[L.dreb]}</b> reb · <b>{l[L.ast]}</b> ast <span className="muted small">· {l[L.fgm]}/{l[L.fga]} FG</span>
          </div>
        </div>
        <span className="night-score" title="Game Score">{b.gmsc.toFixed(1)}</span>
      </div>
      {night.best.slice(1).map((x) => (
        <div key={x.playerId} className="muted small">
          also: <Link to={`/player/${x.playerId}`}>{name(x.playerId)}</Link> {x.line[L.pts]} pts, {x.line[L.oreb] + x.line[L.dreb]} reb, {x.line[L.ast]} ast
        </div>
      ))}
      <p className="small"><Link to="/insights?tab=night">Every night →</Link></p>
    </div>
  );
}

function AwardRace({ season }: { season: number }) {
  const snap = seasonSnapshot(season);
  const races = useMemo(() => {
    if (!snap) return [];
    const { list, leagueDrtg } = candidates(snap);
    return AWARDS.map((a) => ({ ...a, top: rankAward(a.id, list, leagueDrtg).filter((r) => r.eligible).slice(0, 3) }));
  }, [snap]);
  return (
    <div className="card">
      <h3>Awards race</h3>
      {races.every((r) => !r.top.length) && <p className="muted small">No games played yet.</p>}
      {races.map((r) =>
        r.top.length ? (
          <div key={r.id} className="home-award">
            <Link to={`/awards?award=${r.id}`} className="muted small">{r.short}</Link>
            <ol>
              {r.top.map((x) => (
                <li key={x.c.id}><Link to={`/player/${x.c.id}`}>{x.c.name}</Link></li>
              ))}
            </ol>
          </div>
        ) : null,
      )}
      <p className="small"><Link to="/awards">Full ladders →</Link></p>
    </div>
  );
}

function stored(key: string): Record<string, unknown> | undefined {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : undefined;
  } catch {
    return undefined;
  }
}

/** Today's daily puzzles and whether they've been started or finished on this device. */
function Puzzles() {
  const day = todayKey();
  const grid = stored(`grid-${day}`) as { picks?: (number | null)[]; guessesLeft?: number; gaveUp?: boolean } | undefined;
  const connect = stored(`connect-${day}`) as { chain?: number[]; gaveUp?: boolean } | undefined;
  const guess = stored(`guess-${day}`) as { guesses?: number[]; done?: boolean } | undefined;
  const statline = stored(`statline-${day}`) as { guesses?: number[]; done?: boolean } | undefined;
  const trivia = stored(`trivia-${day}`) as unknown as number[] | undefined;
  const gridFilled = grid?.picks?.filter((p) => p != null).length ?? 0;
  const items = [
    { tab: 'grid', label: 'Played for both', status: grid?.gaveUp || grid?.guessesLeft === 0 || gridFilled === 9 ? `Done · ${gridFilled}/9` : gridFilled ? `${gridFilled}/9 so far` : 'Not started' },
    { tab: 'connect', label: 'Connect the players', status: connect?.gaveUp ? 'Gave up' : (connect?.chain?.length ?? 0) > 1 ? `${connect!.chain!.length - 1} links so far` : 'Not started' },
    { tab: 'guess', label: 'Guess the player', status: guess?.done ? 'Done' : guess?.guesses?.length ? `${guess.guesses.length}/6 guesses` : 'Not started' },
    { tab: 'trivia', label: 'Trivia', status: trivia?.length ? (trivia.length >= 5 ? 'Done' : `${trivia.length}/5 answered`) : 'Not started' },
    { tab: 'statline', label: 'Who am I?', status: statline?.done ? 'Done' : statline?.guesses?.length ? `${statline.guesses.length}/6 guesses` : 'Not started' },
  ];
  return (
    <div className="card">
      <h3>Today's puzzles</h3>
      <div className="home-puzzles">
        {items.map((it) => (
          <Link key={it.tab} to={`/games?tab=${it.tab}`} className="home-puzzle">
            <b>{it.label}</b>
            <span className={it.status === 'Not started' ? 'muted small' : 'small'}>{it.status}</span>
          </Link>
        ))}
        <Link to="/games?tab=higher" className="home-puzzle">
          <b>Higher or lower</b>
          <span className="muted small">Endless</span>
        </Link>
      </div>
    </div>
  );
}
