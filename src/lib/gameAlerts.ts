// Game-time alerts: browser notifications, while the site is open, when your
// favourite team's game tips off, gets close late, or finishes.
import { useEffect, useRef, useState } from 'react';
import type { Game } from '../api/types';

const KEY = 'nba-hub-game-alerts';

export const alertsSupported = () => typeof window !== 'undefined' && 'Notification' in window;

export function alertsOn(): boolean {
  try {
    return localStorage.getItem(KEY) === '1' && alertsSupported() && Notification.permission === 'granted';
  } catch {
    return false;
  }
}

/** The on/off switch: asks the browser for permission when switching on. */
export function useAlertSwitch(): [boolean, () => Promise<void>, string | undefined] {
  const [on, setOn] = useState(alertsOn);
  const [problem, setProblem] = useState<string>();
  const toggle = async () => {
    if (on) {
      try {
        localStorage.setItem(KEY, '0');
      } catch {
        /* ignore */
      }
      setOn(false);
      return;
    }
    if (!alertsSupported()) return setProblem("This browser doesn't support notifications.");
    const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (p !== 'granted') return setProblem('Notifications are blocked for this site in your browser settings.');
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
    setProblem(undefined);
    setOn(true);
  };
  return [on, toggle, problem];
}

/** Late in the fourth quarter or overtime with the score within five? (ESPN status like "2:31 - 4th"). */
export function isCloseLate(g: Game): boolean {
  if (g.state !== 'in') return false;
  const m = /(\d+):(\d+)\s*-\s*(4th|OT|\d+OT)/i.exec(g.statusDetail ?? '');
  if (!m) return false;
  const secs = Number(m[1]) * 60 + Number(m[2]);
  return secs <= 180 && Math.abs((g.home.score ?? 0) - (g.away.score ?? 0)) <= 5;
}

export interface GameEvent {
  kind: 'start' | 'close' | 'final';
  title: string;
  body: string;
}

/** What changed for a team's game between two polls. */
export function gameEvents(prev: Game | undefined, now: Game, teamId: string, closeSent: boolean): GameEvent[] {
  const us = now.home.team.id === teamId ? now.home : now.away;
  const them = now.home.team.id === teamId ? now.away : now.home;
  const line = `${now.away.team.abbr} ${now.away.score ?? 0} – ${now.home.score ?? 0} ${now.home.team.abbr}`;
  const out: GameEvent[] = [];
  if (prev?.state === 'pre' && now.state === 'in') out.push({ kind: 'start', title: `${us.team.shortName} tip off`, body: `${now.away.team.abbr} @ ${now.home.team.abbr} has started.` });
  if (!closeSent && isCloseLate(now)) out.push({ kind: 'close', title: 'Close game!', body: `${line} · ${now.statusDetail}` });
  if (prev && prev.state !== 'post' && now.state === 'post') {
    const won = (us.score ?? 0) > (them.score ?? 0);
    out.push({ kind: 'final', title: `${us.team.shortName} ${won ? 'win' : 'lose'}`, body: `Final: ${line}` });
  }
  return out;
}

/** Watches the polled scoreboard and fires notifications for the favourite team's game. */
export function useGameAlerts(games: Game[] | undefined, teamId: string | undefined) {
  const prev = useRef(new Map<string, Game>());
  const closeSent = useRef(new Set<string>());
  useEffect(() => {
    if (!games || !teamId) return;
    for (const g of games) {
      if (g.home.team.id !== teamId && g.away.team.id !== teamId) continue;
      const events = gameEvents(prev.current.get(g.id), g, teamId, closeSent.current.has(g.id));
      prev.current.set(g.id, g);
      for (const e of events) {
        if (e.kind === 'close') closeSent.current.add(g.id);
        if (!alertsOn()) continue;
        try {
          new Notification(e.title, { body: e.body, tag: `${g.id}-${e.kind}` });
        } catch {
          /* some browsers only allow notifications from a service worker */
        }
      }
    }
  }, [games, teamId]);
}
