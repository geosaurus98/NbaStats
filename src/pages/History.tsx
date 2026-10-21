import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AllTimeLeaders, Awards } from '../components/AllTime';
import { CareerArc, CareerStatsTable } from '../components/CareerStats';
import { DraftHistory } from '../components/DraftHistory';
import { CareerTimeline } from '../components/CareerTimeline';
import { ChordDiagram } from '../components/ChordDiagram';
import { ContinuityHeatmap } from '../components/ContinuityHeatmap';
import { PlayerDatalist, PlayerInput } from '../components/PlayerInput';
import { GreatestTeams } from '../components/GreatestTeams';
import { SimilarPlayers } from '../components/SimilarPlayers';
import { TeamSeasonCompare } from '../components/TeamSeasonCompare';
import { Tile } from '../components/Tile';
import { franchiseById } from '../lib/franchises';
import { allMoves, careerSegments, commonTeammates, continuity, journeymen, moveMatrix, sharedRosters } from '../lib/history';
import { useTeammateGraph } from '../lib/teammateStore';
import { Loading as GraphLoading } from '../components/Status';
import { bfs, findPlayer, seasonLabel, type Graph } from '../lib/teammates';

const TABS = [
  { id: 'movement', label: 'Player movement' },
  { id: 'careers', label: 'Career journeys' },
  { id: 'compare', label: 'Compare two players' },
  { id: 'similar', label: 'Similar players' },
  { id: 'leaders', label: 'All-time leaders' },
  { id: 'awards', label: 'Awards' },
  { id: 'draft', label: 'Draft' },
  { id: 'teams', label: 'Team vs team' },
  { id: 'greatest', label: 'Greatest teams' },
  { id: 'continuity', label: 'Roster continuity' },
] as const;
type Tab = (typeof TABS)[number]['id'];

export function History() {
  const graph = useTeammateGraph();
  if (!graph) return <GraphLoading label="Loading every roster since 1946-47…" />;
  return <HistoryPage graph={graph} />;
}

function HistoryPage({ graph }: { graph: Graph }) {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'movement') as Tab;
  const setParam = (updates: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(updates)) {
      if (v == null) next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true });
  };

  return (
    <section>
      <PlayerDatalist graph={graph} />
      <h1>NBA history</h1>
      <p className="muted">Every roster since 1946-47, grouped into today's 30 franchises (Seattle counts as OKC, New Jersey as Brooklyn, and so on).</p>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setParam({ tab: t.id })}>{t.label}</button>
        ))}
      </div>
      {tab === 'movement' && <Movement graph={graph} />}
      {tab === 'careers' && <Careers graph={graph} params={params} setParam={setParam} />}
      {tab === 'compare' && <Compare graph={graph} params={params} setParam={setParam} />}
      {tab === 'leaders' && <AllTimeLeaders graph={graph} />}
      {tab === 'awards' && <Awards graph={graph} />}
      {tab === 'draft' && <DraftHistory graph={graph} />}
      {tab === 'teams' && <TeamSeasonCompare graph={graph} />}
      {tab === 'greatest' && <GreatestTeams graph={graph} />}
      {tab === 'similar' && <SimilarPlayers graph={graph} params={params} setParam={setParam} />}
      {tab === 'continuity' && <Continuity graph={graph} />}
      <p className="muted small">
        Rosters from Basketball-Reference via the open bball-reference-datasets project. The source doesn't say in which order a player
        traded mid-season played for his teams, so it's inferred from the seasons either side and can be off for some trades.
      </p>
    </section>
  );
}

type ParamProps = { graph: Graph; params: URLSearchParams; setParam: (u: Record<string, string | undefined>) => void };

const ERAS = [
  { id: 'all', label: 'All time', from: 0, to: 9999 },
  { id: '1980', label: '1980s', from: 1980, to: 1989 },
  { id: '1990', label: '1990s', from: 1990, to: 1999 },
  { id: '2000', label: '2000s', from: 2000, to: 2009 },
  { id: '2010', label: '2010s', from: 2010, to: 2019 },
  { id: '2020', label: '2020s', from: 2020, to: 9999 },
];

