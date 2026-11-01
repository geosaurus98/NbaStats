import { describe, expect, it } from 'vitest';
import { arrange, moveCard } from './dashboard';

describe('dashboard layout', () => {
  it('keeps the saved order and adds new cards at the end', () => {
    expect(arrange(['a', 'b', 'c', 'd'], { order: ['c', 'x', 'a'], hidden: [] })).toEqual(['c', 'a', 'b', 'd']);
  });
  it('moves a card up or down', () => {
    expect(moveCard(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveCard(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c']);
  });
});
