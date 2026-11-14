import { beforeEach, describe, expect, it, vi } from 'vitest';

// The Eval view's read (PRD omni-loop-8 s5), with the reader and the repository stubbed: the demo's set, a member's
// rows kept to their product's questions, and nothing when a read fails or nobody can read. Fictional rows only.

interface Stubs {
  reader: unknown;
  runs: unknown;
  questions: unknown;
  answers: unknown;
}

const state = vi.hoisted((): Stubs => ({ reader: { kind: 'unreadable' }, runs: [], questions: [], answers: [] }));

vi.mock('server-only', () => ({}));
vi.mock('../../constituents/knowledge-reader', () => ({
  knowledgeReader: () => Promise.resolve(state.reader),
}));
vi.mock('./eval.repository', () => ({
  runsOf: () => Promise.resolve(state.runs),
  questionsOf: () => Promise.resolve(state.questions),
  answersOf: () => Promise.resolve(state.answers),
}));

import { loadEval } from './eval-load';

const NOW = Date.parse('2026-11-13T12:00:00Z');
const answer = (questionId: string) => ({ questionId, entryId: 'e', relevant: true, source: 'jev', confidence: 0.9, decidedBy: null, decidedAt: 'x' });

describe('loadEval', () => {
  beforeEach(() => {
    state.reader = { kind: 'database', db: {} };
    state.runs = [{ id: 'r1' }];
    state.questions = [{ id: 'q1' }];
    state.answers = [answer('q1'), answer('q-of-another-product')];
  });

  it('is the demo’s set for the demo product, and nothing for another', async () => {
    state.reader = { kind: 'demo' };
    expect((await loadEval('demo-product-1', NOW))?.runs).toHaveLength(3);
    expect(await loadEval('another', NOW)).toBeNull();
  });

  it('is a member’s runs and questions, with the answers of their product’s questions only', async () => {
    const read = await loadEval('p-1', NOW);
    expect(read?.runs).toEqual([{ id: 'r1' }]);
    expect(read?.answers.map((a) => a.questionId)).toEqual(['q1']);
  });

  it('is nothing when a read fails', async () => {
    for (const key of ['runs', 'questions', 'answers'] as const) {
      state.runs = [];
      state.questions = [];
      state.answers = [];
      state[key] = null;
      expect(await loadEval('p-1', NOW)).toBeNull();
    }
  });

  it('is nothing when nobody can read', async () => {
    state.reader = { kind: 'unreadable' };
    expect(await loadEval('p-1', NOW)).toBeNull();
  });
});
