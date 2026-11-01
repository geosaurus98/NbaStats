// Trade machine: pick two teams and the players each sends; see whether the
// salaries match, what happens to each payroll and the Win Shares that move.
import { useMemo } from 'react';
import { CurrentSeasonNote } from '../components/SeasonNote';
import { Link, useSearchParams } from 'react-router-dom';
import { loadSnapshot } from '../api/snapshotStore';
import { Empty, Loading } from '../components/Status';
import { TeamLogo } from '../components/TeamLogo';
import { useTeamSeasons } from '../components/TeamAnalytics';
import { useAsync } from '../hooks/useAsync';
import { playerAdvanced } from '../lib/advanced';
import type { PayrollPlayer } from '../lib/brefContracts';
import { capLevels, capZone, money, ZONE_LABELS } from '../lib/salaryCap';
import { DEFAULT_SEASON, seasonInfo } from '../lib/seasons';
import { checkSide } from '../lib/trade';

const salary = (p: PayrollPlayer) => p.salaries[0] ?? 0;

export function Trade() {
  const [params, setParams] = useSearchParams();
  const snap = useAsync(() => loadSnapshot(DEFAULT_SEASON), []);
  const seasons = useTeamSeasons(DEFAULT_SEASON, 2);
  const s = snap.data;
  const levels = capLevels(DEFAULT_SEASON);
  const teams = useMemo(() => [...(s?.teams ?? [])].sort((a, b) => a.name.localeCompare(b.name)), [s]);
  const ws = useMemo(() => {
    const box = s?.box?.['2'];
    if (!box || !seasons.data) return new Map<string, number>();
    return new Map(playerAdvanced(box, seasons.data.seasons).map((p) => [p.id, p.ws]));
  }, [s, seasons.data]);

  if (snap.loading) return <Loading />;
  if (!s?.payroll) return <Empty>No payroll data for {seasonInfo(DEFAULT_SEASON).label} yet.</Empty>;
  const ids = [params.get('a') ?? teams[0]?.id ?? '', params.get('b') ?? teams[1]?.id ?? ''];
  const moving = new Set((params.get('p') ?? '').split(',').filter(Boolean));
  const update = (next: { a?: string; b?: string; p?: Set<string> }) => {
    const p = [...(next.p ?? moving)];
    setParams({ a: next.a ?? ids[0], b: next.b ?? ids[1], ...(p.length ? { p: p.join(',') } : {}) }, { replace: true });
  };
  const roster = (id: string) => [...(s.payroll?.[id] ?? [])].filter((p) => salary(p) > 0).sort((a, b) => salary(b) - salary(a));
  const sides = ids.map((id, i) => {
    const players = roster(id);
    const outgoing = players.filter((p) => moving.has(p.bref));
    const incoming = roster(ids[1 - i]).filter((p) => moving.has(p.bref));
    const before = players.reduce((a, p) => a + salary(p), 0);
    const sum = (ps: PayrollPlayer[]) => ps.reduce((a, p) => a + salary(p), 0);
    const wsOf = (ps: PayrollPlayer[]) => ps.reduce((a, p) => a + (p.espn ? (ws.get(p.espn) ?? 0) : 0), 0);
    const verdict = checkSide({ before, out: sum(outgoing), in: sum(incoming) }, levels);
    return { id, team: teams.find((t) => t.id === id), players, outgoing, incoming, before, verdict, wsNet: wsOf(incoming) - wsOf(outgoing) };
  });
  const any = moving.size > 0 && sides.every((x) => x.outgoing.length + x.incoming.length > 0);
  const works = any && sides.every((x) => x.verdict.ok);

  return (
    <section>
      <h1>Trade machine</h1>
      <CurrentSeasonNote />
      <p className="muted">Pick two teams and tick the players each one sends. It checks the salary-matching rules, shows both payrolls afterwards and the Win Shares that change hands this season.</p>
      <div className="two-col trade-grid">
        {sides.map((side, i) => (
          <div key={i} className="card">
            <label className="trade-team">
              <span className="muted small">Team {i + 1}</span>
              <select value={side.id} onChange={(e) => update(i === 0 ? { a: e.target.value, p: new Set() } : { b: e.target.value, p: new Set() })}>
                {teams.filter((t) => t.id !== ids[1 - i]).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
            <ul className="trade-list">
              {side.players.map((p) => {
                const on = moving.has(p.bref);
                const w = p.espn ? ws.get(p.espn) : undefined;
                return (
                  <li key={p.bref}>
                    <label className={on ? 'active' : undefined}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => {
                          const next = new Set(moving);
                          if (on) next.delete(p.bref);
                          else next.add(p.bref);
                          update({ p: next });
                        }}
                      />
                      <span className="trade-name">{p.name}</span>
                      <span className="muted small">{w != null ? `${w.toFixed(1)} WS` : ''}</span>
                      <span className="trade-salary">{money(salary(p))}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      {!any && <Empty>Tick at least one player on each side (or a player on one side for a salary dump).</Empty>}
      {moving.size > 0 && (
        <>
          <h2>{works ? '✔ This trade works' : any ? '✘ This trade doesn\'t work' : 'Trade so far'}</h2>
          <div className="two-col trade-grid">
            {sides.map((side) => (
              <div key={side.id} className="card">
                <h3 className="team-title">{side.team && <TeamLogo team={side.team} size={24} />} {side.team?.name}</h3>
                <p className="small">
                  <b>Gets:</b> {side.incoming.length ? side.incoming.map((p) => p.name).join(', ') : 'nothing'}
                  <br />
                  <b>Sends:</b> {side.outgoing.length ? side.outgoing.map((p) => p.name).join(', ') : 'nothing'}
                </p>
                <div className="stat-tiles">
                  <div className="tile">
                    <div className="tile-value">{money(side.verdict.after)}</div>
                    <div className="tile-label">Payroll after (was {money(side.before)}) · {ZONE_LABELS[capZone(side.verdict.after, levels)]}</div>
                  </div>
                  <div className="tile">
                    <div className={`tile-value ${side.wsNet > 0 ? 'win' : side.wsNet < 0 ? 'loss' : ''}`}>{side.wsNet > 0 ? '+' : ''}{side.wsNet.toFixed(1)}</div>
                    <div className="tile-label">Win Shares this season, in minus out</div>
                  </div>
                </div>
                <p className={side.verdict.ok ? 'win small' : 'loss small'}>
                  {side.verdict.ok ? '✔' : '✘'} {side.verdict.rule}
                  {!side.verdict.ok && Number.isFinite(side.verdict.maxIn) && <> (can take back up to {money(side.verdict.maxIn)}, getting {money(side.incoming.reduce((a, p) => a + salary(p), 0))})</>}
                </p>
              </div>
            ))}
          </div>
          <p className="small"><button className="link" onClick={() => update({ p: new Set() })}>Clear the trade</button> · copy the address to share it</p>
        </>
      )}
      <p className="muted small">
        Salary matching is simplified from the 2023 agreement: under the cap afterwards, anything goes; over it, a team can take back 200% + $250K of small outgoing salary, outgoing + $7.5M in the middle band and 125% + $250K at the top (bands grown with the cap); above the first apron afterwards, no more than it sends. Roster limits, trade kickers, cash, picks and aggregation limits aren't checked. {levels.estimated ? 'Cap figures are estimates. ' : ''}
        <Link to="/salaries">Every team's payroll →</Link>
      </p>
    </section>
  );
}
