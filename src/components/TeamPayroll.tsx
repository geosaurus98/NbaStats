// Team page: this season's payroll against the cap lines, salary committed
// to future seasons, and every contract. Player page: salary by season.
import { Link } from 'react-router-dom';
import { loadSnapshot } from '../api/espn';
import { useAsync } from '../hooks/useAsync';
import type { PayrollPlayer, SalaryFlag } from '../lib/brefContracts';
import { CAP_LEVELS, capZone, money, nextLevel, ZONE_LABELS } from '../lib/salaryCap';
import { DEFAULT_SEASON } from '../lib/seasons';
import { ColumnChart } from './Charts';
import { PayrollChart, payrollRows } from './PayrollChart';

const seasonName = (offset: number) => `${DEFAULT_SEASON - 1 + offset}-${String(DEFAULT_SEASON + offset).slice(2)}`;
const FLAG: Record<SalaryFlag, string> = { '': '', 'player-option': 'PO', 'team-option': 'TO', 'early-termination': 'ETO', 'non-guaranteed': 'NG' };

export const playerLink = (p: PayrollPlayer) => (p.espn ? `/player/${p.espn}` : `/history?tab=careers&p=${encodeURIComponent(p.name)}`);

export function TeamPayroll({ teamId }: { teamId: string }) {
  const snap = useAsync(() => loadSnapshot(DEFAULT_SEASON), []);
  const levels = CAP_LEVELS[DEFAULT_SEASON];
  const s = snap.data;
  if (!s?.payroll?.[teamId] || !levels) return null;
  const [row] = payrollRows(s.teams.filter((t) => t.id === teamId), s.payroll);
  const all = [...s.payroll[teamId]].sort((a, b) => (b.salaries[0] ?? 0) - (a.salaries[0] ?? 0));
  const next = nextLevel(row.total, levels);
  const years = [0, 1, 2, 3, 4];
  const committed = years.map((y) => all.reduce((a, p) => a + (p.salaries[y] ?? 0), 0));
  return (
    <div className="card">
      <h3>Payroll</h3>
      <p>
        <b>{money(row.total)}</b> · {ZONE_LABELS[capZone(row.total, levels)]}
        {next ? <span className="muted"> · {money(next.gap)} below the {next.label.toLowerCase()}</span> : null}
      </p>
      <PayrollChart rows={[row]} levels={levels} />
      <div className="table-wrap flat">
        <table>
          <thead>
            <tr>
              <th className="left">Player</th>
              {years.map((y) => (
                <th key={y} className={y > 2 ? 'hide-sm' : undefined}>{seasonName(y)}</th>
              ))}
              <th className="hide-sm" title="Guaranteed money left">Guaranteed</th>
            </tr>
          </thead>
          <tbody>
            {all.map((p) => (
              <tr key={p.bref}>
                <td className="left nowrap"><Link to={playerLink(p)}>{p.name}</Link> {p.age ? <span className="muted small">{p.age}</span> : null}</td>
                {years.map((y) => (
                  <td key={y} className={[y === 0 ? 'sorted' : '', y > 2 ? 'hide-sm' : ''].join(' ').trim() || undefined}>
                    {p.salaries[y] ? money(p.salaries[y]!) : <span className="muted">–</span>}
                    {p.flags[y] && y > 0 ? <sup className="muted" title={p.flags[y]}> {FLAG[p.flags[y]]}</sup> : null}
                  </td>
                ))}
                <td className="hide-sm">{money(p.guaranteed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">PO = player option, TO = team option, ETO = early termination option, NG = not guaranteed.</p>
      <h3>Salary committed by season</h3>
      <ColumnChart
        ariaLabel="Salary already committed to each coming season"
        height={170}
        xLabels
        columns={committed.map((v, y) => ({ value: Math.round(v / 1e5) / 10, label: seasonName(y), tick: seasonName(y), detail: `${money(v)} committed to ${all.filter((p) => p.salaries[y]).length} players` }))}
        yFormat={(v) => `$${v}M`}
      />
      <p className="muted small">Future seasons drop as contracts end; options are counted as if picked up. <Link to="/salaries">Every team's payroll →</Link></p>
    </div>
  );
}

/** Player page: salary by season (past from ESPN, this season and future from the payroll). */
export function SalaryHistory({ playerId }: { playerId: string }) {
  const snap = useAsync(() => loadSnapshot(DEFAULT_SEASON), []);
  const s = snap.data;
  const contract = Object.values(s?.payroll ?? {}).flat().find((p) => p.espn === playerId);
  const past = (s?.salaryHistory?.[playerId] ?? []).filter(([y]) => y < DEFAULT_SEASON);
  const future: [number, number, SalaryFlag][] = contract ? contract.salaries.flatMap((v, i) => (v ? [[DEFAULT_SEASON + i, v, contract.flags[i]] as [number, number, SalaryFlag]] : [])) : [];
  if (!future.length && !past.length) return null;
  const levels = CAP_LEVELS[DEFAULT_SEASON];
  const rows = [...past.map(([y, v]) => [y, v, ''] as [number, number, SalaryFlag]).reverse(), ...future];
  const now = contract?.salaries[0];
  return (
    <div className="card salary-history">
      <h3>Salary</h3>
      <p>
        {now ? <><b>{money(now)}</b> this season{levels ? <span className="muted"> · {((now / levels.cap) * 100).toFixed(1)}% of the cap</span> : null}</> : 'No contract listed this season'}
        {contract && future.length > 1 ? <span className="muted"> · signed through {DEFAULT_SEASON - 2 + future.length}-{String(DEFAULT_SEASON - 1 + future.length).slice(2)}, {money(contract.guaranteed)} guaranteed</span> : null}
      </p>
      <ColumnChart
        ariaLabel="Salary by season"
        height={170}
        xLabels
        columns={rows.map(([y, v, flag]) => ({ value: Math.round(v / 1e5) / 10, label: `${y - 1}-${String(y).slice(2)}${y > DEFAULT_SEASON ? ' (future)' : ''}`, tick: `'${String(y).slice(2)}`, detail: `${money(v, 2)}${flag ? ` · ${FLAG[flag]}` : ''}` }))}
        yFormat={(v) => `$${v}M`}
      />
      <p className="muted small">Past seasons from ESPN; this season and beyond from the team's payroll (Basketball-Reference).</p>
    </div>
  );
}
