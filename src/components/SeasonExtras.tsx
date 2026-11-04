// Games lost to injury, roster continuity, the model's report card, your power
// poll, comebacks and collapses, and rest splits.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadSnapshot, seasonSnapshot } from '../api/espn';
import { loadLines } from '../api/linesStore';
import { useAsync } from '../hooks/useAsync';
import { playerAdvanced } from '../lib/advanced';
import { L, type SeasonLines } from '../lib/boxTotals';
import { formatShortDate } from '../lib/dates';
import { pct1, signed } from '../lib/format';
import { isFinal } from '../lib/league';
import { steadyWsPerGame } from '../lib/projections';
import { absences, backToBackDrops, continuity, modelReport, restSplits, swings } from '../lib/seasonExtras';
import type { Model } from '../pages/Projections';
import { useTeamSeasons } from './TeamAnalytics';
import { Empty, Loading } from './Status';
import { TeamLogo } from './TeamLogo';

const rec = ([w, l]: [number, number]) => `${w}-${l}`;

function useTeams(season: number) {
  const snap = seasonSnapshot(season);
  return { teams: new Map((snap?.teams ?? []).map((t) => [t.id, t])), names: snap?.players ?? {} };
}

function TeamCell({ team }: { team?: { id: string; abbr: string; name: string; shortName: string; logo?: string } }) {
  return team ? <Link to={`/team/${team.id}`} className="team-cell"><TeamLogo team={team} size={18} />{team.abbr}</Link> : null;
}

