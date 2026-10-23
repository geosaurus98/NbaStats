// History → Draft: every draft class, best player at each slot, late-pick
// steals and how No. 1 picks turned out.
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { allStarCounts, perGame, totals } from '../lib/careers';
import { loadFranchiseData } from '../lib/franchiseData';
import { franchiseValue } from '../lib/franchiseHistory';
import { ordinal } from '../lib/milestones';
import { franchiseOf, FRANCHISES } from '../lib/franchises';
import { seasonLabel, type Graph } from '../lib/teammates';
import { useCareers } from './CareerStats';
import { ErrorBox, Loading } from './Status';

export function DraftHistory({ graph }: { graph: Graph }) {
  const careers = useCareers();
  const fd = useAsync(() => loadFranchiseData(), []);
  const [params, setParams] = useSearchParams();
  const team = params.get('team') ?? '';
  const redraft = params.get('view') === 'redraft';

  const model = useMemo(() => {
    if (!careers.data || !fd.data) return undefined;
    const stars = allStarCounts(careers.data);
    const picks = fd.data.draft
      .filter((d) => d[1] !== 1) // NBA/BAA drafts (ABA drafts listed separately in the source)
      .map((d) => {
        const t = d[5] >= 0 ? totals(careers.data!.seasons[d[5]] ?? []) : undefined;
        return { season: d[0], pick: d[2], round: d[3], code: d[4], player: d[5], name: d[6], college: d[7], pts: t?.values.pts ?? 0, ppg: t ? perGame(t, 'pts') : undefined, seasons: t?.seasons ?? 0, stars: d[5] >= 0 ? (stars.get(d[5]) ?? 0) : 0, value: t ? franchiseValue(t.values) + (stars.get(d[5]) ?? 0) * 2000 : 0 };
      });
    return { picks, years: [...new Set(picks.map((p) => p.season))].sort((a, b) => b - a) };
  }, [careers.data, fd.data]);

  if (careers.error || fd.error) return <ErrorBox error={(careers.error ?? fd.error)!} />;
  if (!model) return <Loading label="Loading every draft since 1947…" />;
  const year = Number(params.get('year')) || model.years.find((y) => y <= 2020) || model.years[0];
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };
  const ofTeam = (p: { code: string }) => !team || (franchiseOf(p.code)?.id ?? p.code) === team;
  const cls = model.picks.filter((p) => p.season === year && ofTeam(p)).sort((a, b) => a.pick - b.pick);
  const pool = model.picks.filter(ofTeam);
  const bestAtSlot = Array.from({ length: 30 }, (_, i) => pool.filter((p) => p.pick === i + 1).sort((a, b) => b.pts - a.pts)[0]).filter(Boolean);
  const steals = pool.filter((p) => p.pick >= 15).sort((a, b) => b.pts - a.pts).slice(0, 15);
  const firsts = model.picks.filter((p) => p.pick === 1 && ofTeam(p)).sort((a, b) => b.season - a.season);
  const link = (p: { player: number; name: string }) => (p.player >= 0 ? <Link to={`/history?tab=careers&p=${encodeURIComponent(graph.data.players[p.player][0])}`}>{p.name}</Link> : <span>{p.name}</span>);
  const career = (p: (typeof cls)[number]) => (p.player < 0 ? <span className="muted">never played</span> : `${p.seasons} season${p.seasons === 1 ? '' : 's'} · ${p.pts.toLocaleString()} pts${p.stars ? ` · ${p.stars}× All-Star` : ''}`);

  return (
    <>
      <div className="page-head">
        <div className="actions">
          <label className="small">
            Draft{' '}
            <select value={year} onChange={(e) => set('year', e.target.value)}>
              {model.years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
          <label className="small">
            Team{' '}
            <select value={team} onChange={(e) => set('team', e.target.value)}>
              <option value="">All teams</option>
              {FRANCHISES.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="chips tight">
        <button className={!redraft ? 'chip active' : 'chip'} onClick={() => set('view', '')}>As drafted</button>
        <button className={redraft ? 'chip active' : 'chip'} onClick={() => set('view', 'redraft')}>Redraft by career</button>
      </div>
      {redraft && <Redraft picks={model.picks.filter((p) => p.season === year)} year={year} link={link} />}
      {!redraft && (
      <div className="table-wrap">
        <h3 className="table-title">{year} draft{team ? ` · ${team}` : ''}</h3>
        <table>
          <thead>
            <tr>
              <th>Pick</th>
              <th className="left">Team</th>
              <th className="left">Player</th>
              <th className="left hide-sm">College / from</th>
              <th className="left">Career</th>
            </tr>
          </thead>
          <tbody>
            {cls.map((p) => (
              <tr key={`${p.pick}-${p.name}`}>
                <td>{p.pick}</td>
                <td className="left">{p.code}</td>
                <td className="left">{link(p)}</td>
                <td className="left muted small hide-sm">{p.college}</td>
                <td className="left small">{career(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
      <div className="two-col">
        <div className="card">
          <h3>Best player at each pick{team ? ` (${team})` : ''}</h3>
          <table>
            <tbody>
              {bestAtSlot.map((p) => (
                <tr key={p.pick}>
                  <td>#{p.pick}</td>
                  <td className="left">{link(p)} <span className="muted small">{p.season} {p.code}</span></td>
                  <td className="sorted small">{p.pts.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">By career points.</p>
        </div>
        <div className="card">
          <h3>Biggest steals: pick 15 or later</h3>
          <table>
            <tbody>
              {steals.map((p) => (
                <tr key={`${p.season}-${p.pick}`}>
                  <td className="muted small">{p.season} #{p.pick}</td>
                  <td className="left">{link(p)} <span className="muted small">{p.code}</span></td>
                  <td className="sorted small">{p.pts.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>No. 1 picks</h3>
          <div className="winners-list">
            {firsts.map((p) => (
              <div key={p.season} className="winner-row" title={p.player >= 0 ? `${p.pts.toLocaleString()} career points` : ''}>
                <span className="muted small">{p.season}</span> {link(p)} <span className="muted small">{p.code}{p.stars ? ` · ${p.stars}× AS` : ''}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="muted small">NBA and BAA drafts from Basketball-Reference. Seasons and points are each player's whole career. {seasonLabel(year + 1)} was this class's rookie season.</p>
    </>
  );
}

interface RedraftPick {
  pick: number;
  code: string;
  player: number;
  name: string;
  pts: number;
  seasons: number;
  stars: number;
  value: number;
}

/** The class re-ordered by what each player went on to do (whole career). */
function Redraft({ picks, year, link }: { picks: RedraftPick[]; year: number; link: (p: { player: number; name: string }) => React.ReactNode }) {
  const ranked = [...picks].filter((p) => p.pick > 0).sort((a, b) => b.value - a.value || a.pick - b.pick);
  const rows = ranked.slice(0, 30).map((p, i) => ({ ...p, redraft: i + 1, move: p.pick - (i + 1) }));
  const steal = [...rows].sort((a, b) => b.move - a.move)[0];
  const bust = ranked
    .map((p, i) => ({ ...p, redraft: i + 1 }))
    .filter((p) => p.pick <= 5)
    .sort((a, b) => b.redraft - b.pick - (a.redraft - a.pick))[0];
  return (
    <div className="table-wrap">
      <h3 className="table-title">{year} redraft</h3>
      <p className="muted small" style={{ padding: '0 .9rem' }}>
        Ranked by career production (points, rebounds, 1.5× assists, 2× steals and blocks, plus All-Star selections).
        {steal && steal.move > 0 ? ` Biggest steal: ${steal.name}, taken ${ordinal(steal.pick)}, goes ${ordinal(steal.redraft)}.` : ''}
        {bust && bust.redraft > bust.pick ? ` Biggest fall: ${bust.name}, taken ${ordinal(bust.pick)}, goes ${ordinal(bust.redraft)}.` : ''}
      </p>
      <table>
        <thead>
          <tr>
            <th>New</th>
            <th className="left">Player</th>
            <th>Was</th>
            <th>Move</th>
            <th className="left">Career</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={`${p.pick}-${p.name}`}>
              <td className="sorted">{p.redraft}</td>
              <td className="left">{link(p)} <span className="muted small">{p.code}</span></td>
              <td>{p.pick}</td>
              <td className="small">{p.move > 0 ? <span className="win">▲{p.move}</span> : p.move < 0 ? <span className="loss">▼{-p.move}</span> : '–'}</td>
              <td className="left small">{p.player < 0 ? <span className="muted">never played</span> : `${p.seasons} season${p.seasons === 1 ? '' : 's'} · ${p.pts.toLocaleString()} pts${p.stars ? ` · ${p.stars}× All-Star` : ''}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
