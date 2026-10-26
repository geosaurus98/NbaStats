// Graphs built from data the site already has: usage vs efficiency, team
// styles across eras, salary vs production, a team's Elo through the season
// and a player's game-by-game timeline.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchLeagueGames, seasonSnapshot } from '../api/espn';
import { loadLines } from '../api/linesStore';
import { useAsync } from '../hooks/useAsync';
import { gameScore, L, P, T, type BoxTotals } from '../lib/boxTotals';
import { formatShortDate } from '../lib/dates';
import { DETAIL, loadFranchiseData } from '../lib/franchiseData';
import { carryOver, runElo } from '../lib/projections';
import { money } from '../lib/salaryCap';
import { SEASONS } from '../lib/seasons';
import { seasonLabel } from '../lib/teammates';
import { LineChart } from './Charts';
import { ScatterPlot, type ScatterPoint } from './ScatterPlot';
import { Empty, ErrorBox, Loading } from './Status';

const surname = (name: string) => name.split(' ').slice(1).join(' ') || name;
const pct1 = (v: number) => `${(v * 100).toFixed(1)}%`;

/** Usage rate and true shooting for every regular (Basketball-Reference's usage formula). */
export function usageRows(box: BoxTotals, names: Record<string, string>) {
  const teams = new Map(box.teams.map((t) => [t[0], t]));
  const maxGames = Math.max(1, ...box.teams.map((t) => t[T.gp] as number));
  return box.players.flatMap((r) => {
    const v = (k: keyof typeof P) => r[P[k]] as number;
    const t = teams.get(r[1]);
    const g = v('gp');
    if (!t || t.length <= T.tov || !g || g < Math.max(3, maxGames * 0.3) || v('min') / g < 20) return [];
    const tv = (k: keyof typeof T) => t[T[k]] as number;
    const teamMin = tv('gp') * 240;
    const usage = ((v('fga') + 0.44 * v('fta') + v('tov')) * (teamMin / 5)) / (v('min') * (tv('fga') + 0.44 * tv('fta') + tv('tov')));
    const ts = v('pts') / (2 * (v('fga') + 0.44 * v('fta')));
    return [{ id: r[0], name: names[r[0]] ?? r[0], team: r[1], usage, ts, ppg: v('pts') / g, g }];
  });
}

export function UsageEfficiency({ season }: { season: number }) {
  const navigate = useNavigate();
  const snap = seasonSnapshot(season);
  const box = snap?.box?.['2'];
  if (!box) return <Empty>No box scores for this season yet.</Empty>;
  const rows = usageRows(box, snap.players ?? {});
  if (rows.length < 5) return <Empty>Too early in the season: players need a few more games.</Empty>;
  const abbr = new Map(snap.teams.map((t) => [t.id, t.abbr]));
  const leagueTs = rows.reduce((a, r) => a + r.ts, 0) / rows.length;
  const stars = new Set([...rows].sort((a, b) => b.ppg - a.ppg).slice(0, 10).map((r) => r.id));
  const points: ScatterPoint[] = rows.map((r) => ({
    id: r.id,
    x: r.usage * 100,
    y: r.ts * 100,
    label: `${r.name} (${abbr.get(r.team) ?? ''})`,
    short: surname(r.name),
    highlight: stars.has(r.id),
    detail: [`${r.ppg.toFixed(1)} points a game`, `${r.g} games`],
  }));
  return (
    <>
      <p className="muted">
        How much of the offence each player carries (usage: the share of team possessions they finish with a shot, free throws or a turnover while on court) against how efficiently they score (true shooting). Top right is rare: heavy load and efficient. The ten top scorers are labelled. 20+ minutes a game.
      </p>
      <div className="card">
        <ScatterPlot
          points={points}
          xLabel="Usage rate"
          yLabel="True shooting"
          xFormat={(v) => `${v.toFixed(0)}%`}
          yFormat={(v) => `${v.toFixed(0)}%`}
          guides={{ x: 20, y: leagueTs * 100 }}
          ariaLabel="Usage rate against true shooting for every regular"
          onPick={(p) => navigate(`/player/${p.id}`)}
        />
        <p className="muted small">Dashed lines: 20% usage (an average share) and the average true shooting of these players ({pct1(leagueTs)}).</p>
      </div>
    </>
  );
}

