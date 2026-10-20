/** Local-time YYYY-MM-DD. */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** ESPN wants dates as YYYYMMDD. */
export function espnDate(iso: string): string {
  return iso.replaceAll('-', '');
}

export function formatDay(iso: string): string {
  return parseISODate(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTime(dateTime: string): string {
  return new Date(dateTime).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatShortDate(dateTime: string): string {
  return new Date(dateTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
