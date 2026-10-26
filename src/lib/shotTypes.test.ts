import { describe, expect, it } from 'vitest';
import type { Shot } from '../api/types';
import { ShotSplitAccumulator, shotType } from './shotTypes';

describe('shot types', () => {
  it('classifies ESPN shot descriptions', () => {
    expect(shotType('Shai Gilgeous-Alexander makes 26-foot three point jumper (Jalen Williams assists)', 3)).toBe('three');
    expect(shotType('Luka Doncic makes 27-foot step back jumpshot', 3)).toBe('stepback');
    expect(shotType('Jalen Brunson misses 14-foot pullup jump shot', 2)).toBe('pullup');
    expect(shotType('Giannis Antetokounmpo makes driving dunk', 2)).toBe('dunk');
    expect(shotType('Ja Morant makes alley oop dunk shot (Desmond Bane assists)', 2)).toBe('dunk');
    expect(shotType('Tyrese Haliburton makes 9-foot driving floating jump shot', 2)).toBe('floater');
    expect(shotType('Nikola Jokic makes 8-foot hook shot', 2)).toBe('hook');
    expect(shotType('Kevin Durant makes 15-foot turnaround fadeaway shot', 2)).toBe('fadeaway');
    expect(shotType('Steven Adams makes putback layup', 2)).toBe('tip');
    expect(shotType('Stephen Curry makes 2-foot driving layup', 2)).toBe('layup');
    expect(shotType('DeMar DeRozan makes 18-foot jumper', 2)).toBe('jumper');
  });

  it('counts makes, assists and quarters per player', () => {
    const acc = new ShotSplitAccumulator();
    const shot = (text: string, made: boolean, period: number, value = 2): Shot => ({ teamId: 'T', athleteId: 'p1', x: 25, y: 10, made, value, text, period, clock: '5:00' });
    acc.add(shot('p1 makes 2-foot driving layup (p2 assists)', true, 1));
    acc.add(shot('p1 makes driving layup', true, 2));
    acc.add(shot('p1 misses driving layup', false, 5));
    acc.add(shot('p1 makes 25-foot three point jumper (p2 assists)', true, 6, 3));
    const r = acc.result(1);
    expect(r.players.p1.types.layup).toEqual([3, 2, 1]);
    expect(r.players.p1.types.three).toEqual([1, 1, 1]);
    expect(r.players.p1.quarters).toEqual([[1, 1], [1, 1], [0, 0], [0, 0], [2, 1]]);
    expect(r.league.layup).toEqual([3, 2, 1]);
    expect(acc.result(10).players).toEqual({});
  });
});
