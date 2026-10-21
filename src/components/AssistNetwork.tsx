// "Who assists whom" for one team: a circular passing network, a
// passer × scorer matrix (the exact numbers, doubling as the table view) and
// the top duos.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AssistPairs } from '../api/types';
import { useWidth } from './Charts';

interface Node {
  id: string;
  name: string;
  given: number;
  received: number;
  x: number;
  y: number;
  r: number;
  angle: number;
}

interface Edge {
  from: string;
  to: string;
  count: number;
  points: number;
}

const MAX_PLAYERS = 10;

function useNetwork(data: AssistPairs, maxPlayers: number) {
  return useMemo(() => {
    const names = new Map(data.players);
    const given = new Map<string, number>();
    const received = new Map<string, number>();
    for (const [p, s, n] of data.pairs) {
      given.set(p, (given.get(p) ?? 0) + n);
      received.set(s, (received.get(s) ?? 0) + n);
    }
    const ids = [...new Set([...given.keys(), ...received.keys()])]
      .sort((a, b) => (given.get(b) ?? 0) + (received.get(b) ?? 0) - ((given.get(a) ?? 0) + (received.get(a) ?? 0)))
      .slice(0, maxPlayers);
    const keep = new Set(ids);
    const edges: Edge[] = data.pairs
      .filter(([p, s]) => keep.has(p) && keep.has(s))
      .map(([from, to, count, points]) => ({ from, to, count, points }));
    return { ids, names, given, received, edges };
  }, [data, maxPlayers]);
}

