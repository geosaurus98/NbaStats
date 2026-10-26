// Graphs from the play-by-play shot splits and team box-score extras: shot
// types, self-created vs assisted scoring, quarter splits, points by source,
// and who plays with whom.
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { seasonSnapshot, type SeasonType } from '../api/espn';
import type { SeasonSnapshot } from '../api/snapshot';
import { T } from '../lib/boxTotals';
import { SHOT_TYPES, type ShotTypeId, type TypeCounts } from '../lib/shotTypes';
import { Empty } from './Status';
import { TeamLogo } from './TeamLogo';

const pct = (m: number, a: number) => (a ? `${((m / a) * 100).toFixed(1)}%` : '–');
const typeLabel = (id: ShotTypeId) => SHOT_TYPES.find((t) => t.id === id)!.label;

/** Player page: shot mix with accuracy against the league, assisted share, and quarter by quarter. */
export function PlayerShotTypes({ playerId, season, type }: { playerId: string; season: number; type: SeasonType }) {
  const splits = seasonSnapshot(season)?.shotSplits?.[String(type)];
  const me = splits?.players[playerId];
  if (!splits || !me) return null;
  const total = SHOT_TYPES.reduce((a, t) => a + (me.types[t.id]?.[0] ?? 0), 0);
  const made = SHOT_TYPES.reduce((a, t) => a + (me.types[t.id]?.[1] ?? 0), 0);
  const assisted = SHOT_TYPES.reduce((a, t) => a + (me.types[t.id]?.[2] ?? 0), 0);
  const rows = SHOT_TYPES.filter((t) => me.types[t.id]?.[0]).sort((a, b) => me.types[b.id]![0] - me.types[a.id]![0]);
  const maxShare = Math.max(...rows.map((t) => me.types[t.id]![0] / total));
  const q = me.quarters;
  const qAvg = made / Math.max(1, total);
  return (
    <div className="card">
      <h3>Shot types</h3>
      <p className="small">
        {total} shots · <b>{pct(made, total)}</b> · {made ? <><b>{Math.round(((made - assisted) / made) * 100)}%</b> of made shots unassisted (self-created)</> : null}
      </p>
      <div className="shot-types">
        {rows.map((t) => {
          const [a, m, ast] = me.types[t.id]!;
          const lg = splits.league[t.id];
          const diff = lg && a >= 5 ? (m / a - lg[1] / lg[0]) * 100 : undefined;
          return (
            <div key={t.id} className="st-row" title={`${t.label}: ${m}/${a}, league ${lg ? pct(lg[1], lg[0]) : '–'}; ${m ? Math.round((ast / m) * 100) : 0}% of makes assisted`}>
              <span className="st-name">{t.label}</span>
              <span className="pbar-track"><span className="pbar-fill" style={{ width: `${((a / total) / maxShare) * 100}%`, background: 'var(--series-1)' }} /></span>
              <span className="st-share">{Math.round((a / total) * 100)}%</span>
              <span className="st-pct">{pct(m, a)}</span>
              <span className={`st-diff small ${diff == null ? 'muted' : diff >= 0 ? 'win' : 'loss'}`}>{diff == null ? '' : `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}`}</span>
            </div>
          );
        })}
      </div>
      <p className="muted small">Bar = share of all shots; then FG% and the difference from the league on that shot type (5+ attempts). From the play-by-play shot descriptions.</p>
      <h3>By quarter</h3>
      <div className="quarters">
        {q.map(([a, m], i) => (
          <div key={i} className="q-cell" title={`${a} shots`}>
            <span className="muted small">{i < 4 ? `Q${i + 1}` : 'OT'}</span>
            <b className={a >= 5 ? (m / a >= qAvg ? 'win' : 'loss') : 'muted'}>{a ? pct(m, a) : '–'}</b>
            <span className="muted small">{m}/{a}</span>
          </div>
        ))}
      </div>
      <p className="muted small">Field-goal % in each quarter, against the overall {pct(made, total)}.</p>
    </div>
  );
}

