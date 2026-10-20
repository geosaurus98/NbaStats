import { describe, expect, it } from 'vitest';
import type { Game } from '../api/types';
import { gamesToICS } from './ics';

const t = (abbr: string) => ({ id: abbr, name: abbr, shortName: abbr, abbr });

describe('gamesToICS', () => {
  it('writes one event per game with UTC times and escaped text', () => {
    const game: Game = {
      id: '42',
      date: '2026-04-12T23:30:00Z',
      state: 'pre',
      statusDetail: '',
      home: { team: t('LAL'), homeAway: 'home', linescores: [], leaders: [] },
      away: { team: t('BOS'), homeAway: 'away', linescores: [], leaders: [] },
      venue: 'Arena, Los Angeles',
      broadcasts: ['ESPN'],
    };
    const ics = gamesToICS([game], 'Lakers');
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART:20260412T233000Z');
    expect(ics).toContain('DTEND:20260413T020000Z');
    expect(ics).toContain('SUMMARY:BOS @ LAL');
    expect(ics).toContain('LOCATION:Arena\\, Los Angeles');
    expect(ics.split('\r\n').filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(1);
  });
});
