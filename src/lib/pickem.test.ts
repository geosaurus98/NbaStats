import { describe, expect, it } from 'vitest';
import type { Game } from '../api/types';
import { openGames, scorePicks } from './pickem';

const game = (id: string, date: string, hs?: number, as?: number, state: Game['state'] = hs == null ? 'pre' : 'post'): Game =>
  ({ id, date, state, home: { team: { id: 'H' }, score: hs }, away: { team: { id: 'A' }, score: as } }) as unknown as Game;

describe('pickem', () => {
  it('scores you and the model on finished games', () => {
    const games = [game('1', '2026-11-01T00:00Z', 100, 90), game('2', '2026-11-02T00:00Z', 90, 100), game('3', '2026-11-09T00:00Z')];
    const preds = new Map([['1', 0.6], ['2', 0.7], ['3', 0.5]]);
    const s = scorePicks({ 1: 'A', 2: 'A', 3: 'H' }, games, preds);
    // Game 1: you A (wrong), model H (right). Game 2: you A (right, against the model), model H (wrong).
    expect(s.you).toEqual([1, 1]);
    expect(s.model).toEqual([1, 1]);
    expect(s.against).toEqual([2, 1]);
    expect(s.results.map((r) => r.game.id)).toEqual(['2', '1']);
  });
  it('offers the next two days of games that haven’t started', () => {
    const now = Date.parse('2026-11-05T12:00Z');
    const games = [game('a', '2026-11-05T10:00Z'), game('b', '2026-11-06T00:00Z'), game('c', '2026-11-07T00:30Z'), game('d', '2026-11-08T00:00Z')];
    expect(openGames(games, now).map((g) => g.id)).toEqual(['b', 'c']);
  });
});