export function TeamStyles({ season }: { season: number }) {
  const navigate = useNavigate();
  const fd = useAsync(() => loadFranchiseData(), []);
  const snap = seasonSnapshot(season);
  const [era, setEra] = useState<'all' | 'recent'>('all');
  if (fd.error) return <ErrorBox error={fd.error} />;
  if (!fd.data) return <Loading />;
  const box = snap?.box?.['2'];
  const current: ScatterPoint[] = (box?.teams ?? [])
    .filter((t) => t.length > T.tov && (t[T.gp] as number) > 0)
    .map((t) => {
      const team = snap!.teams.find((x) => x.id === t[0]);
      const g = t[T.gp] as number;
      return { id: `now-${t[0]}`, x: (t[T.poss] as number) / g, y: (t[T.tpa] as number) / (t[T.fga] as number), label: `${team?.name ?? t[0]} ${seasonLabel(season)}`, short: team?.abbr, highlight: true, detail: [`${g} games`] };
    });
  const from = era === 'all' ? 1980 : 2010;
  const past: ScatterPoint[] = fd.data.teamSeasons.flatMap((s, i) => {
    const par = fd.data!.detail[i]?.[DETAIL.par3];
    return s[1] === 0 && s[0] >= from && s[0] < season && s[10] != null && par != null ? [{ id: `${s[0]}-${s[2]}`, x: s[10]!, y: par, label: `${s[3]} ${seasonLabel(s[0])}`, context: true, detail: [`${s[4]}-${s[5]}`] }] : [];
  });
  return (
    <>
      <p className="muted">Every team since {from - 1}-{String(from).slice(2)} by pace (possessions per game) and how many of its shots were threes. This season's teams are labelled; the grey cloud shows how the league has moved up and to the right.</p>
      <div className="chips tight">
        <button className={era === 'all' ? 'chip active' : 'chip'} onClick={() => setEra('all')}>Since 1979-80</button>
        <button className={era === 'recent' ? 'chip active' : 'chip'} onClick={() => setEra('recent')}>Since 2009-10</button>
      </div>
      <div className="card">
        <ScatterPlot
          points={[...past, ...current]}
          xLabel="Pace (possessions per game)"
          yLabel="Three-point rate"
          xFormat={(v) => v.toFixed(0)}
          yFormat={(v) => `${Math.round(v * 100)}%`}
          height={420}
          ariaLabel="Pace against three-point rate, this season's teams over every team since 1980"
          onPick={(p) => p.id.startsWith('now-') && navigate(`/team/${p.id.slice(4)}`)}
        />
        <p className="muted small">Past seasons from Basketball-Reference; this season from our box scores (possessions estimated the same way).</p>
      </div>
    </>
  );
}

