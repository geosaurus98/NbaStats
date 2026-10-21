// All-time leaderboards and awards history (History page tabs).
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { franchiseOf } from '../lib/franchises';
import {
  allStarCounts,
  AWARD_NAMES,
  careerLeaders,
  LEAGUE_NAMES,
  seasonBests,
  STAT_LABELS,
  type CareerData,
  type StatKey,
} from '../lib/careers';
import { seasonLabel, type Graph } from '../lib/teammates';
import { useCareers } from './CareerStats';
import { ErrorBox, Loading } from './Status';

const careerLink = (graph: Graph, p: number) => `/history?tab=careers&p=${encodeURIComponent(graph.data.players[p][0])}`;
const years = (graph: Graph, p: number) => `${graph.data.players[p][1] - 1}–${graph.data.players[p][2]}`;

const LEADER_STATS: StatKey[] = ['pts', 'trb', 'ast', 'stl', 'blk', 'tp', 'g', 'mp'];
const MODES = [
  { id: 'total', label: 'Career totals' },
  { id: 'perGame', label: 'Per game (400+ games)' },
  { id: 'season', label: 'Best single seasons' },
] as const;
type Mode = (typeof MODES)[number]['id'];

const RECORDED: Partial<Record<StatKey, string>> = {
  trb: 'Rebounds recorded since 1950-51.',
  stl: 'Steals recorded since 1973-74.',
  blk: 'Blocks recorded since 1973-74.',
  tp: 'The three-point line arrived in 1979-80 (ABA from 1967).',
};

function useData() {
  const careers = useCareers();
  const view = careers.loading ? <Loading label="Loading every career since 1946-47…" /> : careers.error ? <ErrorBox error={careers.error} /> : null;
  return { data: careers.data, view };
}

export function AllTimeLeaders({ graph }: { graph: Graph }) {
  const { data, view } = useData();
  const [stat, setStat] = useState<StatKey>('pts');
  const [mode, setMode] = useState<Mode>('total');
  const [nbaOnly, setNbaOnly] = useState(false);
  const perGameStat = stat !== 'g';
  const rows = useMemo(() => {
    if (!data) return [];
    if (mode === 'season') return seasonBests(data, stat === 'g' ? 'pts' : stat, 25).map((r) => ({ ...r, label: `${seasonLabel(r.season)}${r.league ? ` ${LEAGUE_NAMES[r.league]}` : ''}` }));
    return careerLeaders(data, stat, perGameStat ? mode : 'total', 400, 25, nbaOnly).map((r) => ({ ...r, label: years(graph, r.player) }));
  }, [data, stat, mode, nbaOnly, perGameStat, graph]);
  if (view) return view;
  const max = Math.max(1, ...rows.map((r) => r.value));
  const fmt = (v: number) => (mode === 'total' || !perGameStat ? Math.round(v).toLocaleString() : v.toFixed(1));

  return (
    <>
      <div className="chips">
        {LEADER_STATS.map((k) => (
          <button key={k} className={k === stat ? 'chip active' : 'chip'} onClick={() => setStat(k)}>{STAT_LABELS[k]}</button>
        ))}
      </div>
      <div className="page-head">
        <div className="segmented">
          {MODES.map((m) => (
            <button key={m.id} className={m.id === mode ? 'active' : ''} onClick={() => setMode(m.id)} disabled={m.id !== 'total' && !perGameStat}>{m.label}</button>
          ))}
        </div>
        {mode !== 'season' && (
          <label className="small">
            <input type="checkbox" checked={nbaOnly} onChange={(e) => setNbaOnly(e.target.checked)} /> NBA/BAA only (exclude ABA)
          </label>
        )}
      </div>
      <div className="card">
        <div className="partner-bars">
          {rows.map((r, i) => (
            <div key={`${r.player}-${i}`} className="pbar wide">
              <span className="pbar-name">
                <span className="muted">{i + 1}.</span> <Link to={careerLink(graph, r.player)}>{graph.data.players[r.player][0]}</Link>
                <span className="muted small">{r.label}</span>
              </span>
              <span className="pbar-track">
                <span className="pbar-fill" style={{ width: `${(r.value / max) * 100}%`, background: 'var(--series-1)' }} />
              </span>
              <b className="pbar-n">{fmt(r.value)}</b>
              <span className="muted small">{r.games} g</span>
            </div>
          ))}
        </div>
      </div>
      <p className="muted small">
        Regular season, NBA/BAA/ABA combined unless filtered. {RECORDED[stat] ?? ''} Single seasons need 50+ games.
      </p>
    </>
  );
}

const AWARD_ORDER = ['nba mvp', 'nba dpoy', 'nba roy', 'nba smoy', 'nba mip', 'nba clutch_poy', 'aba mvp', 'aba roy'];