function Movement({ graph }: { graph: Graph }) {
  const players = graph.data.players;
  const [era, setEra] = useState('all');
  const [focus, setFocus] = useState<number | undefined>();
  const [pinnedFocus, setPinnedFocus] = useState<number | undefined>();
  const [pair, setPair] = useState<[number, number] | undefined>();
  const moves = useMemo(() => allMoves(graph), [graph]);
  const e = ERAS.find((x) => x.id === era)!;
  const filtered = useMemo(() => moves.filter((m) => m.season >= e.from && m.season <= e.to), [moves, e]);
  const { ids, matrix } = useMemo(() => moveMatrix(filtered), [filtered]);
  const f = focus ?? pinnedFocus;

  const pairs: { i: number; j: number; v: number }[] = [];
  matrix.forEach((row, i) => row.forEach((v, j) => j > i && pairs.push({ i, j, v })));
  pairs.sort((a, b) => b.v - a.v);
  const pairMoves = pair ? filtered.filter((m) => (m.from === ids[pair[0]] && m.to === ids[pair[1]]) || (m.from === ids[pair[1]] && m.to === ids[pair[0]])) : [];

  return (
    <>
      <div className="chips">
        {ERAS.map((x) => (
          <button key={x.id} className={x.id === era ? 'chip active' : 'chip'} onClick={() => { setEra(x.id); setPair(undefined); }}>{x.label}</button>
        ))}
      </div>
      <div className="degrees-main">
        <div className="card">
          <h3>Who moves between whom ({filtered.length.toLocaleString()} moves)</h3>
          <ChordDiagram
            ids={ids}
            matrix={matrix}
            selected={pair}
            onSelect={setPair}
            focus={f}
            onFocus={setFocus}
          />
          <p className="muted small">
            Each ribbon joins two franchises; wider = more players who went from one to the other (either way). Hover a team to isolate it,
            click a ribbon for the players.
          </p>
          {f != null && (
            <button className="chip" onClick={() => setPinnedFocus(pinnedFocus === f ? undefined : f)}>
              {pinnedFocus === f ? 'Unpin' : `Pin ${ids[f]}`}
            </button>
          )}
        </div>
        <div className="card chain-card">
          {pair ? (
            <>
              <h3>
                {franchiseById(ids[pair[0]])?.name} ↔ {franchiseById(ids[pair[1]])?.name}: {pairMoves.length} players
              </h3>
              <ol className="move-list">
                {pairMoves
                  .sort((a, b) => b.season - a.season)
                  .map((m, k) => (
                    <li key={k}>
                      <Link to={`/history?tab=careers&p=${encodeURIComponent(players[m.player][0])}`}>{players[m.player][0]}</Link>{' '}
                      <span className="muted small">
                        {m.from} → {m.to}, {seasonLabel(m.season)}
                      </span>
                    </li>
                  ))}
              </ol>
            </>
          ) : f != null ? (
            <>
              <h3>{franchiseById(ids[f])?.name}'s busiest links</h3>
              <PairBars
                rows={matrix[f]
                  .map((v, j) => ({ label: ids[j], v, j }))
                  .filter((r) => r.j !== f && r.v > 0)
                  .sort((a, b) => b.v - a.v)
                  .slice(0, 10)
                  .map((r) => ({ label: `${ids[f]} ↔ ${r.label}`, v: r.v, onClick: () => setPair([f, r.j]) }))}
              />
            </>
          ) : (
            <>
              <h3>Busiest connections</h3>
              <PairBars rows={pairs.slice(0, 10).map((p) => ({ label: `${ids[p.i]} ↔ ${ids[p.j]}`, v: p.v, onClick: () => setPair([p.i, p.j]) }))} />
            </>
          )}
        </div>
      </div>
    </>
  );
}