export function SalaryScatter({ season, payroll }: { season: number; payroll: Record<string, { espn?: string; name: string; salaries: (number | null)[] }[]> }) {
  const navigate = useNavigate();
  const snap = seasonSnapshot(season);
  const box = snap?.box?.['2'];
  if (!box) return null;
  const rows = new Map(box.players.map((r) => [r[0], r]));
  const maxGames = Math.max(1, ...box.teams.map((t) => t[T.gp] as number));
  const points: ScatterPoint[] = Object.values(payroll)
    .flat()
    .flatMap((p) => {
      const r = p.espn ? rows.get(p.espn) : undefined;
      const salary = p.salaries[0];
      if (!r || !salary) return [];
      const g = r[P.gp] as number;
      if (g < Math.max(2, maxGames * 0.3) || (r[P.min] as number) / g < 15) return [];
      const line = [0, 0, 0, ...[P.min, P.pts, P.fgm, P.fga, P.tpm, P.tpa, P.ftm, P.fta, P.oreb, P.dreb, P.ast, P.stl, P.blk, P.tov, P.pf, P.pm].map((k) => (r[k] as number) / g)];
      return [{ id: p.espn!, x: salary / 1e6, y: gameScore(line), label: p.name, short: surname(p.name), detail: [`${money(salary)}`, `${((r[P.pts] as number) / g).toFixed(1)} points a game`] }];
    });
  if (points.length < 5) return null;
  // Label the biggest bargains and the priciest underperformers: furthest above and below a straight-line fit.
  const n = points.length;
  const mx = points.reduce((a, p) => a + p.x, 0) / n;
  const my = points.reduce((a, p) => a + p.y, 0) / n;
  const slope = points.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0) / points.reduce((a, p) => a + (p.x - mx) ** 2, 0);
  const resid = (p: ScatterPoint) => p.y - (my + slope * (p.x - mx));
  const sorted = [...points].sort((a, b) => resid(b) - resid(a));
  const flagged = new Set([...sorted.slice(0, 6), ...sorted.slice(-4)].map((p) => p.id));
  return (
    <div className="card">
      <h3>Salary vs production</h3>
      <ScatterPlot
        points={points.map((p) => ({ ...p, highlight: flagged.has(p.id) }))}
        xLabel="Salary ($M)"
        yLabel="Game Score per game"
        xFormat={(v) => `$${v.toFixed(0)}M`}
        yFormat={(v) => v.toFixed(0)}
        ariaLabel="Salary against Game Score per game"
        onPick={(p) => navigate(`/player/${p.id}`)}
      />
      <p className="muted small">Labelled: the six players furthest above the trend for their salary (bargains) and the four furthest below. 15+ minutes a game.</p>
    </div>
  );
}

/** A team's Elo rating game by game this season and last, with the biggest swings. */
export function EloHistory({ teamId, season }: { teamId: string; season: number }) {
  const { data } = useAsync(async () => {
    const hasPrev = SEASONS.some((s) => s.year === season - 1);
    const [now, prev, prev2] = await Promise.all([
      fetchLeagueGames(season, 2),
      hasPrev ? fetchLeagueGames(season - 1, 2).catch(() => undefined) : undefined,
      SEASONS.some((s) => s.year === season - 2) ? fetchLeagueGames(season - 2, 2).catch(() => undefined) : undefined,
    ]);
    const prevRun = prev ? runElo(prev.games, prev2 ? carryOver(runElo(prev2.games).ratings) : new Map()) : undefined;
    const run = runElo(now.games, prevRun ? carryOver(prevRun.ratings) : new Map());
    return { now: run, prev: prevRun, games: now.games };
  }, [teamId, season]);
  const swings = useMemo(() => {
    if (!data) return [];
    const h = data.now.history.get(teamId) ?? [];
    return h.slice(1).map((pt, i) => ({ t: pt.t, delta: pt.rating - h[i].rating })).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 4);
  }, [data, teamId]);
  if (!data) return null;
  const now = (data.now.history.get(teamId) ?? []).map((p) => Math.round(p.rating));
  const prev = (data.prev?.history.get(teamId) ?? []).map((p) => Math.round(p.rating));
  if (now.length < 2) return null;
  const gameAt = (t: number) => data.games.find((g) => Date.parse(g.date) === t && (g.home.team.id === teamId || g.away.team.id === teamId));
  const n = Math.max(now.length, prev.length);
  const pad = (xs: number[]) => [...xs, ...Array(n - xs.length).fill(null)];
  return (
    <div className="card">
      <h3>Elo rating through the season</h3>
      <LineChart
        ariaLabel="Elo rating after each game, this season and last"
        series={[
          { id: 'now', label: 'This season', values: pad(now), color: 'var(--series-1)' },
          ...(prev.length ? [{ id: 'prev', label: 'Last season', values: pad(prev), color: 'var(--series-2)' }] : []),
        ]}
        xLabel={(i) => (i === 0 ? 'Start of season' : `After game ${i}`)}
        xTick={(i) => String(i)}
        height={220}
      />
      {swings.length > 0 && (
        <p className="small">
          <b>Biggest swings:</b>{' '}
          {swings.map((s, i) => {
            const g = gameAt(s.t);
            const opp = g ? (g.home.team.id === teamId ? g.away.team.abbr : g.home.team.abbr) : '';
            return (
              <span key={s.t}>
                {i > 0 && ' · '}
                <span className={s.delta > 0 ? 'win' : 'loss'}>{s.delta > 0 ? '+' : ''}{s.delta.toFixed(0)}</span> vs {opp} ({formatShortDate(new Date(s.t).toISOString())})
              </span>
            );
          })}
        </p>
      )}
      <p className="muted small">1500 is average. Ratings move more for upsets and big margins; each season starts from 75% of the last.</p>
    </div>
  );
}

