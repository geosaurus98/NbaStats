import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { seasonAssists, seasonDrama, seasonShots, snapshotGameMap, snapshotTeams, type SeasonType } from '../api/espn';
import type { Game } from '../api/types';
import { useWidth } from '../components/Charts';
import { Clutch, Combos, HotCold, PlayerOfTheNight, ScheduleAheadTab } from '../components/InsightsMore';
import { SeasonTypeToggle } from '../components/SeasonTypeToggle';
import { ShootingZones } from '../components/ShootingZones';
import { TeamStyles, UsageEfficiency } from '../components/MoreGraphs';
import { PointsBySource, ShotTypeLeaders } from '../components/ShotGraphs';
import { ArchetypesView, FreeThrowPressure } from '../components/PlayerExtras';
import { HotHandView } from '../components/HotHand';
import { Empty } from '../components/Status';
import { TeamLogo } from '../components/TeamLogo';
import { formatShortDate } from '../lib/dates';
import type { DramaRow } from '../lib/pbpStats';
import { useSeason } from '../SeasonContext';

const TABS = [
  { id: 'drama', label: 'Most exciting games' },
  { id: 'night', label: 'Player of the night' },
  { id: 'hot', label: 'Hot & cold' },
  { id: 'clutch', label: 'Clutch' },
  { id: 'combos', label: 'Duos & trios' },
  { id: 'duos', label: 'Passing duos' },
  { id: 'zones', label: 'Shooting zones' },
  { id: 'shots', label: 'Shot types' },
  { id: 'hothand', label: 'Hot hand' },
  { id: 'sources', label: 'Points by source' },
  { id: 'usage', label: 'Usage vs efficiency' },
  { id: 'styles', label: 'Team styles' },
  { id: 'archetypes', label: 'Player archetypes' },
  { id: 'schedule', label: 'Schedule ahead' },
] as const;
type Tab = (typeof TABS)[number]['id'];
/** Tabs that only cover the regular season. */
const REGULAR_ONLY = new Set<Tab>(['night', 'hot', 'schedule', 'usage', 'styles', 'sources', 'archetypes']);

export function Insights() {
  const { season } = useSeason();
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.find((t) => t.id === params.get('tab'))?.id ?? 'drama';
  const [type, setType] = useState<SeasonType>(2);
  const hasData = !!seasonDrama(season.year, 2);

  return (
    <section>
      <div className="page-head">
        <h1>{season.label} insights</h1>
        {!REGULAR_ONLY.has(tab) && <SeasonTypeToggle value={type} onChange={setType} />}
      </div>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setParams({ tab: t.id }, { replace: true })}>{t.label}</button>
        ))}
      </div>
      {!hasData && tab !== 'schedule' && <Empty>These are built from every game's play-by-play once a season is finished. Pick 2025-26 or 2024-25.</Empty>}
      {hasData && tab === 'drama' && <Drama season={season.year} type={type} />}
      {hasData && tab === 'duos' && <Duos season={season.year} type={type} />}
      {hasData && tab === 'shots' && <ShotTypeLeaders season={season.year} type={type} />}
      {hasData && tab === 'sources' && <PointsBySource season={season.year} />}
      {hasData && tab === 'usage' && <UsageEfficiency season={season.year} />}
      {hasData && tab === 'styles' && <TeamStyles season={season.year} />}
      {hasData && tab === 'zones' && <ShootingZones season={season.year} type={type} />}
      {hasData && tab === 'night' && <PlayerOfTheNight season={season.year} />}
      {hasData && tab === 'hot' && <HotCold season={season.year} />}
      {hasData && tab === 'clutch' && (
        <>
          <Clutch season={season.year} type={type} />
          <FreeThrowPressure season={season.year} type={type} />
        </>
      )}
      {hasData && tab === 'archetypes' && <ArchetypesView season={season.year} />}
      {hasData && tab === 'hothand' && <HotHandView season={season.year} type={type} />}
      {hasData && tab === 'combos' && <Combos season={season.year} type={type} />}
      {tab === 'schedule' && <ScheduleAheadTab season={season.year} start={season.start} end={season.regularEnd} />}
    </section>
  );
}

const SORTS = [
  { id: 'index', label: 'Drama score', title: 'Total win-probability swing, with the last five minutes counted double' },
  { id: 'comeback', label: 'Biggest comebacks', title: 'Largest deficit the winner overcame' },
  { id: 'changes', label: 'Most lead changes', title: 'Times the lead switched sides' },
  { id: 'late', label: 'Wildest finishes', title: 'Win-probability swing in the last five minutes and overtime' },
] as const;
type SortId = (typeof SORTS)[number]['id'];

