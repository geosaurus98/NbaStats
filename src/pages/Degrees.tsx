import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ColumnChart } from '../components/Charts';
import { TeammateGalaxy } from '../components/TeammateGalaxy';
import { Tile } from '../components/Tile';
import { getTeammateGraph } from '../lib/teammateStore';
import { averageDistance, bfs, findPlayer, pathTo, seasonLabel, type Graph } from '../lib/teammates';

const DEFAULT_CENTRE = 'LeBron James';

function PlayerInput({ graph, label, value, onPick }: { graph: Graph; label: string; value?: number; onPick: (p: number) => void }) {
  const current = value != null ? graph.data.players[value][0] : '';
  const [text, setText] = useState(current);
  useEffect(() => setText(current), [current]);
  const commit = (t: string) => {
    const p = findPlayer(graph.data, t);
    if (p != null) onPick(p);
  };
  return (
    <label className="player-input">
      <span className="muted small">{label}</span>
      <input
        list="all-players"
        value={text}
        placeholder="Type a player…"
        onChange={(e) => {
          setText(e.target.value);
          // Picking from the suggestion list gives an exact name: apply straight away.
          if (graph.data.players.some(([n]) => n === e.target.value)) commit(e.target.value);
        }}
        onKeyDown={(e) => e.key === 'Enter' && commit(text)}
        onBlur={() => text && text !== current && commit(text)}
      />
    </label>
  );
}

function rosterLabel(graph: Graph, r: number) {
  const [season, lg, team] = graph.data.rosters[r];
  return `${seasonLabel(season)} ${team}${lg === 'NBA' ? '' : ` (${lg})`}`;
}

function years(graph: Graph, p: number) {
  const [, from, to] = graph.data.players[p];
  return from === to ? seasonLabel(from) : `${from - 1}–${to}`;
}

