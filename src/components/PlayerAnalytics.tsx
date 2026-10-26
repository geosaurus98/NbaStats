// Player analytics: league-wide on/off, shot quality vs shot making,
// advanced leaderboards (PER, Win Shares), a build-your-own ranking and
// aging curves with the most similar careers.
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { seasonShots, seasonSnapshot, snapshotPlayers, type SeasonType } from '../api/espn';
import { useAsync } from '../hooks/useAsync';
import { playerAdvanced } from '../lib/advanced';
import { ageComps, byAge, leagueCurve, type AgeStat } from '../lib/aging';
import { P } from '../lib/boxTotals';
import { COL, loadCareers } from '../lib/careers';
import { zoneTotals, ZONES } from '../lib/pbpStats';
import { loadTeammateGraph } from '../lib/teammateStore';
import { LineChart } from './Charts';
import { ScatterPlot, type ScatterPoint } from './ScatterPlot';
import { Empty, Loading } from './Status';
import { useTeamSeasons } from './TeamAnalytics';
import { NetBar, per48, signed } from './TeamLineups';

const pct1 = (v: number) => `${(v * 100).toFixed(1)}%`;

function useAbbr(season: number) {
  const snap = seasonSnapshot(season);
  return useMemo(() => new Map((snap?.teams ?? []).map((t) => [t.id, t.abbr])), [snap]);
}

export function OnOffLeaders({ season, type }: { season: number; type: SeasonType }) {
  const snap = seasonSnapshot(season);
  const names = snapshotPlayers(season);
  const abbr = useAbbr(season);
  const [worst, setWorst] = useState(false);
  const teams = snap?.lineups?.[String(type)];
  if (!teams) return <Empty>No lineup data for this season yet.</Empty>;
  const all = Object.entries(teams).flatMap(([team, t]) =>
    t.onOff.map(([id, on, opf, opa, g, gpf, gpa]) => ({ id, team, on, off: g - on, onNet: per48(opf, opa, on), offNet: per48(gpf - opf, gpa - opa, g - on) })),
  );
  const maxOn = Math.max(1, ...all.map((p) => p.on));
  const rows = all
    .filter((p) => p.on >= Math.min(18000, maxOn * 0.35) && p.off >= Math.min(6000, maxOn * 0.12))
    .map((p) => ({ ...p, swing: p.onNet - p.offNet }))
    .sort((a, b) => (worst ? a.swing - b.swing : b.swing - a.swing))
    .slice(0, 30);
  const max = Math.max(10, ...rows.map((r) => Math.abs(r.swing)));
  return (
    <>
      <p className="muted">
        How much better each team does with a player on the floor than with them on the bench, in games they played: point margin per 48 minutes. It captures things the box score misses (spacing, defence) but also who a player shares the floor with.
      </p>
      <div className="segmented">
        <button className={!worst ? 'active' : ''} onClick={() => setWorst(false)}>Biggest positive swings</button>
        <button className={worst ? 'active' : ''} onClick={() => setWorst(true)}>Biggest negative swings</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="left">Player</th>
              <th>Min on</th>
              <th title="Team margin per 48 with them on court">On</th>
              <th title="…with them on the bench">Off</th>
              <th title="On minus off">Swing</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id + r.team}>
                <td className="left nowrap"><Link to={`/player/${r.id}`}>{names[r.id] ?? r.id}</Link> <span className="muted small">{abbr.get(r.team)}</span></td>
                <td>{Math.round(r.on / 60)}</td>
                <td>{signed(r.onNet)}</td>
                <td className="muted">{signed(r.offNet)}</td>
                <td className={r.swing >= 0 ? 'win' : 'loss'}><b>{signed(r.swing)}</b></td>
                <td className="net-cell"><NetBar v={r.swing} max={max} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <Empty>Too early: players need more minutes on and off the floor.</Empty>}
      <p className="muted small">From play-by-play lineups; players need a decent share of minutes both on and off the court. Traded players are listed once per team.</p>
    </>
  );
}

