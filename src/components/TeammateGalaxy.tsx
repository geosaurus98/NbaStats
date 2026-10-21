// Every player in history around a centre player: distance from the centre
// (teammate links) sets the ring, career midpoint sets the angle, so the
// league's history runs clockwise from 1947 at the top. Drawn on canvas
// (5,000+ dots) with a second canvas for the hover/path overlay.
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import type { Graph, Search } from '../lib/teammates';
import { pathTo } from '../lib/teammates';
import { useWidth } from './Charts';

const FIRST = 1947;
const LAST = 2026;

function hash(i: number): number {
  let h = (i + 1) * 2654435761;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#2a78d6';
}

export function TeammateGalaxy({
  graph,
  search,
  centre,
  target,
  onPick,
}: {
  graph: Graph;
  search: Search;
  centre: number;
  target?: number;
  onPick: (player: number) => void;
}) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const base = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [theme, setTheme] = useState(0);
  const size = Math.min(width, 760);
  const players = graph.data.players;
  const maxD = Math.max(1, search.counts.length - 1);

  // Re-read colours when the OS theme or the in-app theme switch changes.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const fn = () => setTheme((t) => t + 1);
    mq.addEventListener('change', fn);
    window.addEventListener('themechange', fn);
    return () => {
      mq.removeEventListener('change', fn);
      window.removeEventListener('themechange', fn);
    };
  }, []);

  const layout = useMemo(() => {
    const c = size / 2;
    const R = size / 2 - 34;
    // Ring widths grow with sqrt(players in ring) so crowded rings get room
    // and near-empty outer rings don't waste space.
    const weights = Array.from({ length: maxD }, (_, k) => Math.max(1.5, Math.sqrt(search.counts[k + 1] ?? 0)));
    const total = weights.reduce((a, b) => a + b, 0);
    const edges = [0];
    for (const w of weights) edges.push(edges[edges.length - 1] + (w / total) * R);
    const xs = new Float32Array(players.length);
    const ys = new Float32Array(players.length);
    players.forEach(([, from, to], i) => {
      const d = search.dist[i];
      if (d < 0) {
        xs[i] = NaN;
        return;
      }
      if (d === 0) {
        xs[i] = c;
        ys[i] = c;
        return;
      }
      const mid = (from + to) / 2;
      const angle = -Math.PI / 2 + ((mid - FIRST) / (LAST - FIRST + 1)) * Math.PI * 2 + (hash(i * 7) - 0.5) * 0.05;
      const inner = edges[d - 1];
      const outer = edges[d];
      const r = inner + (outer - inner) * (0.15 + 0.7 * hash(i));
      xs[i] = c + r * Math.cos(angle);
      ys[i] = c + r * Math.sin(angle);
    });
    return { c, R, edges, xs, ys };
  }, [players, search, size, maxD]);

  // Base layer: rings, era ticks and every player.
  useEffect(() => {
    const cv = base.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = size * dpr;
    cv.height = size * dpr;
    const ctx = cv.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const { c, R, edges, xs, ys } = layout;
    const grid = cssVar('--grid');
    const tick = cssVar('--tick');
    const dot = cssVar('--series-1');

    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    for (let d = 1; d <= maxD; d++) {
      ctx.beginPath();
      ctx.arc(c, c, edges[d], 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = tick;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let year = 1950; year <= 2020; year += 10) {
      const a = -Math.PI / 2 + ((year - FIRST) / (LAST - FIRST + 1)) * Math.PI * 2;
      ctx.fillText(`${year}s`, c + (R + 18) * Math.cos(a), c + (R + 18) * Math.sin(a));
    }
    // Ring numbers along the 12 o'clock line, on a surface chip so dots don't hide them.
    for (let d = 1; d <= maxD; d++) {
      const y = c - (edges[d - 1] + edges[d]) / 2;
      ctx.fillStyle = cssVar('--surface');
      ctx.fillRect(c - 7, y - 7, 14, 14);
      ctx.fillStyle = tick;
      ctx.fillText(String(d), c, y);
    }

    for (let i = 0; i < players.length; i++) {
      const d = search.dist[i];
      if (d <= 0 || Number.isNaN(xs[i])) continue;
      // Closer players are more opaque.
      ctx.globalAlpha = 0.95 - 0.6 * ((d - 1) / Math.max(1, maxD - 1));
      ctx.fillStyle = dot;
      ctx.beginPath();
      ctx.arc(xs[i], ys[i], d === 1 ? 2.6 : 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, [layout, size, players, search, maxD, theme]);

  // Overlay: path to the target (and to the hovered player), centre marker.
  useEffect(() => {
    const cv = overlay.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = size * dpr;
    cv.height = size * dpr;
    const ctx = cv.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const { xs, ys } = layout;
    const accent = cssVar('--series-2');
    const surface = cssVar('--surface');
    const text = cssVar('--text');

    const drawPath = (to: number, strong: boolean) => {
      const chain = pathTo(search, to);
      if (chain.length < 2) return;
      ctx.globalAlpha = strong ? 1 : 0.55;
      ctx.strokeStyle = accent;
      ctx.lineWidth = strong ? 2.5 : 1.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      chain.forEach((l, k) => (k ? ctx.lineTo(xs[l.player], ys[l.player]) : ctx.moveTo(xs[l.player], ys[l.player])));
      ctx.stroke();
      for (const l of chain) {
        ctx.fillStyle = accent;
        ctx.strokeStyle = surface;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(xs[l.player], ys[l.player], strong ? 5 : 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (strong) {
        ctx.font = '600 11px system-ui, sans-serif';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 3;
        for (const l of chain.slice(1)) {
          const x = xs[l.player];
          const right = x >= layout.c;
          ctx.textAlign = right ? 'left' : 'right';
          const label = players[l.player][0];
          ctx.strokeStyle = surface;
          ctx.strokeText(label, x + (right ? 8 : -8), ys[l.player]);
          ctx.fillStyle = text;
          ctx.fillText(label, x + (right ? 8 : -8), ys[l.player]);
        }
      }
    };
    if (target != null && target !== centre) drawPath(target, true);
    if (hover != null && hover !== target) drawPath(hover, false);

    // Centre player.
    ctx.fillStyle = text;
    ctx.beginPath();
    ctx.arc(layout.c, layout.c, 7, 0, Math.PI * 2);
    ctx.fill();
  }, [layout, size, search, target, hover, centre, players, theme]);

  const nearest = (e: MouseEvent<HTMLCanvasElement>): number | null => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const { xs, ys } = layout;
    let best = -1;
    let bestD = 12 * 12; // pick radius 12px
    for (let i = 0; i < xs.length; i++) {
      const dx = xs[i] - px;
      const dy = ys[i] - py;
      const dd = dx * dx + dy * dy;
      if (dd < bestD) {
        bestD = dd;
        best = i;
      }
    }
    return best >= 0 ? best : null;
  };

  const h = hover != null ? players[hover] : undefined;

  return (
    <div className="galaxy" ref={wrapRef}>
      <div className="galaxy-stage" style={{ width: size, height: size }}>
        <canvas ref={base} style={{ width: size, height: size }} aria-hidden />
        <canvas
          ref={overlay}
          style={{ width: size, height: size }}
          role="img"
          aria-label={`Every player in history placed by teammate distance from ${players[centre][0]}`}
          onPointerMove={(e) => setHover(nearest(e))}
          onPointerLeave={() => setHover(null)}
          onClick={(e) => {
            const p = nearest(e);
            if (p != null) onPick(p);
          }}
        />
        {h && hover != null && (
          <div className="tooltip" style={layout.xs[hover] > size * 0.6 ? { right: size - layout.xs[hover] + 12, top: layout.ys[hover] } : { left: layout.xs[hover] + 12, top: layout.ys[hover] }}>
            <div className="tt-row">
              <b>{h[0]}</b>
            </div>
            <div className="tt-title">
              {h[1] === h[2] ? h[1] : `${h[1]}–${h[2]}`} · {search.dist[hover]} link{search.dist[hover] === 1 ? '' : 's'} away
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
