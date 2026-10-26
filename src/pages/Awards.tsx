import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { seasonSnapshot } from '../api/espn';
import { loadSnapshot } from '../api/snapshotStore';
import { useAsync } from '../hooks/useAsync';
import { AwardTimeline } from '../components/AwardTimeline';
import { RookieLadder } from '../components/PlayerExtras';
import { Empty } from '../components/Status';
import { TeamLogo } from '../components/TeamLogo';
import { ACTUAL, actualVotes, awardOdds, AWARDS, candidates, MIN_GAMES_SHARE, rankAward, type AwardId, type Ranked } from '../lib/awards';
import { nameKey } from '../lib/boxTotals';
import { useSeason } from '../SeasonContext';

const SHOW = 15;

const METHOD: Record<AwardId, string> = {
  mvp: 'Game Score per game (a one-number box-score rating), scaled down for missed games, plus team win % (30 × above .500), plus-minus per game (× 0.25) and on/off net rating (× 0.1). Needs 20+ minutes a game and the 65-game minimum (pro-rated during the season).',
  dpoy:
    'Steals (× 2.2) and blocks (× 2.4) per game, defensive rebounds (× 0.3), how many fewer points per 48 the team allows with them on court (× 0.2), and the team’s defensive rating against the league (weighted by their minutes). A small deduction per point scored nudges it towards defensive specialists, as voters do. Needs 24+ minutes and the 65-game minimum.',
  roy: 'First-year players only. Game Score per game, scaled down for missed games, plus minutes per game (× 0.1) and a little for team record. Needs 12+ minutes a game.',
};

