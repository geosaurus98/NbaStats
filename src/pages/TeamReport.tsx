// A one-page, printable season report for a team: record and ratings with
// league ranks, the four factors, the players, best lineups, quarters, luck,
// payroll and the champion it plays like.
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { seasonSnapshot } from '../api/espn';
import { loadSnapshot } from '../api/snapshotStore';
import { useAsync } from '../hooks/useAsync';
import { fourFactors, playerAdvanced, possessions, pythagWins } from '../lib/advanced';
import { P } from '../lib/boxTotals';
import { loadFranchiseData } from '../lib/franchiseData';
import { CAP_LEVELS, capZone, money, ZONE_LABELS } from '../lib/salaryCap';
import { championDna, closestChampions, currentDna, srs } from '../lib/teamExtras';
import { useSeason } from '../SeasonContext';
import { Empty, Loading } from '../components/Status';
import { TeamLogo } from '../components/TeamLogo';
import { useTeamSeasons } from '../components/TeamAnalytics';
import { per48, signed } from '../components/TeamLineups';

const pct1 = (v: number) => `${(v * 100).toFixed(1)}%`;
const ord = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 >= 11 && n % 100 <= 13 ? 0 : n % 10] ?? 'th'}`;

export function TeamReport() {
  const { id = '' } = useParams();
  const { season } = useSeason();
  const snap = seasonSnapshot(season.year);
  const data = useTeamSeasons(season.year, 2);
  const champs = useAsync(() => loadFranchiseData().then(championDna), []);
  const current = useAsync(() => loadSnapshot(Math.max(...Object.keys(CAP_LEVELS).map(Number))), []);
  const team = snap?.teams.find((t) => t.id === id);
  const model = useMemo(() => {
    if (!data.data || !data.data.seasons.has(id)) return undefined;
    const all = [...data.data.seasons.values()];
    const rate = (t: (typeof all)[number]) => {
      const poss = possessions(t.own, t.opp);
      return { id: t.teamId, ortg: (100 * t.own.pts) / poss, drtg: (100 * t.opp.pts) / poss, pace: (48 * poss) / (t.own.min / 5), off: fourFactors(t.own, t.opp), def: fourFactors(t.opp, t.own), wins: t.wins, losses: t.losses, exp: pythagWins(t.own.pts, t.opp.pts, t.wins + t.losses) };
    };
    const rates = all.map(rate);
    const me = rates.find((r) => r.id === id)!;
    const rankBy = (f: (r: (typeof rates)[number]) => number, high = true) => [...rates].sort((a, b) => (high ? f(b) - f(a) : f(a) - f(b))).findIndex((r) => r.id === id) + 1;
    const s = srs(data.data.games);
    const srsRank = [...s].sort((a, b) => b[1].srs - a[1].srs).findIndex(([t]) => t === id) + 1;
    const players = snap?.box?.['2'] ? playerAdvanced(snap.box['2'], data.data.seasons).filter((p) => p.team === id).sort((a, b) => b.min - a.min).slice(0, 10) : [];
    return { me, rankBy, srs: s.get(id)!, srsRank, players, dna: currentDna(data.data.seasons).get(id) };
  }, [data.data, id, snap]);
  if (data.loading) return <Loading />;
  if (!team || !model) return <Empty>No season data for this team yet.</Empty>;
  const { me, rankBy } = model;
  const box = snap?.box?.['2'];
  const row = (pid: string) => box?.players.find((r) => r[0] === pid);
  const lineups = snap?.lineups?.['2']?.[id]?.lineups.filter(([, sec]) => sec >= 1200).slice(0, 5) ?? [];
  const names = snap?.players ?? {};
  const surname = (pid: string) => (names[pid] ?? pid).split(' ').slice(1).join(' ') || (names[pid] ?? pid);
  const q = snap?.quarters?.['2']?.[id];
  const payroll = current.data?.payroll?.[id];
  const capYear = Math.max(...Object.keys(CAP_LEVELS).map(Number));
  const total = payroll?.reduce((s, p) => s + (p.salaries[0] ?? 0), 0) ?? 0;
  const match = champs.data && model.dna ? closestChampions(model.dna, champs.data.filter((c) => c.season < season.year), 1)[0] : undefined;
  const standing = snap?.standings.flatMap((c) => c.rows.map((r, i) => ({ conf: c.name, rank: r.seed ?? i + 1, id: r.team.id }))).find((r) => r.id === id);
  return (
    <section className="report">
      <div className="page-head no-print">
        <Link to={`/team/${id}`}>← {team.name}</Link>
        <button className="chip" onClick={() => window.print()}>🖨 Print or save as PDF</button>
      </div>
      <header className="report-head">
        <TeamLogo team={team} size={56} />
        <div>
          <h1>{team.name}</h1>
          <p className="muted">{season.label} season report · {me.wins}-{me.losses}{standing ? ` · ${ord(standing.rank)} in the ${standing.conf.replace(' Conference', '')}` : ''}</p>
        </div>
      </header>
      <div className="report-tiles">
        {[
          ['SRS', signed(model.srs.srs), model.srsRank],
          ['Offensive rating', me.ortg.toFixed(1), rankBy((r) => r.ortg)],
          ['Defensive rating', me.drtg.toFixed(1), rankBy((r) => r.drtg, false)],
          ['Net rating', signed(me.ortg - me.drtg), rankBy((r) => r.ortg - r.drtg)],
          ['Pace', me.pace.toFixed(1), rankBy((r) => r.pace)],
          [`Expected wins · luck ${signed(me.wins - me.exp)}`, me.exp.toFixed(1), 0],
        ].map(([label, v, r]) => (
          <div key={label as string} className="tile">
            <div className="tile-value">{v}</div>
            <div className="tile-label">{label}{r ? ` · ${ord(r as number)}` : ''}</div>
          </div>
        ))}
      </div>
      <div className="report-grid">
        <div>
          <h3>Four factors</h3>
          <div className="table-wrap flush"><table>
            <thead>
              <tr>
                <th className="left" />
                <th>Offence</th>
                <th>Rank</th>
                <th>Defence</th>
                <th>Rank</th>
              </tr>
            </thead>
            <tbody>
              {([['efg', 'eFG%', true], ['tov', 'Turnover %', false], ['orb', 'Off. rebound %', true], ['ftr', 'FT rate', true]] as const).map(([k, label, high]) => (
                <tr key={k}>
                  <td className="left">{label}</td>
                  <td>{pct1(me.off[k])}</td>
                  <td className="muted">{ord(rankBy((r) => r.off[k], high))}</td>
                  <td>{pct1(me.def[k])}</td>
                  <td className="muted">{ord(rankBy((r) => r.def[k], k === 'tov'))}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
          {q && (
            <>
              <h3>By quarter</h3>
              <p className="small">
                {['Q1', 'Q2', 'Q3', 'Q4'].map((l, i) => `${l} ${signed((q.pf[i] - q.pa[i]) / Math.max(1, q.games))}`).join(' · ')}
                <br />Leading at half-time {q.leadHalf[0]}-{q.leadHalf[1]} · trailing {q.trailHalf[0]}-{q.trailHalf[1]}
              </p>
            </>
          )}
          {match && <p className="small"><b>Plays like:</b> {match.season - 1}-{String(match.season).slice(2)} {match.name} ({match.similarity}% match)</p>}
          {payroll && season.year === capYear && (
            <p className="small"><b>Payroll:</b> {money(total)} · {ZONE_LABELS[capZone(total, CAP_LEVELS[capYear])]}</p>
          )}
        </div>
        <div>
          <h3>Players</h3>
          <div className="table-wrap flush"><table>
            <thead>
              <tr>
                <th className="left">Player</th>
                <th>G</th>
                <th>MPG</th>
                <th>PTS</th>
                <th>REB</th>
                <th>AST</th>
                <th>TS%</th>
                <th>WS</th>
              </tr>
            </thead>
            <tbody>
              {model.players.map((p) => {
                const r = row(p.id);
                const g = (r?.[P.gp] as number) || 1;
                const v = (k: keyof typeof P) => ((r?.[P[k]] as number) ?? 0) / g;
                return (
                  <tr key={p.id}>
                    <td className="left nowrap">{names[p.id] ?? p.id}</td>
                    <td>{p.g}</td>
                    <td>{(p.min / p.g).toFixed(1)}</td>
                    <td>{v('pts').toFixed(1)}</td>
                    <td>{(v('oreb') + v('dreb')).toFixed(1)}</td>
                    <td>{v('ast').toFixed(1)}</td>
                    <td>{pct1(p.ts)}</td>
                    <td>{p.ws.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
          {lineups.length > 0 && (
            <>
              <h3>Most-used lineups</h3>
              <div className="table-wrap flush"><table>
                <tbody>
                  {lineups.map(([ids, sec, pf, pa]) => (
                    <tr key={ids.join()}>
                      <td className="left small">{ids.map(surname).join(', ')}</td>
                      <td className="muted">{Math.round(sec / 60)} min</td>
                      <td>{signed(per48(pf, pa, sec))}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </>
          )}
        </div>
      </div>
      <p className="muted small">Regular season to date, from every box score and play-by-play. Ranks are out of 30. NBA Stats Hub.</p>
    </section>
  );
}