export function Degrees() {
  const graph = getTeammateGraph();
  const players = graph.data.players;
  const [params, setParams] = useSearchParams();
  const centre = findPlayer(graph.data, params.get('c') ?? DEFAULT_CENTRE) ?? 0;
  const target = params.get('t') ? findPlayer(graph.data, params.get('t')!) : undefined;
  const search = useMemo(() => bfs(graph, centre), [graph, centre]);

  const set = (key: 'c' | 't', p?: number) => {
    const next = new URLSearchParams(params);
    if (p == null) next.delete(key);
    else next.set(key, players[p][0]);
    setParams(next, { replace: true });
  };
  const random = () => {
    const reachable = players.map((_, i) => i).filter((i) => search.dist[i] > 1);
    set('t', reachable[Math.floor(Math.random() * reachable.length)]);
  };
  const swap = () => {
    if (target == null) return;
    const next = new URLSearchParams(params);
    next.set('c', players[target][0]);
    next.set('t', players[centre][0]);
    setParams(next, { replace: true });
  };

  const chain = target != null ? pathTo(search, target) : [];
  const maxD = search.counts.length - 1;
  const farthest = players.map((_, i) => i).filter((i) => search.dist[i] === maxD);
  const direct = useMemo(() => {
    // Centre's rosters, newest first, with their teammates.
    return graph.playerRosters[centre]
      .map((r) => ({ r, mates: graph.data.rosters[r][3].filter((p) => p !== centre) }))
      .sort((a, b) => graph.data.rosters[b.r][0] - graph.data.rosters[a.r][0]);
  }, [graph, centre]);

  return (
    <section>
      <datalist id="all-players">
        {players.map(([name], i) => (
          <option key={i} value={name} />
        ))}
      </datalist>

      <h1>Six degrees of the NBA</h1>
      <p className="muted">
        Every player since 1946-47, linked if they were ever on the same team in the same season. Like the Kevin Bacon game:
        how many teammate links does it take to get from one player to another?
      </p>

      <div className="degrees-controls">
        <PlayerInput graph={graph} label="Centre player" value={centre} onPick={(p) => set('c', p)} />
        <PlayerInput graph={graph} label="Connect to" value={target} onPick={(p) => set('t', p)} />
        <div className="actions">
          <button className="chip" onClick={random}>🎲 Random player</button>
          {target != null && <button className="chip" onClick={swap}>⇄ Swap</button>}
          {target != null && <button className="chip" onClick={() => set('t')}>Clear</button>}
        </div>
      </div>

      <div className="stat-tiles">
        <Tile label="Direct teammates" value={String(search.counts[1] ?? 0)} />
        <Tile label="Players reached" value={`${(search.counts.reduce((a, b) => a + b, 0) - 1).toLocaleString()}`} />
        <Tile label="Average links to anyone" value={averageDistance(search).toFixed(2)} />
        <Tile label="Farthest away" value={`${maxD} links`} />
      </div>

      <div className="degrees-main">
        <div className="card">
          <TeammateGalaxy graph={graph} search={search} centre={centre} target={target} onPick={(p) => set('t', p)} />
          <p className="muted small">
            Each dot is a player. Rings = teammate links from {players[centre][0]}; position around the circle = when they played
            (1947 at the top, running clockwise). Hover a dot to trace their link; click to lock it in.
          </p>
        </div>

        <div className="card chain-card">
          {target == null || target === centre ? (
            <>
              <h3>Pick someone to connect</h3>
              <p className="muted small">
                Click any dot, type a name above, or hit 🎲. The {maxD}-link players farthest from {players[centre][0]}:
              </p>
              <div className="chips tight">
                {farthest.slice(0, 8).map((p) => (
                  <button key={p} className="chip" onClick={() => set('t', p)}>{players[p][0]}</button>
                ))}
              </div>
            </>
          ) : chain.length === 0 ? (
            <p className="muted">{players[target][0]} can't be reached from {players[centre][0]}.</p>
          ) : (
            <>
              <h3>
                {players[target][0]} is <span className="degree-badge">{chain.length - 1}</span> link{chain.length === 2 ? '' : 's'} from{' '}
                {players[centre][0]}
              </h3>
              <ol className="chain">
                {chain.map((l, k) => (
                  <li key={l.player}>
                    {l.roster != null && <div className="chain-via">teammates on the {rosterLabel(graph, l.roster)}</div>}
                    <div className="chain-player">
                      <span className="chain-step">{k}</span>
                      <button className="link" onClick={() => set('c', l.player)} title="Make this player the centre">
                        {players[l.player][0]}
                      </button>
                      <span className="muted small">{years(graph, l.player)}</span>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="muted small">One shortest chain; there are often several. Click a name to put them in the centre.</p>
            </>
          )}
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <h3>How far is everyone from {players[centre][0]}?</h3>
          <ColumnChart
            ariaLabel="Number of players at each teammate distance"
            columns={search.counts.slice(1).map((n, i) => ({
              value: n,
              label: `${i + 1} link${i ? 's' : ''} away`,
              detail: `${n.toLocaleString()} players`,
              tick: String(i + 1),
            }))}
            yFormat={(v) => (v >= 1000 ? `${(v / 1000).toFixed(v % 1000 ? 1 : 0)}K` : String(v))}
            xLabels
          />
          <p className="muted small">Teammate links away (hover a bar for the count).</p>
        </div>
        <div className="card">
          <h3>The NBA's Kevin Bacons</h3>
          <p className="muted small">Players with the shortest average path to everyone in league history.</p>
          <table>
            <tbody>
              {graph.data.central.slice(0, 10).map(([p, avg], i) => (
                <tr key={p}>
                  <td>{i + 1}</td>
                  <td className="left">
                    <button className="link" onClick={() => set('c', p)}>{players[p][0]}</button>{' '}
                    <span className="muted small">{years(graph, p)}</span>
                  </td>
                  <td className="sorted">{avg.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <h2>{players[centre][0]}'s teammates ({search.counts[1] ?? 0})</h2>
      <div className="roster-list">
        {direct.map(({ r, mates }) => (
          <details key={r} className="card">
            <summary>
              <b>{rosterLabel(graph, r)}</b> <span className="muted small">{mates.length} teammates</span>
            </summary>
            <div className="chips tight">
              {mates.map((p) => (
                <button key={p} className="chip" onClick={() => set('c', p)}>{players[p][0]}</button>
              ))}
            </div>
          </details>
        ))}
      </div>

      <p className="muted small">
        Rosters from Basketball-Reference (via the open bball-reference-datasets project), BAA/NBA/ABA, 1946-47 to 2025-26. A
        traded player counts as a teammate of both teams that season.
      </p>
    </section>
  );
}
