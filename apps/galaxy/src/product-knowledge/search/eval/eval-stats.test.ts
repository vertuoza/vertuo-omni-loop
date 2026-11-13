import { describe, expect, it } from 'vitest';
import {
  addedByOf, byOf, categoriesOfRuns, missTextOf, openCategoryOf, seriesOf, setOf,
  type EvalAnswer, type EvalQuestion, type EvalRun, type Measures,
} from './eval-stats';

// The Eval view's numbers (PRD omni-loop-8 s5), against hand-worked fixtures.

const m = (top1: number): Measures => ({ questions: 2, top1, top5: top1, recall5: top1, recall10: top1, mrr: top1 });
const run = (id: string, ranAt: string, overall: Measures, categories: Record<string, Measures> = {}): EvalRun =>
  ({ id, ranAt, trigger: 'daily', overall, categories, misses: [], skipped: 0 });

const RUNS = [
  run('r1', '2026-11-10T06:00:00Z', m(0.5), { invoicing: m(1) }),
  run('r2', '2026-11-11T06:00:00Z', m(0.25)),
  run('r3', '2026-11-12T06:00:00Z', m(0.75), { invoicing: m(0.5), quotes: m(0) }),
];

describe('the series of a measure', () => {
  it('is one point per run, oldest first, overall', () => {
    expect(seriesOf(RUNS, null).map((p) => p.measures.top1)).toEqual([0.5, 0.25, 0.75]);
  });

  it('leaves a gap, not a zero, for a run that did not measure the category', () => {
    expect(seriesOf(RUNS, 'invoicing').map((p) => [p.at.slice(0, 10), p.measures.top1])).toEqual([['2026-11-10', 1], ['2026-11-12', 0.5]]);
    expect(seriesOf([], null)).toEqual([]);
  });
});

describe('the categories of the runs', () => {
  it('are every category some run measured, once, in the order they first appear', () => {
    expect(categoriesOfRuns(RUNS)).toEqual(['invoicing', 'quotes']);
  });

  it('open the one ?category= names when a run holds it, else the overall measures', () => {
    expect(openCategoryOf(RUNS, { category: 'quotes' })).toBe('quotes');
    expect(openCategoryOf(RUNS, { category: ['invoicing', 'x'] })).toBe('invoicing');
    expect(openCategoryOf(RUNS, { category: 'nope' })).toBeNull();
    expect(openCategoryOf(RUNS, {})).toBeNull();
  });
});

const q = (id: string): EvalQuestion => ({ id, question: `question ${id}`, category: null, addedBy: 'promotion', addedAt: '2026-11-01T00:00:00Z' });
const a = (questionId: string, entryId: string, relevant: boolean, source: 'jev' | 'person', confidence: number | null = null): EvalAnswer =>
  ({ questionId, entryId, relevant, source, confidence, decidedBy: source === 'person' ? 'ana' : null, decidedAt: '2026-11-02T00:00:00Z' });

describe('the set', () => {
  const set = setOf([q('1'), q('2')], [
    a('1', 'e-jev-low', true, 'jev', 0.7), a('1', 'e-jev-high', true, 'jev', 0.9), a('1', 'e-person', true, 'person'),
    a('1', 'e-refused', false, 'person'), a('2', 'e-other', true, 'jev', 0.8), a('9', 'e-elsewhere', true, 'jev', 0.8),
  ]);

  it('lists a person’s right answers first, then Jev’s by confidence, and keeps what a person refused apart', () => {
    expect(set[0]?.right.map((x) => x.entryId)).toEqual(['e-person', 'e-jev-high', 'e-jev-low']);
    expect(set[0]?.refused.map((x) => x.entryId)).toEqual(['e-refused']);
  });

  it('holds each question once, with only its own answers, and a question with none has none', () => {
    expect(set.map((s) => s.question.id)).toEqual(['1', '2']);
    expect(set[1]?.right.map((x) => x.entryId)).toEqual(['e-other']);
    expect(setOf([q('3')], [])[0]).toEqual({ question: q('3'), right: [], refused: [] });
  });
});

describe('who made a change', () => {
  it('names Jev, or the person with their login', () => {
    expect(byOf(a('1', 'e', true, 'jev'))).toBe('Jev');
    expect(byOf(a('1', 'e', true, 'person'))).toBe('person @ana');
    expect(byOf({ source: 'person', decidedBy: null })).toBe('person');
  });

  it('names the promotion or the member who added a question', () => {
    expect(addedByOf({ addedBy: 'promotion' })).toBe('promotion');
    expect(addedByOf({ addedBy: 'ana' })).toBe('@ana');
  });

  it('finds a miss’s question text in the set by its id', () => {
    expect(missTextOf({ id: '1', category: 'x', rank: null, first: [], right: [] }, [q('1')])).toBe('question 1');
    expect(missTextOf({ category: 'x', rank: null, first: [], right: [] }, [q('1')])).toBeNull();
  });
});
