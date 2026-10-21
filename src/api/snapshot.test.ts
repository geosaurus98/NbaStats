import { describe, expect, it } from 'vitest';
import { compactGame, expandGame } from './snapshot';
import type { Game } from './types';

const LAL = { id: '13', name: 'Los Angeles Lakers', shortName: 'Lakers', abbr: 'LAL' };
const BOS = { id: '2', name: 'Boston Celtics', shortName: 'Celtics', abbr: 'BOS' };

describe('snapshot game format', () => {
  it('round-trips the fields the app uses', () => {
    const g: Game = {
      id: '1',
      date: '2026-04-12T23:30Z',
      state: 'post',
      statusDetail: 'Final',
      home: { team: LAL, homeAway: 'home', score: 120, winner: true, linescores: [1], leaders: [] },
      away: { team: BOS, homeAway: 'away', score: 110, winner: false, linescores: [1], leaders: [] },
      broadcasts: ['ESPN', 'NBA TV'],
      note: 'West 1st Round - Game 1',
    };
    const back = expandGame(compactGame(g), new Map([[LAL.id, LAL], [BOS.id, BOS]]));
    expect(back).toMatchObject({ id: '1', state: 'post', note: g.note, broadcasts: g.broadcasts });
    expect(back.home).toMatchObject({ team: LAL, score: 120, winner: true });
    expect(back.away).toMatchObject({ team: BOS, score: 110, winner: false });
  });

  it('treats a game without scores as not yet played', () => {
    const back = expandGame(['2', '2026-04-13T00:00Z', '13', '2', null, null, null, null], new Map());
    expect(back.state).toBe('pre');
    expect(back.home.team.abbr).toBe('13');
  });
});
