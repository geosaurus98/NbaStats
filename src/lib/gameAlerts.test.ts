import { describe, expect, it } from 'vitest';
import type { Game } from '../api/types';
import { gameEvents, isCloseLate } from './gameAlerts';

const g = (state: Game['state'], hs: number, as: number, statusDetail = ''): Game =>
  ({ id: '1', date: '', state, statusDetail, broadcasts: [], home: { team: { id: 'H', abbr: 'HOM', shortName: 'Homers' }, score: hs }, away: { team: { id: 'A', abbr: 'AWY', shortName: 'Aways' }, score: as } }) as unknown as Game;

describe('game alerts', () => {
  it('spots close games late', () => {
    expect(isCloseLate(g('in', 100, 98, '2:31 - 4th'))).toBe(true);
    expect(isCloseLate(g('in', 100, 90, '2:31 - 4th'))).toBe(false);
    expect(isCloseLate(g('in', 100, 98, '8:00 - 4th'))).toBe(false);
    expect(isCloseLate(g('in', 100, 99, '0:45 - OT'))).toBe(true);
  });
  it('reports tip-off and the final', () => {
    expect(gameEvents(g('pre', 0, 0), g('in', 2, 0, '11:40 - 1st'), 'H', false).map((e) => e.kind)).toEqual(['start']);
    const fin = gameEvents(g('in', 100, 98, '0:01 - 4th'), g('post', 101, 98, 'Final'), 'A', true);
    expect(fin.map((e) => e.title)).toEqual(['Aways lose']);
    expect(gameEvents(undefined, g('in', 10, 8, '5:00 - 1st'), 'H', false)).toEqual([]);
  });
});
