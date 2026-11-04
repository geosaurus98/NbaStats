// Draft hub: this year's projected order and lottery odds, every team's
// draft classes graded against what their picks usually produce, and which
// franchises draft best.
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DraftLottery } from '../components/DraftLottery';
import { LotteryRace } from '../components/LotteryRace';
import { useCareers } from '../components/CareerStats';
import { ErrorBox, Loading } from '../components/Status';
import { TeamLogo } from '../components/TeamLogo';
import { useAsync } from '../hooks/useAsync';
import { classGrades, draftPicksFrom, gradePicks, teamDrafting, type GradedPick } from '../lib/draftGrades';
import { loadFranchiseData } from '../lib/franchiseData';
import { franchiseById } from '../lib/franchises';
import { useSeason } from '../SeasonContext';
import { buildModel } from './Projections';
import { DraftHistory } from '../components/DraftHistory';
import { LotteryHistory } from '../components/HistoryExtras';
import { useTeammateGraph } from '../lib/teammateStore';

/** Every draft class since 1947 (moved here from History). */
function Classes() {
  const graph = useTeammateGraph();
  return graph ? <DraftHistory graph={graph} /> : <Loading label="Loading every draft since 1947…" />;
}

const TABS = [
  { id: 'order', label: 'Lottery & order' },
  { id: 'race', label: 'Lottery race' },
  { id: 'grades', label: 'Class grades' },
  { id: 'teams', label: 'Best drafting teams' },
  { id: 'classes', label: 'Every draft class' },
  { id: 'lotteries', label: 'Lottery history' },
] as const;

