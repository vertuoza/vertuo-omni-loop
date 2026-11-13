import { beforeEach, describe, expect, it, vi } from 'vitest';

// The Eval view's writes (PRD omni-loop-8 s5), with the reader stubbed: each is one database function called as the
// signed-in person; the demo and a reader who cannot write are refused in one line. A fake client records the calls.

const state = vi.hoisted(() => ({ reader: { kind: 'unreadable' } as unknown, calls: [] as unknown[][], error: null as { message: string } | null }));

vi.mock('server-only', () => ({}));
vi.mock('../../constituents/knowledge-reader', () => ({ knowledgeReader: () => Promise.resolve(state.reader) }));

import { addEvalQuestion, removeEvalQuestion, setEvalAnswer } from './eval-actions';

const database = { kind: 'database', db: { rpc: (...args: unknown[]) => { state.calls.push(args); return Promise.resolve({ error: state.error }); } } };

describe('the Eval view’s writes', () => {
  beforeEach(() => {
    state.reader = database;
    state.calls = [];
    state.error = null;
  });

  it('add a question through search_eval_question_add, with its category only when one is chosen', async () => {
    expect(await addEvalQuestion('p-1', 'a quote?', 'quotes')).toEqual({ ok: true });
    expect(await addEvalQuestion('p-1', 'a quote?', null)).toEqual({ ok: true });
    expect(state.calls).toEqual([
      ['search_eval_question_add', { p_product: 'p-1', p_question: 'a quote?', p_category: 'quotes' }],
      ['search_eval_question_add', { p_product: 'p-1', p_question: 'a quote?' }],
    ]);
  });

  it('remove a question through search_eval_question_remove', async () => {
    expect(await removeEvalQuestion('q-1')).toEqual({ ok: true });
    expect(state.calls).toEqual([['search_eval_question_remove', { p_question: 'q-1' }]]);
  });

  it('set a person’s word on an entry through search_eval_answer_set, confirming or removing', async () => {
    await setEvalAnswer('q-1', 'e-1', true);
    await setEvalAnswer('q-1', 'e-1', false);
    expect(state.calls).toEqual([
      ['search_eval_answer_set', { p_question: 'q-1', p_entry: 'e-1', p_relevant: true }],
      ['search_eval_answer_set', { p_question: 'q-1', p_entry: 'e-1', p_relevant: false }],
    ]);
  });

  it('answer with one refusal line when the database refuses, never its message', async () => {
    state.error = { message: 'not a member of this workspace' };
    expect(await removeEvalQuestion('q-1')).toEqual({ ok: false, message: 'The change was refused. Reload and try again.' });
  });

  it('refuse in the demo, which keeps nothing, and for a reader who cannot write', async () => {
    state.reader = { kind: 'demo' };
    expect(await setEvalAnswer('q-1', 'e-1', true)).toEqual({ ok: false, message: 'The demo does not keep changes.' });
    state.reader = { kind: 'unreadable' };
    expect(await setEvalAnswer('q-1', 'e-1', true)).toEqual({ ok: false, message: 'The change was refused. Reload and try again.' });
    expect(state.calls).toEqual([]);
  });
});
