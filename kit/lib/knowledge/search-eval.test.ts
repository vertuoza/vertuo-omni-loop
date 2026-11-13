import { describe, expect, it } from 'vitest';
import { scoreSearches, type SearchOutcome } from './search-eval.ts';

const filler = (n: number): string[] => Array.from({ length: n }, (_, i) => `f${String(i)}`);

// Hand-worked: category A has q1 (right answer 2nd) and q2 (3 right answers; the first is 1st, one more
// is 7th, one never comes up); category B has q3 (right answer 11th), q4 (no right answer) and q5 (nothing found).
const OUTCOMES: SearchOutcome[] = [
  { id: 'q1', category: 'A', ranked: ['x', 'R1', 'y'], right: ['R1'] },
  { id: 'q2', category: 'A', ranked: ['R1', 'a', 'b', 'c', 'd', 'e', 'R2', 'f'], right: ['R1', 'R2', 'R3'] },
  { id: 'q3', category: 'B', ranked: [...filler(10), 'R1'], right: ['R1'] },
  { id: 'q4', category: 'B', ranked: ['a'], right: [] },
  { id: 'q5', category: 'B', ranked: [], right: ['Z'] },
];

describe('scoreSearches', () => {
  const scores = scoreSearches(OUTCOMES);

  it('scores category A by hand', () => {
    expect(scores.byCategory[0]).toEqual({
      category: 'A',
      measures: { questions: 2, top1: 0.5, top5: 1, recall5: (1 + 1 / 3) / 2, recall10: (1 + 2 / 3) / 2, mrr: 0.75 },
    });
  });

  it('scores category B by hand, a question with no right answer left out', () => {
    expect(scores.byCategory[1]).toEqual({
      category: 'B',
      measures: { questions: 2, top1: 0, top5: 0, recall5: 0, recall10: 0, mrr: 1 / 11 / 2 },
    });
    expect(scores.skipped).toBe(1);
  });

  it('scores overall over every counted question', () => {
    const o = scores.overall;
    expect(o).toMatchObject({ questions: 4, top1: 0.25, top5: 0.5 });
    expect(o.recall5).toBeCloseTo(1 / 3, 12);
    expect(o.recall10).toBeCloseTo(5 / 12, 12);
    expect(o.mrr).toBeCloseTo((1.5 + 1 / 11) / 4, 12);
  });

  it('lists the misses: right answer outside the top 5, with its rank and what came first', () => {
    expect(scores.misses).toEqual([
      { id: 'q3', category: 'B', rank: 11, first: ['f0', 'f1', 'f2', 'f3', 'f4'], right: ['R1'] },
      { id: 'q5', category: 'B', rank: null, first: [], right: ['Z'] },
    ]);
  });

  it('counts a right answer at rank 5 as a hit and at rank 6 as a miss', () => {
    const five = scoreSearches([{ category: 'A', ranked: [...filler(4), 'R'], right: ['R'] }]);
    const six = scoreSearches([{ category: 'A', ranked: [...filler(5), 'R'], right: ['R'] }]);
    expect(five.overall).toMatchObject({ top5: 1, recall5: 1 });
    expect(five.misses).toEqual([]);
    expect(six.overall).toMatchObject({ top5: 0, recall5: 0, recall10: 1 });
    expect(six.misses).toHaveLength(1);
  });

  it('counts a right answer at rank 10 in recall@10 and rank 11 not', () => {
    expect(scoreSearches([{ category: 'A', ranked: [...filler(9), 'R'], right: ['R'] }]).overall.recall10).toBe(1);
    expect(scoreSearches([{ category: 'A', ranked: [...filler(10), 'R'], right: ['R'] }]).overall.recall10).toBe(0);
  });

  it('does not count a repeated id or a repeated right answer twice', () => {
    const s = scoreSearches([{ category: 'A', ranked: ['R', 'R', 'a'], right: ['R', 'R', 'S'] }]);
    expect(s.overall.recall5).toBe(0.5);
  });

  it('answers zeros and no categories for an empty set, and omits an id the caller did not give', () => {
    expect(scoreSearches([])).toEqual({ overall: { questions: 0, top1: 0, top5: 0, recall5: 0, recall10: 0, mrr: 0 }, byCategory: [], misses: [], skipped: 0 });
    expect(scoreSearches([{ category: 'A', ranked: [], right: ['R'] }]).misses[0]).not.toHaveProperty('id');
  });
});