function PairBars({ rows }: { rows: { label: string; v: number; onClick: () => void }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.v));
  return (
    <div className="partner-bars">
      {rows.map((r) => (
        <button key={r.label} className="pbar pbar-button" onClick={r.onClick}>
          <span className="pbar-name">{r.label}</span>
          <span className="pbar-track">
            <span className="pbar-fill" style={{ width: `${(r.v / max) * 100}%`, background: 'var(--series-1)' }} />
          </span>
          <b className="pbar-n">{r.v}</b>
        </button>
      ))}
    </div>
  );
}

function Careers({ graph, params, setParam }: ParamProps) {
  const players = graph.data.players;
  const p = findPlayer(graph.data, params.get('p') ?? 'Ish Smith');
  const top = useMemo(() => journeymen(graph, 20), [graph]);
  const segs = p != null ? careerSegments(graph, p) : [];
  const franchises = new Set(segs.map((s) => s.key)).size;

  return (
    <>
      <div className="degrees-controls">
        <PlayerInput graph={graph} label="Player" value={p} onPick={(i) => setParam({ p: players[i][0] })} />
        {p != null && <Link className="chip" to={`/degrees?c=${encodeURIComponent(players[p][0])}`}>6 degrees from {players[p][0]}</Link>}
      </div>
      {p != null && (
        <>
          <div className="stat-tiles">
            <Tile label="Seasons" value={String(new Set(graph.data.stints[p].map((r) => graph.data.rosters[r][0])).size)} />
            <Tile label="Franchises" value={String(franchises)} />
            <Tile label="Team changes" value={String(Math.max(0, segs.length - 1))} />
            <Tile label="Career" value={`${players[p][1] - 1}–${players[p][2]}`} />
          </div>
          <div className="card">
            <h3>{players[p][0]}'s career</h3>
            <CareerTimeline rows={[{ name: players[p][0], segments: segs }]} />
            <ol className="journey">
              {segs.map((s, k) => (
                <li key={k}>
                  <b>{s.defunct ? s.code : franchiseById(s.key)?.name}</b>{' '}
                  <span className="muted small">
                    {s.from === s.to ? seasonLabel(s.from) : `${seasonLabel(s.from)} – ${seasonLabel(s.to)}`}
                    {!s.defunct && s.code !== s.key ? ` (as ${s.code})` : ''}
                    {s.league !== 'NBA' ? ` · ${s.league}` : ''}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <h3>Career stats</h3>
          <CareerStatsTable graph={graph} player={p} />
          <CareerArc graph={graph} players={[p]} />
        </>
      )}
      <h2>The journeymen: most franchises played for</h2>
      <div className="table-wrap">
        <table>
          <tbody>
            {top.map((j, k) => (
              <tr key={j.player} className="clickable" onClick={() => setParam({ p: players[j.player][0] })}>
                <td>{k + 1}</td>
                <td className="left">{players[j.player][0]}</td>
                <td className="left muted small">{players[j.player][1] - 1}–{players[j.player][2]}</td>
                <td className="sorted">{j.franchises} franchises</td>
                <td className="muted">{j.stints} spells</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Compare({ graph, params, setParam }: ParamProps) {
  const players = graph.data.players;
  const a = findPlayer(graph.data, params.get('a') ?? 'LeBron James');
  const b = findPlayer(graph.data, params.get('b') ?? 'Kobe Bryant');
  const result = useMemo(() => {
    if (a == null || b == null || a === b) return undefined;
    const rosters = sharedRosters(graph, a, b);
    return {
      shared: rosters,
      seasons: [...new Set(rosters.map((r) => graph.data.rosters[r][0]))],
      common: commonTeammates(graph, a, b).sort((x, y) => players[x][0].localeCompare(players[y][0])),
      distance: bfs(graph, a).dist[b],
    };
  }, [graph, a, b, players]);

  return (
    <>
      <div className="degrees-controls">
        <PlayerInput graph={graph} label="Player A" value={a} onPick={(i) => setParam({ a: players[i][0] })} />
        <PlayerInput graph={graph} label="Player B" value={b} onPick={(i) => setParam({ b: players[i][0] })} />
      </div>
      {a != null && b != null && result && (
        <>
          <div className="stat-tiles">
            <Tile label="Seasons as teammates" value={String(result.seasons.length)} />
            <Tile label="Common teammates" value={String(result.common.length)} />
            <Tile label="Teammate links apart" value={result.distance < 0 ? '–' : String(result.distance)} />
            <Tile label="Overlapping seasons" value={String(Math.max(0, Math.min(players[a][2], players[b][2]) - Math.max(players[a][1], players[b][1]) + 1))} />
          </div>
          <div className="card">
            <h3>Careers side by side</h3>
            <CareerTimeline
              rows={[
                { name: players[a][0], segments: careerSegments(graph, a) },
                { name: players[b][0], segments: careerSegments(graph, b) },
              ]}
              shared={result.seasons}
            />
            <p className="muted small">
              {result.shared.length
                ? `Teammates on: ${result.shared.map((r) => `${seasonLabel(graph.data.rosters[r][0])} ${graph.data.rosters[r][2]}`).join(', ')} (shaded).`
                : 'Never teammates.'}{' '}
              <Link to={`/degrees?c=${encodeURIComponent(players[a][0])}&t=${encodeURIComponent(players[b][0])}`}>See the teammate chain →</Link>
            </p>
          </div>
          <CareerArc graph={graph} players={[a, b]} />
          <h3>Teammates of both ({result.common.length})</h3>
          {result.common.length === 0 ? (
            <p className="muted small">No one played with both.</p>
          ) : (
            <div className="chips tight">
              {result.common.map((p) => (
                <Link key={p} className="chip" to={`/history?tab=careers&p=${encodeURIComponent(players[p][0])}`}>{players[p][0]}</Link>
              ))}
            </div>
          )}
        </>
      )}
      {a != null && a === b && <p className="muted">Pick two different players.</p>}
    </>
  );
}

function Continuity({ graph }: { graph: Graph }) {
  const data = useMemo(() => continuity(graph), [graph]);
  const [allHistory, setAllHistory] = useState(false);
  const cells = [...data].flatMap(([id, list]) => list.filter((c) => c.roster >= 10).map((c) => ({ id, ...c })));
  const stable = [...cells].sort((x, y) => y.share - x.share || y.roster - x.roster).slice(0, 8);
  const overhauls = [...cells].sort((x, y) => x.share - y.share).slice(0, 8);
  const list = (rows: typeof cells) => (
    <table>
      <tbody>
        {rows.map((c) => (
          <tr key={`${c.id}${c.season}`}>
            <td className="left"><b>{c.id}</b> {seasonLabel(c.season)}</td>
            <td className="sorted">{Math.round(c.share * 100)}%</td>
            <td className="muted small">{c.returning}/{c.roster} back</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <>
      <div className="page-head">
        <p className="muted">How much of each team's roster was with the franchise the season before.</p>
        <div className="segmented">
          <button className={!allHistory ? 'active' : ''} onClick={() => setAllHistory(false)}>Since 1980</button>
          <button className={allHistory ? 'active' : ''} onClick={() => setAllHistory(true)}>All history</button>
        </div>
      </div>
      <div className="card">
        <ContinuityHeatmap data={data} from={allHistory ? 1948 : 1980} />
      </div>
      <div className="two-col">
        <div className="card">
          <h3>Most stable rosters</h3>
          {list(stable)}
        </div>
        <div className="card">
          <h3>Biggest overhauls</h3>
          {list(overhauls)}
        </div>
      </div>
    </>
  );
}
