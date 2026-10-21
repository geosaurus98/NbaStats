// History → Team vs team: any two franchise seasons side by side, with the
// numbers that change across eras shown against that season's league average,
// and an era-neutral matchup from each team's SRS.
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { eraMatchup } from '../lib/eraMatchup';
import { CHAMPIONS, DETAIL, LEAGUE, loadFranchiseData, type FranchiseData } from '../lib/franchiseData';
import { espnLogo, franchiseById, franchiseOf, FRANCHISES } from '../lib/franchises';
import { seasonLabel, type Graph } from '../lib/teammates';
import { ErrorBox, Loading } from './Status';
import { TeamLogo } from './TeamLogo';

const PRESETS: [string, string, string][] = [
  ['CHI-1996', 'GSW-2017', "'96 Bulls vs '17 Warriors"],
  ['GSW-2016', 'CHI-1996', '73-9 vs 72-10'],
  ['LAL-1987', 'BOS-1986', "Showtime vs '86 Celtics"],
  ['LAL-1972', 'MIL-1971', "'72 Lakers vs '71 Bucks"],
  ['PHI-1967', 'BOS-1965', "'67 76ers vs '65 Celtics"],
  ['OKC-2026', 'BOS-2008', "'26 Thunder vs '08 Celtics"],
];

interface Side {
  i: number;
  id: string;
  season: number;
}

function parse(v: string | null, fallback: string): { id: string; season: number } {
  const [id, s] = (v ?? fallback).split('-');
  return { id, season: Number(s) };
}