export function ShotQuality({ season, type }: { season: number; type: SeasonType }) {
  const shots = seasonShots(season, type);
  const abbr = useAbbr(season);
  const navigate = useNavigate();
  const model = useMemo(() => {
    if (!shots) return undefined;
    const lg = zoneTotals(shots.league, shots.teamSize);
    const value = (z: string) => (z === 'corner3' || z === 'arc3' ? 3 : 2);
    return Object.entries(shots.players).flatMap(([id, p]) => {
      const z = zoneTotals(p.bins, shots.playerSize);
      let att = 0;
      let expPts = 0;
      let pts = 0;
      for (const { id: zid } of ZONES) {
        const { att: a, made } = z[zid];
        att += a;
        expPts += a * (lg[zid].made / Math.max(1, lg[zid].att)) * value(zid);
        pts += made * value(zid);
      }
      if (att < 50) return [];
      const quality = expPts / (2 * att);
      const efg = pts / (2 * att);
      return [{ id, name: p.name, team: p.team, att, quality, efg, making: efg - quality }];
    });
  }, [shots]);
  if (!model?.length) return <Empty>No shot locations for this season yet.</Empty>;
  const byMaking = [...model].sort((a, b) => b.making - a.making);
  const labelled = new Set([...byMaking.slice(0, 6), ...byMaking.slice(-4)].map((p) => p.id));
  const points: ScatterPoint[] = model.map((p) => ({
    id: p.id,
    x: p.quality * 100,
    y: p.making * 100,
    label: `${p.name} (${abbr.get(p.team) ?? ''})`,
    short: p.name.split(' ').slice(1).join(' ') || p.name,
    highlight: labelled.has(p.id),
    detail: [`${p.att} shots, eFG ${pct1(p.efg)}`],
  }));
  return (
    <>
      <p className="muted">
        Shot quality: the eFG% an average shooter would get from this player's spots on the floor (league FG% in each zone). Shot making: how far above or below that they actually shoot. Top right = good shots and making them.
      </p>
      <div className="card">
        <ScatterPlot
          points={points}
          xLabel="Shot quality (expected eFG%)"
          yLabel="Shot making (eFG% above expected)"
          xFormat={(v) => `${v.toFixed(0)}%`}
          yFormat={(v) => `${v > 0 ? '+' : ''}${v.toFixed(0)}`}
          guides={{ x: (model.reduce((s, p) => s + p.quality * p.att, 0) / model.reduce((s, p) => s + p.att, 0)) * 100, y: 0 }}
          height={400}
          ariaLabel="Expected effective field-goal percentage from shot locations against how much each player beats it"
          onPick={(p) => navigate(`/player/${p.id}`)}
        />
      </div>
      <div className="two-col">
        {[
          { title: 'Best shot makers', rows: byMaking.slice(0, 10) },
          { title: 'Toughest shot diets (lowest quality)', rows: [...model].sort((a, b) => a.quality - b.quality).slice(0, 10) },
        ].map((t) => (
          <div key={t.title} className="table-wrap">
            <h3 className="table-title">{t.title}</h3>
            <table>
              <thead>
                <tr>
                  <th className="left">Player</th>
                  <th>Shots</th>
                  <th title="Expected eFG% from shot locations">xeFG%</th>
                  <th>eFG%</th>
                  <th>+/-</th>
                </tr>
              </thead>
              <tbody>
                {t.rows.map((p) => (
                  <tr key={p.id}>
                    <td className="left nowrap"><Link to={`/player/${p.id}`}>{p.name}</Link> <span className="muted small">{abbr.get(p.team)}</span></td>
                    <td>{p.att}</td>
                    <td>{pct1(p.quality)}</td>
                    <td>{pct1(p.efg)}</td>
                    <td className={p.making >= 0 ? 'win' : 'loss'}>{signed(p.making * 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
      <p className="muted small">The {model.length} highest-volume shooters with 50+ located shots. Zones only: it doesn't know how open a shot was, so great shooters who take tough shots still score well on making.</p>
    </>
  );
}

const ADV_COLS = [
  { id: 'per', label: 'PER', title: "Player Efficiency Rating (Hollinger): per-minute production, league average 15", fmt: (v: number) => v.toFixed(1) },
  { id: 'ws', label: 'WS', title: 'Win Shares (Basketball-Reference method): wins created by offence and defence', fmt: (v: number) => v.toFixed(1) },
  { id: 'ws48', label: 'WS/48', title: 'Win Shares per 48 minutes (league average about .100)', fmt: (v: number) => v.toFixed(3).replace(/^0/, '').replace(/^-0/, '-') },
  { id: 'ows', label: 'OWS', title: 'Offensive Win Shares', fmt: (v: number) => v.toFixed(1) },
  { id: 'dws', label: 'DWS', title: 'Defensive Win Shares', fmt: (v: number) => v.toFixed(1) },
  { id: 'ortg', label: 'ORtg', title: 'Offensive rating: points produced per 100 possessions used', fmt: (v: number) => v.toFixed(0) },
  { id: 'drtg', label: 'DRtg', title: 'Defensive rating: points allowed per 100 possessions (lower is better)', fmt: (v: number) => v.toFixed(0) },
  { id: 'ts', label: 'TS%', title: 'True shooting %', fmt: pct1 },
  { id: 'usg', label: 'USG%', title: 'Usage: share of team plays finished while on court', fmt: pct1 },
] as const;
type AdvKey = (typeof ADV_COLS)[number]['id'];

export function AdvancedLeaders({ season }: { season: number }) {
  const snap = seasonSnapshot(season);
  const data = useTeamSeasons(season, 2);
  const names = snapshotPlayers(season);
  const abbr = useAbbr(season);
  const [sort, setSort] = useState<AdvKey>('ws');
  const rows = useMemo(() => (snap?.box?.['2'] && data.data ? playerAdvanced(snap.box['2'], data.data.seasons) : []), [snap, data.data]);
  if (data.loading) return <Loading />;
  if (!rows.length) return <Empty>No box scores for this season yet.</Empty>;
  const maxG = Math.max(...rows.map((r) => r.g));
  const qualified = rows.filter((r) => r.g >= Math.max(1, maxG * 0.4) && r.min / r.g >= 15);
  const sorted = [...qualified].sort((a, b) => (sort === 'drtg' ? a[sort] - b[sort] : b[sort] - a[sort])).slice(0, 50);
  return (
    <>
      <p className="muted">Advanced stats computed from this season's box scores the way Basketball-Reference does. Hover a column for what it means; click to sort. Players in 40% of games with 15+ minutes a game.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th className="left">Player</th>
              <th>G</th>
              <th>MPG</th>
              {ADV_COLS.map((c) => (
                <th key={c.id} title={c.title} className={c.id === sort ? 'sorted' : 'sortable'} onClick={() => setSort(c.id)}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.id}>
                <td className="muted">{i + 1}</td>
                <td className="left nowrap"><Link to={`/player/${r.id}`}>{names[r.id] ?? r.id}</Link> <span className="muted small">{abbr.get(r.team)}</span></td>
                <td>{r.g}</td>
                <td>{(r.min / r.g).toFixed(1)}</td>
                {ADV_COLS.map((c) => (
                  <td key={c.id} className={c.id === sort ? 'strong' : undefined}>{c.fmt(r[c.id])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">Traded players are measured against their current team. Box plus-minus isn't included: its published coefficients depend on position estimates the site doesn't have, so on/off (Insights) covers impact instead.</p>
    </>
  );
}

const BUILD = [
  { id: 'pts', label: 'Points', d: 5 },
  { id: 'reb', label: 'Rebounds', d: 2 },
  { id: 'ast', label: 'Assists', d: 3 },
  { id: 'stl', label: 'Steals', d: 1 },
  { id: 'blk', label: 'Blocks', d: 1 },
  { id: 'tpm', label: 'Threes', d: 1 },
  { id: 'ts', label: 'True shooting', d: 3 },
  { id: 'tov', label: 'Avoiding turnovers', d: 1 },
  { id: 'pm', label: '+/- per game', d: 1 },
] as const;
type BuildKey = (typeof BUILD)[number]['id'];
const PRESETS: { label: string; w: Record<BuildKey, number> }[] = [
  { label: 'Balanced', w: { pts: 5, reb: 2, ast: 3, stl: 1, blk: 1, tpm: 1, ts: 3, tov: 1, pm: 1 } },
  { label: 'Pure scorer', w: { pts: 10, reb: 0, ast: 0, stl: 0, blk: 0, tpm: 2, ts: 4, tov: 0, pm: 0 } },
  { label: 'Playmaker', w: { pts: 3, reb: 0, ast: 10, stl: 1, blk: 0, tpm: 1, ts: 2, tov: 5, pm: 2 } },
  { label: 'Defender', w: { pts: 0, reb: 4, ast: 0, stl: 8, blk: 8, tpm: 0, ts: 0, tov: 0, pm: 3 } },
  { label: 'Winning', w: { pts: 2, reb: 1, ast: 1, stl: 1, blk: 1, tpm: 1, ts: 2, tov: 1, pm: 10 } },
];

export function BuildYourOwn({ season }: { season: number }) {
  const snap = seasonSnapshot(season);
  const names = snapshotPlayers(season);
  const abbr = useAbbr(season);
  const [w, setW] = useState<Record<BuildKey, number>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('nba-hub-metric') ?? 'null');
      if (saved && typeof saved === 'object') return { ...PRESETS[0].w, ...saved };
    } catch {
      /* private mode */
    }
    return PRESETS[0].w;
  });
  useEffect(() => {
    try {
      localStorage.setItem('nba-hub-metric', JSON.stringify(w));
    } catch {
      /* private mode */
    }
  }, [w]);
  const pool = useMemo(() => {
    const box = snap?.box?.['2'];
    if (!box) return [];
    const maxG = Math.max(1, ...box.players.map((r) => r[P.gp] as number));
    const raw = box.players.flatMap((r) => {
      const v = (k: keyof typeof P) => r[P[k]] as number;
      const g = v('gp');
      if (g < Math.max(1, maxG * 0.4) || v('min') / g < 15) return [];
      const stats: Record<BuildKey, number> = {
        pts: v('pts') / g,
        reb: (v('oreb') + v('dreb')) / g,
        ast: v('ast') / g,
        stl: v('stl') / g,
        blk: v('blk') / g,
        tpm: v('tpm') / g,
        ts: v('pts') / Math.max(1, 2 * (v('fga') + 0.44 * v('fta'))),
        tov: -v('tov') / g,
        pm: v('pm') / g,
      };
      return [{ id: r[0], team: r[1], stats }];
    });
    // z-scores so every stat counts on the same scale.
    const z = Object.fromEntries(
      BUILD.map(({ id }) => {
        const xs = raw.map((p) => p.stats[id]);
        const m = xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
        const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length)) || 1;
        return [id, { m, sd }];
      }),
    ) as Record<BuildKey, { m: number; sd: number }>;
    return raw.map((p) => ({ ...p, z: Object.fromEntries(BUILD.map(({ id }) => [id, (p.stats[id] - z[id].m) / z[id].sd])) as Record<BuildKey, number> }));
  }, [snap]);
  if (!pool.length) return <Empty>No box scores for this season yet.</Empty>;
  const total = BUILD.reduce((s, b) => s + w[b.id], 0) || 1;
  const ranked = pool
    .map((p) => ({ ...p, score: BUILD.reduce((s, b) => s + w[b.id] * p.z[b.id], 0) / total }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 25);
  const top = Math.max(0.1, ranked[0]?.score ?? 1);
  return (
    <>
      <p className="muted">Weight what you value and the ranking updates live. Each stat is scaled against the league (standard deviations from average), so a weight of 5 on steals counts as much as 5 on points. Your weights are saved in this browser.</p>
      <div className="chips tight">
        {PRESETS.map((p) => (
          <button key={p.label} className="chip" onClick={() => setW(p.w)}>{p.label}</button>
        ))}
      </div>
      <div className="two-col">
        <div className="card sliders">
          {BUILD.map((b) => (
            <label key={b.id} className="slider-row">
              <span>{b.label}</span>
              <input type="range" min={0} max={10} step={1} value={w[b.id]} onChange={(e) => setW({ ...w, [b.id]: Number(e.target.value) })} aria-label={`${b.label} weight`} />
              <b>{w[b.id]}</b>
            </label>
          ))}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th className="left">Player</th>
                <th title="Weighted average of the stats' standard scores">Score</th>
                <th />
                <th>PTS</th>
                <th>REB</th>
                <th>AST</th>
                <th>TS%</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((p, i) => (
                <tr key={p.id}>
                  <td className="muted">{i + 1}</td>
                  <td className="left nowrap"><Link to={`/player/${p.id}`}>{names[p.id] ?? p.id}</Link> <span className="muted small">{abbr.get(p.team)}</span></td>
                  <td><b>{p.score.toFixed(2)}</b></td>
                  <td className="bar-cell"><span className="bar" style={{ width: `${Math.max(2, (p.score / top) * 100)}%` }} /></td>
                  <td>{p.stats.pts.toFixed(1)}</td>
                  <td>{p.stats.reb.toFixed(1)}</td>
                  <td>{p.stats.ast.toFixed(1)}</td>
                  <td>{pct1(p.stats.ts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

const AGE_STATS: { id: AgeStat; label: string }[] = [
  { id: 'pts', label: 'Points' },
  { id: 'trb', label: 'Rebounds' },
  { id: 'ast', label: 'Assists' },
  { id: 'mp', label: 'Minutes' },
];

/** Player page: per-game numbers by age against the league curve and the five most similar careers. */
export function AgingCurve({ playerId, season }: { playerId: string; season: number }) {
  const [stat, setStat] = useState<AgeStat>('pts');
  const snap = seasonSnapshot(season);
  const { data } = useAsync(async () => {
    const [careers, graph] = await Promise.all([loadCareers(), loadTeammateGraph()]);
    const idx = graph.data.espn?.[playerId];
    if (idx == null) return undefined;
    const rows = careers.seasons[idx] ?? [];
    const arc = byAge(rows);
    // Add this season's box scores when the history stops at last season.
    const last = rows.length ? rows[rows.length - 1] : undefined;
    const row = snap?.box?.['2']?.players.find((r) => r[0] === playerId);
    if (last && row && last[COL.season] === season - 1 && (row[P.gp] as number) >= 3) {
      const g = row[P.gp] as number;
      arc.set(last[COL.age] + 1, { g, pts: (row[P.pts] as number) / g, trb: ((row[P.oreb] as number) + (row[P.dreb] as number)) / g, ast: (row[P.ast] as number) / g, mp: (row[P.min] as number) / g });
    }
    if (arc.size < 2) return undefined;
    const comps = ageComps(careers, arc, idx);
    return { careers, graph, idx, arc, comps, curves: Object.fromEntries(AGE_STATS.map((s) => [s.id, leagueCurve(careers, s.id)])) as Record<AgeStat, Map<number, number>> };
  }, [playerId, season]);
  if (!data) return null;
  const { arc, comps, curves, graph } = data;
  const name = (i: number) => graph.data.players[i]?.[0] ?? '';
  const ages = [...new Set([...arc.keys(), ...comps.flatMap((c) => [...c.arc.keys()])])].filter((a) => a >= 18 && a <= 42).sort((a, b) => a - b);
  const lo = Math.min(...arc.keys());
  const hi = Math.min(Math.max(...ages), Math.max(...arc.keys()) + 8);
  const xs = ages.filter((a) => a >= Math.min(lo, 19) && a <= hi);
  const val = (m: Map<number, { g: number } & Record<AgeStat, number>>, a: number) => {
    const v = m.get(a);
    return v && v.g >= 10 ? Math.round(v[stat] * 10) / 10 : null;
  };
  const series = [
    ...comps.map((c) => ({ id: `c${c.player}`, label: name(c.player), values: xs.map((a) => val(c.arc, a)) })),
    { id: 'league', label: 'League average (1,000+ min)', values: xs.map((a) => (curves[stat].has(a) ? Math.round(curves[stat].get(a)! * 10) / 10 : null)), color: 'var(--series-2)' },
    { id: 'me', label: 'This player', values: xs.map((a) => val(arc, a)), color: 'var(--series-1)' },
  ];
  const now = Math.max(...arc.keys());
  const next = (c: (typeof comps)[number]) => {
    const later = [1, 2, 3].map((d) => c.arc.get(now + d)).filter((v): v is NonNullable<typeof v> => !!v);
    return later.length ? later.reduce((s, v) => s + v[stat], 0) / later.length : undefined;
  };
  const proj = comps.map(next).filter((v): v is number => v != null);
  return (
    <div className="card">
      <div className="page-head">
        <h3>Aging curve</h3>
        <div className="chips tight">
          {AGE_STATS.map((s) => (
            <button key={s.id} className={s.id === stat ? 'chip active' : 'chip'} onClick={() => setStat(s.id)}>{s.label}</button>
          ))}
        </div>
      </div>
      <LineChart
        series={series}
        height={260}
        xLabel={(i) => `Age ${xs[i]}`}
        xTick={(i) => String(xs[i])}
        ariaLabel={`${AGE_STATS.find((s) => s.id === stat)!.label} per game by age, with the league average and the most similar careers`}
        contextLabel="Most similar careers"
      />
      {comps.length > 0 && (
        <>
          <p className="small">
            Most similar careers up to age {now} (per-game points, rebounds, assists and minutes at the same ages):{' '}
            {comps.map((c, i) => (
              <span key={c.player}>
                {i > 0 && ', '}
                <b>{name(c.player)}</b> <span className="muted">({c.similarity}% match)</span>
              </span>
            ))}
            .
          </p>
          {proj.length >= 3 && (
            <p className="small">
              Over the next three seasons they averaged <b>{(proj.reduce((a, b) => a + b, 0) / proj.length).toFixed(1)}</b> {AGE_STATS.find((s) => s.id === stat)!.label.toLowerCase()} a game.
            </p>
          )}
        </>
      )}
      <p className="muted small">Ages as of February of each season (Basketball-Reference). Seasons with 10+ games.</p>
    </div>
  );
}
