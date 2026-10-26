// Win Shares per $1M, archetypes, win probability added, a lineup explorer,
// free throws under pressure, streaks, the rookie ladder and a player's
// season against their last.
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { seasonSnapshot, snapshotPlayers, type SeasonType } from '../api/espn';
import { loadLines } from '../api/linesStore';
import { loadSnapshot } from '../api/snapshotStore';
import { useAsync } from '../hooks/useAsync';
import { playerAdvanced } from '../lib/advanced';
import { gameScore, P } from '../lib/boxTotals';
import { C } from '../lib/clutch';
import { formatShortDate } from '../lib/dates';
import { ARCHETYPES, archetypes, comboTotals, STREAKS, streaks, type ArchetypeId, type StreakId } from '../lib/playerExtras';
import { money } from '../lib/salaryCap';
import { SHOT_TYPES } from '../lib/shotTypes';
import { ScatterPlot, type ScatterPoint } from './ScatterPlot';
import { Empty, Loading } from './Status';
import { useTeamSeasons } from './TeamAnalytics';
import { NetBar, per48, signed } from './TeamLineups';

const pct1 = (v: number) => `${(v * 100).toFixed(1)}%`;

function useAbbr(season: number) {
  const snap = seasonSnapshot(season);
  return useMemo(() => new Map((snap?.teams ?? []).map((t) => [t.id, t.abbr])), [snap]);
}

function PlayerCell({ id, name, team }: { id: string; name: string; team?: string }) {
  return (
    <td className="left nowrap">
      <Link to={`/player/${id}`}>{name}</Link> {team && <span className="muted small">{team}</span>}
    </td>
  );
}

