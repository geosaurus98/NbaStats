import { describe, expect, it } from 'vitest';
import careers from '../data/careers.json';
import teammates from '../data/teammates.json';
import type { CareerData } from './careers';
import { hallOfFameOdds } from './hallOfFame';

const data = careers as unknown as CareerData;
const names = (teammates as unknown as { players: [string][] }).players;
const model = hallOfFameOdds(data, 2026);
const odds = (name: string) => model.candidates.find((c) => names[c.player][0].normalize('NFD').replace(/[̀-ͯ]/g, '') === name)?.prob;

describe('Hall of Fame odds', () => {
  it('learns from who got in and rates active stars', () => {
    expect(model.accuracy).toBeGreaterThan(0.95);
    expect(odds('LeBron James')).toBeGreaterThan(0.99);
    expect(odds('Stephen Curry')).toBeGreaterThan(0.95);
    expect(odds('Nikola Jokic')).toBeGreaterThan(0.9);
  });
});
