// Builds an iCalendar (.ics) file from games, for Outlook / Google / Apple Calendar.
import type { Game } from '../api/types';

const GAME_LENGTH_MS = 2.5 * 60 * 60 * 1000;

function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function gamesToICS(games: Game[], calendarName: string): string {
  const now = stamp(new Date());
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NBA Stats Hub//EN', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${escape(calendarName)}`];
  for (const g of games) {
    if (!g.date) continue;
    const start = new Date(g.date);
    const summary =
      g.state === 'post'
        ? `${g.away.team.abbr} ${g.away.score} @ ${g.home.team.abbr} ${g.home.score} (Final)`
        : `${g.away.team.shortName} @ ${g.home.team.shortName}`;
    const details = [g.note, g.broadcasts.length ? `TV: ${g.broadcasts.join(', ')}` : ''].filter(Boolean).join('\n');
    lines.push(
      'BEGIN:VEVENT',
      `UID:nba-${g.id}@nba-stats-hub`,
      `DTSTAMP:${now}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(new Date(start.getTime() + GAME_LENGTH_MS))}`,
      `SUMMARY:${escape(summary)}`,
    );
    if (g.venue) lines.push(`LOCATION:${escape(g.venue)}`);
    if (details) lines.push(`DESCRIPTION:${escape(details)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadFile(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
