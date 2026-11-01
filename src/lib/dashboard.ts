// Personal dashboard: which Home cards to show and in what order, kept in
// this browser.
import { useCallback, useState } from 'react';

export interface DashboardLayout {
  order: string[];
  hidden: string[];
}

const KEY = 'nba-hub-dashboard';

/** The saved layout applied to the cards that exist: unknown ids dropped, new cards added at the end. */
export function arrange(ids: string[], layout: DashboardLayout): string[] {
  const known = layout.order.filter((id) => ids.includes(id));
  return [...known, ...ids.filter((id) => !known.includes(id))];
}

export function moveCard(order: string[], id: string, by: -1 | 1): string[] {
  const i = order.indexOf(id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= order.length) return order;
  const next = [...order];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function useDashboard(): [DashboardLayout, (l: DashboardLayout) => void] {
  const [layout, setLayout] = useState<DashboardLayout>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) ?? '') as DashboardLayout;
      return { order: v.order ?? [], hidden: v.hidden ?? [] };
    } catch {
      return { order: [], hidden: [] };
    }
  });
  const save = useCallback((l: DashboardLayout) => {
    setLayout(l);
    try {
      localStorage.setItem(KEY, JSON.stringify(l));
    } catch {
      /* storage blocked: the layout lasts for this visit */
    }
  }, []);
  return [layout, save];
}
