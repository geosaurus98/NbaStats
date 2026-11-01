// Players the viewer follows (for the Alerts page), and when they last looked.
// Stored in this browser only.
import { useEffect, useState } from 'react';

const KEY = 'nba-hub-follow';
const SEEN = 'nba-hub-alerts-seen';
const listeners = new Set<() => void>();

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function useFollowed(): [string[], (id: string) => void] {
  const [ids, setIds] = useState(read);
  useEffect(() => {
    const update = () => setIds(read());
    listeners.add(update);
    return () => void listeners.delete(update);
  }, []);
  const toggle = (id: string) => {
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* private mode: keep it for this visit */
    }
    setIds(next);
    listeners.forEach((l) => l());
  };
  return [ids, toggle];
}

/** The ISO date the viewer last marked alerts as seen (default: a week ago). */
export function lastSeen(): string {
  try {
    const v = localStorage.getItem(SEEN);
    if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  } catch {
    /* ignore */
  }
  return new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
}

export function markSeen(day: string) {
  try {
    localStorage.setItem(SEEN, day);
  } catch {
    /* ignore */
  }
}