export function Awards({ graph }: { graph: Graph }) {
  const { data, view } = useData();
  const [award, setAward] = useState('nba mvp');
  const rows = data?.awards[award] ?? [];
  const seasons = [...new Set(rows.map((r) => r[0]))].sort((a, b) => b - a);
  const [season, setSeason] = useState<number | undefined>();
  if (view) return view;
  const d = data as CareerData;
  const year = season && seasons.includes(season) ? season : seasons[0];
  const race = rows.filter((r) => r[0] === year).sort((a, b) => b[2] - a[2]).slice(0, 10);
  const winners = seasons.map((y) => ({ season: y, winners: rows.filter((r) => r[0] === y && r[3]).map((r) => r[1]) }));
  const wins = new Map<number, number>();
  for (const r of rows) if (r[3]) wins.set(r[1], (wins.get(r[1]) ?? 0) + 1);
  const mostWins = [...wins].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const stars = [...allStarCounts(d)].sort((a, b) => b[1] - a[1]).slice(0, 15);
  // Franchise of each winner in that season (their team that year).
  const byFranchise = new Map<string, number>();
  for (const { season: y, winners: ws } of winners) {
    for (const p of ws) {
      const code = (graph.data.stints[p] ?? []).map((r) => graph.data.rosters[r]).filter((r) => r[0] === y).pop()?.[2];
      const key = code ? (franchiseOf(code)?.id ?? code) : '?';
      byFranchise.set(key, (byFranchise.get(key) ?? 0) + 1);
    }
  }
  const franchises = [...byFranchise].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const name = AWARD_NAMES[award] ?? award;

  return (
    <>
      <div className="chips">
        {AWARD_ORDER.filter((a) => d.awards[a]).map((a) => (
          <button key={a} className={a === award ? 'chip active' : 'chip'} onClick={() => { setAward(a); setSeason(undefined); }}>{AWARD_NAMES[a]}</button>
        ))}
      </div>
      <div className="degrees-main">
        <div className="card">
          <div className="page-head">
            <h3>{seasonLabel(year)} {name} voting</h3>
            <select value={year} onChange={(e) => setSeason(Number(e.target.value))}>
              {seasons.map((y) => (
                <option key={y} value={y}>{seasonLabel(y)}</option>
              ))}
            </select>
          </div>
          <div className="partner-bars">
            {race.map((r) => (
              <div key={r[1]} className="pbar wide" title={`${r[4] >= 0 ? `${r[4]} first-place votes` : ''}`}>
                <span className="pbar-name">
                  {r[3] ? '🏆' : ''} <Link to={careerLink(graph, r[1])}>{graph.data.players[r[1]][0]}</Link>
                </span>
                <span className="pbar-track">
                  <span className="pbar-fill" style={{ width: `${r[2] * 100}%`, background: r[3] ? 'var(--series-2)' : 'var(--series-1)' }} />
                </span>
                <b className="pbar-n">{Math.round(r[2] * 100)}%</b>
                <span className="muted small">{r[4] > 0 ? `${r[4]} 1st` : ''}</span>
              </div>
            ))}
          </div>
          <p className="muted small">Share of the maximum possible voting points. Orange = winner.</p>
        </div>
        <div className="card chain-card">
          <h3>Most {name} awards</h3>
          <table>
            <tbody>
              {mostWins.map(([p, n], i) => (
                <tr key={p}>
                  <td>{i + 1}</td>
                  <td className="left"><Link to={careerLink(graph, p)}>{graph.data.players[p][0]}</Link></td>
                  <td className="sorted">{n}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>By franchise</h3>
          <table>
            <tbody>
              {franchises.map(([f, n]) => (
                <tr key={f}>
                  <td className="left">{f}</td>
                  <td className="sorted">{n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="two-col">
        <div className="card">
          <h3>Every {name}</h3>
          <div className="winners-list">
            {winners.map((w) => (
              <button key={w.season} className={`winner-row${w.season === year ? ' active' : ''}`} onClick={() => setSeason(w.season)}>
                <span className="muted small">{seasonLabel(w.season)}</span> {w.winners.map((p) => graph.data.players[p][0]).join(' & ')}
              </button>
            ))}
          </div>
        </div>
        <div className="card">
          <h3>Most All-Star selections</h3>
          <table>
            <tbody>
              {stars.map(([p, n], i) => (
                <tr key={p}>
                  <td>{i + 1}</td>
                  <td className="left"><Link to={careerLink(graph, p)}>{graph.data.players[p][0]}</Link> <span className="muted small">{years(graph, p)}</span></td>
                  <td className="sorted">{n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="muted small">Award voting through 2024-25 (2025-26 awards aren't in the source yet).</p>
    </>
  );
}