const logoTeam = (id: string) => {
  const f = franchiseById(id);
  return { id: f?.espnId ?? id, abbr: id, name: f?.name ?? id, shortName: f?.name ?? id };
};
const k = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v / 100) / 10).toFixed(1)}k`;

export function Draft() {
  const { season } = useSeason();
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.id === params.get('tab'))?.id ?? 'order';
  const set = (next: Record<string, string>) => setParams({ ...Object.fromEntries(params), ...next }, { replace: true });
  return (
    <section>
      <h1>Draft hub</h1>
      <h2 className="sr-only">Draft</h2>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} aria-pressed={tab === t.id} onClick={() => setParams({ tab: t.id }, { replace: true })}>{t.label}</button>
        ))}
      </div>
      {tab === 'order' && <Order season={season.year} />}
      {tab === 'race' && <LotteryRace season={season.year} />}
      {(tab === 'grades' || tab === 'teams') && <Grades tab={tab} params={params} set={set} />}
      {tab === 'classes' && <Classes />}
      {tab === 'lotteries' && <LotteryHistory />}
    </section>
  );
}

function Order({ season }: { season: number }) {
  const model = useAsync(() => buildModel(season), [season]);
  if (model.error) return <ErrorBox error={model.error} />;
  if (!model.data) return <Loading label="Simulating the season…" />;
  return (
    <>
      <DraftLottery model={model.data} season={season} />
      <p className="small"><Link to="/draft?tab=lotteries">Every lottery since 1985 →</Link> · <Link to="/draft?tab=classes">Every draft class →</Link></p>
    </>
  );
}

function Grades({ tab, params, set }: { tab: 'grades' | 'teams'; params: URLSearchParams; set: (n: Record<string, string>) => void }) {
  const careers = useCareers();
  const fd = useAsync(() => loadFranchiseData(), []);
  const graded = useMemo(() => {
    if (!careers.data || !fd.data) return undefined;
    const picks = draftPicksFrom(fd.data, careers.data);
    return gradePicks(picks);
  }, [careers.data, fd.data]);
  if (careers.error || fd.error) return <ErrorBox error={(careers.error ?? fd.error)!} />;
  if (!graded) return <Loading label="Grading every draft since 1990…" />;
  const years = [...new Set(graded.map((p) => p.season))].sort((a, b) => b - a);
  const latest = years[0];
  const explain = (
    <p className="muted small">
      Career value is points + rebounds + 1.5 × assists + 2 × (steals + blocks), plus 2,000 for each All-Star selection. Each pick is measured against what that slot has usually produced since 1990, scaled to how far its class's careers have got, so recent classes are graded on the same footing (but can still change a lot).
    </p>
  );
  if (tab === 'teams') {
    const from = Number(params.get('from')) || 2005;
    const rows = teamDrafting(graded, from, latest - 2);
    return (
      <>
        <p>
          Value above the usual for every pick from{' '}
          <select value={from} onChange={(e) => set({ from: e.target.value })} aria-label="First draft">
            {[1990, 2000, 2005, 2010, 2015].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>{' '}
          to {latest - 2}.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th className="left">Team</th>
                <th>Picks</th>
                <th title="Picks that beat their slot by a lot">Hits</th>
                <th>Value above the usual</th>
                <th className="left">Best pick</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const best = graded.filter((p) => p.team === r.team && p.season >= from && p.season <= latest - 2).sort((a, b) => b.surplus - a.surplus)[0];
                return (
                  <tr key={r.team}>
                    <td>{i + 1}</td>
                    <td className="left"><span className="team-cell"><TeamLogo team={logoTeam(r.team)} size={20} />{franchiseById(r.team)?.name ?? r.team}</span></td>
                    <td>{r.picks}</td>
                    <td>{r.hits}</td>
                    <td className={r.surplus >= 0 ? 'win' : 'loss'}>{k(r.surplus)}</td>
                    <td className="left small">{best && <>{best.name} <span className="muted">({best.season}, No. {best.pick})</span></>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {explain}
      </>
    );
  }
  const year = Number(params.get('year')) || years.find((y) => y <= latest - 3) || latest;
  const classes = classGrades(graded, year);
  const steals = graded.filter((p) => p.season === year).sort((a, b) => b.surplus - a.surplus).slice(0, 5);
  const busts = graded.filter((p) => p.season === year && p.pick <= 14).sort((a, b) => a.surplus - b.surplus).slice(0, 5);
  const name = (p: GradedPick) => (p.player >= 0 ? <Link to={`/history?tab=careers&p=${encodeURIComponent(p.name)}`}>{p.name}</Link> : <span className="muted">{p.name}</span>);
  return (
    <>
      <p>
        <label>
          Draft{' '}
          <select value={year} onChange={(e) => set({ year: e.target.value })}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        {year > latest - 4 && <span className="muted small"> · careers are only a few seasons in, so these grades will move</span>}
      </p>
      <div className="two-col">
        <div className="card">
          <h3>Biggest steals</h3>
          <ol className="small">{steals.map((p) => <li key={p.name}>{name(p)} <span className="muted">No. {p.pick}, {p.team} · {k(p.surplus)}</span></li>)}</ol>
        </div>
        <div className="card">
          <h3>Lottery disappointments</h3>
          <ol className="small">{busts.map((p) => <li key={p.name}>{name(p)} <span className="muted">No. {p.pick}, {p.team} · {k(p.surplus)}</span></li>)}</ol>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="left">Team</th>
              <th>Grade</th>
              <th className="left">Picks (value against the usual for the slot)</th>
            </tr>
          </thead>
          <tbody>
            {classes.map((c) => (
              <tr key={c.team}>
                <td className="left"><span className="team-cell"><TeamLogo team={logoTeam(c.team)} size={20} />{c.team}</span></td>
                <td><b className={c.grade.startsWith('A') ? 'win' : c.grade === 'D' || c.grade === 'F' ? 'loss' : undefined}>{c.grade}</b></td>
                <td className="left small">
                  {c.picks.map((p, i) => (
                    <span key={p.pick}>{i > 0 && ' · '}No. {p.pick} {name(p)} <span className={p.surplus >= 0 ? 'win' : 'loss'}>{k(p.surplus)}</span></span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {explain}
    </>
  );
}