export function TeamSeasonCompare({ graph }: { graph: Graph }) {
  const fd = useAsync(() => loadFranchiseData(), []);
  const [params, setParams] = useSearchParams();
  const index = useMemo(() => {
    const m = new Map<string, number>();
    fd.data?.teamSeasons.forEach((s, i) => {
      const f = franchiseOf(s[2]);
      if (f && s[1] !== 1) m.set(`${f.id}-${s[0]}`, i); // NBA/BAA seasons
    });
    return m;
  }, [fd.data]);

  if (fd.error) return <ErrorBox error={fd.error} />;
  if (!fd.data) return <Loading label="Loading every team-season…" />;
  const data = fd.data;

  const resolve = (key: 'a' | 'b', fallback: string): Side => {
    const { id, season } = parse(params.get(key), fallback);
    const i = index.get(`${id}-${season}`) ?? index.get(fallback)!;
    return { i, id: franchiseOf(data.teamSeasons[i][2])!.id, season: data.teamSeasons[i][0] };
  };
  const a = resolve('a', 'CHI-1996');
  const b = resolve('b', 'GSW-2017');
  const set = (key: 'a' | 'b', id: string, season: number) => {
    // Keep the season if the new franchise played it, else its latest season.
    const has = index.has(`${id}-${season}`);
    const latest = Math.max(...[...index.keys()].filter((k) => k.startsWith(`${id}-`)).map((k) => Number(k.split('-')[1])));
    const next = new URLSearchParams(params);
    next.set(key, `${id}-${has ? season : latest}`);
    setParams(next, { replace: true });
  };
  const preset = (pa: string, pb: string) => {
    const next = new URLSearchParams(params);
    next.set('a', pa);
    next.set('b', pb);
    setParams(next, { replace: true });
  };

  const sa = data.teamSeasons[a.i];
  const sb = data.teamSeasons[b.i];
  const srs = (s: FranchiseData['teamSeasons'][number], i: number) => s[7] ?? data.detail[i][DETAIL.mov] ?? 0;
  const m = eraMatchup(srs(sa, a.i), srs(sb, b.i));
  const fav = m.margin >= 0 ? sa : sb;
  const odds = m.margin >= 0 ? m : { ...m, gameProb: 1 - m.gameProb, seriesProb: 1 - m.seriesProb };

  return (
    <>
      <p className="muted">Stack any two seasons from any era. Numbers that drift over time (scoring, pace, three-point rate) are also shown against that season's league average.</p>
      <div className="chips tight">
        {PRESETS.map(([pa, pb, label]) => (
          <button key={label} className="chip" onClick={() => preset(pa, pb)}>{label}</button>
        ))}
      </div>
      <div className="era-pickers">
        <Picker side={a} index={index} onChange={(id, s) => set('a', id, s)} label="Team A" />
        <Picker side={b} index={index} onChange={(id, s) => set('b', id, s)} label="Team B" />
      </div>
      <div className="era-heads">
        <Head data={data} side={a} color="var(--series-1)" />
        <Head data={data} side={b} color="var(--series-2)" />
      </div>

      <div className="card era-matchup">
        <h3>If they met (neutral court)</h3>
        <p>
          <b>{fav[3]}</b> by <b>{Math.abs(m.margin).toFixed(1)}</b> points a game · win one game <b>{Math.round(odds.gameProb * 100)}%</b> · win a best-of-seven{' '}
          <b>{Math.round(odds.seriesProb * 100)}%</b>
        </p>
        <div className="era-tug" aria-label={`Series odds: ${sa[3]} ${Math.round(m.seriesProb * 100)}%, ${sb[3]} ${Math.round((1 - m.seriesProb) * 100)}%`}>
          <span style={{ width: `${m.seriesProb * 100}%`, background: 'var(--series-1)' }} />
          <span style={{ width: `${(1 - m.seriesProb) * 100}%`, background: 'var(--series-2)' }} />
        </div>
        <p className="muted small">
          From each team's SRS (point margin adjusted for schedule, relative to its own league), so it assumes a team that dominated its era by
          the same margin would be as good in any era. A game swings about 12 points either way.
        </p>
      </div>

      <div className="table-wrap">
        <table className="era-table">
          <thead>
            <tr>
              <th className="left">Stat</th>
              <th style={{ color: 'var(--series-1)' }}>{seasonLabel(a.season)} {a.id}</th>
              <th style={{ color: 'var(--series-2)' }}>{seasonLabel(b.season)} {b.id}</th>
              <th className="left hide-sm">What it means</th>
            </tr>
          </thead>
          <tbody>
            {rows(data, a.i, b.i).map((r) => (
              <tr key={r.label}>
                <td className="left nowrap">{r.label}</td>
                {[r.a, r.b].map((v, k) => {
                  const other = k ? r.a : r.b;
                  const best = r.higher != null && v.cmp != null && other.cmp != null && (r.higher ? v.cmp > other.cmp : v.cmp < other.cmp);
                  return (
                    <td key={k} className={best ? 'sorted' : undefined}>
                      {v.text}
                      {v.rel && <div className="muted small">{v.rel}</div>}
                    </td>
                  );
                })}
                <td className="left muted small hide-sm">{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="two-col home-row">
        <Roster data={data} side={a} graph={graph} />
        <Roster data={data} side={b} graph={graph} />
      </div>
      <p className="muted small">Team and player numbers from Basketball-Reference. Highlighted = better of the two, judged against each season's league where that's shown (pace and three-point rate are style, so neither is highlighted). Ratings are points per 100 possessions.</p>
    </>
  );
}

function Picker({ side, index, onChange, label }: { side: Side; index: Map<string, number>; onChange: (id: string, season: number) => void; label: string }) {
  const seasons = [...index.keys()].filter((k) => k.startsWith(`${side.id}-`)).map((k) => Number(k.split('-')[1])).sort((x, y) => y - x);
  return (
    <div className="actions">
      <span className="muted small">{label}</span>
      <select value={side.id} onChange={(e) => onChange(e.target.value, side.season)} aria-label={`${label} franchise`}>
        {FRANCHISES.map((f) => (
          <option key={f.id} value={f.id}>{f.name}</option>
        ))}
      </select>
      <select value={side.season} onChange={(e) => onChange(side.id, Number(e.target.value))} aria-label={`${label} season`}>
        {seasons.map((s) => (
          <option key={s} value={s}>{seasonLabel(s)}</option>
        ))}
      </select>
    </div>
  );
}

function Head({ data, side, color }: { data: FranchiseData; side: Side; color: string }) {
  const s = data.teamSeasons[side.i];
  const f = franchiseById(side.id)!;
  const champ = CHAMPIONS[s[0]] && franchiseOf(CHAMPIONS[s[0]])?.id === side.id;
  return (
    <div className="card era-head" style={{ borderTop: `4px solid ${color}` }}>
      <TeamLogo team={{ id: f.espnId, name: f.name, shortName: f.name, abbr: f.id, logo: espnLogo(f) }} size={48} />
      <div>
        <div className="muted small">{seasonLabel(s[0])}</div>
        <div className="era-name">{s[3]}</div>
        <div>
          <b>{s[4]}-{s[5]}</b> {champ ? '🏆 Champions' : s[6] ? '· made playoffs' : '· missed playoffs'}
        </div>
        <div className="small"><Link to={`/franchise/${f.id}`}>Franchise history →</Link></div>
      </div>
    </div>
  );
}

interface Cell {
  text: string;
  rel?: string;
  cmp?: number;
}

function rows(data: FranchiseData, ia: number, ib: number) {
  const lg = (i: number) => data.league.find((l) => l[0] === data.teamSeasons[i][0] && l[1] === data.teamSeasons[i][1]);
  const sign = (v: number, dp = 1) => `${v > 0 ? '+' : ''}${v.toFixed(dp)}`;
  const cell = (v: number | null | undefined, fmt: (v: number) => string, rel?: (v: number) => string | undefined): Cell =>
    v == null ? { text: '–' } : { text: fmt(v), rel: rel?.(v), cmp: v };
  const relCell = (v: number | null | undefined, l: number | null | undefined, fmt: (v: number) => string, relFmt: (d: number) => string): Cell => {
    if (v == null) return { text: '–' };
    return { text: fmt(v), rel: l != null ? `${relFmt(v - l)} vs league` : undefined, cmp: l != null ? v - l : v };
  };
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const both = (f: (i: number) => Cell) => ({ a: f(ia), b: f(ib) });
  const ts = data.teamSeasons;
  const d = data.detail;
  return [
    { label: 'Win %', higher: true, note: '', ...both((i) => cell(ts[i][4] / Math.max(1, ts[i][4] + ts[i][5]), (v) => v.toFixed(3).replace(/^0/, ''))) },
    { label: 'SRS', higher: true, note: 'Margin adjusted for opponents; already relative to its league', ...both((i) => cell(ts[i][7], (v) => sign(v, 2))) },
    { label: 'Point margin', higher: true, note: 'Average winning margin', ...both((i) => cell(d[i][DETAIL.mov], (v) => sign(v))) },
    { label: 'Net rating', higher: true, note: 'Margin per 100 possessions', ...both((i) => cell(d[i][DETAIL.nrtg], (v) => sign(v))) },
    { label: 'Offensive rating', higher: true, note: 'Points scored per 100 possessions', ...both((i) => relCell(ts[i][8], lg(i)?.[LEAGUE.ortg], (v) => v.toFixed(1), (x) => sign(x))) },
    {
      label: 'Defensive rating',
      higher: false,
      note: 'Points allowed per 100 possessions (lower is better)',
      ...both((i) => relCell(ts[i][9], lg(i)?.[LEAGUE.ortg], (v) => v.toFixed(1), (x) => sign(x))),
    },
    { label: 'Pace', higher: null, note: 'Possessions per 48 minutes', ...both((i) => relCell(ts[i][10], lg(i)?.[LEAGUE.pace], (v) => v.toFixed(1), (x) => sign(x))) },
    { label: 'True shooting', higher: true, note: 'Scoring efficiency including threes and free throws', ...both((i) => relCell(d[i][DETAIL.ts], lg(i)?.[LEAGUE.ts], pct, (x) => sign(x * 100))) },
    { label: 'Three-point rate', higher: null, note: 'Share of shots that were threes', ...both((i) => relCell(d[i][DETAIL.par3], lg(i)?.[LEAGUE.par3], pct, (x) => sign(x * 100))) },
    { label: 'Turnover %', higher: false, note: 'Possessions ending in a turnover', ...both((i) => relCell(d[i][DETAIL.tov], lg(i)?.[LEAGUE.tov], (v) => `${v.toFixed(1)}%`, (x) => sign(x))) },
    { label: 'Offensive rebound %', higher: true, note: 'Own misses rebounded', ...both((i) => relCell(d[i][DETAIL.orb], lg(i)?.[LEAGUE.orb], (v) => `${v.toFixed(1)}%`, (x) => sign(x))) },
    { label: 'Opponent eFG%', higher: false, note: 'How well opponents shot', ...both((i) => relCell(d[i][DETAIL.oppEfg], lg(i)?.[LEAGUE.efg], pct, (x) => sign(x * 100))) },
    { label: 'Average age', higher: false, note: 'Weighted by minutes', ...both((i) => cell(d[i][DETAIL.age], (v) => v.toFixed(1))) },
  ].filter((r) => r.a.cmp != null || r.b.cmp != null);
}

function Roster({ data, side, graph }: { data: FranchiseData; side: Side; graph: Graph }) {
  const flat = data.top[side.i] ?? [];
  const players = Array.from({ length: flat.length / 5 }, (_, k) => flat.slice(k * 5, k * 5 + 5));
  const s = data.teamSeasons[side.i];
  const per = (v: number) => (v < 0 ? '–' : (v / 10).toFixed(1));
  return (
    <div className="card">
      <h3>{seasonLabel(s[0])} {s[3]}: top scorers</h3>
      <table>
        <thead>
          <tr>
            <th className="left">Player</th>
            <th>G</th>
            <th>PTS</th>
            <th>REB</th>
            <th>AST</th>
          </tr>
        </thead>
        <tbody>
          {players.map(([p, g, pts, reb, ast]) => (
            <tr key={p}>
              <td className="left"><Link to={`/history?tab=careers&p=${encodeURIComponent(graph.data.players[p][0])}`}>{graph.data.players[p][0]}</Link></td>
              <td>{g}</td>
              <td className="sorted">{per(pts)}</td>
              <td>{per(reb)}</td>
              <td>{per(ast)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
