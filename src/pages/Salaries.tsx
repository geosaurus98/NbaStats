// Salaries: every team's payroll against the cap, tax line and aprons, the
// biggest contracts and the best value for money this season.
import { Link, useNavigate } from 'react-router-dom';
import { loadSnapshot } from '../api/espn';
import { PayrollChart, payrollRows, yearsLeft } from '../components/PayrollChart';
import { playerLink } from '../components/TeamPayroll';
import { Empty, ErrorBox, Loading } from '../components/Status';
import { TeamLogo } from '../components/TeamLogo';
import { useAsync } from '../hooks/useAsync';
import { P } from '../lib/boxTotals';
import { CAP_LEVELS, capZone, money, ZONE_LABELS, type CapZone } from '../lib/salaryCap';
import { DEFAULT_SEASON, getSeason } from '../lib/seasons';

export function Salaries() {
  const snap = useAsync(() => loadSnapshot(DEFAULT_SEASON), []);
  const navigate = useNavigate();
  if (snap.error) return <ErrorBox error={snap.error} />;
  if (snap.loading) return <Loading />;
  const s = snap.data;
  const levels = CAP_LEVELS[DEFAULT_SEASON];
  const label = getSeason(DEFAULT_SEASON).label;
  if (!s?.payroll || !levels) return <Empty>Salaries aren't in today's data yet. They're refreshed with the daily snapshot.</Empty>;

  const rows = payrollRows(s.teams, s.payroll);
  const zones = new Map<CapZone, number>();
  for (const r of rows) zones.set(capZone(r.total, levels), (zones.get(capZone(r.total, levels)) ?? 0) + 1);
  const teamOf = new Map(rows.flatMap((r) => r.players.map((p) => [p.bref, r.team] as const)));
  const box = new Map((s.box?.['2']?.players ?? []).map((r) => [r[0], r]));
  const all = rows.flatMap((r) => r.players).sort((a, b) => b.salary - a.salary);
  // Value: Game Score per game for every $10M, among regulars.
  const value = all
    .map((p) => {
      const r = p.espn ? box.get(p.espn) : undefined;
      if (!r) return undefined;
      const g = r[P.gp] as number;
      const v = (k: keyof typeof P) => r[P[k]] as number;
      const gmsc = (v('pts') + 0.4 * v('fgm') - 0.7 * v('fga') - 0.4 * (v('fta') - v('ftm')) + 0.7 * v('oreb') + 0.3 * v('dreb') + v('stl') + 0.7 * v('ast') + 0.7 * v('blk') - 0.4 * v('pf') - v('tov')) / g;
      return g >= 3 && v('min') / g >= 20 ? { p, g, ppg: v('pts') / g, gmsc, perTen: gmsc / (p.salary / 1e7) } : undefined;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  const bestValue = [...value].sort((a, b) => b.perTen - a.perTen).slice(0, 12);
  const ppg = (id?: string) => {
    const r = id ? box.get(id) : undefined;
    return r ? ((r[P.pts] as number) / (r[P.gp] as number)).toFixed(1) : '–';
  };

  return (
    <section>
      <h1>{label} salaries</h1>
      <p className="muted">
        Each team's player salaries this season against the minimum, the cap ({money(levels.cap)}), the tax line ({money(levels.tax)}), the first apron ({money(levels.firstApron)}) and the second apron ({money(levels.secondApron)}).{' '}
        {[...zones].map(([z, n]) => `${n} ${ZONE_LABELS[z].toLowerCase()}`).join(' · ')}.
      </p>
      <div className="card">
        <h3>Team payrolls</h3>
        <PayrollChart rows={rows} levels={levels} onPick={(t) => navigate(`/team/${t.id}`)} />
        <p className="muted small">Each block is one player; hover for the contract, click a team to open it.</p>
      </div>
      <div className="two-col home-row">
        <div className="table-wrap">
          <h3 className="table-title">Biggest salaries</h3>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th className="left">Player</th>
                <th>Salary</th>
                <th className="hide-sm">% of cap</th>
                <th title="Seasons left, including this one">Years</th>
                <th>PTS</th>
              </tr>
            </thead>
            <tbody>
              {all.slice(0, 20).map((p, i) => {
                const t = teamOf.get(p.bref);
                return (
                  <tr key={p.bref}>
                    <td>{i + 1}</td>
                    <td className="left nowrap"><Link to={playerLink(p)}>{p.name}</Link> {t && <span className="muted small">{t.abbr}</span>}</td>
                    <td className="sorted">{money(p.salary)}</td>
                    <td className="hide-sm">{((p.salary / levels.cap) * 100).toFixed(1)}%</td>
                    <td>{yearsLeft(p)}</td>
                    <td>{ppg(p.espn)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="table-wrap">
          <h3 className="table-title">Best value</h3>
          {bestValue.length === 0 ? (
            <p className="muted small" style={{ padding: '0 .9rem' }}>Needs a few more games.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th className="left">Player</th>
                  <th>Salary</th>
                  <th>PTS</th>
                  <th title="Game Score per game for every $10M of salary">Per $10M</th>
                </tr>
              </thead>
              <tbody>
                {bestValue.map(({ p, ppg: pts, perTen }) => {
                  const t = teamOf.get(p.bref);
                  return (
                    <tr key={p.bref}>
                      <td className="left nowrap"><Link to={playerLink(p)}>{p.name}</Link> {t && <span className="muted small">{t.abbr}</span>}</td>
                      <td>{money(p.salary)}</td>
                      <td>{pts.toFixed(1)}</td>
                      <td className="sorted">{perTen.toFixed(1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="muted small" style={{ padding: '0 .9rem' }}>Game Score per game (a one-number box-score rating) for every $10M of salary; 20+ minutes a game.</p>
        </div>
      </div>
      <div className="table-wrap">
        <h3 className="table-title">Every team</h3>
        <table>
          <thead>
            <tr>
              <th className="left">Team</th>
              <th>Payroll</th>
              <th className="left">Status</th>
              <th className="hide-sm">vs cap</th>
              <th className="hide-sm">vs tax</th>
              <th>Players</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.team.id}>
                <td className="left nowrap"><Link to={`/team/${r.team.id}`} className="team-cell"><TeamLogo team={r.team} size={16} /> {r.team.shortName}</Link></td>
                <td className="sorted">{money(r.total)}</td>
                <td className="left">{ZONE_LABELS[capZone(r.total, levels)]}</td>
                <td className="hide-sm">{r.total >= levels.cap ? '+' : '−'}{money(Math.abs(r.total - levels.cap))}</td>
                <td className="hide-sm">{r.total >= levels.tax ? '+' : '−'}{money(Math.abs(r.total - levels.tax))}</td>
                <td>{r.players.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        Payrolls from Basketball-Reference, refreshed daily. Totals are the players under contract; they don't include dead money or cap holds, so they can differ a little from official cap sheets. Thresholds: <a href={levels.source}>NBA</a>.
      </p>
    </section>
  );
}