/** Rankings → Injuries: games each team's players have missed and what they were worth. */
export function InjuryTable({ season }: { season: number }) {
  const lines = useAsync(() => loadLines(season), [season]);
  const seasons = useTeamSeasons(season, 2);
  const { teams, names } = useTeams(season);
  const rows = useMemo(() => {
    const box = seasonSnapshot(season)?.box?.['2'];
    if (!lines.data || !seasons.data || !box) return undefined;
    const ws = new Map(playerAdvanced(box, seasons.data.seasons).map((p) => [p.id, steadyWsPerGame(p.ws, p.g)]));
    return absences(lines.data, ws);
  }, [lines.data, seasons.data, season]);
  if (!rows) return <Loading />;
  return (
    <>
      <p className="muted">Games each team's players have missed, and what those players were worth: Win Shares per game played (shrunk while the sample is small) × games missed. Only games between a player's first and last appearance for the team count, so trades and late signings don't; coach's decisions and rest days count as missed.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th className="left">Team</th>
              <th title="Player-games missed">Games missed</th>
              <th title="Win Shares lost to absences">Wins lost</th>
              <th className="left">Biggest absences (games missed · team record with / without)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => (
              <tr key={t.teamId}>
                <td>{i + 1}</td>
                <td className="left"><TeamCell team={teams.get(t.teamId)} /></td>
                <td>{t.missed}</td>
                <td><b>{t.wsLost.toFixed(1)}</b></td>
                <td className="left small">
                  {t.players.filter((p) => p.missed > 0).slice(0, 2).map((p, k) => (
                    <span key={p.playerId}>{k > 0 && ' · '}<Link to={`/player/${p.playerId}`}>{names[p.playerId] ?? p.playerId}</Link> {p.missed} <span className="muted">({rec(p.withRec)} / {rec(p.withoutRec)})</span></span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Rankings → Continuity: how much of last season's minutes each team kept, against how it has done since. */
export function ContinuityTable({ season }: { season: number }) {
  const data = useAsync(async () => Promise.all([loadLines(season - 1), loadLines(season), loadSnapshot(season - 1)]), [season]);
  const { teams, names } = useTeams(season);
  const prevNames = data.data?.[2]?.players ?? {};
  const rows = useMemo(() => {
    const [prev, now] = data.data ?? [];
    if (!prev || !now) return undefined;
    const winPct = (lines: SeasonLines) => {
      const r = new Map<string, [number, number]>();
      for (const g of lines.games) {
        if (g[2] !== 2) continue;
        let h = 0;
        let a = 0;
        for (const l of g[6]) (l[L.home] ? (h += l[L.pts]) : (a += l[L.pts]));
        for (const [t, won] of [[g[3], h > a], [g[4], a > h]] as const) {
          const x = r.get(t) ?? [0, 0];
          x[won ? 0 : 1]++;
          r.set(t, x);
        }
      }
      return new Map([...r].map(([t, [w, l]]) => [t, w / Math.max(1, w + l)]));
    };
    const before = winPct(prev);
    const after = winPct(now);
    return continuity(prev, now).map((c) => ({ ...c, before: before.get(c.teamId) ?? 0, after: after.get(c.teamId) ?? 0 }));
  }, [data.data]);
  if (data.loading) return <Loading />;
  if (!rows) return <Empty>Needs this season's and last season's box scores.</Empty>;
  const kept = rows.slice(0, 10);
  const changed = rows.slice(-10);
  const avg = (xs: typeof rows) => xs.reduce((a, r) => a + (r.after - r.before), 0) / xs.length;
  return (
    <>
      <p className="muted">Share of last season's minutes played by players who have also played for the team this season. The ten most settled teams have changed their win % by {signed(avg(kept) * 100)} points on average; the ten most changed by {signed(avg(changed) * 100)}.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th className="left">Team</th>
              <th>Minutes kept</th>
              <th>Win % last season</th>
              <th>Win % now</th>
              <th className="left">Biggest departures (last season's minutes)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.teamId}>
                <td>{i + 1}</td>
                <td className="left"><TeamCell team={teams.get(r.teamId)} /></td>
                <td>
                  <span className="cont-bar" aria-hidden><span style={{ width: `${r.share * 100}%` }} /></span> {pct1(r.share)}
                </td>
                <td className="muted">{r.before.toFixed(3).replace(/^0/, '')}</td>
                <td className={r.after > r.before ? 'win' : r.after < r.before ? 'loss' : undefined}>{r.after.toFixed(3).replace(/^0/, '')}</td>
                <td className="left small">{r.gone.map((g) => `${prevNames[g.playerId] ?? names[g.playerId] ?? g.playerId} (${Math.round(g.minutes).toLocaleString()})`).join(', ') || '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Projections → Model report card: each team against the model's pre-game chances, and how often the model was right. */
export function ModelReportCard({ model }: { model: Model }) {
  const report = useMemo(
    () =>
      modelReport(
        model.elo.predictions
          .filter(({ game }) => isFinal(game))
          .map(({ game, pHome }) => ({ home: game.home.team.id, away: game.away.team.id, date: game.date, pHome, homeWon: (game.home.score ?? 0) > (game.away.score ?? 0) })),
      ),
    [model],
  );
  const team = new Map(model.teams.map((t) => [t.id, t]));
  if (!report.overall.games) return <Empty>No games yet.</Empty>;
  const o = report.overall;
  return (
    <>
      <div className="stat-tiles">
        <div className="tile"><div className="tile-value">{pct1(o.correct / o.games)}</div><div className="tile-label">Winners picked ({o.correct} of {o.games})</div></div>
        <div className="tile"><div className="tile-value">{o.brier.toFixed(3)}</div><div className="tile-label">Brier score (0 is perfect, 0.25 a coin flip)</div></div>
      </div>
      <div className="two-col">
        <div className="table-wrap">
          <h3 className="table-title">Against the model</h3>
          <table>
            <thead>
              <tr>
                <th className="left">Team</th>
                <th>W-L</th>
                <th title="Wins the model expected from its pre-game chances">Expected W</th>
                <th>Beat it by</th>
                <th>As favourite</th>
                <th>As underdog</th>
              </tr>
            </thead>
            <tbody>
              {report.teams.map((t) => (
                <tr key={t.teamId}>
                  <td className="left"><TeamCell team={team.get(t.teamId)} /></td>
                  <td>{t.wins}-{t.games - t.wins}</td>
                  <td className="muted">{t.expected.toFixed(1)}</td>
                  <td className={t.wins - t.expected >= 0.5 ? 'win' : t.wins - t.expected <= -0.5 ? 'loss' : 'muted'}>{signed(t.wins - t.expected)}</td>
                  <td>{rec(t.asFavourite)}</td>
                  <td>{rec(t.asUnderdog)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-wrap">
          <h3 className="table-title">By month</h3>
          <table>
            <thead>
              <tr>
                <th className="left">Month</th>
                <th>Games</th>
                <th>Right</th>
                <th>Brier</th>
              </tr>
            </thead>
            <tbody>
              {report.months.map((m) => (
                <tr key={m.month}>
                  <td className="left">{new Date(`${m.month}-15T12:00:00Z`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</td>
                  <td>{m.games}</td>
                  <td>{pct1(m.correct / m.games)}</td>
                  <td className="muted">{m.brier.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">Each game's chance is the model's before tip-off (Elo with home court), using only results up to then. Beating it means winning more than those chances added up to.</p>
        </div>
      </div>
    </>
  );
}

/** Projections → Your power poll: rank the teams yourself and compare with the model. */
export function PowerPoll({ model, season }: { model: Model; season: number }) {
  const key = `nba-power-poll-${season}`;
  const modelOrder = useMemo(() => [...model.teams].sort((a, b) => (model.elo.ratings.get(b.id) ?? 0) - (model.elo.ratings.get(a.id) ?? 0)).map((t) => t.id), [model]);
  const [order, setOrder] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? '[]') as string[];
      if (saved.length === modelOrder.length && saved.every((id) => modelOrder.includes(id))) return saved;
    } catch {
      /* fall through */
    }
    return modelOrder;
  });
  const [drag, setDrag] = useState<number | undefined>();
  const save = (next: string[]) => {
    setOrder(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* storage blocked */
    }
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    const [id] = next.splice(from, 1);
    next.splice(to, 0, id);
    save(next);
  };
  const team = new Map(model.teams.map((t) => [t.id, t]));
  const modelRank = new Map(modelOrder.map((id, i) => [id, i + 1]));
  const diffs = order.map((id, i) => ({ id, d: (modelRank.get(id) ?? 0) - (i + 1) }));
  const higher = [...diffs].sort((a, b) => b.d - a.d).filter((x) => x.d > 0).slice(0, 3);
  const lower = [...diffs].sort((a, b) => a.d - b.d).filter((x) => x.d < 0).slice(0, 3);
  return (
    <>
      <p className="muted">Drag teams (or use the arrows) into your own order, best first. It's saved in this browser; the model's rank is its Elo power rating.</p>
      {(higher.length > 0 || lower.length > 0) && (
        <p className="small">
          {higher.length > 0 && <>You're higher than the model on <b>{higher.map((x) => `${team.get(x.id)?.abbr} (+${x.d})`).join(', ')}</b>. </>}
          {lower.length > 0 && <>Lower on <b>{lower.map((x) => `${team.get(x.id)?.abbr} (${x.d})`).join(', ')}</b>.</>}
        </p>
      )}
      <ol className="poll">
        {order.map((id, i) => {
          const t = team.get(id);
          const d = (modelRank.get(id) ?? 0) - (i + 1);
          return (
            <li
              key={id}
              draggable
              onDragStart={() => setDrag(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (drag !== undefined) move(drag, i);
                setDrag(undefined);
              }}
              className={drag === i ? 'dragging' : undefined}
            >
              <span className="poll-rank">{i + 1}</span>
              <TeamCell team={t} />
              <span className="small muted poll-model">model {modelRank.get(id)}{d ? <span className={d > 0 ? 'win' : 'loss'}> ({d > 0 ? '+' : ''}{d})</span> : null}</span>
              <span className="poll-move">
                <button className="chip" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move ${t?.name} up`}>↑</button>
                <button className="chip" onClick={() => move(i, i + 1)} disabled={i === order.length - 1} aria-label={`Move ${t?.name} down`}>↓</button>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="small"><button className="link" onClick={() => save(modelOrder)}>Start again from the model's order</button></p>
    </>
  );
}

/** Team page: the season's biggest comebacks and blown leads. */
export function ComebacksCard({ teamId, season }: { teamId: string; season: number }) {
  const snap = seasonSnapshot(season);
  const drama = snap?.drama?.['2'];
  const s = useMemo(() => (drama && snap ? swings(drama, snap.games['2'], teamId) : undefined), [drama, snap, teamId]);
  if (!s || (!s.comebacks.length && !s.collapses.length)) return null;
  const teams = new Map((snap?.teams ?? []).map((t) => [t.id, t]));
  const list = (xs: typeof s.comebacks, verb: string) => (
    <ul className="recap-list small">
      {xs.map((x) => (
        <li key={x.gameId}>
          <Link to={`/game/${x.gameId}`}>{verb} {x.margin}</Link> {x.home ? 'v' : '@'} {teams.get(x.opponentId)?.abbr} <span className="muted">· {x.score} · {formatShortDate(x.date)}</span>
        </li>
      ))}
      {!xs.length && <li className="muted">None this season.</li>}
    </ul>
  );
  return (
    <div className="card">
      <h3>Comebacks and collapses</h3>
      <div className="two-col">
        <div><h4>Biggest comebacks</h4>{list(s.comebacks, 'Won from')}</div>
        <div><h4>Biggest blown leads</h4>{list(s.collapses, 'Lost a lead of')}</div>
      </div>
      <p className="muted small">The largest deficit overcome in each win, and the largest lead let slip in each loss, from the play-by-play.</p>
    </div>
  );
}

/** Player page: per-game numbers on back-to-backs, one day off and two or more. */
export function RestCard({ playerId, season }: { playerId: string; season: number }) {
  const lines = useAsync(() => loadLines(season), [season]);
  const splits = useMemo(() => (lines.data ? restSplits(lines.data, playerId) : []), [lines.data, playerId]);
  if (splits.length < 2) return null;
  return (
    <div className="card">
      <h3>Rest and fatigue</h3>
      <div className="table-wrap flush">
        <table>
          <thead>
            <tr>
              <th className="left">Rest before the game</th>
              <th>G</th>
              <th>MIN</th>
              <th>PTS</th>
              <th>TS%</th>
            </tr>
          </thead>
          <tbody>
            {splits.map((s) => (
              <tr key={s.label}>
                <td className="left">{s.label}</td>
                <td>{s.games}</td>
                <td>{s.min.toFixed(1)}</td>
                <td>{s.pts.toFixed(1)}</td>
                <td>{pct1(s.ts)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">Regular season. A back-to-back is a game the day after the team's last one.</p>
    </div>
  );
}

/** Insights → Rest & fatigue: who drops off most (and least) on back-to-backs. */
export function BackToBackTable({ season }: { season: number }) {
  const lines = useAsync(() => loadLines(season), [season]);
  const [by, setBy] = useState<'pts' | 'ts'>('pts');
  const rows = useMemo(() => (lines.data ? backToBackDrops(lines.data) : undefined), [lines.data]);
  const { teams, names } = useTeams(season);
  if (!rows) return <Loading />;
  if (!rows.length) return <Empty>Not enough back-to-backs yet this season.</Empty>;
  const diff = (r: (typeof rows)[number]) => (by === 'pts' ? r.b2b.pts - r.rested.pts : r.b2b.ts - r.rested.ts);
  const sorted = [...rows].sort((a, b) => diff(a) - diff(b));
  const teamOf = (id: string) => {
    const box = seasonSnapshot(season)?.box?.['2'];
    return teams.get((box?.players.find((r) => r[0] === id)?.[1] as string) ?? '');
  };
  const table = (title: string, list: typeof rows) => (
    <div className="table-wrap">
      <h3 className="table-title">{title}</h3>
      <table>
        <thead>
          <tr>
            <th className="left">Player</th>
            <th>B2B G</th>
            <th>{by === 'pts' ? 'PTS' : 'TS%'} B2B</th>
            <th>With rest</th>
            <th>Change</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.playerId}>
              <td className="left nowrap"><Link to={`/player/${r.playerId}`}>{names[r.playerId] ?? r.playerId}</Link> <span className="muted small">{teamOf(r.playerId)?.abbr}</span></td>
              <td>{r.b2b.games}</td>
              <td>{by === 'pts' ? r.b2b.pts.toFixed(1) : pct1(r.b2b.ts)}</td>
              <td className="muted">{by === 'pts' ? r.rested.pts.toFixed(1) : pct1(r.rested.ts)}</td>
              <td className={diff(r) >= 0 ? 'win' : 'loss'}>{by === 'pts' ? signed(diff(r)) : signed(diff(r) * 100)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <>
      <div className="chips tight">
        <button className={by === 'pts' ? 'chip active' : 'chip'} aria-pressed={by === 'pts'} onClick={() => setBy('pts')}>Points</button>
        <button className={by === 'ts' ? 'chip active' : 'chip'} aria-pressed={by === 'ts'} onClick={() => setBy('ts')}>True shooting</button>
      </div>
      <div className="two-col">
        {table('Biggest drop on back-to-backs', sorted.slice(0, 12))}
        {table('Better on back-to-backs', sorted.slice(-12).reverse())}
      </div>
      <p className="muted small">Players with 15+ games and 4+ back-to-backs. "With rest" is every other game (one or more days off).</p>
    </>
  );
}
