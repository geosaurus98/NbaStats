// Trade machine: two or three teams, the players and draft picks each sends
// and where they go; whether the salaries match, what happens to each payroll,
// the Win Shares that move and each team's playoff and title odds afterwards.
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
import { oddsPct } from '../lib/format';
import { seededRandom } from '../lib/games';
import { eloForWins, gamesLeft, simulate, steadyWsPerGame } from '../lib/projections';
import { capLevels, capZone, money, ZONE_LABELS } from '../lib/salaryCap';
import { DEFAULT_SEASON, seasonInfo } from '../lib/seasons';
import { checkSide } from '../lib/trade';
import { buildModel } from './Projections';

const salary = (p: PayrollPlayer) => p.salaries[0] ?? 0;
const SIMS = 1000;
/** Each team's own picks for the next seven drafts (who owns which pick today isn't tracked). */
const pickYears = Array.from({ length: 7 }, (_, i) => DEFAULT_SEASON + i);
const pickLabel = (key: string) => {
  const [, year, round] = key.split('-');
  return `${year} ${round === '1' ? '1st' : '2nd'}`;
};

export function Trade() {
  const [params, setParams] = useSearchParams();
  const snap = useAsync(() => loadSnapshot(DEFAULT_SEASON), []);
  const seasons = useTeamSeasons(DEFAULT_SEASON, 2);
  const model = useAsync(() => buildModel(DEFAULT_SEASON, 200), []);
  const s = snap.data;
  const levels = capLevels(DEFAULT_SEASON);
  const teams = useMemo(() => [...(s?.teams ?? [])].sort((a, b) => a.name.localeCompare(b.name)), [s]);
  const adv = useMemo(() => {
    const box = s?.box?.['2'];
    if (!box || !seasons.data) return new Map<string, { ws: number; g: number }>();
    return new Map(playerAdvanced(box, seasons.data.seasons).map((p) => [p.id, { ws: p.ws, g: p.g }]));
  }, [s, seasons.data]);

  // Address: t = team ids, p = player:destination pairs, k = pick:destination pairs (pick = team-year-round).
  const fromUrl = (params.get('t') ?? [params.get('a'), params.get('b')].filter(Boolean).join(',')).split(',').filter(Boolean);
  const ids = fromUrl.length >= 2 ? fromUrl.slice(0, 3) : [teams[0]?.id ?? '', teams[1]?.id ?? ''];
  const pairs = (key: string) => new Map((params.get(key) ?? '').split(',').filter(Boolean).map((x) => x.split(':') as [string, string]));
  const moving = pairs('p');
  const picks = pairs('k');
  // Old two-team links listed players without destinations.
  const other = (from: string) => ids.find((t) => t !== from) ?? '';

  const roster = (id: string) => [...(s?.payroll?.[id] ?? [])].filter((p) => salary(p) > 0).sort((a, b) => salary(b) - salary(a));
  const ownerOf = new Map<string, string>();
  for (const id of ids) for (const p of roster(id)) ownerOf.set(p.bref, id);
  const dest = (bref: string) => {
    const d = moving.get(bref);
    return d && ids.includes(d) && d !== ownerOf.get(bref) ? d : other(ownerOf.get(bref) ?? '');
  };

  const left = useMemo(() => (model.data ? gamesLeft(model.data.games) : new Map<string, number>()), [model.data]);
  const sides = ids.map((id) => {
    const players = roster(id);
    const outgoing = players.filter((p) => moving.has(p.bref));
    const incoming = ids.filter((t) => t !== id).flatMap((t) => roster(t).filter((p) => moving.has(p.bref) && dest(p.bref) === id));
    const before = players.reduce((a, p) => a + salary(p), 0);
    const sum = (ps: PayrollPlayer[]) => ps.reduce((a, p) => a + salary(p), 0);
    const wsOf = (ps: PayrollPlayer[]) => ps.reduce((a, p) => a + (p.espn ? (adv.get(p.espn)?.ws ?? 0) : 0), 0);
    // Wins over the rest of the season: each player's Win Shares per game so far × games left.
    const perGame = (ps: PayrollPlayer[]) => ps.reduce((a, p) => a + (p.espn && adv.get(p.espn) ? steadyWsPerGame(adv.get(p.espn)!.ws, adv.get(p.espn)!.g) : 0), 0);
    const winsDelta = (perGame(incoming) - perGame(outgoing)) * (left.get(id) ?? 0);
    const verdict = checkSide({ before, out: sum(outgoing), in: sum(incoming) }, levels);
    const picksOut = [...picks.keys()].filter((k) => k.startsWith(`${id}-`));
    const picksIn = [...picks].filter(([k, d]) => d === id && !k.startsWith(`${id}-`)).map(([k]) => k);
    return { id, team: teams.find((t) => t.id === id), players, outgoing, incoming, before, verdict, wsNet: wsOf(incoming) - wsOf(outgoing), winsDelta, picksOut, picksIn };
  });

  const odds = useMemo(() => {
    const m = model.data;
    if (!m || !sides.some((x) => x.winsDelta)) return undefined;
    const base = simulate(m.games, m.conferences, m.elo.ratings, SIMS, seededRandom(DEFAULT_SEASON));
    const ratings = new Map(m.elo.ratings);
    for (const x of sides) ratings.set(x.id, (ratings.get(x.id) ?? 1505) + eloForWins(x.winsDelta, left.get(x.id) ?? 0));
    return { base, after: simulate(m.games, m.conferences, ratings, SIMS, seededRandom(DEFAULT_SEASON)) };
  }, [model.data, sides.map((x) => x.winsDelta.toFixed(2)).join()]); // eslint-disable-line react-hooks/exhaustive-deps

  if (snap.loading) return <Loading />;
  if (!s?.payroll) return <Empty>No payroll data for {seasonInfo(DEFAULT_SEASON).label} yet.</Empty>;
  const write = (next: { t?: string[]; p?: Map<string, string>; k?: Map<string, string> }) => {
    const t = next.t ?? ids;
    const enc = (m: Map<string, string>) => [...m].map(([a, b]) => `${a}:${b}`).join(',');
    const p = next.p ?? moving;
    const k = next.k ?? picks;
    setParams({ t: t.join(','), ...(p.size ? { p: enc(p) } : {}), ...(k.size ? { k: enc(k) } : {}) }, { replace: true });
  };
  const setTeam = (i: number, id: string) => {
    const t = [...ids];
    if (id) t[i] = id;
    else t.splice(i, 1);
    write({ t, p: new Map(), k: new Map() });
  };
  const anyMove = moving.size + picks.size > 0;
  const involved = sides.filter((x) => x.outgoing.length + x.incoming.length + x.picksOut.length + x.picksIn.length > 0);
  const works = anyMove && involved.length >= 2 && sides.every((x) => x.verdict.ok);

  return (
    <section>
      <h1>Trade machine</h1>
      <CurrentSeasonNote />
      <p className="muted">Pick two or three teams and tick the players and draft picks each one sends (with three teams, choose where each goes). It checks the salary-matching rules, shows every payroll afterwards, the Win Shares that change hands and each team's playoff and title odds after the trade.</p>
      <div className={`trade-grid trade-cols-${ids.length}`}>
        {sides.map((side, i) => (
          <div key={i} className="card">
            <label className="trade-team">
              <span className="muted small">Team {i + 1}</span>
              <select value={side.id} onChange={(e) => setTeam(i, e.target.value)}>
                {teams.filter((t) => t.id === side.id || !ids.includes(t.id)).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
            {i === 2 && <button className="link small" onClick={() => setTeam(2, '')}>Remove this team</button>}
            <ul className="trade-list">
              {side.players.map((p) => {
                const on = moving.has(p.bref);
                const w = p.espn ? adv.get(p.espn)?.ws : undefined;
                return (
                  <li key={p.bref}>
                    <label className={on ? 'active' : undefined}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => {
                          const next = new Map(moving);
                          if (on) next.delete(p.bref);
                          else next.set(p.bref, other(side.id));
                          write({ p: next });
                        }}
                      />
                      <span className="trade-name">{p.name}</span>
                      <span className="muted small">{w != null ? `${w.toFixed(1)} WS` : ''}</span>
                      <span className="trade-salary">{money(salary(p))}</span>
                    </label>
                    {on && ids.length > 2 && (
                      <label className="trade-dest small">
                        to{' '}
                        <select value={dest(p.bref)} onChange={(e) => write({ p: new Map(moving).set(p.bref, e.target.value) })}>
                          {ids.filter((t) => t !== side.id).map((t) => <option key={t} value={t}>{teams.find((x) => x.id === t)?.abbr}</option>)}
                        </select>
                      </label>
                    )}
                  </li>
                );
              })}
            </ul>
            <details className="trade-picks">
              <summary className="small">Draft picks{side.picksOut.length ? ` (${side.picksOut.length} sent)` : ''}</summary>
              <div className="chips tight">
                {pickYears.flatMap((y) => [1, 2].map((r) => `${side.id}-${y}-${r}`)).map((k) => {
                  const on = picks.has(k);
                  return (
                    <span key={k} className="trade-pick">
                      <button className={on ? 'chip active' : 'chip'} aria-pressed={on} onClick={() => { const next = new Map(picks); if (on) next.delete(k); else next.set(k, other(side.id)); write({ k: next }); }}>{pickLabel(k)}</button>
                      {on && ids.length > 2 && (
                        <select className="small" aria-label={`Where the ${pickLabel(k)} goes`} value={picks.get(k)} onChange={(e) => write({ k: new Map(picks).set(k, e.target.value) })}>
                          {ids.filter((t) => t !== side.id).map((t) => <option key={t} value={t}>{teams.find((x) => x.id === t)?.abbr}</option>)}
                        </select>
                      )}
                    </span>
                  );
                })}
              </div>
            </details>
          </div>
        ))}
        {ids.length < 3 && (
          <div className="card trade-add">
            <label className="trade-team">
              <span className="muted small">Add a third team</span>
              <select value="" onChange={(e) => e.target.value && write({ t: [...ids, e.target.value] })}>
                <option value="">Choose a team…</option>
                {teams.filter((t) => !ids.includes(t.id)).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
          </div>
        )}
      </div>
      {!anyMove && <Empty>Tick players or picks to build a trade.</Empty>}
      {anyMove && (
        <>
          <h2>{works ? '✔ This trade works' : involved.length < 2 ? 'Trade so far' : "✘ This trade doesn't work"}</h2>
          <div className={`trade-grid trade-cols-${ids.length}`}>
            {sides.map((side) => {
              const b = odds?.base.get(side.id);
              const a = odds?.after.get(side.id);
              return (
                <div key={side.id} className="card">
                  <h3 className="team-title">{side.team && <TeamLogo team={side.team} size={24} />} {side.team?.name}</h3>
                  <p className="small">
                    <b>Gets:</b> {[...side.incoming.map((p) => p.name), ...side.picksIn.map((k) => `${teams.find((t) => k.startsWith(`${t.id}-`))?.abbr} ${pickLabel(k)}`)].join(', ') || 'nothing'}
                    <br />
                    <b>Sends:</b> {[...side.outgoing.map((p) => `${p.name}${ids.length > 2 ? ` (to ${teams.find((t) => t.id === dest(p.bref))?.abbr})` : ''}`), ...side.picksOut.map((k) => `${pickLabel(k)}${ids.length > 2 ? ` (to ${teams.find((t) => t.id === picks.get(k))?.abbr})` : ''}`)].join(', ') || 'nothing'}
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
                    {b && a && (
                      <div className="tile">
                        <div className="tile-value">{oddsPct(a.champion)}</div>
                        <div className="tile-label">Title odds (was {oddsPct(b.champion)}) · playoffs {oddsPct(a.playoffs)} (was {oddsPct(b.playoffs)})</div>
                      </div>
                    )}
                  </div>
                  <p className={side.verdict.ok ? 'win small' : 'loss small'}>
                    {side.verdict.ok ? '✔' : '✘'} {side.verdict.rule}
                    {!side.verdict.ok && Number.isFinite(side.verdict.maxIn) && <> (can take back up to {money(side.verdict.maxIn)}, getting {money(side.incoming.reduce((x, p) => x + salary(p), 0))})</>}
                  </p>
                </div>
              );
            })}
          </div>
          {model.loading && <p className="small muted">Working out the title odds…</p>}
          <p className="small"><button className="link" onClick={() => write({ p: new Map(), k: new Map() })}>Clear the trade</button> · copy the address to share it</p>
        </>
      )}
      <p className="muted small">
        Salary matching is simplified from the 2023 agreement: under the cap afterwards, anything goes; over it, a team can take back 200% + $250K of small outgoing salary, outgoing + $7.5M in the middle band and 125% + $250K at the top (bands grown with the cap); above the first apron afterwards, no more than it sends. With three teams each team is checked on everything it sends and gets. Roster limits, trade kickers, cash and aggregation limits aren't checked, and picks are each team's own (protections and picks already traded aren't tracked). Odds after the trade move each team's Elo by the players' Win Shares per game over the games left, then simulate the season {SIMS.toLocaleString()} times. {levels.estimated ? 'Cap figures are estimates. ' : ''}
        <Link to="/salaries">Every team's payroll →</Link>
      </p>
    </section>
  );
}
