// Higher or lower: which of two players had more of a career stat? Keep the
// streak going; best streak is remembered on this device.
import { useMemo, useState } from 'react';
import { allStarCounts, perGame, totals, type CareerData } from '../lib/careers';
import { careerSegments } from '../lib/history';
import type { Graph } from '../lib/teammates';
import { useCareers } from './CareerStats';
import { ShareButton } from './ShareButton';
import { ErrorBox, Loading } from './Status';

const BEST_KEY = 'nba-hub-higher-lower-best';

interface Stat {
  id: string;
  label: string;
  value: (p: number) => number | undefined;
  format: (v: number) => string;
  /** Only ask when both players' careers were fully recorded for this stat. */
  since?: number;
}

function stats(graph: Graph, data: CareerData): Stat[] {
  const stars = allStarCounts(data);
  const t = (p: number) => totals(data.seasons[p] ?? []);
  const int = (v: number) => Math.round(v).toLocaleString();
  return [
    { id: 'pts', label: 'career points', value: (p) => t(p).values.pts, format: int },
    { id: 'trb', label: 'career rebounds', value: (p) => t(p).values.trb, format: int, since: 1951 },
    { id: 'ast', label: 'career assists', value: (p) => t(p).values.ast, format: int },
    { id: 'ppg', label: 'career points per game', value: (p) => perGame(t(p), 'pts'), format: (v) => v.toFixed(1) },
    { id: 'g', label: 'career games', value: (p) => t(p).g, format: int },
    { id: 'as', label: 'All-Star selections', value: (p) => stars.get(p) ?? 0, format: int },
    { id: 'fr', label: 'franchises played for', value: (p) => new Set(careerSegments(graph, p).map((s) => s.key)).size, format: int },
  ];
}

export function HigherLower({ graph }: { graph: Graph }) {
  const careers = useCareers();
  const pool = useMemo(() => {
    if (!careers.data) return [];
    const d = careers.data;
    return graph.data.players.map((_, p) => p).filter((p) => totals(d.seasons[p] ?? []).values.pts >= 9000);
  }, [graph, careers.data]);
  const statList = useMemo(() => (careers.data ? stats(graph, careers.data) : []), [graph, careers.data]);
  const [round, setRound] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(() => {
    try {
      return Number(localStorage.getItem(BEST_KEY)) || 0;
    } catch {
      return 0;
    }
  });
  const [picked, setPicked] = useState<number | null>(null);

  const q = useMemo(() => {
    if (!pool.length || !statList.length) return undefined;
    for (let tries = 0; tries < 50; tries++) {
      const a = pool[Math.floor(Math.random() * pool.length)];
      const b = pool[Math.floor(Math.random() * pool.length)];
      const stat = statList[Math.floor(Math.random() * statList.length)];
      if (a === b) continue;
      if (stat.since && Math.min(graph.data.players[a][1], graph.data.players[b][1]) < stat.since) continue;
      const va = stat.value(a);
      const vb = stat.value(b);
      if (va == null || vb == null || va === vb) continue;
      return { a, b, stat, va, vb };
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, pool, statList]);

  if (careers.loading) return <Loading label="Loading every career…" />;
  if (careers.error) return <ErrorBox error={careers.error} />;
  if (!q) return null;
  const players = graph.data.players;
  const answer = q.va > q.vb ? q.a : q.b;
  const correct = picked === answer;

  const pick = (p: number) => {
    if (picked != null) return;
    setPicked(p);
    if (p === answer) {
      const s = streak + 1;
      setStreak(s);
      if (s > best) {
        setBest(s);
        try {
          localStorage.setItem(BEST_KEY, String(s));
        } catch {
          /* storage unavailable */
        }
      }
    }
  };
  const next = () => {
    if (!correct) setStreak(0);
    setPicked(null);
    setRound((r) => r + 1);
  };

  return (
    <>
      <p className="muted">
        Who had more <b>{q.stat.label}</b>? Regular season, any era.
      </p>
      <div className="actions">
        <span className="chip static">Streak {streak}</span>
        <span className="chip static">Best {best}</span>
      </div>
      <div className="hl-cards">
        {[q.a, q.b].map((p) => {
          const v = p === q.a ? q.va : q.vb;
          const state = picked == null ? '' : p === answer ? ' right' : p === picked ? ' wrong' : '';
          return (
            <button key={p} className={`card hl-card${state}`} onClick={() => pick(p)} disabled={picked != null}>
              <b>{players[p][0]}</b>
              <span className="muted small">{players[p][1] - 1}–{players[p][2]}</span>
              <span className="hl-value">{picked == null ? '?' : q.stat.format(v)}</span>
            </button>
          );
        })}
      </div>
      {picked != null && (
        <p>
          <b className={correct ? 'win' : 'loss'}>{correct ? '✓ Correct!' : `✗ It was ${players[answer][0]}.`}</b>{' '}
          <button className="chip active" onClick={next}>{correct ? 'Next' : 'Start a new streak'}</button>{' '}
          {!correct && streak > 0 && <ShareButton label="Share streak" text={`🏀 NBA Stats Hub · Higher or lower\n🔥 ${streak} in a row (best ${best})`} />}
        </p>
      )}
    </>
  );
}