/** Salaries page: Win Shares bought per $1M of salary. */
export function WinSharesValue({ season, payroll }: { season: number; payroll: Record<string, { espn?: string; name: string; salaries: (number | null)[] }[]> }) {
  const snap = seasonSnapshot(season);
  const data = useTeamSeasons(season, 2);
  const abbr = useAbbr(season);
  const rows = useMemo(() => {
    if (!snap?.box?.['2'] || !data.data) return [];
    const adv = new Map(playerAdvanced(snap.box['2'], data.data.seasons).map((p) => [p.id, p]));
    return Object.entries(payroll).flatMap(([team, ps]) =>
      ps.flatMap((p) => {
        const a = p.espn ? adv.get(p.espn) : undefined;
        const salary = p.salaries[0];
        if (!a || !salary || a.min < 100) return [];
        return [{ id: a.id, name: p.name, team, salary, ws: a.ws, g: a.g, perM: a.ws / (salary / 1e7) }];
      }),
    );
  }, [snap, data.data, payroll]);
  if (rows.length < 10) return null;
  const totalWs = rows.reduce((s, r) => s + Math.max(0, r.ws), 0);
  const early = Math.max(...rows.map((r) => r.g)) < 15;
  const totalPay = rows.reduce((s, r) => s + r.salary, 0);
  const lists = [
    { title: 'Best value (salary $3M+)', rows: rows.filter((r) => r.salary >= 3e6).sort((a, b) => b.perM - a.perM).slice(0, 12) },
    { title: 'Least value (salary $20M+)', rows: rows.filter((r) => r.salary >= 20e6).sort((a, b) => a.perM - b.perM).slice(0, 12) },
  ];
  return (
    <div className="card">
      <h3>Win Shares per $10M</h3>
      <p className="muted small">
        Win Shares (wins a player's offence and defence created, from the Leaders page) for every $10M of this season's salary. League rate so far: {((totalWs / totalPay) * 1e7).toFixed(2)} per $10M, or about {money(totalPay / Math.max(1, totalWs))} per win share. Rookie-scale and minimum deals naturally dominate the top.{early ? ' Early in the season Win Shares are small and noisy.' : ''}
      </p>
      <div className="two-col">
        {lists.map((l) => (
          <div key={l.title} className="table-wrap">
            <h4 className="table-title">{l.title}</h4>
            <table>
              <thead>
                <tr>
                  <th className="left">Player</th>
                  <th>Salary</th>
                  <th>WS</th>
                  <th title="Win Shares per $10M of salary">WS/$10M</th>
                </tr>
              </thead>
              <tbody>
                {l.rows.map((r) => (
                  <tr key={r.id}>
                    <PlayerCell id={r.id} name={r.name} team={abbr.get(r.team)} />
                    <td>{money(r.salary)}</td>
                    <td>{r.ws.toFixed(1)}</td>
                    <td className={r.perM >= (totalWs / totalPay) * 1e7 ? 'win' : 'loss'}><b>{r.perM.toFixed(2)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

const ARCH_COLORS: Record<ArchetypeId, string> = Object.fromEntries(ARCHETYPES.map((a, i) => [a.id, `var(--series-${i + 1})`])) as Record<ArchetypeId, string>;

export function ArchetypesView({ season }: { season: number }) {
  const snap = seasonSnapshot(season);
  const names = snapshotPlayers(season);
  const abbr = useAbbr(season);
  const [pick, setPick] = useState<ArchetypeId>('creator');
  const [hover, setHover] = useState<string | null>(null);
  const list = useMemo(() => (snap?.box?.['2'] ? archetypes(snap.box['2'], snap.shotSplits?.['2']) : []), [snap]);
  if (!list.length) return <Empty>Too early: archetypes need a few games of rotation minutes.</Empty>;
  const info = ARCHETYPES.find((a) => a.id === pick)!;
  const members = list.filter((p) => p.archetype === pick).sort((a, b) => b.minutes - a.minutes);
  const teams = [...new Set(list.map((p) => p.team))].map((team) => {
    const ps = list.filter((p) => p.team === team);
    const total = ps.reduce((s, p) => s + p.minutes, 0);
    return { team, total, shares: ARCHETYPES.map((a) => ({ id: a.id, share: ps.filter((p) => p.archetype === a.id).reduce((s, p) => s + p.minutes, 0) / Math.max(1, total) })) };
  });
  teams.sort((a, b) => (abbr.get(a.team) ?? '').localeCompare(abbr.get(b.team) ?? ''));
  return (
    <>
      <p className="muted">
        Every rotation player (15+ minutes a game) sorted into the closest of eight styles, from their usage, passing, rebounding, steals, blocks, three-point and rim rates, free throws and how many of their baskets were unassisted. Styles blur at the edges, so each player's second-closest is shown too.
      </p>
      <div className="chips tight">
        {ARCHETYPES.map((a) => (
          <button key={a.id} className={a.id === pick ? 'chip picked' : 'chip'} onClick={() => setPick(a.id)}>
            <i className="key-sq" style={{ background: ARCH_COLORS[a.id] }} />
            {a.label} <span className="muted small">{list.filter((p) => p.archetype === a.id).length}</span>
          </button>
        ))}
      </div>
      <div className="two-col">
        <div className="table-wrap">
          <h3 className="table-title">{info.label}: {info.desc.toLowerCase()}</h3>
          <table>
            <thead>
              <tr>
                <th className="left">Player</th>
                <th>MPG</th>
                <th className="left">Also like</th>
              </tr>
            </thead>
            <tbody>
              {members.slice(0, 25).map((p) => {
                const row = snap?.box?.['2']?.players.find((r) => r[0] === p.id);
                const g = (row?.[P.gp] as number) || 1;
                return (
                  <tr key={p.id}>
                    <PlayerCell id={p.id} name={names[p.id] ?? p.id} team={abbr.get(p.team)} />
                    <td>{(p.minutes / g).toFixed(1)}</td>
                    <td className="left muted small">{ARCHETYPES.find((a) => a.id === p.also)?.label}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>Each team's mix (share of rotation minutes)</h3>
          <div className="legend small">
            {ARCHETYPES.map((a) => (
              <span key={a.id}><i className="key-sq" style={{ background: ARCH_COLORS[a.id] }} />{a.label}</span>
            ))}
          </div>
          <div className="arch-rows">
            {teams.map((t) => (
              <div key={t.team} className="arch-row">
                <Link to={`/team/${t.team}`} className="small">{abbr.get(t.team)}</Link>
                <span className="stack-track">
                  {t.shares.filter((s) => s.share > 0).map((s) => (
                    <span
                      key={s.id}
                      className={hover && hover !== `${t.team}:${s.id}` ? 'dim' : undefined}
                      style={{ width: `${s.share * 100}%`, background: ARCH_COLORS[s.id] }}
                      title={`${abbr.get(t.team)}: ${ARCHETYPES.find((a) => a.id === s.id)?.label} ${Math.round(s.share * 100)}% of rotation minutes`}
                      onMouseEnter={() => setHover(`${t.team}:${s.id}`)}
                      onMouseLeave={() => setHover(null)}
                    />
                  ))}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export function WpaLeaders({ season, type }: { season: number; type: SeasonType }) {
  const snap = seasonSnapshot(season);
  const names = snapshotPlayers(season);
  const abbr = useAbbr(season);
  const [worst, setWorst] = useState(false);
  const w = snap?.wpa?.[String(type)];
  if (!w) return <Empty>Win probability added starts with the next daily data update.</Empty>;
  if (!w.players.length) return <Empty>ESPN hasn't published win probabilities for these games.</Empty>;
  const dates = new Map((snap?.games[String(type)] ?? []).map((g) => [g[0], g]));
  const teams = new Map((snap?.teams ?? []).map((t) => [t.id, t]));
  const rows = [...w.players].sort((a, b) => (worst ? a[3] - b[3] : b[3] - a[3])).slice(0, 30);
  const max = Math.max(0.5, ...rows.map((r) => Math.abs(r[3])));
  const gameLabel = (gameId: string, team: string) => {
    const g = dates.get(gameId);
    if (!g) return '';
    const opp = g[2] === team ? g[3] : g[2];
    return `${g[2] === team ? 'vs' : '@'} ${teams.get(opp)?.abbr ?? ''}, ${formatShortDate(g[1])}`;
  };
  return (
    <>
      <p className="muted">
        Win probability added: every play moves ESPN's win probability, and the players in it get the credit (or blame). A made shot goes to the shooter (a third to the passer on an assist); a steal or block is split between the two players. Totals are in wins: +1.0 means plays worth one extra win. Misses, turnovers and fouls are always charged to someone while the matching gain often has no name on it, so totals lean negative: compare players with each other rather than with zero.
      </p>
      <div className="segmented">
        <button className={!worst ? 'active' : ''} onClick={() => setWorst(false)}>Most added</button>
        <button className={worst ? 'active' : ''} onClick={() => setWorst(true)}>Most lost</button>
      </div>
      <div className="two-col">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="left">Player</th>
                <th>G</th>
                <th title="Wins added over the season">WPA</th>
                <th />
                <th title="Per game, in percentage points of win probability">Per game</th>
                <th className="left" title="Biggest single game">Best game</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r[0]}>
                  <PlayerCell id={r[0]} name={names[r[0]] ?? r[0]} team={abbr.get(r[1])} />
                  <td>{r[2]}</td>
                  <td className={r[3] >= 0 ? 'win' : 'loss'}><b>{`${r[3] > 0 ? '+' : ''}${r[3].toFixed(2)}`}</b></td>
                  <td className="net-cell"><NetBar v={r[3]} max={max} /></td>
                  <td>{signed((100 * r[3]) / Math.max(1, r[2]))}</td>
                  <td className="left small nowrap">
                    {worst ? <>{signed(100 * r[6])}% <Link to={`/game/${r[7]}`}>{gameLabel(r[7], r[1])}</Link></> : <>{signed(100 * r[4])}% <Link to={`/game/${r[5]}`}>{gameLabel(r[5], r[1])}</Link></>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-wrap">
          <h3 className="table-title">Biggest single games</h3>
          <table>
            <tbody>
              {w.games.slice(0, 20).map(([id, team, gameId, v]) => (
                <tr key={id + gameId}>
                  <PlayerCell id={id} name={names[id] ?? id} team={abbr.get(team)} />
                  <td className="win"><b>+{Math.round(v * 100)}%</b></td>
                  <td className="left small"><Link to={`/game/${gameId}`}>{gameLabel(gameId, team)}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">Percentage points of win probability added in one game: +60% is like taking a game from a 20% chance to an 80% one on your own. Back-and-forth games can add up to more than 100%.</p>
        </div>
      </div>
    </>
  );
}

/** Team page: choose 2-5 players and see their minutes and margin together. */
export function LineupExplorer({ season, teamId, type }: { season: number; teamId: string; type: SeasonType }) {
  const snap = seasonSnapshot(season);
  const names = snapshotPlayers(season);
  const t = snap?.lineups?.[String(type)]?.[teamId];
  const roster = useMemo(() => (t ? [...t.onOff].sort((a, b) => b[1] - a[1]).slice(0, 13).map(([id]) => id) : []), [t]);
  const [picked, setPicked] = useState<string[]>([]);
  const chosen = picked.length ? picked : roster.slice(0, 2);
  if (!t || roster.length < 5) return null;
  const last = (id: string) => (names[id] ?? id).split(' ').slice(1).join(' ') || (names[id] ?? id);
  // Surnames, with an initial where two share one.
  const surname = (id: string) => (roster.filter((x) => last(x) === last(id)).length > 1 ? `${(names[id] ?? id)[0]}. ${last(id)}` : last(id));
  const toggle = (id: string) => setPicked((p) => {
    const base = p.length ? p : roster.slice(0, 2);
    return base.includes(id) ? base.filter((x) => x !== id) : base.length >= 5 ? base : [...base, id];
  });
  const c = chosen.length >= 2 ? comboTotals(t, chosen) : undefined;
  const teamNet = per48(...(t.lineups.reduce((s, r) => [s[0] + r[2], s[1] + r[3], s[2] + r[1]], [0, 0, 0]) as [number, number, number]));
  const net = c && c.sec > 0 ? per48(c.pf, c.pa, c.sec) : undefined;
  return (
    <div className="card">
      <h3>Lineup explorer</h3>
      <p className="muted small">Pick two to five players to see how the team does with all of them on the floor.</p>
      <div className="chips tight">
        {roster.map((id) => (
          <button key={id} className={chosen.includes(id) ? 'chip picked' : 'chip'} onClick={() => toggle(id)}>{surname(id)}</button>
        ))}
      </div>
      {chosen.length < 2 ? (
        <p className="small">Pick at least two players.</p>
      ) : c && c.sec > 0 ? (
        <div className="stat-tiles">
          <div className="tile"><div className="tile-value">{Math.round(c.sec / 60)}</div><div className="tile-label">minutes together</div></div>
          <div className="tile"><div className="tile-value">{c.pf}-{c.pa}</div><div className="tile-label">points for and against</div></div>
          <div className="tile"><div className={`tile-value ${net! >= 0 ? 'win' : 'loss'}`}>{signed(net!)}</div><div className="tile-label">margin per 48 (team {signed(teamNet)})</div></div>
        </div>
      ) : (
        <p className="small">These players haven't shared the floor{chosen.length > 2 ? ' in any lineup with 2+ minutes' : ''}.</p>
      )}
      <p className="muted small">{chosen.length === 2 ? 'Pairs are exact.' : 'Groups of three or more are summed from five-man lineups that played 2+ minutes, so very short stints are missing.'} From play-by-play substitutions.</p>
    </div>
  );
}

/** Insights → Clutch: free-throw shooting with the game on the line against the rest of the time. */
export function FreeThrowPressure({ season, type }: { season: number; type: SeasonType }) {
  const snap = seasonSnapshot(season);
  const names = snapshotPlayers(season);
  const abbr = useAbbr(season);
  const clutch = snap?.clutch?.[String(type)];
  const box = type === 2 ? snap?.box?.['2'] : undefined;
  if (!clutch || !box) return null;
  const totals = new Map(box.players.map((r) => [r[0], r]));
  const rows = clutch.players
    .flatMap((r) => {
      const all = totals.get(r[0]);
      if (!all || r[C.fta] < 6) return [];
      const fta = (all[P.fta] as number) - r[C.fta];
      const ftm = (all[P.ftm] as number) - r[C.ftm];
      if (fta < 20) return [];
      const clutchPct = r[C.ftm] / r[C.fta];
      const rest = ftm / fta;
      return [{ id: r[0], team: r[1], made: r[C.ftm], att: r[C.fta], clutchPct, rest, diff: clutchPct - rest }];
    })
    .sort((a, b) => b.diff - a.diff);
  if (rows.length < 4) return null;
  const lgC = rows.reduce((s, r) => s + r.made, 0) / rows.reduce((s, r) => s + r.att, 0);
  const show = [...rows.slice(0, 8), ...rows.slice(-8).filter((r) => !rows.slice(0, 8).includes(r))];
  const max = Math.max(0.1, ...show.map((r) => Math.abs(r.diff)));
  return (
    <div className="table-wrap">
      <h3 className="table-title">Free throws under pressure</h3>
      <p className="muted small">Clutch-time free-throw % (last five minutes, within five points) against the rest of the game. These players hit {pct1(lgC)} in the clutch. Small samples: 6+ clutch attempts.</p>
      <table>
        <thead>
          <tr>
            <th className="left">Player</th>
            <th>Clutch FT</th>
            <th>Clutch %</th>
            <th title="Free-throw % the rest of the time">Other %</th>
            <th>Diff</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {show.map((r) => (
            <tr key={r.id}>
              <PlayerCell id={r.id} name={names[r.id] ?? r.id} team={abbr.get(r.team)} />
              <td>{r.made}/{r.att}</td>
              <td><b>{pct1(r.clutchPct)}</b></td>
              <td className="muted">{pct1(r.rest)}</td>
              <td className={r.diff >= 0 ? 'win' : 'loss'}>{signed(r.diff * 100)}</td>
              <td className="net-cell"><NetBar v={r.diff} max={max} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StreaksView({ season }: { season: number }) {
  const names = snapshotPlayers(season);
  const snap = seasonSnapshot(season);
  const [which, setWhich] = useState<StreakId>('pts20');
  const { data, loading } = useAsync(() => loadLines(season), [season]);
  const list = useMemo(() => (data ? streaks(data, which) : []), [data, which]);
  if (loading) return <Loading />;
  if (!list.length) return <Empty>No games for this season yet.</Empty>;
  const team = new Map((snap?.box?.['2']?.players ?? []).map((r) => [r[0], r[1]]));
  const abbr = new Map((snap?.teams ?? []).map((t) => [t.id, t.abbr]));
  const active = list.filter((s) => s.active >= 2).sort((a, b) => b.active - a.active).slice(0, 20);
  const longest = [...list].sort((a, b) => b.longest - a.longest).slice(0, 20);
  const done = snap?.complete !== false;
  return (
    <>
      <p className="muted">Consecutive games each player has hit the mark, counting the games they played.</p>
      <div className="chips tight">
        {STREAKS.map((s) => (
          <button key={s.id} className={s.id === which ? 'chip active' : 'chip'} onClick={() => setWhich(s.id)}>{s.label}</button>
        ))}
      </div>
      <div className="two-col">
        {!done && (
          <div className="table-wrap">
            <h3 className="table-title">Active streaks</h3>
            {active.length ? (
              <table>
                <tbody>
                  {active.map((s) => (
                    <tr key={s.id}>
                      <PlayerCell id={s.id} name={names[s.id] ?? s.id} team={abbr.get(team.get(s.id) ?? '')} />
                      <td><b>{s.active}</b> straight</td>
                      <td className="muted small">season best {s.longest}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="small">Nobody has an active run of two or more.</p>
            )}
          </div>
        )}
        <div className="table-wrap">
          <h3 className="table-title">Longest this season</h3>
          <table>
            <tbody>
              {longest.map((s) => (
                <tr key={s.id}>
                  <PlayerCell id={s.id} name={names[s.id] ?? s.id} team={abbr.get(team.get(s.id) ?? '')} />
                  <td><b>{s.longest}</b> games</td>
                  <td className="muted small">{s.active === s.longest && !done ? 'still going' : `ended ${formatShortDate(s.longestEnd)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/** Awards → Rookie of the Year: each rookie's production against where they were drafted. */
export function RookieLadder({ season }: { season: number }) {
  const snap = seasonSnapshot(season);
  const navigate = useNavigate();
  const box = snap?.box?.['2'];
  const draft = snap?.rookieDraft;
  if (!box || !draft) return null;
  const rookies = new Set(box.rookies ?? []);
  const abbr = new Map((snap?.teams ?? []).map((t) => [t.id, t.abbr]));
  const names = snap?.players ?? {};
  const rows = box.players.flatMap((r) => {
    if (!rookies.has(r[0])) return [];
    const g = r[P.gp] as number;
    if (g < 2 || (r[P.min] as number) / g < 8) return [];
    const line = [0, 0, 0, ...[P.min, P.pts, P.fgm, P.fga, P.tpm, P.tpa, P.ftm, P.fta, P.oreb, P.dreb, P.ast, P.stl, P.blk, P.tov, P.pf, P.pm].map((k) => (r[k] as number) / g)];
    const d = draft[r[0]];
    return [{ id: r[0], team: r[1], g, gmsc: gameScore(line), ppg: (r[P.pts] as number) / g, pick: d ? d[2] : 61 }];
  });
  if (rows.length < 5) return null;
  const top = [...rows].sort((a, b) => b.gmsc - a.gmsc);
  const flagged = new Set(top.slice(0, 8).map((r) => r.id));
  const points: ScatterPoint[] = rows.map((r) => ({
    id: r.id,
    x: r.pick,
    y: r.gmsc,
    label: `${names[r.id] ?? r.id} (${abbr.get(r.team) ?? ''})`,
    short: (names[r.id] ?? r.id).split(' ').slice(1).join(' '),
    highlight: flagged.has(r.id),
    detail: [r.pick > 60 ? 'Undrafted' : `Pick ${r.pick}`, `${r.ppg.toFixed(1)} points a game, ${r.g} games`],
  }));
  return (
    <div className="card">
      <h3>Rookie ladder: production vs draft slot</h3>
      <ScatterPlot
        points={points}
        xLabel="Draft pick (61 = undrafted)"
        yLabel="Game Score per game"
        xFormat={(v) => (v > 60 ? 'UDFA' : String(Math.round(v)))}
        yFormat={(v) => v.toFixed(0)}
        height={320}
        ariaLabel="Each rookie's Game Score per game against their draft pick"
        onPick={(p) => navigate(`/player/${p.id}`)}
      />
      <p className="muted small">Rookies with 8+ minutes a game. Draft slots from ESPN player profiles. Steals of the draft sit high on the right.</p>
    </div>
  );
}

/** Player page: this season against last, by shot type and headline numbers. */
export function SeasonVsLast({ playerId, season }: { playerId: string; season: number }) {
  const now = seasonSnapshot(season);
  // Last season's file isn't loaded unless something asks for it.
  const prev = useAsync(() => loadSnapshot(season - 1), [season]).data;
  const a = now?.shotSplits?.['2']?.players[playerId];
  const b = prev?.shotSplits?.['2']?.players[playerId];
  const rowNow = now?.box?.['2']?.players.find((r) => r[0] === playerId);
  const rowPrev = prev?.box?.['2']?.players.find((r) => r[0] === playerId);
  const arch = useMemo(() => (now?.box?.['2'] ? archetypes(now.box['2'], now.shotSplits?.['2']).find((p) => p.id === playerId) : undefined), [now, playerId]);
  if (!a || !b || !rowNow || !rowPrev) return arch ? <ArchetypeLine a={arch.archetype} also={arch.also} /> : null;
  const per = (r: (string | number)[]) => {
    const v = (k: keyof typeof P) => r[P[k]] as number;
    const g = v('gp') || 1;
    return { ppg: v('pts') / g, mpg: v('min') / g, ts: v('pts') / Math.max(1, 2 * (v('fga') + 0.44 * v('fta'))), par3: v('fga') ? v('tpa') / v('fga') : 0, ast: v('ast') / g, reb: (v('oreb') + v('dreb')) / g };
  };
  const x = per(rowNow);
  const y = per(rowPrev);
  const headline = [
    { label: 'Points', now: x.ppg, prev: y.ppg, fmt: (v: number) => v.toFixed(1) },
    { label: 'Minutes', now: x.mpg, prev: y.mpg, fmt: (v: number) => v.toFixed(1) },
    { label: 'Rebounds', now: x.reb, prev: y.reb, fmt: (v: number) => v.toFixed(1) },
    { label: 'Assists', now: x.ast, prev: y.ast, fmt: (v: number) => v.toFixed(1) },
    { label: 'True shooting', now: x.ts, prev: y.ts, fmt: pct1 },
    { label: 'Three-point rate', now: x.par3, prev: y.par3, fmt: pct1 },
  ];
  const attA = Object.values(a.types).reduce((s, c) => s + (c?.[0] ?? 0), 0);
  const attB = Object.values(b.types).reduce((s, c) => s + (c?.[0] ?? 0), 0);
  const types = SHOT_TYPES.map((t) => {
    const ca = a.types[t.id];
    const cb = b.types[t.id];
    return { ...t, shareNow: (ca?.[0] ?? 0) / Math.max(1, attA), sharePrev: (cb?.[0] ?? 0) / Math.max(1, attB), fgNow: ca && ca[0] >= 5 ? ca[1] / ca[0] : undefined, fgPrev: cb && cb[0] >= 5 ? cb[1] / cb[0] : undefined };
  }).filter((t) => t.shareNow >= 0.03 || t.sharePrev >= 0.03);
  const arrow = (d: number, eps: number) => (Math.abs(d) < eps ? '' : d > 0 ? '▲' : '▼');
  return (
    <div className="card">
      <h3>This season vs last</h3>
      {arch && <ArchetypeLine a={arch.archetype} also={arch.also} inline />}
      <div className="table-wrap flush">
      <table>
        <thead>
          <tr>
            <th className="left" />
            <th>Last</th>
            <th>This</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {headline.map((h) => (
            <tr key={h.label}>
              <td className="left">{h.label}</td>
              <td className="muted">{h.fmt(h.prev)}</td>
              <td><b>{h.fmt(h.now)}</b></td>
              <td className="small">{arrow(h.now - h.prev, h.prev * 0.04)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <h4>Shot diet</h4>
      <div className="table-wrap flush">
      <table>
        <thead>
          <tr>
            <th className="left">Shot type</th>
            <th title="Share of shots, last season → this season">Share</th>
            <th title="Last season → this season">FG%</th>
          </tr>
        </thead>
        <tbody>
          {types.map((t) => (
            <tr key={t.id}>
              <td className="left">{t.label}</td>
              <td>{pct1(t.sharePrev)} → <b>{pct1(t.shareNow)}</b> <span className="small">{arrow(t.shareNow - t.sharePrev, 0.02)}</span></td>
              <td>{t.fgPrev == null ? '–' : pct1(t.fgPrev)} → <b>{t.fgNow == null ? '–' : pct1(t.fgNow)}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <p className="muted small">Regular season; arrows show last season → this. Shot types from play-by-play descriptions; FG% shown with 5+ attempts. Early in a season the changes are mostly noise.</p>
    </div>
  );
}

function ArchetypeLine({ a, also, inline }: { a: ArchetypeId; also: ArchetypeId; inline?: boolean }) {
  const info = ARCHETYPES.find((x) => x.id === a)!;
  const line = (
    <p className="small">
      Plays like a <b>{info.label.toLowerCase()}</b> ({info.desc.toLowerCase()}), with a touch of {ARCHETYPES.find((x) => x.id === also)!.label.toLowerCase()}.{' '}
      <Link to="/insights?tab=archetypes">All archetypes →</Link>
    </p>
  );
  return inline ? line : <div className="card">{line}</div>;
}