export function Awards() {
  const { season } = useSeason();
  const [params, setParams] = useSearchParams();
  const award = (AWARDS.find((a) => a.id === params.get('award'))?.id ?? 'mvp') as AwardId;
  const snap = seasonSnapshot(season.year);
  const model = useMemo(() => (snap ? candidates(snap) : undefined), [snap]);
  const ranked = useMemo(() => (model ? rankAward(award, model.list, model.leagueDrtg) : []), [model, award]);
  const teams = new Map((snap?.teams ?? []).map((t) => [t.id, t]));
  const actual = actualVotes(season.year, award);
  const info = AWARDS.find((a) => a.id === award)!;

  const eligible = ranked.filter((r) => r.eligible).slice(0, SHOW);
  const cutoff = eligible[eligible.length - 1]?.score ?? Infinity;
  const short = ranked.filter((r) => !r.eligible && r.score > cutoff).slice(0, 5);
  const best = eligible[0]?.score ?? 1;
  const games = model?.list.length ? Math.max(...model.list.map((c) => c.teamGames)) : 0;
  const done = snap?.complete !== false;
  // Last season's model scores steady the odds early on.
  const prevSnap = useAsync(() => (done ? Promise.resolve(undefined) : loadSnapshot(season.year - 1)), [season.year, done]).data;
  const prior = useMemo(() => {
    if (!prevSnap || award === 'roy') return undefined;
    const prev = candidates(prevSnap);
    return new Map(rankAward(award, prev.list, prev.leagueDrtg).map((r) => [r.c.id, r.score]));
  }, [prevSnap, award]);
  const odds = useMemo(() => (done ? undefined : awardOdds(ranked, award, prior)), [ranked, award, done, prior]);

  return (
    <section>
      <h1>{season.label} awards race</h1>
      <div className="tabs">
        {AWARDS.map((a) => (
          <button key={a.id} className={a.id === award ? 'active' : ''} onClick={() => setParams({ award: a.id }, { replace: true })}>{a.name}</button>
        ))}
      </div>
      {!model?.list.length ? (
        <Empty>No box-score totals for this season yet.</Empty>
      ) : (
        <>
          <p className="muted">
            {done ? `The model's final ${info.short} ladder for ${season.label}.` : `The model's ${info.short} ladder so far, ${games} game${games === 1 ? '' : 's'} into the season. Early on, a hot week moves it a lot.`}
            {actual ? ' Real voting results are alongside for comparison.' : done ? ' Real voting for this season isn’t in our data source yet.' : ''}
          </p>
          <div className="table-wrap">
            <table className="awards-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th className="left">Player</th>
                  <th className="hide-sm">G</th>
                  {award === 'dpoy' ? (
                    <>
                      <th>STL</th>
                      <th>BLK</th>
                      <th className="hide-sm">DREB</th>
                      <th title="Points per 48 the team allows with them off court minus on court">On/off D</th>
                    </>
                  ) : (
                    <>
                      <th>PTS</th>
                      <th>REB</th>
                      <th>AST</th>
                      <th className="hide-sm">TS%</th>
                    </>
                  )}
                  <th className="hide-sm">Team</th>
                  <th className="left">Model score</th>
                  {odds && <th title="Chance of finishing first, from simulating the rest of the season">Win odds</th>}
                  {actual && <th title="Share of the maximum voting points, and finishing place">Real vote</th>}
                </tr>
              </thead>
              <tbody>
                {eligible.map((r, i) => (
                  <Row key={r.c.id} r={r} rank={i + 1} best={best} award={award} team={teams.get(r.c.teamId)} actual={actual?.get(nameKey(r.c.name))} showActual={!!actual} odds={odds?.get(r.c.id) ?? (odds ? 0 : undefined)} />
                ))}
              </tbody>
            </table>
          </div>
          {odds && <p className="muted small">Win odds: each player's expected score blends this season with last season (leaning on this season more as games are played), then the rest of the season is simulated 4,000 times with random swings that shrink as fewer games are left. Players who can no longer reach the games minimum are out.</p>}
          {short.length > 0 && (
            <p className="muted small">
              Would rank higher but {done ? 'missed' : 'are behind'} the 65-game minimum ({Math.floor(MIN_GAMES_SHARE * games)} of {games} so far):{' '}
              {short.map((r, i) => (
                <span key={r.c.id}>
                  {i > 0 && ', '}
                  <Link to={`/player/${r.c.id}`}>{r.c.name}</Link> ({r.c.gp} g)
                </span>
              ))}
              .
            </p>
          )}
          {actual && <Missed season={season.year} award={award} shown={new Set(eligible.map((r) => nameKey(r.c.name)))} />}
          {snap && <AwardTimeline snap={snap} award={award} />}
          {award === 'roy' && <RookieLadder season={season.year} />}
          <div className="card">
            <h3>How the model works</h3>
            <p className="small">{METHOD[award]}</p>
            <p className="muted small">
              Built from every regular-season box score and play-by-play substitution in our bundled season data, refreshed daily. It’s deliberately simple:
              voters also weigh narrative, health and fatigue with past winners, which no box score captures. On 2024-25 it had the real MVP and Rookie of
              the Year on top.
            </p>
          </div>
        </>
      )}
    </section>
  );
}

function Missed({ season, award, shown }: { season: number; award: AwardId; shown: Set<string> }) {
  const missing = (ACTUAL[season]?.[award] ?? []).map(([name], i) => ({ name, rank: i + 1 })).filter((r) => !shown.has(nameKey(r.name))).slice(0, 4);
  if (!missing.length) return null;
  return <p className="muted small">Real vote-getters outside the model's top {SHOW}: {missing.map((r) => `${r.name} (${r.rank}${['st', 'nd', 'rd'][r.rank - 1] ?? 'th'})`).join(', ')}.</p>;
}

function Row({ r, rank, best, award, team, actual, showActual, odds }: { r: Ranked; rank: number; best: number; award: AwardId; team?: { id: string; name: string; shortName: string; abbr: string; logo?: string }; actual?: { share: number; rank: number }; showActual: boolean; odds?: number }) {
  const c = r.c;
  const f1 = (v: number | undefined) => (v == null ? '–' : v.toFixed(1));
  const why = r.parts.filter((p) => Math.abs(p.value) >= 0.5).sort((a, b) => b.value - a.value).map((p) => `${p.label} ${p.value > 0 ? '+' : ''}${p.value.toFixed(1)}`).join(' · ');
  return (
    <tr>
      <td>{rank}</td>
      <td className="left nowrap">
        <Link to={`/player/${c.id}`}>{c.name}</Link>
      </td>
      <td className="hide-sm">{c.gp}</td>
      {award === 'dpoy' ? (
        <>
          <td>{f1(c.spg)}</td>
          <td>{f1(c.bpg)}</td>
          <td className="hide-sm">{f1(c.drpg)}</td>
          <td>{c.onOffDef == null ? '–' : `${c.onOffDef > 0 ? '+' : ''}${c.onOffDef.toFixed(1)}`}</td>
        </>
      ) : (
        <>
          <td>{f1(c.ppg)}</td>
          <td>{f1(c.rpg)}</td>
          <td>{f1(c.apg)}</td>
          <td className="hide-sm">{c.ts == null ? '–' : (c.ts * 100).toFixed(1)}</td>
        </>
      )}
      <td className="hide-sm nowrap">
        {team && (
          <Link to={`/team/${team.id}`}>
            <TeamLogo team={team} size={18} /> {team.abbr}
          </Link>
        )}{' '}
        <span className="muted small">{award === 'dpoy' ? `DRtg ${c.teamDrtg.toFixed(1)}` : c.winPct.toFixed(3).replace(/^0/, '')}</span>
      </td>
      <td className="left award-score" title={why}>
        <span className="pbar-track"><span className="pbar-fill" style={{ width: `${Math.max(0, r.score / best) * 100}%`, background: 'var(--series-1)' }} /></span>
        <b>{r.score.toFixed(1)}</b>
      </td>
      {odds != null && <td className={odds >= 0.2 ? 'strong' : odds < 0.01 ? 'muted' : undefined}>{odds < 0.01 ? '<1%' : `${Math.round(odds * 100)}%`}</td>}
      {showActual && <td>{actual ? `${Math.round(actual.share * 100)}% · #${actual.rank}` : <span className="muted">–</span>}</td>}
    </tr>
  );
}
