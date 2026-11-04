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

/** The NBA's (US Eastern) calendar date for a moment: ESPN's scoreboard is keyed by it. */
// One formatter for every call: building an Intl.DateTimeFormat is slow, and this runs for every game.
let usFormat: Intl.DateTimeFormat | undefined;
export function usDate(d: Date = new Date()): string {
  try {
    usFormat ??= new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
    return usFormat.format(d);
  } catch {
    return toISODate(new Date(d.getTime() - 5 * 3600e3 + d.getTimezoneOffset() * 60e3));
  }
}

/**
 * The heading for a US game day in the viewer's own time zone: the local day(s)
 * its games fall on, with the US date alongside when that differs.
 */
export function slateLabel(usDay: string, gameTimes: string[]): string {
  const local = [...new Set(gameTimes.map((t) => toISODate(new Date(t))))].sort();
  if (!local.length || (local.length === 1 && local[0] === usDay)) return formatDay(usDay);
  const days = local.length === 1 ? formatDay(local[0]) : `${formatDay(local[0])} – ${formatDay(local[local.length - 1])}`;
  return `${days} your time · ${formatDay(usDay)} in the US`;
}
