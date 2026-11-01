// Alerts: what happened to your team and the players you follow since you
// last looked: results, big games, streaks, milestones and injury news.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadSnapshot } from '../api/snapshotStore';
import { loadLines } from '../api/linesStore';
import { Empty, Loading } from '../components/Status';
import { useFavourite } from '../FavouriteContext';
import { useAsync } from '../hooks/useAsync';
import { gameScore, L } from '../lib/boxTotals';
import { loadCareers } from '../lib/careers';
import { formatDay, formatShortDate, toISODate } from '../lib/dates';
import { lastSeen, markSeen, useFollowed } from '../lib/follow';
import { usDay } from '../lib/gameLines';
import { milestones } from '../lib/milestones';
import { streaks } from '../lib/playerExtras';
import { loadTeammateGraph } from '../lib/teammateStore';
import { DEFAULT_SEASON } from '../lib/seasons';

interface Alert {
  day: string;
  kind: string;
  text: string;
  to?: string;
}

export function Alerts() {
  const { favouriteId } = useFavourite();
  const [followed, toggle] = useFollowed();
  const [since, setSince] = useState(lastSeen);
  const season = DEFAULT_SEASON;
  // Alerts are always about the current season, whichever season the site is set to.
  const { data, loading } = useAsync(async () => {
    const [snap, lines, careers, graph] = await Promise.all([loadSnapshot(season), loadLines(season), followed.length ? loadCareers() : undefined, followed.length ? loadTeammateGraph() : undefined]);
    return { snap, lines, careers, graph };
  }, [season, followed.join()]);
  const snap = data?.snap;
  const names = snap?.players ?? {};
  const abbr = useMemo(() => new Map((snap?.teams ?? []).map((t) => [t.id, t.abbr])), [snap]);
  const teamName = snap?.teams.find((t) => t.id === favouriteId)?.name;

  const alerts = useMemo(() => {
    const out: Alert[] = [];
    const lines = data?.lines;
    if (!lines) return out;
    const games = [...lines.games].sort((a, b) => a[1].localeCompare(b[1]));
    // Team results.
    if (favouriteId) {
      for (const [gameId, date, , homeId, awayId, , gl] of games) {
        if ((homeId !== favouriteId && awayId !== favouriteId) || usDay(date) <= since) continue;
        let h = 0;
        let a = 0;
        for (const l of gl) (l[L.home] ? (h += l[L.pts]) : (a += l[L.pts]));
        const home = homeId === favouriteId;
        const us = home ? h : a;
        const them = home ? a : h;
        const top = gl.filter((l) => !!l[L.home] === home).sort((x, y) => y[L.pts] - x[L.pts])[0];
        out.push({ day: usDay(date), kind: us > them ? 'Win' : 'Loss', text: `${home ? 'vs' : '@'} ${abbr.get(home ? awayId : homeId)} ${us}-${them}${top ? ` · ${names[lines.ids[top[L.p]]] ?? ''} ${top[L.pts]} pts` : ''}`, to: `/game/${gameId}` });
      }
    }
    // Followed players' games.
    const followIdx = new Map(followed.map((id) => [lines.ids.indexOf(id), id]).filter(([i]) => (i as number) >= 0) as [number, string][]);
    const best = new Map<number, number>();
    for (const [gameId, date, , , , , gl] of games) {
      for (const l of gl) {
        const id = followIdx.get(l[L.p]);
        if (!id || l[L.min] <= 0) continue;
        const prev = best.get(l[L.p]) ?? 0;
        best.set(l[L.p], Math.max(prev, l[L.pts]));
        if (usDay(date) <= since) continue;
        const reb = l[L.oreb] + l[L.dreb];
        const tens = [l[L.pts], reb, l[L.ast], l[L.stl], l[L.blk]].filter((v) => v >= 10).length;
        const tags = [l[L.pts] > prev && prev > 0 ? 'season high' : '', tens >= 3 ? 'triple-double' : tens === 2 ? 'double-double' : '', l[L.pts] >= 30 ? '30+ points' : ''].filter(Boolean);
        out.push({ day: usDay(date), kind: names[id] ?? id, text: `${l[L.pts]} pts, ${reb} reb, ${l[L.ast]} ast in ${l[L.min]} min (Game Score ${gameScore(l).toFixed(1)})${tags.length ? ` · ${tags.join(', ')}` : ''}`, to: `/game/${gameId}` });
      }
    }
    // Streaks still going.
    if (followed.length) {
      for (const which of ['pts20', 'dd', 'tpm3'] as const) {
        for (const s of streaks(lines, which)) {
          if (!followed.includes(s.id) || s.active < 3) continue;
          const label = { pts20: '20+ points', dd: 'double-doubles', tpm3: '3+ threes' }[which];
          out.push({ day: toISODate(new Date()), kind: names[s.id] ?? s.id, text: `${s.active} straight games with ${label}${s.active === s.longest ? ' (season best)' : ''}` });
        }
      }
    }
    // Milestones within reach.
    if (data.careers && data.graph && snap?.box?.['2']) {
      for (const m of milestones(data.careers, data.graph, snap.box['2'], 10)) {
        if (followed.includes(m.espnId)) out.push({ day: toISODate(new Date()), kind: names[m.espnId] ?? m.espnId, text: `${m.remaining.toLocaleString()} ${m.label} from ${m.what} (about ${m.gamesAway} game${m.gamesAway === 1 ? '' : 's'})`, to: '/leaders?tab=milestones' });
      }
    }
    // Injury report.
    for (const i of snap?.injuries ?? []) {
      if (i.teamId === favouriteId || followed.includes(i.athleteId)) out.push({ day: i.date ? i.date.slice(0, 10) : toISODate(new Date()), kind: 'Injury', text: `${i.name} (${abbr.get(i.teamId)}): ${i.status}${i.returnDate ? `, expected back ${formatShortDate(`${i.returnDate.slice(0, 10)}T12:00:00Z`)}` : ''}${i.comment ? `. ${i.comment}` : ''}`, to: `/player/${i.athleteId}` });
    }
    return out.sort((a, b) => b.day.localeCompare(a.day));
  }, [data, favouriteId, followed, since, snap, abbr, names]);

  const nothing = !favouriteId && !followed.length;
  return (
    <section>
      <div className="page-head">
        <h1>Alerts</h1>
        <button className="chip" onClick={() => { const d = toISODate(new Date()); markSeen(d); setSince(d); }}>Mark all as seen</button>
      </div>
      <p className="muted">
        Since {formatDay(since)}: {teamName ? <>results and injuries for <b>{teamName}</b></> : 'no favourite team yet'}{followed.length ? <>, plus {followed.length} player{followed.length === 1 ? '' : 's'} you follow</> : ''}. Star a team on its page and follow players on theirs; it's all kept in this browser.
      </p>
      {nothing && <Empty>Pick a favourite team (☆ on any team page) or follow a player (☆ Follow on any player page) to get alerts here.</Empty>}
      {loading && <Loading />}
      {!nothing && !loading && !alerts.length && <Empty>Nothing new since {formatDay(since)}.</Empty>}
      {alerts.length > 0 && (
        <ul className="alerts">
          {alerts.map((a, i) => (
            <li key={i}>
              <span className="muted small">{formatShortDate(`${a.day}T12:00:00Z`)}</span>
              <span className={`alert-kind${a.kind === 'Win' ? ' win' : a.kind === 'Loss' || a.kind === 'Injury' ? ' loss' : ''}`}>{a.kind}</span>
              {a.to ? <Link to={a.to}>{a.text}</Link> : <span>{a.text}</span>}
            </li>
          ))}
        </ul>
      )}
      {followed.length > 0 && (
        <p className="small">
          Following:{' '}
          {followed.map((id, i) => (
            <span key={id}>
              {i > 0 && ', '}
              <Link to={`/player/${id}`}>{names[id] ?? id}</Link> <button className="link-button small" onClick={() => toggle(id)} aria-label={`Stop following ${names[id] ?? id}`}>×</button>
            </span>
          ))}
        </p>
      )}
    </section>
  );
}
