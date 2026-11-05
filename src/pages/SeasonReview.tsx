// Season review: a finished season (or the one in progress, so far) on one
// page: champion and its path, best records, who beat expectations, award
// winners against the model, the biggest upsets, best games and leaders.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { fetchLeagueGames, loadSnapshot, seasonSnapshot } from '../api/espn';
import { useCareers } from '../components/CareerStats';
import { Empty, Loading } from '../components/Status';
import { TeamLogo } from '../components/TeamLogo';
import { useAsync } from '../hooks/useAsync';
import { candidates, rankAward } from '../lib/awards';
import { expectedWins, rankClutch, rankMostImproved, rankSixthMan } from '../lib/awardsMore';
import { nameKey } from '../lib/boxTotals';
import { formatShortDate } from '../lib/dates';
import { countsInStandings, isFinal } from '../lib/league';
import { carryOver, runElo } from '../lib/projections';
import { bestGames, biggestUpsets, championPath, leaders } from '../lib/seasonReview';
import { useTeammateGraph } from '../lib/teammateStore';
import { useSeason } from '../SeasonContext';

type TeamLite = { id: string; abbr: string; name: string; shortName: string; logo?: string };

const AWARD_ROWS: { key: string; label: string; model: 'mvp' | 'dpoy' | 'roy' | 'sixth' | 'mip' | 'clutch' }[] = [
  { key: 'nba mvp', label: 'MVP', model: 'mvp' },
  { key: 'nba dpoy', label: 'Defensive Player', model: 'dpoy' },
  { key: 'nba roy', label: 'Rookie of the Year', model: 'roy' },
  { key: 'nba smoy', label: 'Sixth Man', model: 'sixth' },
  { key: 'nba mip', label: 'Most Improved', model: 'mip' },
  { key: 'nba clutch_poy', label: 'Clutch Player', model: 'clutch' },
];

