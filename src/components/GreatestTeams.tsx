// History → Greatest teams: every team-season ranked by SRS (point margin
// adjusted for schedule, relative to its own league), so eras compare fairly.
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { CHAMPIONS, LEAGUE, loadFranchiseData } from '../lib/franchiseData';
import { espnLogo, franchiseOf } from '../lib/franchises';
import { seasonLabel, type Graph } from '../lib/teammates';
import { ErrorBox, Loading } from './Status';
import { TeamLogo } from './TeamLogo';

const ERAS = [
  { id: 'all', label: 'All time', from: 0, to: 9999 },
  { id: '1950', label: '1950s–60s', from: 1947, to: 1969 },
  { id: '1970', label: '1970s', from: 1970, to: 1979 },
  { id: '1980', label: '1980s', from: 1980, to: 1989 },
  { id: '1990', label: '1990s', from: 1990, to: 1999 },
  { id: '2000', label: '2000s', from: 2000, to: 2009 },
  { id: '2010', label: '2010s', from: 2010, to: 2019 },
  { id: '2020', label: '2020s', from: 2020, to: 9999 },
];

export function GreatestTeams({ graph }: { graph: Graph }) {
  const fd = useAsync(() => loadFranchiseData(), []);
  const [params, setParams] = useSearchParams();
  const era = ERAS.find((e) => e.id === params.get('era')) ?? ERAS[0];
  const champsOnly = params.get('champs') === '1';
  const set = (k: string, v: string | undefined) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  const rows = useMemo(() => {
    if (!fd.data) return [];
    const d = fd.data;
    return d.teamSeasons
      .map((s, i) => ({ s, i, f: franchiseOf(s[2]) }))
      .filter(({ s, f }) => s[1] !== 1 && s[7] != null && f && s[0] >= era.from && s[0] <= era.to)
      .map((x) => ({ ...x, champ: CHAMPIONS[x.s[0]] != null && franchiseOf(CHAMPIONS[x.s[0]])?.id === x.f!.id }))
      .filter((x) => !champsOnly || x.champ)
      .sort((a, b) => b.s[7]! - a.s[7]!)
      .slice(0, 50);
  }, [fd.data, era, champsOnly]);

  if (fd.error) return <ErrorBox error={fd.error} />;
  if (!fd.data) return <Loading label="Loading every team-season…" />;
  const d = fd.data;
  const lg = (i: number) => d.league.find((l) => l[0] === d.teamSeasons[i][0] && l[1] === d.teamSeasons[i][1]);
  const rel = (v: number | null, l: number | null | undefined, invert = false) => (v == null || l == null ? '–' : `${(invert ? l - v : v - l) > 0 ? '+' : ''}${(invert ? l - v : v - l).toFixed(1)}`);

  return (
    <>
      <p className="muted">Every NBA and BAA team-season ranked by SRS: average winning margin adjusted for schedule strength, measured against its own league, so a 1960s team and a 2020s team can sit on the same list.</p>
      <div className="chips tight">
        {ERAS.map((e) => (
          <button key={e.id} className={e.id === era.id ? 'chip active' : 'chip'} onClick={() => set('era', e.id === 'all' ? undefined : e.id)}>{e.label}</button>
        ))}
        <button className={champsOnly ? 'chip active' : 'chip'} onClick={() => set('champs', champsOnly ? undefined : '1')}>🏆 Champions only</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th className="left">Team</th>
              <th>W-L</th>
              <th title="Simple rating system">SRS</th>
              <th className="hide-sm" title="Offensive rating vs that season's league">Off. vs lg</th>
              <th className="hide-sm" title="Defensive rating vs that season's league (positive = better)">Def. vs lg</th>
              <th className="left hide-sm">Top scorer</th>
              <th className="left">Result</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ s, i, f, champ }, k) => {
              const top = d.top[i];
              return (
                <tr key={`${s[0]}-${s[2]}`}>
                  <td>{k + 1}</td>
                  <td className="left nowrap">
                    <Link to={`/franchise/${f!.id}`} className="team-cell">
                      <TeamLogo team={{ id: f!.espnId, name: f!.name, shortName: f!.name, abbr: f!.id, logo: espnLogo(f!) }} size={18} />
                      {seasonLabel(s[0])} {s[3]}
                    </Link>
                  </td>
                  <td>{s[4]}-{s[5]}</td>
                  <td className="sorted">{s[7]!.toFixed(2)}</td>
                  <td className="hide-sm">{rel(s[8], lg(i)?.[LEAGUE.ortg])}</td>
                  <td className="hide-sm">{rel(s[9], lg(i)?.[LEAGUE.ortg], true)}</td>
                  <td className="left hide-sm small">{top?.length ? `${graph.data.players[top[0]][0]} ${(top[2] / 10).toFixed(1)}` : '–'}</td>
                  <td className="left nowrap">{champ ? '🏆 Champions' : s[6] ? 'Playoffs' : <span className="muted">Missed playoffs</span>}</td>
                  <td>
                    <Link className="small nowrap" to={`/history?tab=teams&a=${f!.id}-${s[0]}&b=${k === 0 ? (rows[1] ? `${rows[1].f!.id}-${rows[1].s[0]}` : 'GSW-2017') : `${rows[0].f!.id}-${rows[0].s[0]}`}`}>Compare →</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted small">"Compare" opens that team against the top team on this list in Team vs team, with the full breakdown and the odds if they met.</p>
    </>
  );
}