export function AssistNetwork({ data, title, maxPlayers = MAX_PLAYERS }: { data: AssistPairs; title?: string; maxPlayers?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { ids, names, given, received, edges } = useNetwork(data, maxPlayers);
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [edgeTip, setEdgeTip] = useState<{ e: Edge; x: number; y: number } | null>(null);
  const focus = hover ?? pinned;

  if (ids.length < 2 || edges.length === 0) return <p className="muted small">Not enough assisted baskets to draw a network.</p>;

  const size = Math.min(width, 560);
  const cx = size / 2;
  const cy = size / 2;
  const ring = size / 2 - 70;
  const maxGiven = Math.max(1, ...ids.map((id) => given.get(id) ?? 0));
  const maxCount = Math.max(...edges.map((e) => e.count));
  const nodes = new Map<string, Node>(
    ids.map((id, i) => {
      const angle = -Math.PI / 2 + (i / ids.length) * Math.PI * 2;
      return [
        id,
        {
          id,
          name: names.get(id) ?? id,
          given: given.get(id) ?? 0,
          received: received.get(id) ?? 0,
          angle,
          x: cx + ring * Math.cos(angle),
          y: cy + ring * Math.sin(angle),
          r: 6 + 12 * Math.sqrt((given.get(id) ?? 0) / maxGiven),
        },
      ];
    }),
  );

  // Curved so A→B and B→A sit side by side; trimmed to stop at the node edge.
  const edgePath = (e: Edge) => {
    const a = nodes.get(e.from)!;
    const b = nodes.get(e.to)!;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const bend = 0.12 * len;
    const qx = mx + (cx - mx) * 0.25 - (dy / len) * bend;
    const qy = my + (cy - my) * 0.25 + (dx / len) * bend;
    const tx = b.x - qx;
    const ty = b.y - qy;
    const tl = Math.hypot(tx, ty) || 1;
    const ex = b.x - (tx / tl) * (b.r + 5);
    const ey = b.y - (ty / tl) * (b.r + 5);
    return { d: `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${qx.toFixed(1)},${qy.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`, qx, qy };
  };

  const role = (e: Edge) => (!focus ? 'all' : e.from === focus ? 'out' : e.to === focus ? 'in' : 'off');
  const connected = (id: string) => !focus || id === focus || edges.some((e) => (e.from === focus && e.to === id) || (e.to === focus && e.from === id));
  // Draw strongest edges last so they sit on top; focused edges above the rest.
  const ordered = [...edges].sort((a, b) => Number(role(a) !== 'off') - Number(role(b) !== 'off') || a.count - b.count);

  const f = focus ? nodes.get(focus) : undefined;
  const outList = focus ? edges.filter((e) => e.from === focus).sort((a, b) => b.count - a.count) : [];
  const inList = focus ? edges.filter((e) => e.to === focus).sort((a, b) => b.count - a.count) : [];

  return (
    <div className="network" ref={ref}>
      {title && <h3>{title}</h3>}
      <div className="legend">
        <span><i className="key-line" style={{ background: 'var(--series-1)' }} />Passes to</span>
        <span><i className="key-line" style={{ background: 'var(--series-2)' }} />Assisted by</span>
        <span className="muted">Thicker line = more assists · bigger dot = more assists made · tap a player</span>
      </div>
      <div className="network-body">
        <svg width={size} height={size} role="img" aria-label="Assist network: arrows point from passer to scorer" onClick={() => setPinned(null)}>
          <defs>
            {(['all', 'out', 'in'] as const).map((k) => (
              <marker key={k} id={`arrow-${k}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" className={`arrow-${k}`} />
              </marker>
            ))}
          </defs>
          {ordered.map((e) => {
            const r = role(e);
            const { d, qx, qy } = edgePath(e);
            const w = 1 + 7 * (e.count / maxCount);
            return (
              <path
                key={`${e.from}>${e.to}`}
                d={d}
                className={`edge edge-${r}`}
                style={{ strokeWidth: w, opacity: r === 'all' ? 0.2 + 0.6 * (e.count / maxCount) : undefined }}
                markerEnd={r === 'off' ? undefined : `url(#arrow-${r})`}
                onPointerEnter={() => setEdgeTip({ e, x: qx, y: qy })}
                onPointerLeave={() => setEdgeTip(null)}
              />
            );
          })}
          {[...nodes.values()].map((n) => {
            const right = Math.cos(n.angle) >= 0;
            const lx = n.x + Math.cos(n.angle) * (n.r + 8);
            const ly = n.y + Math.sin(n.angle) * (n.r + 8);
            return (
              <g
                key={n.id}
                className={`node${connected(n.id) ? '' : ' faded'}${n.id === focus ? ' focus' : ''}`}
                onPointerEnter={() => setHover(n.id)}
                onPointerLeave={() => setHover(null)}
                onClick={(ev) => {
                  ev.stopPropagation();
                  setPinned(pinned === n.id ? null : n.id);
                }}
              >
                <circle cx={n.x} cy={n.y} r={Math.max(n.r, 14)} className="node-hit" />
                <circle cx={n.x} cy={n.y} r={n.r} className="node-dot" />
                <text x={lx} y={ly} dy="0.32em" textAnchor={right ? 'start' : 'end'} className="node-label">
                  {n.name}
                </text>
              </g>
            );
          })}
        </svg>
        {edgeTip && (
          <div className="tooltip" style={{ left: Math.min(edgeTip.x + 10, size - 180), top: edgeTip.y }}>
            <div className="tt-title">
              {names.get(edgeTip.e.from)} → {names.get(edgeTip.e.to)}
            </div>
            <div className="tt-row">
              <b>{edgeTip.e.count}</b>
              <span>assists · {edgeTip.e.points} pts</span>
            </div>
          </div>
        )}
        <div className="network-side">
          {f ? (
            <>
              <div className="network-who">
                <Link to={`/player/${f.id}`}>{f.name}</Link>
                <div className="muted small">
                  {f.given} assists made · {f.received} baskets assisted
                </div>
              </div>
              <PartnerBars title="Passes to" list={outList.map((e) => ({ id: e.to, name: names.get(e.to) ?? e.to, n: e.count }))} color="var(--series-1)" />
              <PartnerBars title="Assisted by" list={inList.map((e) => ({ id: e.from, name: names.get(e.from) ?? e.from, n: e.count }))} color="var(--series-2)" />
            </>
          ) : (
            <TopDuos edges={edges} names={names} />
          )}
        </div>
      </div>
    </div>
  );
}

function PartnerBars({ title, list, color }: { title: string; list: { id: string; name: string; n: number }[]; color: string }) {
  const max = Math.max(1, ...list.map((x) => x.n));
  return (
    <div className="partner-bars">
      <div className="small muted">{title}</div>
      {list.length === 0 && <div className="small muted">-</div>}
      {list.slice(0, 6).map((x) => (
        <div key={x.id} className="pbar">
          <span className="pbar-name">{x.name}</span>
          <span className="pbar-track">
            <span className="pbar-fill" style={{ width: `${(x.n / max) * 100}%`, background: color }} />
          </span>
          <b className="pbar-n">{x.n}</b>
        </div>
      ))}
    </div>
  );
}

function TopDuos({ edges, names }: { edges: Edge[]; names: Map<string, string> }) {
  const top = [...edges].sort((a, b) => b.count - a.count).slice(0, 8);
  const max = Math.max(1, ...top.map((e) => e.count));
  return (
    <div className="partner-bars">
      <div className="small muted">Top passing duos (passer → scorer)</div>
      {top.map((e) => (
        <div key={`${e.from}>${e.to}`} className="pbar">
          <span className="pbar-name">
            {names.get(e.from)} → {names.get(e.to)}
          </span>
          <span className="pbar-track">
            <span className="pbar-fill" style={{ width: `${(e.count / max) * 100}%`, background: 'var(--series-1)' }} />
          </span>
          <b className="pbar-n">{e.count}</b>
        </div>
      ))}
    </div>
  );
}

/** Passer rows × scorer columns, shaded by assists. */
export function AssistMatrix({ data }: { data: AssistPairs }) {
  const { ids, names, edges } = useNetwork(data, MAX_PLAYERS);
  if (ids.length < 2) return null;
  const cell = new Map(edges.map((e) => [`${e.from}>${e.to}`, e]));
  const max = Math.max(1, ...edges.map((e) => e.count));
  const short = (id: string) => (names.get(id) ?? id).split(' ').pop();
  return (
    <div className="table-wrap">
      <table className="matrix">
        <thead>
          <tr>
            <th className="left">Passer ↓ · Scorer →</th>
            {ids.map((id) => (
              <th key={id} title={names.get(id)}>{short(id)}</th>
            ))}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {ids.map((p) => {
            const total = edges.filter((e) => e.from === p).reduce((s, e) => s + e.count, 0);
            return (
              <tr key={p}>
                <td className="left nowrap">
                  <Link to={`/player/${p}`}>{names.get(p)}</Link>
                </td>
                {ids.map((s) => {
                  const e = cell.get(`${p}>${s}`);
                  if (p === s) return <td key={s} className="diag" />;
                  const pct = e ? Math.round(12 + 78 * (e.count / max)) : 0;
                  return (
                    <td
                      key={s}
                      title={e ? `${names.get(p)} → ${names.get(s)}: ${e.count} assists, ${e.points} pts` : undefined}
                      style={e ? { background: `color-mix(in srgb, var(--series-1) ${pct}%, transparent)`, color: pct > 55 ? '#fff' : undefined } : undefined}
                    >
                      {e?.count ?? ''}
                    </td>
                  );
                })}
                <td><b>{total}</b></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
