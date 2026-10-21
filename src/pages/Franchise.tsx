import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ColumnChart } from '../components/Charts';
import { useCareers } from '../components/CareerStats';
import { ErrorBox, Loading } from '../components/Status';
import { TeamLogo } from '../components/TeamLogo';
import { Tile } from '../components/Tile';
import { useAsync } from '../hooks/useAsync';
import { LEAGUE_NAMES, STAT_LABELS, totals, type StatKey } from '../lib/careers';
import { loadFranchiseData } from '../lib/franchiseData';
import { allTimeFive, eras, franchiseDraft, franchiseLeaders, franchiseSeasons, franchiseTotals, titlesOf } from '../lib/franchiseHistory';
import { espnLogo, franchiseById, FRANCHISES } from '../lib/franchises';
import { useTeammateGraph } from '../lib/teammateStore';
import { seasonLabel } from '../lib/teammates';

const LEADER_STATS: StatKey[] = ['pts', 'trb', 'ast', 'stl', 'blk', 'g'];

export function Franchise() {
  const { id = '' } = useParams();
  const f = franchiseById(id.toUpperCase());
  const graph = useTeammateGraph();
  const careers = useCareers();
  const fd = useAsync(() => loadFranchiseData(), []);
  const [stat, setStat] = useState<StatKey>('pts');

  const model = useMemo(() => {
    if (!f || !graph || !careers.data || !fd.data) return undefined;
    const seasons = franchiseSeasons(fd.data, f.id);
    const totals = franchiseTotals(graph, careers.data, f.id);
    return {
      seasons,
      eras: eras(seasons),
      titles: titlesOf(f.id),
      totals,
      draft: franchiseDraft(fd.data, f.id),
      five: allTimeFive(totals, careers.data.pos ?? []),
    };
  }, [f, graph, careers.data, fd.data]);

  if (!f) return <ErrorBox error={new Error(`No franchise "${id}"`)} />;
  if (fd.error || careers.error) return <ErrorBox error={(fd.error ?? careers.error)!} />;
  if (!model || !graph || !careers.data) return <Loading label="Loading franchise history…" />;

  const { seasons, titles } = model;
  const w = seasons.reduce((a, s) => a + Math.max(0, s[4]), 0);
  const l = seasons.reduce((a, s) => a + Math.max(0, s[5]), 0);
  const playoffs = seasons.filter((s) => s[6]).length;
  const pct = (s: (typeof seasons)[number]) => (s[4] + s[5] > 0 ? s[4] / (s[4] + s[5]) : 0);
  const best = [...seasons].sort((a, b) => pct(b) - pct(a))[0];
  const titleSet = new Set(titles);
  const leaders = franchiseLeaders(model.totals, stat, 10);
  const max = Math.max(1, ...leaders.map((r) => r.value));
  const careerLink = (p: number) => `/history?tab=careers&p=${encodeURIComponent(graph.data.players[p][0])}`;
  const draftWithCareers = model.draft
    .filter((d) => d[5] >= 0)
    // Players drafted twice (e.g. Elgin Baylor) appear once, at their final selection.
    .filter((d, _, all) => !all.some((o) => o[5] === d[5] && o[0] > d[0]))
    .map((d) => ({ d, pts: totals(careers.data!.seasons[d[5]] ?? []).values.pts }))
    .sort((a, b) => b.pts - a.pts)
    .slice(0, 12);
  const team = { id: f.espnId, name: f.name, shortName: f.name, abbr: f.id, logo: espnLogo(f) };

  return (
    <section>
      <div className="page-head">
        <h1 className="team-title">
          <TeamLogo team={team} size={44} /> <span>{f.name} <span className="muted">history</span></span>
        </h1>
        <div className="actions">
          <Link className="chip" to={`/team/${f.espnId}`}>This season →</Link>
          <select value={f.id} onChange={(e) => (window.location.hash = `#/franchise/${e.target.value}`)} aria-label="Pick a franchise">
            {FRANCHISES.map((x) => (
              <option key={x.id} value={x.id}>{x.name}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="muted">
        {model.eras.map((e, i) => (
          <span key={i}>
            {i > 0 && ' → '}
            <b>{e.name}</b> {e.from === e.to ? seasonLabel(e.from) : `${e.from - 1}–${e.to}`}
            {e.league ? ` (${LEAGUE_NAMES[e.league]})` : ''}
          </span>
        ))}
      </p>

      <div className="stat-tiles">
        <Tile label="NBA titles" value={String(titles.length)} />
        <Tile label="Seasons" value={String(seasons.length)} />
        <Tile label="All-time record" value={`${w.toLocaleString()}-${l.toLocaleString()}`} />
        <Tile label="Win %" value={(w / Math.max(1, w + l)).toFixed(3).replace(/^0/, '')} />
        <Tile label="Playoff seasons" value={String(playoffs)} />
        {best && <Tile label={`Best season (${seasonLabel(best[0])})`} value={`${best[4]}-${best[5]}`} />}
      </div>
      {titles.length > 0 && (
        <div className="chips tight">
          {titles.map((y) => (
            <span key={y} className="chip static">🏆 {seasonLabel(y)}</span>
          ))}
        </div>
      )}

      <div className="card">
        <h3>Every season: win % above or below .500</h3>
        <ColumnChart
          ariaLabel="Win percentage minus .500 for each season"
          columns={seasons.map((s) => ({
            value: Math.round((pct(s) - 0.5) * 1000) / 10,
            label: `${seasonLabel(s[0])} ${s[3]}`,
            detail: `${s[4]}-${s[5]}${titleSet.has(s[0]) ? ' · 🏆 champions' : s[6] ? ' · playoffs' : ''}`,
          }))}
          yFormat={(v) => (v > 0 ? `+${v}` : String(v))}
        />
        <p className="muted small">Blue = winning season, red = losing. Hover a bar for the record (🏆 = title).</p>
      </div>

      <div className="card">
        <h3>All-time starting five</h3>
        <div className="five">
          {model.five.starters.map(({ slot, player }) => {
            const t = model.totals.get(player)!;
            return (
              <div key={slot} className="five-player">
                <span className="five-slot">{slot}</span>
                <Link to={careerLink(player)}><b>{graph.data.players[player][0]}</b></Link>
                <span className="muted small">{t.from - 1}–{t.to} · {t.g} g</span>
                <span className="small">{(t.pts / t.g).toFixed(1)} pts · {(t.trb / t.g).toFixed(1)} reb · {(t.ast / t.g).toFixed(1)} ast</span>
              </div>
            );
          })}
        </div>
        <p className="small">
          <span className="muted">Bench: </span>
          {model.five.bench.map((p, i) => (
            <span key={p}>{i > 0 && ', '}<Link to={careerLink(p)}>{graph.data.players[p][0]}</Link></span>
          ))}
        </p>
        <p className="muted small">Chosen by production while with this franchise (points, rebounds, 1.5× assists, 2× steals and blocks) and each player's main position. Per-game numbers are with this team.</p>
      </div>

      <div className="degrees-main">
        <div className="card">
          <h3>Franchise leaders: {STAT_LABELS[stat].toLowerCase()}</h3>
          <div className="chips tight">
            {LEADER_STATS.map((k) => (
              <button key={k} className={k === stat ? 'chip active' : 'chip'} onClick={() => setStat(k)}>{STAT_LABELS[k]}</button>
            ))}
          </div>
          <div className="partner-bars">
            {leaders.map((r, i) => (
              <div key={r.player} className="pbar franchise">
                <span className="pbar-name">
                  <span className="muted">{i + 1}.</span> <Link to={careerLink(r.player)}>{graph.data.players[r.player][0]}</Link>
                  <span className="muted small">{r.from - 1}–{r.to}</span>
                </span>
                <span className="pbar-track">
                  <span className="pbar-fill" style={{ width: `${(r.value / max) * 100}%`, background: 'var(--series-1)' }} />
                </span>
                <b className="pbar-n">{r.value.toLocaleString()}</b>
                <span className="muted small">{r.games} g</span>
              </div>
            ))}
          </div>
          <p className="muted small">Only seasons with this franchise (traded seasons split by team).</p>
        </div>
        <div className="card chain-card">
          <h3>Best draft picks</h3>
          <table>
            <tbody>
              {draftWithCareers.map(({ d, pts }) => (
                <tr key={`${d[0]}-${d[2]}`}>
                  <td className="left nowrap muted small">{d[0]} #{d[2]}</td>
                  <td className="left"><Link to={careerLink(d[5])}>{d[6]}</Link></td>
                  <td className="muted small">{pts.toLocaleString()} pts</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">By career points (anywhere). <Link to={`/history?tab=draft&team=${f.id}`}>Full draft history →</Link></p>
        </div>
      </div>

      <h2>Season by season</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="left">Season</th>
              <th className="left">Team</th>
              <th>W-L</th>
              <th>Win %</th>
              <th className="left">Playoffs</th>
              <th title="Simple rating system: point margin adjusted for schedule">SRS</th>
              <th title="Points scored per 100 possessions">ORtg</th>
              <th title="Points allowed per 100 possessions">DRtg</th>
              <th>Pace</th>
              <th className="hide-sm">Attendance/g</th>
            </tr>
          </thead>
          <tbody>
            {[...seasons].reverse().map((s) => (
              <tr key={`${s[0]}-${s[2]}`}>
                <td className="left nowrap">
                  {s[1] === 1 ? seasonLabel(s[0]) : <Link to={`/history?tab=teams&a=${f.id}-${s[0]}`} title="Compare this season with any other">{seasonLabel(s[0])}</Link>}
                  {s[1] ? <span className="muted small"> {LEAGUE_NAMES[s[1]]}</span> : null}
                </td>
                <td className="left nowrap">{s[3]}</td>
                <td>{s[4]}-{s[5]}</td>
                <td>{pct(s).toFixed(3).replace(/^0/, '')}</td>
                <td className="left">{titleSet.has(s[0]) ? '🏆 Champions' : s[6] ? 'Made playoffs' : <span className="muted">–</span>}</td>
                <td>{s[7] == null ? '–' : s[7].toFixed(2)}</td>
                <td>{s[8] == null ? '–' : s[8].toFixed(1)}</td>
                <td>{s[9] == null ? '–' : s[9].toFixed(1)}</td>
                <td>{s[10] == null ? '–' : s[10].toFixed(1)}</td>
                <td className="hide-sm">{s[11] ? s[11].toLocaleString() : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">Team records and ratings from Basketball-Reference. Titles are NBA/BAA championships (ABA titles aren't counted). Click a season to compare it with any other team's.</p>
    </section>
  );
}