export function SeasonReview() {
  const { season } = useSeason();
  const data = useAsync(async () => {
    const [reg, po, prev, prevSnap] = await Promise.all([
      fetchLeagueGames(season.year, 2),
      fetchLeagueGames(season.year, 3).catch(() => ({ games: [] })),
      fetchLeagueGames(season.year - 1, 2).catch(() => undefined),
      loadSnapshot(season.year - 1).catch(() => undefined),
    ]);
    return { reg: reg.games, po: po.games, prev: prev?.games, prevSnap };
  }, [season.year]);
  const snap = seasonSnapshot(season.year);
  const careers = useCareers();
  const graph = useTeammateGraph();

  const review = useMemo(() => {
    if (!data.data || !snap) return undefined;
    const { reg, po, prev, prevSnap } = data.data;
    const played = reg.filter((g) => isFinal(g) && countsInStandings(g));
    const record = new Map<string, [number, number]>();
    for (const g of played) {
      const homeWon = (g.home.score ?? 0) > (g.away.score ?? 0);
      for (const [id, won] of [[g.home.team.id, homeWon], [g.away.team.id, !homeWon]] as const) {
        const r = record.get(id) ?? [0, 0];
        r[won ? 0 : 1]++;
        record.set(id, r);
      }
    }
    const exp = expectedWins(reg, prev);
    const vsExp = [...record].map(([id, [w, l]]) => ({ id, w, l, diff: w - (exp.get(id) ?? (w + l) / 2) })).sort((a, b) => b.diff - a.diff);
    const start = prev ? carryOver(runElo(prev).ratings) : new Map<string, number>();
    const elo = runElo(reg, start);
    const box = snap.box?.['2'];
    const { list, leagueDrtg } = candidates(snap);
    const prevList = prevSnap ? candidates(prevSnap).list : [];
    const clutch = snap.clutch?.['2'];
    const modelTop: Record<string, string | undefined> = {
      mvp: rankAward('mvp', list, leagueDrtg).find((r) => r.eligible)?.c.name,
      dpoy: rankAward('dpoy', list, leagueDrtg).find((r) => r.eligible)?.c.name,
      roy: rankAward('roy', list, leagueDrtg).find((r) => r.eligible)?.c.name,
      sixth: rankSixthMan(list)[0]?.c.name,
      mip: prevList.length ? rankMostImproved(list, prevList).find((r) => r.eligible)?.c.name : undefined,
      clutch: clutch ? rankClutch(list, clutch.players, clutch.teams)[0]?.c.name : undefined,
    };
    const teamGames = Math.max(0, ...[...record.values()].map(([w, l]) => w + l));
    return {
      played: played.length,
      total: reg.filter(countsInStandings).length,
      champion: championPath(po),
      records: [...record].sort((a, b) => b[1][0] / (b[1][0] + b[1][1]) - a[1][0] / (a[1][0] + a[1][1])),
      vsExp,
      upsets: biggestUpsets(elo.predictions),
      games: bestGames(snap.drama?.['2'] ?? []),
      gameById: new Map(reg.map((g) => [g.id, g])),
      modelTop,
      leaders: box
        ? (['pts', 'reb', 'ast', 'stl', 'blk'] as const).map((k) => ({ k, rows: leaders(box.players, teamGames, k) }))
        : [],
    };
  }, [data.data, snap]);

  if (data.loading) return <Loading />;
  if (!snap || !review || !review.played) return <section><h1>{season.label} season review</h1><Empty>No games in this season’s data yet.</Empty></section>;
  const teams = new Map(snap.teams.map((t) => [t.id, t as TeamLite]));
  const names = snap.players ?? {};
  const team = (id: string) => {
    const t = teams.get(id);
    return t ? <Link to={`/team/${t.id}`} className="team-cell"><TeamLogo team={t} size={18} />{t.abbr}</Link> : id;
  };
  const done = review.played >= review.total && review.total > 0;
  const realWinner = (key: string) => {
    const row = careers.data?.awards[key]?.find((r) => r[0] === season.year && r[3]);
    return row && graph?.data.players[row[1]]?.[0];
  };
  const STAT_LABEL = { pts: 'Points', reb: 'Rebounds', ast: 'Assists', stl: 'Steals', blk: 'Blocks' };

  return (
    <section>
      <h1>{season.label} season review</h1>
      <p className="muted">{done ? 'The whole season on one page.' : `The season so far: ${review.played.toLocaleString()} of ${review.total.toLocaleString()} regular-season games played.`}</p>

      {review.champion && (
        <div className="card review-champ">
          <h2>🏆 Champions: {teams.get(review.champion.championId)?.name}</h2>
          <p>
            {review.champion.series.map((s, i) => (
              <span key={s.opponentId}>
                {i > 0 && ' → '}
                beat {teams.get(s.opponentId)?.abbr} {s.wins}-{s.losses}
              </span>
            ))}
          </p>
        </div>
      )}

      <div className="two-col">
        <div className="card">
          <h3>Best and worst records</h3>
          <ol className="review-list">
            {review.records.slice(0, 5).map(([id, [w, l]]) => (
              <li key={id}>{team(id)} {w}-{l}</li>
            ))}
          </ol>
          <p className="muted small">Bottom: {review.records.slice(-3).reverse().map(([id, [w, l]]) => `${teams.get(id)?.abbr} ${w}-${l}`).join(', ')}</p>
        </div>
        <div className="card">
          <h3>Against expectations</h3>
          <p className="muted small">Wins against what each team’s rating going into the season predicted.</p>
          <ol className="review-list">
            {review.vsExp.slice(0, 3).map((r) => (
              <li key={r.id}>{team(r.id)} <span className="win">+{r.diff.toFixed(1)}</span> <span className="muted small">({r.w}-{r.l})</span></li>
            ))}
          </ol>
          <ol className="review-list">
            {review.vsExp.slice(-3).reverse().map((r) => (
              <li key={r.id}>{team(r.id)} <span className="loss">−{Math.abs(r.diff).toFixed(1)}</span> <span className="muted small">({r.w}-{r.l})</span></li>
            ))}
          </ol>
        </div>
      </div>

      <div className="table-wrap">
        <h3 className="table-title">Awards</h3>
        <table>
          <thead>
            <tr>
              <th className="left">Award</th>
              <th className="left">Winner</th>
              <th className="left">Our model’s pick</th>
            </tr>
          </thead>
          <tbody>
            {AWARD_ROWS.map((a) => {
              const real = done ? realWinner(a.key) : undefined;
              const model = review.modelTop[a.model];
              const same = real && model && nameKey(real) === nameKey(model);
              return (
                <tr key={a.key}>
                  <td className="left"><Link to={`/awards?award=${a.model}`}>{a.label}</Link></td>
                  <td className="left">{real ?? <span className="muted">{done ? 'not in our data yet' : 'season in progress'}</span>}</td>
                  <td className="left">{model ?? '–'} {same ? <span className="win" aria-label="matches">✓</span> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="two-col">
        <div className="card">
          <h3>Most dramatic games</h3>
          <ol className="review-list">
            {review.games.map((g) => {
              const game = review.gameById.get(g.gameId);
              return (
                <li key={g.gameId}>
                  <Link to={`/game/${g.gameId}`}>{game ? `${game.away.team.abbr} ${game.away.score} @ ${game.home.team.abbr} ${game.home.score}` : g.gameId}</Link>{' '}
                  <span className="muted small">{game && formatShortDate(game.date)}{g.comeback >= 10 ? ` · ${g.comeback}-point comeback` : ''}</span>
                </li>
              );
            })}
          </ol>
        </div>
        <div className="card">
          <h3>Biggest upsets</h3>
          <ol className="review-list">
            {review.upsets.map((u) => {
              const g = u.game;
              return (
                <li key={g.id}>
                  <Link to={`/game/${g.id}`}>{teams.get(u.winnerId)?.abbr} beat {u.winnerId === g.home.team.id ? g.away.team.abbr : g.home.team.abbr}</Link>{' '}
                  <span className="muted small">{g.away.score}-{g.home.score} · had a {Math.round(u.chance * 100)}% chance · {formatShortDate(g.date)}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {review.leaders.length > 0 && (
        <div className="table-wrap">
          <h3 className="table-title">Per-game leaders</h3>
          <table>
            <thead>
              <tr>
                <th className="left">Stat</th>
                <th className="left">1st</th>
                <th className="left">2nd</th>
                <th className="left hide-sm">3rd</th>
              </tr>
            </thead>
            <tbody>
              {review.leaders.map(({ k, rows }) => (
                <tr key={k}>
                  <td className="left">{STAT_LABEL[k]}</td>
                  {rows.map((r, i) => (
                    <td key={r.id} className={`left${i === 2 ? ' hide-sm' : ''}`}>
                      <Link to={`/player/${r.id}`}>{names[r.id] ?? r.id}</Link> <b>{r.value.toFixed(1)}</b> <span className="muted small">{teams.get(r.teamId)?.abbr}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">Players with 58+ games (scaled to the games played so far).</p>
        </div>
      )}
      <p className="muted small">Pick another season with the season menu at the top. Every part links through to the full page it comes from.</p>
    </section>
  );
}
