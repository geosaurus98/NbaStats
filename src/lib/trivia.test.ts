import { describe, expect, it } from 'vitest';
import careers from '../data/careers.json';
import franchises from '../data/franchises.json';
import teammates from '../data/teammates.json';
import type { CareerData } from './careers';
import type { FranchiseData } from './franchiseData';
import { seededRandom } from './games';
import { buildGraph, type TeammateData } from './teammates';
import { makeQuiz } from './trivia';

describe('trivia', () => {
  const graph = buildGraph(teammates as unknown as TeammateData);
  const quiz = (seed: number) => makeQuiz(franchises as unknown as FranchiseData, careers as unknown as CareerData, graph, seededRandom(seed));

  it('makes five answerable questions with four different options', () => {
    for (const seed of [1, 2, 3, 42, 2026]) {
      const q = quiz(seed);
      expect(q).toHaveLength(5);
      for (const x of q) {
        expect(x.options).toHaveLength(4);
        expect(new Set(x.options).size).toBe(4);
        expect(x.answer).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('is the same for the same seed', () => {
    expect(quiz(7).map((q) => q.text)).toEqual(quiz(7).map((q) => q.text));
  });

  it('gets known answers right', () => {
    // Every champions question names the real champion as its answer.
    for (let seed = 1; seed < 40; seed++) {
      const q = quiz(seed)[0];
      const year = Number(/(\d{4})-\d{2}/.exec(q.text)![1]) + 1;
      if (year === 1996) expect(q.options[q.answer]).toBe('Chicago Bulls');
      if (year === 2016) expect(q.options[q.answer]).toBe('Cleveland Cavaliers');
    }
  });
});
