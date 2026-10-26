// Team analytics from every game's box score: the four factors, a luck check
// (Pythagorean record, close games, opponents' shooting), quarter-by-quarter
// splits, garbage time, and what decided a single game.
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { seasonSnapshot, snapshotPlayers, type SeasonType } from '../api/espn';
import { loadLines } from '../api/linesStore';
import type { TeamRef } from '../api/types';
import { useAsync } from '../hooks/useAsync';
import { factorEdges, factorSpread, fourFactors, gameBoxes, possessions, pythagWins, teamGames, teamSeasons, type FourFactors } from '../lib/advanced';
import { P } from '../lib/boxTotals';
import { G } from '../lib/garbageTime';
import { ScatterPlot, type ScatterPoint } from './ScatterPlot';
import { Empty, Loading } from './Status';
import { TeamLogo } from './TeamLogo';
import { NetBar, signed } from './TeamLineups';

const pct1 = (v: number) => `${(v * 100).toFixed(1)}%`;
const rating = (pts: number, poss: number) => (poss > 0 ? (100 * pts) / poss : 0);

/** Team and opponent totals for a season type, loaded from the per-game lines. */
export function useTeamSeasons(season: number, type: SeasonType = 2) {
  return useAsync(async () => {
    const lines = await loadLines(season);
    if (!lines) return undefined;
    const games = teamGames(lines, type);
    return { games, seasons: teamSeasons(games), spread: factorSpread(games) };
  }, [season, type]);
}

/** Background shading for a rank: blue for the best, red for the worst, clear in the middle. */
export function rankShade(rank: number, n: number): React.CSSProperties {
  const t = n > 1 ? 1 - (2 * (rank - 1)) / (n - 1) : 0; // +1 best … -1 worst
  const pct = Math.round(Math.abs(t) * 38);
  return pct < 4 ? {} : { background: `color-mix(in srgb, var(${t > 0 ? '--pos' : '--neg'}) ${pct}%, transparent)` };
}

const FACTORS: { key: keyof FourFactors; label: string; title: string; lowerBetter?: boolean }[] = [
  { key: 'efg', label: 'eFG%', title: 'Effective field-goal %: threes count 1.5 times' },
  { key: 'tov', label: 'TOV%', title: 'Turnovers per 100 plays', lowerBetter: true },
  { key: 'orb', label: 'ORB%', title: 'Share of own misses rebounded' },
  { key: 'ftr', label: 'FT rate', title: 'Free throws made per field-goal attempt' },
];

function useTeams(season: number): Map<string, TeamRef> {
  const snap = seasonSnapshot(season);
  return useMemo(() => new Map((snap?.teams ?? []).map((t) => [t.id, t])), [snap]);
}

