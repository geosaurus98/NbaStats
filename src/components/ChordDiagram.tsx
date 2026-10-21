// Chord diagram: one arc per franchise (sized by its moves), ribbons sized by
// players who moved between each pair. Hover an arc to isolate a team; hover
// or click a ribbon for the pair.
import { useMemo, useState } from 'react';
import { useWidth } from './Charts';

const GAP = 0.012;

export function ChordDiagram({
  ids,
  matrix,
  selected,
  onSelect,
  focus,
  onFocus,
}: {
  ids: string[];
  matrix: number[][];
  /** Selected pair [i, j]. */
  selected?: [number, number];
  onSelect: (pair: [number, number] | undefined) => void;
  focus?: number;
  onFocus: (i: number | undefined) => void;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hoverRibbon, setHoverRibbon] = useState<{ i: number; j: number; x: number; y: number } | null>(null);
  const size = Math.min(width, 640);
  const c = size / 2;
  const outer = c - 40;
  const inner = outer - 12;

  const layout = useMemo(() => {
    const n = ids.length;
    const sums = matrix.map((row, i) => row.reduce((a, v, j) => a + (i === j ? 0 : v), 0));
    const total = sums.reduce((a, b) => a + b, 0) || 1;
    const k = (Math.PI * 2 - n * GAP) / total;
    let a = -Math.PI / 2;
    const arcs = sums.map((s) => {
      const a0 = a;
      a += s * k;
      const a1 = a;
      a += GAP;
      return { a0, a1 };
    });
    // Sub-arc for each (i, j): ordered by j within arc i.
    const sub = matrix.map((row, i) => {
      let p = arcs[i].a0;
      return row.map((v, j) => {
        const s0 = p;
        if (i !== j) p += v * k;
        return [s0, p] as [number, number];
      });
    });
    return { arcs, sub };
  }, [ids, matrix]);

  const pt = (angle: number, r: number) => [c + r * Math.cos(angle), c + r * Math.sin(angle)];
  const arcPath = (a0: number, a1: number) => {
    const [x0, y0] = pt(a0, outer);
    const [x1, y1] = pt(a1, outer);
    const [x2, y2] = pt(a1, inner);
    const [x3, y3] = pt(a0, inner);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M${x0},${y0}A${outer},${outer} 0 ${large} 1 ${x1},${y1}L${x2},${y2}A${inner},${inner} 0 ${large} 0 ${x3},${y3}Z`;
  };
  const ribbonPath = (i: number, j: number) => {
    const [s0, s1] = layout.sub[i][j];
    const [t0, t1] = layout.sub[j][i];
    const [ax0, ay0] = pt(s0, inner);
    const [ax1, ay1] = pt(s1, inner);
    const [bx0, by0] = pt(t0, inner);
    const [bx1, by1] = pt(t1, inner);
    return `M${ax0},${ay0}A${inner},${inner} 0 0 1 ${ax1},${ay1}Q${c},${c} ${bx0},${by0}A${inner},${inner} 0 0 1 ${bx1},${by1}Q${c},${c} ${ax0},${ay0}Z`;
  };

  const max = Math.max(1, ...matrix.flatMap((row, i) => row.filter((_, j) => j !== i)));
  const ribbons: { i: number; j: number; v: number }[] = [];
  matrix.forEach((row, i) => row.forEach((v, j) => j > i && v > 0 && ribbons.push({ i, j, v })));
  const state = (i: number, j: number) => {
    if (selected && ((selected[0] === i && selected[1] === j) || (selected[0] === j && selected[1] === i))) return 'sel';
    if (focus == null) return 'all';
    return i === focus || j === focus ? 'on' : 'off';
  };
  // Draw faded first, then highlighted on top; small ribbons first.
  const order = (r: { i: number; j: number; v: number }) => ({ off: 0, all: 1, on: 2, sel: 3 })[state(r.i, r.j)] * 1e6 + r.v;
  ribbons.sort((a, b) => order(a) - order(b));

  return (
    <div className="chord" ref={ref}>
      <div className="chord-stage" style={{ width: size, height: size }}>
        <svg width={size} height={size} role="img" aria-label="Players moving between franchises" onClick={() => onSelect(undefined)}>
          {ribbons.map(({ i, j, v }) => {
            const s = state(i, j);
            return (
              <path
                key={`${i}-${j}`}
                d={ribbonPath(i, j)}
                className={`ribbon ribbon-${s}`}
                style={s === 'all' ? { opacity: 0.12 + 0.6 * (v / max) } : undefined}
                onPointerEnter={(e) => {
                  const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                  setHoverRibbon({ i, j, x: e.clientX - rect.left, y: e.clientY - rect.top });
                }}
                onPointerLeave={() => setHoverRibbon(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect([i, j]);
                }}
              />
            );
          })}
          {layout.arcs.map(({ a0, a1 }, i) => {
            const mid = (a0 + a1) / 2;
            const [lx, ly] = pt(mid, outer + 8);
            const deg = (mid * 180) / Math.PI;
            const flip = mid > Math.PI / 2 && mid < (Math.PI * 3) / 2;
            return (
              <g
                key={ids[i]}
                className={`chord-arc${focus === i ? ' focus' : ''}${focus != null && focus !== i ? ' faded' : ''}`}
                onPointerEnter={() => onFocus(i)}
                onPointerLeave={() => onFocus(undefined)}
                onClick={(e) => {
                  e.stopPropagation();
                  onFocus(focus === i ? undefined : i);
                }}
              >
                <path d={arcPath(a0, a1)} />
                <text
                  x={lx}
                  y={ly}
                  dy="0.32em"
                  textAnchor={flip ? 'end' : 'start'}
                  transform={`rotate(${flip ? deg + 180 : deg} ${lx} ${ly})`}
                >
                  {ids[i]}
                </text>
              </g>
            );
          })}
        </svg>
        {hoverRibbon && (
          <div className="tooltip" style={{ left: Math.min(hoverRibbon.x + 12, size - 180), top: hoverRibbon.y + 8 }}>
            <div className="tt-row">
              <b>{matrix[hoverRibbon.i][hoverRibbon.j]}</b>
              <span>players</span>
            </div>
            <div className="tt-title">
              {ids[hoverRibbon.i]} ↔ {ids[hoverRibbon.j]} · click for the list
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