interface DramaGame {
  row: DramaRow;
  game: Game;
  index: number;
}

const value = (d: DramaGame, s: SortId) => (s === 'index' ? d.index : s === 'comeback' ? d.row[2] : s === 'changes' ? d.row[3] : d.row[4]);

function Drama({ season, type }: { season: number; type: SeasonType }) {
  const [sort, setSort] = useState<SortId>('index');
  const navigate = useNavigate();
  const games = useMemo(() => {
    const map = snapshotGameMap(season, type);
    return (seasonDrama(season, type) ?? [])
      .map((row) => ({ row, game: map.get(row[0])!, index: Math.round((row[1] + row[4]) * 100) / 100 }))
      .filter((d) => d.game);
  }, [season, type]);
  const ranked = [...games].sort((a, b) => value(b, sort) - value(a, sort)).slice(0, 25);
  if (games.length === 0) return <Empty>No games.</Empty>;

  return (
    <>
      <div className="chips">
        {SORTS.map((s) => (
          <button key={s.id} title={s.title} className={s.id === sort ? 'chip active' : 'chip'} onClick={() => setSort(s.id)}>{s.label}</button>
        ))}
      </div>
      <div className="card">
        <h3>Every game: whole-game swings vs late drama</h3>
        <DramaScatter games={games} highlight={new Set(ranked.slice(0, 10).map((d) => d.row[0]))} onPick={(id) => navigate(`/game/${id}`)} />
        <p className="muted small">
          Each dot is a game. Right = the win probability swung more over the whole game; up = more of it in the last five minutes.
          Top-ten games for the current ranking are highlighted. Click a dot to open the game.
        </p>
      </div>
      <h2>{SORTS.find((s) => s.id === sort)!.label}</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th className="left">Game</th>
              <th className="left">Date</th>
              <th title={SORTS[0].title}>Drama</th>
              <th>Comeback</th>
              <th>Lead changes</th>
              <th>Late swing</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((d, i) => {
              const { game: g, row } = d;
              const winner = (g.home.score ?? 0) > (g.away.score ?? 0) ? g.home : g.away;
              return (
                <tr key={row[0]} className="clickable" onClick={() => navigate(`/game/${row[0]}`)}>
                  <td>{i + 1}</td>
                  <td className="left nowrap">
                    <span className="team-cell">
                      <TeamLogo team={g.away.team} size={18} /> {g.away.team.abbr} {g.away.score} @ {g.home.team.abbr} {g.home.score}
                    </span>
                    {row[5] > 4 && <span className="muted small"> · {row[5] === 5 ? 'OT' : `${row[5] - 4}OT`}</span>}
                    <span className="muted small"> · {winner.team.abbr} won</span>
                    {g.note && <div className="muted small">{g.note}</div>}
                  </td>
                  <td className="left nowrap">{formatShortDate(g.date)}</td>
                  <td className={sort === 'index' ? 'sorted' : undefined}>{d.index.toFixed(2)}</td>
                  <td className={sort === 'comeback' ? 'sorted' : undefined}>{row[2]}</td>
                  <td className={sort === 'changes' ? 'sorted' : undefined}>{row[3]}</td>
                  <td className={sort === 'late' ? 'sorted' : undefined}>{row[4].toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted small">Swing = total movement in ESPN's win probability (from 50% to 90% and back to 40% is 0.9).</p>
    </>
  );
}

function DramaScatter({ games, highlight, onPick }: { games: DramaGame[]; highlight: Set<string>; onPick: (id: string) => void }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<DramaGame | null>(null);
  const height = 300;
  const m = { top: 10, right: 16, bottom: 32, left: 44 };
  const maxX = Math.max(...games.map((d) => d.row[1]));
  const maxY = Math.max(...games.map((d) => d.row[4]));
  const x = (v: number) => m.left + (v / maxX) * (width - m.left - m.right);
  const y = (v: number) => height - m.bottom - (v / maxY) * (height - m.top - m.bottom);
  const ticks = (max: number) => [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f * 10) / 10);
  const ordered = [...games].sort((a, b) => Number(highlight.has(a.row[0])) - Number(highlight.has(b.row[0])));

  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={height} role="img" aria-label="Scatter of every game's total and late win-probability swing">
        {ticks(maxY).map((t) => (
          <g key={`y${t}`}>
            <line className="grid" x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} />
            <text className="tick" x={m.left - 6} y={y(t)} dy="0.32em" textAnchor="end">{t}</text>
          </g>
        ))}
        {ticks(maxX).map((t) => (
          <text key={`x${t}`} className="tick" x={x(t)} y={height - m.bottom + 16} textAnchor="middle">{t}</text>
        ))}
        <text className="tick" x={width - m.right} y={height - 4} textAnchor="end">whole-game swing →</text>
        <text className="tick" x={m.left} y={m.top + 2} dy="0.7em" dx="4">↑ late swing</text>
        {ordered.map((d) => {
          const hot = highlight.has(d.row[0]);
          return (
            <circle
              key={d.row[0]}
              cx={x(d.row[1])}
              cy={y(d.row[4])}
              r={hot ? 5 : 3}
              className={hot ? 'scatter-dot hot' : 'scatter-dot'}
              onPointerEnter={() => setHover(d)}
              onPointerLeave={() => setHover(null)}
              onClick={() => onPick(d.row[0])}
            />
          );
        })}
      </svg>
      {hover && (
        <div className="tooltip" style={x(hover.row[1]) > width * 0.6 ? { right: width - x(hover.row[1]) + 10, top: y(hover.row[4]) } : { left: x(hover.row[1]) + 10, top: y(hover.row[4]) }}>
          <div className="tt-row">
            <b>
              {hover.game.away.team.abbr} {hover.game.away.score} @ {hover.game.home.team.abbr} {hover.game.home.score}
            </b>
          </div>
          <div className="tt-title">
            {formatShortDate(hover.game.date)} · swing {hover.row[1].toFixed(2)} · late {hover.row[4].toFixed(2)} · comeback {hover.row[2]}
          </div>
        </div>
      )}
    </div>
  );
}

function Duos({ season, type }: { season: number; type: SeasonType }) {
  const byTeam = seasonAssists(season, type) ?? {};
  const shots = seasonShots(season, type);
  const teams = new Map((snapshotTeams(season) ?? []).map((t) => [t.id, t]));
  const { pairs, styles, passers, scorers } = useMemo(() => {
    const names = new Map<string, string>();
    const all: { team: string; from: string; to: string; n: number; pts: number }[] = [];
    const given = new Map<string, { n: number; partners: number; team: string }>();
    const got = new Map<string, { n: number; team: string }>();
    const styles: { team: string; assistedShare: number; topShare: number; top: string }[] = [];
    for (const [team, t] of Object.entries(byTeam)) {
      for (const [id, name] of t.players) names.set(id, name);
      const teamGiven = new Map<string, number>();
      let total = 0;
      for (const [from, to, n, pts] of t.pairs) {
        all.push({ team, from, to, n, pts });
        const g = given.get(from) ?? { n: 0, partners: 0, team };
        g.n += n;
        g.partners++;
        given.set(from, g);
        const r = got.get(to) ?? { n: 0, team };
        r.n += n;
        got.set(to, r);
        teamGiven.set(from, (teamGiven.get(from) ?? 0) + n);
        total += n;
      }
      // Made field goals from the shot bins (every basket is in there once).
      const made = (shots?.teams[team] ?? []).reduce((s, b) => s + b[2], 0);
      const [topId, topN] = [...teamGiven].sort((a, b) => b[1] - a[1])[0] ?? ['', 0];
      if (made && total) styles.push({ team, assistedShare: total / made, topShare: topN / total, top: names.get(topId) ?? topId });
    }
    all.sort((a, b) => b.n - a.n);
    const rank = <T extends { n: number }>(m: Map<string, T>) =>
      [...m].sort((a, b) => b[1].n - a[1].n).slice(0, 10).map(([id, v]) => ({ id, name: names.get(id) ?? id, ...v }));
    return {
      pairs: all.slice(0, 25).map((p) => ({ ...p, fromName: names.get(p.from) ?? p.from, toName: names.get(p.to) ?? p.to })),
      styles,
      passers: rank(given),
      scorers: rank(got),
    };
  }, [byTeam, shots]);
  const max = Math.max(1, ...pairs.map((p) => p.n));
  const abbr = (id: string) => teams.get(id)?.abbr ?? id;

  return (
    <>
      <div className="card">
        <h3>The league's top 25 passing duos</h3>
        <div className="partner-bars">
          {pairs.map((p) => (
            <div key={`${p.from}>${p.to}`} className="pbar wide" title={`${p.n} assists, ${p.pts} pts`}>
              <span className="pbar-name">
                {teams.get(p.team) && <TeamLogo team={teams.get(p.team)!} size={16} />}{' '}
                <Link to={`/player/${p.from}`}>{p.fromName}</Link> → <Link to={`/player/${p.to}`}>{p.toName}</Link>
              </span>
              <span className="pbar-track">
                <span className="pbar-fill" style={{ width: `${(p.n / max) * 100}%`, background: 'var(--series-1)' }} />
              </span>
              <b className="pbar-n">{p.n}</b>
              <span className="muted small">{p.pts} pts</span>
            </div>
          ))}
        </div>
      </div>
      {styles.length > 0 && (
        <div className="card">
          <h3>Passing style: ball movement vs one-man show</h3>
          <StyleScatter styles={styles} abbr={abbr} />
          <p className="muted small">
            Right = more of the team's baskets come from a pass. Up = more of its assists come from one player. Top-right teams pass a
            lot but through one hub; bottom-right teams share it around.
          </p>
        </div>
      )}
      <div className="two-col">
        <div className="card">
          <h3>Most assists (from play-by-play)</h3>
          <table>
            <tbody>
              {passers.map((p, i) => (
                <tr key={p.id}>
                  <td>{i + 1}</td>
                  <td className="left"><Link to={`/player/${p.id}`}>{p.name}</Link> <span className="muted small">{abbr(p.team)}</span></td>
                  <td className="sorted">{p.n}</td>
                  <td className="muted small hide-sm">to {p.partners} teammates</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>Most assisted scorers</h3>
          <table>
            <tbody>
              {scorers.map((p, i) => (
                <tr key={p.id}>
                  <td>{i + 1}</td>
                  <td className="left"><Link to={`/player/${p.id}`}>{p.name}</Link> <span className="muted small">{abbr(p.team)}</span></td>
                  <td className="sorted">{p.n}</td>
                  <td className="muted small hide-sm">assisted baskets</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function StyleScatter({ styles, abbr }: { styles: { team: string; assistedShare: number; topShare: number; top: string }[]; abbr: (id: string) => string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<string | null>(null);
  const height = 340;
  const m = { top: 14, right: 24, bottom: 34, left: 46 };
  const xs = styles.map((s) => s.assistedShare);
  const ys = styles.map((s) => s.topShare);
  const pad = (lo: number, hi: number) => [lo - (hi - lo) * 0.08, hi + (hi - lo) * 0.08];
  const [x0, x1] = pad(Math.min(...xs), Math.max(...xs));
  const [y0, y1] = pad(Math.min(...ys), Math.max(...ys));
  const x = (v: number) => m.left + ((v - x0) / (x1 - x0)) * (width - m.left - m.right);
  const y = (v: number) => height - m.bottom - ((v - y0) / (y1 - y0)) * (height - m.top - m.bottom);
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const ticks = (lo: number, hi: number) => Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * (i + 0.5)) / 5);
  const h = styles.find((s) => s.team === hover);
  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={height} role="img" aria-label="Teams by share of baskets assisted and share of assists from their top passer">
        {ticks(y0, y1).map((t) => (
          <g key={`y${t}`}>
            <line className="grid" x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} />
            <text className="tick" x={m.left - 6} y={y(t)} dy="0.32em" textAnchor="end">{pct(t)}</text>
          </g>
        ))}
        {ticks(x0, x1).map((t) => (
          <text key={`x${t}`} className="tick" x={x(t)} y={height - m.bottom + 16} textAnchor="middle">{pct(t)}</text>
        ))}
        <text className="tick" x={width - m.right} y={height - 4} textAnchor="end">baskets assisted →</text>
        <text className="tick" x={m.left + 4} y={m.top} dy="0.7em">↑ assists from top passer</text>
        {styles.map((s) => (
          <g key={s.team} onPointerEnter={() => setHover(s.team)} onPointerLeave={() => setHover(null)}>
            <circle cx={x(s.assistedShare)} cy={y(s.topShare)} r={12} fill="transparent" />
            <circle className={`scatter-dot team${hover === s.team ? ' hot' : ''}`} cx={x(s.assistedShare)} cy={y(s.topShare)} r={5} />
            <text className="node-label" x={x(s.assistedShare) + 8} y={y(s.topShare)} dy="0.32em">{abbr(s.team)}</text>
          </g>
        ))}
      </svg>
      {h && (
        <div className="tooltip" style={{ left: Math.min(x(h.assistedShare) + 12, width - 220), top: y(h.topShare) + 10 }}>
          <div className="tt-row"><b>{abbr(h.team)}</b></div>
          <div className="tt-title">
            {pct(h.assistedShare)} of baskets assisted · {pct(h.topShare)} of assists by {h.top}
          </div>
        </div>
      )}
    </div>
  );
}