export function FourFactorsTable({ season, type }: { season: number; type: SeasonType }) {
  const data = useTeamSeasons(season, type);
  const teams = useTeams(season);
  const [sort, setSort] = useState('net');
  if (data.loading) return <Loading />;
  if (!data.data || data.data.seasons.size < 2) return <Empty>No box scores for this season yet.</Empty>;
  const rows = [...data.data.seasons.values()].map((t) => {
    const poss = possessions(t.own, t.opp);
    const off = fourFactors(t.own, t.opp);
    const def = fourFactors(t.opp, t.own);
    const ortg = rating(t.own.pts, poss);
    const drtg = rating(t.opp.pts, poss);
    return { id: t.teamId, off, def, ortg, drtg, net: ortg - drtg, g: t.own.g };
  });
  const n = rows.length;
  // Rank each column so 1 = best (defence: lowest opponent number, except opponents' turnovers).
  const rankOf = (get: (r: (typeof rows)[number]) => number, higherBetter: boolean) => {
    const sorted = [...rows].sort((a, b) => (higherBetter ? get(b) - get(a) : get(a) - get(b)));
    return new Map(sorted.map((r, i) => [r.id, i + 1]));
  };
  const cols = [
    { id: 'net', label: 'Net', title: 'Net rating: points per 100 possessions minus points allowed', get: (r: (typeof rows)[number]) => r.net, fmt: signed, hb: true },
    { id: 'ortg', label: 'ORtg', title: 'Points per 100 possessions', get: (r: (typeof rows)[number]) => r.ortg, fmt: (v: number) => v.toFixed(1), hb: true },
    ...FACTORS.map((f) => ({ id: `o-${f.key}`, label: f.label, title: `Offence: ${f.title}`, get: (r: (typeof rows)[number]) => r.off[f.key], fmt: pct1, hb: !f.lowerBetter })),
    { id: 'drtg', label: 'DRtg', title: 'Points allowed per 100 possessions', get: (r: (typeof rows)[number]) => r.drtg, fmt: (v: number) => v.toFixed(1), hb: false },
    ...FACTORS.map((f) => ({ id: `d-${f.key}`, label: f.label, title: `Defence: opponents' ${f.title.toLowerCase()}`, get: (r: (typeof rows)[number]) => r.def[f.key], fmt: pct1, hb: !!f.lowerBetter })),
  ];
  const ranks = new Map(cols.map((c) => [c.id, rankOf(c.get, c.hb)]));
  const col = cols.find((c) => c.id === sort) ?? cols[0];
  const sorted = [...rows].sort((a, b) => ranks.get(col.id)!.get(a.id)! - ranks.get(col.id)!.get(b.id)!);
  return (
    <>
      <p className="muted">
        Dean Oliver's four factors explain most of why teams win: shooting (eFG%), turnovers, offensive rebounding and getting to the line. Weighted roughly 40/25/20/15. Blue = among the best, red = among the worst; click a column to sort.
      </p>
      <div className="table-wrap">
        <table className="factors">
          <thead>
            <tr>
              <th />
              <th colSpan={2} />
              <th colSpan={4} className="group">Offence</th>
              <th />
              <th colSpan={4} className="group">Defence (opponents)</th>
            </tr>
            <tr>
              <th className="left">Team</th>
              {cols.map((c) => (
                <th key={c.id} title={c.title} className={c.id === sort ? 'sorted' : 'sortable'} onClick={() => setSort(c.id)}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const t = teams.get(r.id);
              return (
                <tr key={r.id}>
                  <td className="left nowrap">
                    <Link to={`/team/${r.id}`} className="team-cell">{t && <TeamLogo team={t} size={18} />}{t?.abbr ?? r.id}</Link>
                  </td>
                  {cols.map((c) => {
                    const rank = ranks.get(c.id)!.get(r.id)!;
                    return (
                      <td key={c.id} style={rankShade(rank, n)} title={`${c.title}: ranked ${rank} of ${n}`}>{c.fmt(c.get(r))}</td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted small">Summed from every game's box score; possessions are estimated from field goals, free throws, offensive rebounds and turnovers. Team turnovers and rebounds that ESPN credits to no player aren't counted.</p>
    </>
  );
}

/** Game page: each team's four factors in this game and which one decided it. */
export function GameFactors({ season, gameId }: { season: number; gameId: string }) {
  const teams = useTeams(season);
  const data = useAsync(async () => {
    const lines = await loadLines(season);
    const row = lines?.games.find((x) => x[0] === gameId);
    if (!lines || !row) return undefined;
    // Compare against how much each factor varies across that season type's games.
    return { game: gameBoxes(row)[0], spread: factorSpread(teamGames(lines, row[2])) };
  }, [season, gameId]);
  const g = data.data?.game;
  if (!data.data || !g) return null;
  const edges = factorEdges(g.own, g.opp, data.data.spread);
  const home = fourFactors(g.own, g.opp);
  const away = fourFactors(g.opp, g.own);
  const homeT = teams.get(g.teamId);
  const awayT = teams.get(g.oppId);
  const winnerHome = g.own.pts > g.opp.pts;
  const decisive = FACTORS.map((f) => ({ ...f, edge: winnerHome ? edges[f.key] : -edges[f.key] })).sort((a, b) => b.edge - a.edge)[0];
  const max = Math.max(0.5, ...FACTORS.map((f) => Math.abs(edges[f.key])));
  const winner = winnerHome ? homeT : awayT;
  return (
    <div className="card">
      <h3>What decided it: the four factors</h3>
      {decisive.edge > 0 && <p className="small"><b>{winner?.shortName ?? 'The winners'}</b> won it mostly on <b>{decisive.title.split(':')[0].toLowerCase()}</b>.</p>}
      <table className="game-factors">
        <thead>
          <tr>
            <th className="left">Factor</th>
            <th>{awayT?.abbr ?? 'Away'}</th>
            <th>{homeT?.abbr ?? 'Home'}</th>
            <th title="Weighted edge, scaled by how much each factor usually varies">Edge</th>
          </tr>
        </thead>
        <tbody>
          {FACTORS.map((f) => {
            const e = edges[f.key];
            return (
              <tr key={f.key}>
                <td className="left" title={f.title}>{f.label}</td>
                <td>{pct1(away[f.key])}</td>
                <td>{pct1(home[f.key])}</td>
                <td className="net-cell" title={`${Math.abs(e) < 0.05 ? 'Even' : `${e > 0 ? homeT?.abbr : awayT?.abbr} edge`}`}>
                  <NetBar v={e} max={max} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted small">Bars point to the team that won each factor ({homeT?.abbr} right, {awayT?.abbr} left), sized by Dean Oliver's weights and how unusual the gap was.</p>
    </div>
  );
}

export function LuckMeter({ season }: { season: number }) {
  const data = useTeamSeasons(season, 2);
  const teams = useTeams(season);
  const navigate = useNavigate();
  if (data.loading) return <Loading />;
  if (!data.data || data.data.seasons.size < 2) return <Empty>No box scores for this season yet.</Empty>;
  const all = [...data.data.seasons.values()];
  const lgOpp3 = all.reduce((s, t) => s + t.opp.tpm, 0) / Math.max(1, all.reduce((s, t) => s + t.opp.tpa, 0));
  const lgOppFt = all.reduce((s, t) => s + t.opp.ftm, 0) / Math.max(1, all.reduce((s, t) => s + t.opp.fta, 0));
  const rows = all
    .map((t) => {
      const gp = t.wins + t.losses;
      const exp = pythagWins(t.own.pts, t.opp.pts, gp);
      return {
        id: t.teamId,
        gp,
        wins: t.wins,
        exp,
        luck: t.wins - exp,
        close: [t.closeW, t.closeL] as const,
        opp3: t.opp.tpa ? t.opp.tpm / t.opp.tpa : 0,
        oppFt: t.opp.fta ? t.opp.ftm / t.opp.fta : 0,
      };
    })
    .sort((a, b) => b.luck - a.luck);
  const max = Math.max(2, ...rows.map((r) => Math.abs(r.luck)));
  // rows are sorted luckiest first: label the three at each end.
  const labelled = new Set([...rows.slice(0, 3), ...rows.slice(-3)].filter((r) => Math.abs(r.luck) >= 1).map((r) => r.id));
  const points: ScatterPoint[] = rows.map((r) => ({
    id: r.id,
    x: r.exp / Math.max(1, r.gp),
    y: r.wins / Math.max(1, r.gp),
    label: teams.get(r.id)?.abbr ?? r.id,
    short: teams.get(r.id)?.abbr,
    detail: [`${r.wins}-${r.gp - r.wins}, expected ${r.exp.toFixed(1)} wins`],
    highlight: labelled.has(r.id),
  }));
  return (
    <>
      <p className="muted">
        Points scored and allowed predict a record well (the "Pythagorean" formula). Teams above the line are winning more than their scoring margin says: usually close games and opponents' cold shooting, which rarely last.
      </p>
      <div className="two-col">
        <div className="card">
          <h3>Actual vs expected win %</h3>
          <ScatterPlot
            points={points}
            xLabel="Expected win % (from points)"
            yLabel="Actual win %"
            xFormat={(v) => `${Math.round(v * 100)}%`}
            yFormat={(v) => `${Math.round(v * 100)}%`}
            diagonal
            height={340}
            ariaLabel="Each team's actual win percentage against the win percentage its points scored and allowed predict"
            onPick={(p) => navigate(`/team/${p.id}`)}
          />
          <p className="muted small">Dashed line: actual = expected. Labelled: the three luckiest and unluckiest teams.</p>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="left">Team</th>
                <th>W</th>
                <th title="Expected wins from points scored and allowed">xW</th>
                <th title="Wins minus expected wins">Luck</th>
                <th />
                <th title="Record in games decided by 5 or fewer">Close</th>
                <th title={`Opponents' three-point % (league ${pct1(lgOpp3)})`}>Opp 3P%</th>
                <th title={`Opponents' free-throw % (league ${pct1(lgOppFt)})`}>Opp FT%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const t = teams.get(r.id);
                return (
                  <tr key={r.id}>
                    <td className="left nowrap"><Link to={`/team/${r.id}`} className="team-cell">{t && <TeamLogo team={t} size={18} />}{t?.abbr ?? r.id}</Link></td>
                    <td>{r.wins}</td>
                    <td className="muted">{r.exp.toFixed(1)}</td>
                    <td className={r.luck >= 0 ? 'win' : 'loss'}><b>{signed(r.luck)}</b></td>
                    <td className="net-cell"><NetBar v={r.luck} max={max} /></td>
                    <td>{r.close[0]}-{r.close[1]}</td>
                    <td className={r.opp3 < lgOpp3 - 0.015 ? 'win' : r.opp3 > lgOpp3 + 0.015 ? 'loss' : ''}>{pct1(r.opp3)}</td>
                    <td className={r.oppFt < lgOppFt - 0.02 ? 'win' : r.oppFt > lgOppFt + 0.02 ? 'loss' : ''}>{pct1(r.oppFt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="muted small">Opponents' three-point and free-throw shooting are mostly out of a defence's control: green = opponents shooting unusually badly (lucky), red = unusually well.</p>
        </div>
      </div>
    </>
  );
}

const Q_LABELS = ['Q1', 'Q2', 'Q3', 'Q4', 'OT'];

export function QuarterSplits({ season, type, teamId }: { season: number; type: SeasonType; teamId?: string }) {
  const snap = seasonSnapshot(season);
  const teams = useTeams(season);
  const [sort, setSort] = useState(0);
  const q = snap?.quarters?.[String(type)];
  if (!q || !Object.keys(q).length) return teamId ? null : <Empty>Quarter splits start with the next daily data update.</Empty>;
  const rows = Object.entries(q).map(([id, t]) => ({
    id,
    t,
    net: t.pf.map((pf, i) => (i < 4 ? (pf - t.pa[i]) / Math.max(1, t.games) : t.ot ? (pf - t.pa[i]) / t.ot : 0)),
  }));
  const n = rows.length;
  const rankIn = (i: number, id: string) => [...rows].sort((a, b) => b.net[i] - a.net[i]).findIndex((r) => r.id === id) + 1;
  const rec = ([w, l]: [number, number]) => (w + l ? `${w}-${l}` : '–');
  if (teamId) {
    const r = rows.find((x) => x.id === teamId);
    if (!r) return null;
    return (
      <div className="card">
        <h3>Quarter by quarter</h3>
        <div className="quarters">
          {Q_LABELS.slice(0, r.t.ot ? 5 : 4).map((label, i) => (
            <div key={label} className="q-cell" style={i < 4 ? rankShade(rankIn(i, teamId), n) : undefined}>
              <span className="muted small">{label}</span>
              <b>{signed(r.net[i])}</b>
              <span className="muted small">{i < 4 ? `won ${r.t.won[i]}, lost ${r.t.lost[i]} · ${rankIn(i, teamId)} of ${n}` : `${r.t.ot} OT game${r.t.ot === 1 ? '' : 's'}`}</span>
            </div>
          ))}
        </div>
        <p className="small">
          Leading at half-time: <b>{rec(r.t.leadHalf)}</b> · trailing at half-time: <b>{rec(r.t.trailHalf)}</b> · leading after three: <b>{rec(r.t.lead3)}</b> · trailing after three: <b>{rec(r.t.trail3)}</b>
        </p>
        <p className="muted small">Average point margin per quarter (overtime: per game that went to overtime). Shaded by league rank: blue = among the best.</p>
      </div>
    );
  }
  const sorted = [...rows].sort((a, b) => (sort < 5 ? b.net[sort] - a.net[sort] : sort === 5 ? b.t.trailHalf[0] - a.t.trailHalf[0] : b.t.leadHalf[1] - a.t.leadHalf[1]));
  return (
    <>
      <p className="muted">Average point margin in each quarter, plus what teams do with half-time leads. Click a column to sort.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="left">Team</th>
              {Q_LABELS.slice(0, 4).map((l, i) => (
                <th key={l} className={sort === i ? 'sorted' : 'sortable'} onClick={() => setSort(i)}>{l}</th>
              ))}
              <th title="Record when leading at half-time">Lead at half</th>
              <th className={sort === 5 ? 'sorted' : 'sortable'} title="Record when trailing at half-time (comebacks)" onClick={() => setSort(5)}>Trail at half</th>
              <th className={sort === 6 ? 'sorted' : 'sortable'} title="Half-time leads lost" onClick={() => setSort(6)}>Blown</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const t = teams.get(r.id);
              return (
                <tr key={r.id}>
                  <td className="left nowrap"><Link to={`/team/${r.id}`} className="team-cell">{t && <TeamLogo team={t} size={18} />}{t?.abbr ?? r.id}</Link></td>
                  {[0, 1, 2, 3].map((i) => (
                    <td key={i} style={rankShade(rankIn(i, r.id), n)}>{signed(r.net[i])}</td>
                  ))}
                  <td>{rec(r.t.leadHalf)}</td>
                  <td>{rec(r.t.trailHalf)}</td>
                  <td>{r.t.leadHalf[1]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function GarbageTime({ season, type }: { season: number; type: SeasonType }) {
  const snap = seasonSnapshot(season);
  const teams = useTeams(season);
  const data = useTeamSeasons(season, type);
  const names = snapshotPlayers(season);
  const gt = snap?.garbage?.[String(type)];
  const box = type === 2 ? snap?.box?.['2'] : undefined;
  if (!gt) return <Empty>Garbage-time numbers start with the next daily data update.</Empty>;
  if (!data.data) return data.loading ? <Loading /> : <Empty>No box scores for this season yet.</Empty>;
  const teamRows = [...data.data.seasons.values()]
    .map((t) => {
      const poss = possessions(t.own, t.opp);
      const g = gt.teams.find((r) => r[0] === t.teamId);
      // Garbage-time possessions, estimated from its share of the team's minutes.
      const share = g ? g[2] / Math.max(1, (t.own.min / 5) * 60) : 0;
      const gPoss = poss * share;
      const all = rating(t.own.pts - t.opp.pts, poss);
      const clean = rating(t.own.pts - (g?.[3] ?? 0) - (t.opp.pts - (g?.[4] ?? 0)), poss - gPoss);
      return { id: t.teamId, all, clean, games: g?.[1] ?? 0, min: (g?.[2] ?? 0) / 60, diff: clean - all };
    })
    .sort((a, b) => b.clean - a.clean);
  const players = box
    ? box.players
        .map((r) => {
          const g = gt.players.find((x) => x[0] === r[0]);
          const gp = r[P.gp] as number;
          const pts = r[P.pts] as number;
          const gPts = (g?.[G.pts] as number) ?? 0;
          return { id: r[0], team: r[1], gp, pts, gPts, ppg: pts / Math.max(1, gp), clean: (pts - gPts) / Math.max(1, gp), min: ((g?.[G.sec] as number) ?? 0) / 60, share: pts ? gPts / pts : 0 };
        })
        .filter((p) => p.gp >= 3 && p.gPts >= 5)
        .sort((a, b) => b.gPts - a.gPts)
        .slice(0, 20)
    : [];
  const max = Math.max(1, ...teamRows.map((r) => Math.abs(r.diff)));
  return (
    <>
      <p className="muted">
        Garbage time, by Cleaning the Glass's rule: the fourth quarter once a game is out of reach (up 25+ with 9+ minutes left, 20+ with 6-9, 10+ in the last 6) and no more than two starters are left on the floor. Those minutes are bench players against bench players, so they can blur a team's real level.
      </p>
      <div className="two-col">
        <div className="table-wrap">
          <h3 className="table-title">Net rating with and without garbage time</h3>
          <table>
            <thead>
              <tr>
                <th className="left">Team</th>
                <th title="Point margin per 100 possessions, all minutes">All</th>
                <th title="…without garbage time">Without</th>
                <th title="Without minus all">Change</th>
                <th />
                <th title="Games with garbage time / its minutes">Games · min</th>
              </tr>
            </thead>
            <tbody>
              {teamRows.map((r) => {
                const t = teams.get(r.id);
                return (
                  <tr key={r.id}>
                    <td className="left nowrap"><Link to={`/team/${r.id}`} className="team-cell">{t && <TeamLogo team={t} size={18} />}{t?.abbr ?? r.id}</Link></td>
                    <td className="muted">{signed(r.all)}</td>
                    <td><b>{signed(r.clean)}</b></td>
                    <td>{signed(r.diff)}</td>
                    <td className="net-cell"><NetBar v={r.diff} max={max} /></td>
                    <td className="muted">{r.games} · {Math.round(r.min)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {players.length > 0 && (
          <div className="table-wrap">
            <h3 className="table-title">Most garbage-time points</h3>
            <table>
              <thead>
                <tr>
                  <th className="left">Player</th>
                  <th>PPG</th>
                  <th title="Points per game without garbage time">Without</th>
                  <th title="Garbage-time points">GT pts</th>
                  <th title="Share of their points">Share</th>
                  <th title="Garbage-time minutes">GT min</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.id}>
                    <td className="left nowrap"><Link to={`/player/${p.id}`}>{names[p.id] ?? p.id}</Link> <span className="muted small">{teams.get(p.team)?.abbr}</span></td>
                    <td className="muted">{p.ppg.toFixed(1)}</td>
                    <td><b>{p.clean.toFixed(1)}</b></td>
                    <td>{p.gPts}</td>
                    <td>{Math.round(p.share * 100)}%</td>
                    <td className="muted">{Math.round(p.min)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
