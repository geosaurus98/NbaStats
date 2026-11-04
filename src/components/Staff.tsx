// Coaches and front offices: a card for the team page, the franchise's coaching
// and front-office history (with each executive's draft record), and a
// league-wide table. Data: src/data/staff.json (weekly from Basketball-Reference).
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { useCareers } from './CareerStats';
import { draftPicksFrom, draftsDuring, gradePicks } from '../lib/draftGrades';
import { loadFranchiseData } from '../lib/franchiseData';
import { franchiseById, FRANCHISES, type Franchise } from '../lib/franchises';
import { loadStaff, type Executive, type StaffData, type WL } from '../lib/staff';
import { Loading } from './Status';
import { TeamLogo } from './TeamLogo';

export const useStaff = () => useAsync(() => loadStaff(), []);

const code = (f: Franchise) => f.codes[f.codes.length - 1];
const rec = ([w, l]: WL) => `${w}-${l}`;
const pct = ([w, l]: WL) => (w + l ? (w / (w + l)).toFixed(3).replace(/^0/, '') : '–');
const current = (ex: Executive[] | undefined) => (ex ?? []).filter((e) => e.end === 'present' || !e.end);
const year = (d: string) => d.slice(0, 4);
const logo = (f: Franchise) => ({ id: f.espnId, abbr: f.id, name: f.name, shortName: f.name });
const updated = (s: StaffData) => (s.generatedAt ? new Date(s.generatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/** Team page: the head coach and who runs basketball operations. */
export function CoachCard({ teamId }: { teamId: string }) {
  const staff = useStaff();
  const f = FRANCHISES.find((x) => x.espnId === teamId);
  const s = staff.data;
  if (!f || !s?.coaches.length) return null;
  const c = s.coaches.find((x) => x.team === code(f));
  const execs = current(s.executives[code(f)]);
  if (!c && !execs.length) return null;
  return (
    <div className="card">
      <h3>Coach &amp; front office</h3>
      {c && (
        <p>
          <b>{c.name}</b>, head coach{c.seasonsWithTeam ? ` (season ${c.seasonsWithTeam} with the team, ${c.seasons} in all)` : ''}
          <br />
          <span className="small">This season {rec(c.season)} · with the team {rec(c.withTeam)} ({pct(c.withTeam)}) · career {rec(c.career)} ({pct(c.career)}) · playoffs {rec(c.playoffsCareer)}</span>
        </p>
      )}
      {execs.length > 0 && <p className="small"><b>Front office:</b> {execs.map((e) => `${e.name} (since ${year(e.start)})`).join(', ')}</p>}
      <p className="muted small"><Link to={`/franchise/${f.id}#staff`}>Every coach and executive in team history →</Link></p>
    </div>
  );
}

/** Franchise page: coaching history and front offices, with each executive's drafting. */
export function FranchiseStaff({ franchise }: { franchise: Franchise }) {
  const staff = useStaff();
  const careers = useCareers();
  const fd = useAsync(() => loadFranchiseData(), []);
  const graded = useMemo(() => (careers.data && fd.data ? gradePicks(draftPicksFrom(fd.data, careers.data)) : undefined), [careers.data, fd.data]);
  const s = staff.data;
  if (staff.loading) return <Loading />;
  if (!s || !Object.keys(s.coachHistory).length) return null;
  const coaches = [...(s.coachHistory[code(franchise)] ?? [])].reverse();
  const execs = [...(s.executives[code(franchise)] ?? [])].reverse();
  const mine = graded?.filter((p) => p.team === franchise.id) ?? [];
  const k = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v / 100) / 10).toFixed(1)}k`;
  return (
    <>
      <h2 id="staff">Coaches and front office</h2>
      <div className="two-col">
        <div className="table-wrap">
          <h3 className="table-title">Head coaches</h3>
          <table>
            <thead>
              <tr>
                <th className="left">Coach</th>
                <th>Seasons</th>
                <th>W-L</th>
                <th>Win %</th>
                <th>Playoffs</th>
                <th title="Titles">🏆</th>
              </tr>
            </thead>
            <tbody>
              {coaches.map((c) => (
                <tr key={`${c.bref}-${c.from}`}>
                  <td className="left nowrap">{c.name}</td>
                  <td className="muted small">{c.from - 1}–{String(c.to).slice(2)}</td>
                  <td>{rec(c.record)}</td>
                  <td>{pct(c.record)}</td>
                  <td className="muted">{c.playoffs[0] + c.playoffs[1] ? rec(c.playoffs) : '–'}</td>
                  <td>{c.titles || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-wrap">
          <h3 className="table-title">Front office</h3>
          <table>
            <thead>
              <tr>
                <th className="left">Executive</th>
                <th className="left">In charge</th>
                <th title="Picks made in drafts during their time">Picks</th>
                <th title="Career value of those picks against what their slots usually produce">Draft grade</th>
                <th className="left">Best pick</th>
              </tr>
            </thead>
            <tbody>
              {execs.map((e) => {
                const during = draftsDuring(e.start, e.end);
                const picks = mine.filter((p) => during(p.season));
                const surplus = picks.reduce((a, p) => a + p.surplus, 0);
                const best = [...picks].sort((a, b) => b.value - a.value)[0];
                return (
                  <tr key={`${e.bref}-${e.start}`}>
                    <td className="left nowrap">{e.name}{e.notes ? <span className="muted small"> · {e.notes}</span> : null}</td>
                    <td className="left muted small nowrap">{year(e.start)}–{e.end === 'present' || !e.end ? 'now' : year(e.end)}</td>
                    <td>{graded ? picks.length : ''}</td>
                    <td className={picks.length ? (surplus >= 0 ? 'win' : 'loss') : 'muted'}>{graded && picks.length ? k(surplus) : '–'}</td>
                    <td className="left small">{best ? `${best.name} (${best.season}, No. ${best.pick})` : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="muted small">Draft grade: the career value of every pick made on their watch against what those slots usually produce (as on the <Link to="/draft?tab=grades">Draft hub</Link>). Trades aren't included: no data source for them yet.</p>
        </div>
      </div>
      <p className="muted small">From Basketball-Reference, refreshed weekly{s.generatedAt ? ` (last ${updated(s)})` : ''}.</p>
    </>
  );
}

/** Coaches & front offices page: every team's coach and executives. */
export function CoachesPage() {
  const staff = useStaff();
  const [sort, setSort] = useState<'team' | 'season' | 'career' | 'tenure'>('career');
  const s = staff.data;
  if (staff.loading) return <Loading />;
  if (!s?.coaches.length) return <p className="muted">Coach data hasn't been fetched yet.</p>;
  const rows = s.coaches
    .map((c) => ({ c, f: FRANCHISES.find((f) => f.codes.includes(c.team)) ?? franchiseById(c.team), execs: current(s.executives[c.team]) }))
    .sort((a, b) =>
      sort === 'team' ? (a.f?.name ?? '').localeCompare(b.f?.name ?? '') : sort === 'season' ? b.c.season[0] - b.c.season[1] - (a.c.season[0] - a.c.season[1]) : sort === 'tenure' ? b.c.seasonsWithTeam - a.c.seasonsWithTeam : b.c.career[0] - a.c.career[0],
    );
  const head = (key: typeof sort, label: string, left = false) => (
    <th className={`${left ? 'left ' : ''}sortable${sort === key ? ' sorted' : ''}`} aria-sort={sort === key ? 'descending' : 'none'}>
      <button className="link" onClick={() => setSort(key)}>{label}</button>
    </th>
  );
  return (
    <section>
      <h1>Coaches &amp; front offices</h1>
      <h2 className="sr-only">Every team</h2>
      <p className="muted">Every team's head coach, with this season's record, their record with the team and over their career, and who runs the front office.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {head('team', 'Team', true)}
              <th className="left">Coach</th>
              {head('season', 'This season')}
              {head('tenure', 'Seasons with team')}
              <th>With team</th>
              {head('career', 'Career')}
              <th>Playoffs</th>
              <th className="left">Front office</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ c, f, execs }) => (
              <tr key={c.team}>
                <td className="left">{f ? <Link to={`/franchise/${f.id}#staff`} className="team-cell"><TeamLogo team={logo(f)} size={18} />{f.id}</Link> : c.team}</td>
                <td className="left nowrap">{c.name}</td>
                <td>{rec(c.season)}</td>
                <td>{c.seasonsWithTeam}</td>
                <td>{rec(c.withTeam)}</td>
                <td>{rec(c.career)} <span className="muted small">{pct(c.career)}</span></td>
                <td className="muted">{rec(c.playoffsCareer)}</td>
                <td className="left small">{execs.map((e) => e.name).join(', ') || '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">From Basketball-Reference, refreshed weekly{s.generatedAt ? ` (last ${updated(s)})` : ''}. Open a team for its full coaching and front-office history, with each executive's draft record.</p>
    </section>
  );
}
