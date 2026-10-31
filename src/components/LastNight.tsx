// Home page: last night in brief: 40-point games, triple-doubles, new season
// highs, rookie breakouts and scoring streaks kept alive.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { seasonSnapshot } from '../api/espn';
import { loadLines } from '../api/linesStore';
import { useAsync } from '../hooks/useAsync';
import { L } from '../lib/boxTotals';
import { formatDay } from '../lib/dates';
import { usDay } from '../lib/gameLines';
import { streaks } from '../lib/playerExtras';

interface Item {
  id: string;
  kind: string;
  text: string;
  weight: number;
}

export function LastNight({ season }: { season: number }) {
  const snap = seasonSnapshot(season);
  const { data } = useAsync(() => loadLines(season), [season]);
  const digest = useMemo(() => {
    if (!data || !data.games.length) return undefined;
    const games = [...data.games].sort((a, b) => a[1].localeCompare(b[1]));
    const last = usDay(games[games.length - 1][1]);
    const rookies = new Set(snap?.box?.['2']?.rookies ?? []);
    const best = new Map<number, number>();
    const played = new Map<number, number>();
    const items: Item[] = [];
    const abbr = new Map((snap?.teams ?? []).map((t) => [t.id, t.abbr]));
    const name = (p: number) => snap?.players?.[data.ids[p]] ?? data.ids[p];
    for (const [, date, , homeId, awayId, , lines] of games) {
      const tonight = usDay(date) === last;
      for (const l of lines) {
        if (l[L.min] <= 0) continue;
        const p = l[L.p];
        const pts = l[L.pts];
        const reb = l[L.oreb] + l[L.dreb];
        if (tonight) {
          const id = data.ids[p];
          const team = abbr.get(l[L.home] ? homeId : awayId) ?? '';
          const opp = abbr.get(l[L.home] ? awayId : homeId) ?? '';
          const line = `${pts} pts, ${reb} reb, ${l[L.ast]} ast vs ${opp}`;
          const tens = [pts, reb, l[L.ast], l[L.stl], l[L.blk]].filter((v) => v >= 10).length;
          const prevBest = best.get(p) ?? 0;
          if (pts >= 40) items.push({ id, kind: '40-point game', text: `${name(p)} (${team}): ${line}`, weight: 100 + pts });
          else if (tens >= 3) items.push({ id, kind: 'Triple-double', text: `${name(p)} (${team}): ${line}`, weight: 90 + pts });
          else if ((played.get(p) ?? 0) >= 3 && pts > prevBest && pts >= 25) items.push({ id, kind: 'Season high', text: `${name(p)} (${team}): ${pts} points, up from ${prevBest}`, weight: 50 + pts });
          if (rookies.has(id) && (pts >= 20 || ((played.get(p) ?? 0) >= 2 && pts > prevBest && pts >= 14))) items.push({ id, kind: 'Rookie breakout', text: `${name(p)} (${team}): ${pts >= 20 ? line : `career-high ${pts} points`}`, weight: 40 + pts });
        }
        best.set(p, Math.max(best.get(p) ?? 0, pts));
        played.set(p, (played.get(p) ?? 0) + 1);
      }
    }
    const tonightIds = new Set(games.filter((g) => usDay(g[1]) === last).flatMap((g) => g[6].map((l) => data.ids[l[L.p]])));
    for (const s of streaks(data, 'pts20')) {
      if (s.active >= 6 && tonightIds.has(s.id)) items.push({ id: s.id, kind: 'Streak', text: `${snap?.players?.[s.id] ?? s.id}: 20+ points in ${s.active} straight games${s.active === s.longest ? '' : ` (season best ${s.longest})`}`, weight: 30 + s.active });
    }
    const seen = new Set<string>();
    return {
      day: last,
      items: items.sort((a, b) => b.weight - a.weight).filter((i) => (seen.has(i.id + i.kind) ? false : (seen.add(i.id + i.kind), true))).slice(0, 8),
      games: games.filter((g) => usDay(g[1]) === last).length,
    };
  }, [data, snap]);
  if (!digest || !digest.items.length) return null;
  return (
    <div className="card">
      <h3>Last night in brief <span className="muted small">{formatDay(digest.day)} · {digest.games} game{digest.games === 1 ? '' : 's'}</span></h3>
      <ul className="digest">
        {digest.items.map((i) => (
          <li key={i.id + i.kind}>
            <span className="digest-kind">{i.kind}</span> <Link to={`/player/${i.id}`}>{i.text}</Link>
          </li>
        ))}
      </ul>
      <p className="small"><Link to="/leaders?tab=milestones">Milestones coming up →</Link> · <Link to="/leaders?tab=streaks">All streaks →</Link></p>
    </div>
  );
}