/** Insights → Shot types: leaders by shot type, and who creates their own scoring. */
export function ShotTypeLeaders({ season, type }: { season: number; type: SeasonType }) {
  const navigate = useNavigate();
  const snap = seasonSnapshot(season);
  const splits = snap?.shotSplits?.[String(type)];
  const [shot, setShot] = useState<ShotTypeId>('stepback');
  const [sort, setSort] = useState<'att' | 'pct'>('att');
  const teamOf = useMemo(() => new Map((snap?.box?.['2']?.players ?? []).map((r) => [r[0], r[1]])), [snap]);
  if (!splits) return <Empty>No shot descriptions for this season yet.</Empty>;
  const abbr = new Map(snap!.teams.map((t) => [t.id, t.abbr]));
  const name = (id: string) => snap!.players?.[id] ?? id;
  const lg = splits.league[shot];
  const counts = (c: TypeCounts, id: ShotTypeId) => c[id] ?? [0, 0, 0];
  const maxAtt = Math.max(1, ...Object.values(splits.players).map((p) => counts(p.types, shot)[0]));
  const minAtt = Math.max(3, Math.round(maxAtt * 0.25));
  const leaders = Object.entries(splits.players)
    .map(([id, p]) => ({ id, c: counts(p.types, shot) }))
    .filter((r) => r.c[0] >= (sort === 'pct' ? minAtt : 1))
    .sort((a, b) => (sort === 'att' ? b.c[0] - a.c[0] : b.c[1] / b.c[0] - a.c[1] / a.c[0]))
    .slice(0, 15);

  // Self-created scoring: made shots split into unassisted and assisted, for the 20 players with the most unassisted makes.
  const self = Object.entries(splits.players)
    .map(([id, p]) => {
      const made = SHOT_TYPES.reduce((a, t) => a + (p.types[t.id]?.[1] ?? 0), 0);
      const ast = SHOT_TYPES.reduce((a, t) => a + (p.types[t.id]?.[2] ?? 0), 0);
      return { id, made, unassisted: made - ast, assisted: ast };
    })
    .sort((a, b) => b.unassisted - a.unassisted)
    .slice(0, 20);
  const maxMade = Math.max(1, ...self.map((s) => s.made));

  // Fourth-quarter risers: Q4 FG% minus Q1-3 FG%.
  const late = Object.entries(splits.players)
    .map(([id, p]) => {
      const early = p.quarters.slice(0, 3).reduce((a, q) => [a[0] + q[0], a[1] + q[1]], [0, 0]);
      const q4 = p.quarters[3];
      return { id, q4, early, diff: q4[0] ? q4[1] / q4[0] - early[1] / Math.max(1, early[0]) : 0 };
    })
    .filter((r) => r.q4[0] >= Math.max(5, Math.round(maxAtt * 0.15)) && r.early[0] >= 15);
  const risers = [...late].sort((a, b) => b.diff - a.diff).slice(0, 8);

  return (
    <>
      <p className="muted">Every field-goal attempt classified from its play-by-play description. "Other threes" are mostly catch-and-shoot.</p>
      <div className="chips tight">
        {SHOT_TYPES.map((t) => (
          <button key={t.id} className={t.id === shot ? 'chip active' : 'chip'} onClick={() => setShot(t.id)}>{t.label}</button>
        ))}
      </div>
      <div className="two-col">
        <div className="table-wrap">
          <h3 className="table-title">{typeLabel(shot)} · league {lg ? pct(lg[1], lg[0]) : '–'}</h3>
          <div className="actions" style={{ padding: '0 .9rem' }}>
            <button className={sort === 'att' ? 'chip active' : 'chip'} onClick={() => setSort('att')}>Most attempts</button>
            <button className={sort === 'pct' ? 'chip active' : 'chip'} onClick={() => setSort('pct')}>Best % ({minAtt}+)</button>
          </div>
          <table>
            <thead>
              <tr>
                <th className="left">Player</th>
                <th>Made</th>
                <th>Att</th>
                <th>FG%</th>
                <th title="Share of makes that were assisted">Assisted</th>
              </tr>
            </thead>
            <tbody>
              {leaders.map((r) => (
                <tr key={r.id}>
                  <td className="left nowrap"><Link to={`/player/${r.id}`}>{name(r.id)}</Link> <span className="muted small">{abbr.get(String(teamOf.get(r.id)))}</span></td>
                  <td>{r.c[1]}</td>
                  <td className={sort === 'att' ? 'sorted' : undefined}>{r.c[0]}</td>
                  <td className={sort === 'pct' ? 'sorted' : undefined}>{pct(r.c[1], r.c[0])}</td>
                  <td>{r.c[1] ? `${Math.round((r.c[2] / r.c[1]) * 100)}%` : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>Self-created scoring</h3>
          <div className="legend small">
            <span><i className="key-sq" style={{ background: 'var(--series-1)' }} /> Unassisted makes</span>
            <span><i className="key-sq" style={{ background: 'var(--series-2)' }} /> Assisted makes</span>
          </div>
          <div className="partner-bars">
            {self.map((s) => (
              <div key={s.id} className="pbar stack-row" onClick={() => navigate(`/player/${s.id}`)} title={`${name(s.id)}: ${s.unassisted} unassisted, ${s.assisted} assisted (${Math.round((s.unassisted / Math.max(1, s.made)) * 100)}% self-created)`}>
                <span className="pbar-name">{name(s.id)}</span>
                <span className="stack-track">
                  <span style={{ width: `${(s.unassisted / maxMade) * 100}%`, background: 'var(--series-1)' }} />
                  <span style={{ width: `${(s.assisted / maxMade) * 100}%`, background: 'var(--series-2)' }} />
                </span>
                <b className="pbar-n">{Math.round((s.unassisted / Math.max(1, s.made)) * 100)}%</b>
              </div>
            ))}
          </div>
          <p className="muted small">The 20 players with the most unassisted made shots; % = share of their makes that were self-created.</p>
          <h3>Fourth-quarter risers</h3>
          <table>
            <tbody>
              {risers.map((r) => (
                <tr key={r.id}>
                  <td className="left"><Link to={`/player/${r.id}`}>{name(r.id)}</Link></td>
                  <td className="muted small">Q1-3 {pct(r.early[1], r.early[0])}</td>
                  <td className="small">Q4 <b>{pct(r.q4[1], r.q4[0])}</b></td>
                  <td className={r.diff >= 0 ? 'win small' : 'loss small'}>{r.diff >= 0 ? '+' : ''}{(r.diff * 100).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">Biggest jump in field-goal % in fourth quarters compared with the first three. ESPN's play-by-play has no shot clock, so this is the closest split.</p>
        </div>
      </div>
    </>
  );
}

const SOURCES = [
  { id: 'paint', label: 'Paint', color: 'var(--series-1)' },
  { id: 'mid', label: 'Mid-range', color: 'var(--series-2)' },
  { id: 'three', label: 'Threes', color: 'var(--series-3)' },
  { id: 'ft', label: 'Free throws', color: 'var(--series-4)' },
] as const;

export interface SourceRow {
  teamId: string;
  total: number;
  paint: number;
  mid: number;
  three: number;
  ft: number;
  fastBreak?: number;
}

/** Points per game by source; paint + mid-range + threes + free throws add up to all points. */
export function pointsBySource(snap: SeasonSnapshot, type: SeasonType): SourceRow[] {
  const box = snap.box?.['2'];
  const extras = snap.teamStatSums?.[String(type)] ?? {};
  if (!box || type !== 2) return [];
  return box.teams.flatMap((t) => {
    const ex = extras[t[0]];
    if (t.length <= T.tov || !ex?.gp) return [];
    const g = t[T.gp] as number;
    const total = (t[T.pts] as number) / g;
    const three = (3 * (t[T.tpm] as number)) / g;
    const ft = (t[T.ftm] as number) / g;
    const paint = (ex.sums['Points in Paint'] ?? 0) / ex.gp;
    return [{ teamId: t[0], total, paint, three, ft, mid: Math.max(0, total - paint - three - ft), fastBreak: ex.sums['Fast Break Points'] != null ? ex.sums['Fast Break Points'] / ex.gp : undefined }];
  });
}

export function PointsBySource({ season, teamId }: { season: number; teamId?: string }) {
  const navigate = useNavigate();
  const snap = seasonSnapshot(season);
  const [hover, setHover] = useState<string | null>(null);
  const rows = snap ? pointsBySource(snap, 2) : [];
  if (!rows.length) return teamId ? null : <Empty>No team box scores for this season yet.</Empty>;
  const teams = new Map(snap!.teams.map((t) => [t.id, t]));
  const avg = Object.fromEntries(['total', 'paint', 'mid', 'three', 'ft', 'fastBreak'].map((k) => [k, rows.reduce((a, r) => a + ((r as unknown as Record<string, number>)[k] ?? 0), 0) / rows.length])) as Record<string, number>;
  const shown = teamId ? rows.filter((r) => r.teamId === teamId) : [...rows].sort((a, b) => b.total - a.total);
  const max = Math.max(...rows.map((r) => r.total));
  return (
    <div className="card">
      <h3>Where the points come from</h3>
      <div className="legend small">
        {SOURCES.map((s) => (
          <span key={s.id}><i className="key-sq" style={{ background: s.color }} /> {s.label}</span>
        ))}
      </div>
      <div className="source-bars">
        {shown.map((r) => {
          const t = teams.get(r.teamId);
          return (
            <div key={r.teamId} className={`source-row${teamId ? '' : ' clickable'}`} onClick={() => !teamId && navigate(`/team/${r.teamId}`)} onMouseEnter={() => setHover(r.teamId)} onMouseLeave={() => setHover(null)}>
              <span className="source-team">{t && <TeamLogo team={t} size={16} />} {t?.abbr}</span>
              <span className="stack-track">
                {SOURCES.map((s) => (
                  <span key={s.id} style={{ width: `${(r[s.id] / max) * 100}%`, background: s.color }} title={`${s.label}: ${r[s.id].toFixed(1)} a game (league ${avg[s.id].toFixed(1)})`} />
                ))}
              </span>
              <b className="source-total">{r.total.toFixed(1)}</b>
              {hover === r.teamId && !teamId && (
                <span className="source-tip muted small">
                  {SOURCES.map((s) => `${s.label} ${r[s.id].toFixed(1)}`).join(' · ')}{r.fastBreak != null ? ` · fast break ${r.fastBreak.toFixed(1)}` : ''}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {teamId && shown[0] && (
        <table className="source-table">
          <tbody>
            {[...SOURCES.map((s) => ({ label: s.label, v: shown[0][s.id], lg: avg[s.id] })), ...(shown[0].fastBreak != null ? [{ label: 'Fast break (any type)', v: shown[0].fastBreak, lg: avg.fastBreak }] : [])].map((x) => (
              <tr key={x.label}>
                <td className="left">{x.label}</td>
                <td><b>{x.v.toFixed(1)}</b></td>
                <td className="muted small">league {x.lg.toFixed(1)}</td>
                <td className={x.v >= x.lg ? 'win small' : 'loss small'}>{x.v >= x.lg ? '+' : ''}{(x.v - x.lg).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="muted small">
        Points per game. Paint is ESPN's points in the paint; mid-range is the rest of the two-pointers. Fast-break points overlap the other sources, so they're listed separately{teamId ? '' : ' (hover a team)'}.
      </p>
    </div>
  );
}

/** Team page: minutes together for every pair of the team's most-used players. */
export function PairHeatmap({ season, teamId, type }: { season: number; teamId: string; type: SeasonType }) {
  const snap = seasonSnapshot(season);
  const t = snap?.lineups?.[String(type)]?.[teamId];
  const [hover, setHover] = useState<string | null>(null);
  if (!t?.pairs?.length) return null;
  const top = [...t.onOff].sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (top.length < 4) return null;
  const ids = top.map((r) => r[0]);
  const pair = new Map(t.pairs.map(([p, sec, pf, pa]) => [p.slice().sort().join(','), { sec, net: ((pf - pa) / Math.max(1, sec)) * 2880 }]));
  const own = new Map(top.map((r) => [r[0], r[1]]));
  const maxSec = Math.max(1, ...t.pairs.map((p) => p[1]));
  const surname = (id: string) => {
    const n = snap!.players?.[id] ?? id;
    return n.split(' ').slice(1).join(' ') || n;
  };
  // Surnames, with an initial where two of the ten share one.
  const name = (id: string) => {
    const s = surname(id);
    return ids.filter((x) => surname(x) === s).length > 1 ? `${(snap!.players?.[id] ?? id)[0]}. ${s}` : s;
  };
  return (
    <div className="card">
      <h3>Who plays with whom</h3>
      <div className="heat-wrap">
        <table className="heat">
          <thead>
            <tr>
              <th />
              {ids.map((id) => (
                <th key={id} className="heat-col"><span>{name(id)}</span></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ids.map((a) => (
              <tr key={a}>
                <th className="left nowrap"><Link to={`/player/${a}`}>{name(a)}</Link></th>
                {ids.map((b) => {
                  const key = [a, b].sort().join(',');
                  const cell = a === b ? { sec: own.get(a) ?? 0, net: undefined } : pair.get(key);
                  const min = Math.round((cell?.sec ?? 0) / 60);
                  const shade = a === b ? 0 : Math.round(((cell?.sec ?? 0) / maxSec) * 85);
                  return (
                    <td
                      key={b}
                      className={`heat-cell${a === b ? ' self' : ''}${hover === key ? ' hot' : ''}`}
                      style={a === b ? undefined : { background: `color-mix(in srgb, var(--series-1) ${shade}%, var(--surface))`, color: shade > 55 ? '#fff' : undefined }}
                      onMouseEnter={() => setHover(key)}
                      title={a === b ? `${name(a)}: ${min} minutes in all` : `${name(a)} + ${name(b)}: ${min} minutes together${cell?.net != null ? `, ${cell.net >= 0 ? '+' : ''}${cell.net.toFixed(1)} per 48` : ''}`}
                    >
                      {min || ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">Minutes on court together for the ten most-used players (diagonal: each player's own minutes). Darker = more time together; hover for their +/- per 48.</p>
    </div>
  );
}