/** A player's season game by game: points, plus-minus and minutes, with games missed marked. */
export function PlayerTimeline({ playerId, season }: { playerId: string; season: number }) {
  const lines = useAsync(() => loadLines(season), [season]);
  const [stat, setStat] = useState<'pts' | 'pm' | 'min' | 'gmsc'>('pts');
  const model = useMemo(() => {
    const d = lines.data;
    if (!d) return undefined;
    const idx = d.ids.indexOf(playerId);
    if (idx < 0) return undefined;
    const regular = d.games.filter((g) => g[2] === 2).sort((a, b) => a[1].localeCompare(b[1]));
    let teamId = '';
    for (const g of regular) for (const l of g[6]) if (l[L.p] === idx) teamId = l[L.home] ? g[3] : g[4];
    const teamGames = regular.filter((g) => g[3] === teamId || g[4] === teamId);
    const firstPlayed = teamGames.findIndex((g) => g[6].some((l) => l[L.p] === idx));
    return teamGames.slice(Math.max(0, firstPlayed)).map((g) => {
      const l = g[6].find((x) => x[L.p] === idx);
      const opp = g[3] === teamId ? g[4] : g[3];
      return { date: g[1], opp, home: g[3] === teamId, line: l };
    });
  }, [lines.data, playerId]);
  if (!model || model.length < 2) return null;
  const snap = seasonSnapshot(season);
  const abbr = new Map((snap?.teams ?? []).map((t) => [t.id, t.abbr]));
  const value = (l: number[]) => (stat === 'gmsc' ? gameScore(l) : stat === 'pm' ? l[L.pm] : stat === 'min' ? l[L.min] : l[L.pts]);
  const vals = model.map((m) => (m.line ? value(m.line) : 0));
  const max = Math.max(1, ...vals.map(Math.abs));
  const missed = model.filter((m) => !m.line).length;
  const H = 120;
  // Baseline, measured up from the bottom of each column.
  const zero = stat === 'pm' ? H / 2 : 14;
  return (
    <div className="card">
      <div className="page-head">
        <h3>Season timeline</h3>
        <div className="chips tight">
          {(['pts', 'gmsc', 'pm', 'min'] as const).map((k) => (
            <button key={k} className={k === stat ? 'chip active' : 'chip'} onClick={() => setStat(k)}>{{ pts: 'Points', gmsc: 'Game Score', pm: '+/-', min: 'Minutes' }[k]}</button>
          ))}
        </div>
      </div>
      <div className="tl-strip">
        {model.map((m, i) => {
          const v = vals[i];
          const h = m.line ? Math.max(2, (Math.abs(v) / max) * (stat === 'pm' ? H / 2 - 8 : H - 20)) : 0;
          const title = `${formatShortDate(m.date)} ${m.home ? 'vs' : '@'} ${abbr.get(m.opp) ?? ''}: ${m.line ? `${m.line[L.pts]} pts, ${m.line[L.oreb] + m.line[L.dreb]} reb, ${m.line[L.ast]} ast, ${m.line[L.min]} min, ${m.line[L.pm] > 0 ? '+' : ''}${m.line[L.pm]}` : 'did not play'}`;
          return (
            <div key={m.date + i} className="tl-col" title={title} style={{ height: H }}>
              {m.line ? (
                <span className={`tl-bar ${v < 0 ? 'neg' : ''}`} style={{ height: h, bottom: v < 0 ? zero - h : zero }} />
              ) : (
                <span className="tl-missed" style={{ bottom: zero - 4 }}>×</span>
              )}
            </div>
          );
        })}
      </div>
      <p className="muted small">
        Each column is one of the team's games since the player's first appearance (hover for the line). × = didn't play{missed ? ` (${missed} game${missed === 1 ? '' : 's'})` : ''}. The injury report only covers today, so reasons for older absences aren't shown.
      </p>
    </div>
  );
}
