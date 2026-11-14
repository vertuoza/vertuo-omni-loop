// The `search-eval-run` job (PRD omni-loop-8 s4) with a fake search and a fake store: no test calls Supabase or galaxy.
// Every question and entry is fictional.
import { describe, expect, it } from 'vitest';
import { scoreSearches } from 'omni-loop/kit/lib/knowledge/search-eval.ts';
import type { EvalSearcher } from '../search-eval/galaxy.ts';
import type { EvalQuestion, NewRun, SearchEvalStore } from '../search-eval/store.ts';
import type { ClaimedJob } from './ledger.ts';
import { searchEvalRunHandler, searchEvalRunJob, SEARCH_EVAL_RUN_KIND } from './search-eval-run.ts';

const SLOT = '2027-01-21T00:00:00.000Z';
const QUESTION_TEXT = 'can a quote be sent without a payment term';

const question = (id: string, category: string | null, right: string[], productId = 'p-1'): EvalQuestion => ({ id, productId, workspaceId: 'w-1', question: `${QUESTION_TEXT} ${id}`, category, right });

const job = (payload: Record<string, string> = { slot: SLOT }): ClaimedJob => ({ id: 'j-1', kind: SEARCH_EVAL_RUN_KIND, key: 'k', subject: SEARCH_EVAL_RUN_KIND, payload, tries: 1, claim: 'c-1', claimedUntil: '2027-01-21T00:05:00.000Z' });

/** A store in memory: the sets by product, the runs kept once per product, trigger and slot. */
function fakeStore(sets: Record<string, EvalQuestion[]>) {
  const runs: NewRun[] = [];
  const store: SearchEvalStore = {
    searches: () => Promise.resolve([]),
    joined: () => Promise.resolve(new Set()),
    promote: () => Promise.resolve(null),
    questionOf: () => Promise.resolve(null),
    opened: () => Promise.resolve([]),
    answerJev: () => Promise.resolve(false),
    evalProducts: () => Promise.resolve(Object.keys(sets)),
    questions: (productId) => Promise.resolve(sets[productId] ?? []),
    recorded: (productId, trigger, slot) => Promise.resolve(runs.some((run) => run.productId === productId && run.trigger === trigger && run.slot === slot)),
    record: (run) => {
      runs.push(run);
      return Promise.resolve(`r-${String(runs.length)}`);
    },
  };
  return { store, runs };
}

/** A search answering the ranked ids of each question's text, and recording what it was asked. */
function fakeSearch(ranked: Record<string, string[]>) {
  const asked: string[] = [];
  const search: EvalSearcher = ({ question: text }) => {
    asked.push(text);
    return Promise.resolve(ranked[text] ?? []);
  };
  return { search, asked };
}

const handler = (store: SearchEvalStore, search: EvalSearcher, over: { clock?: () => number; budgetMs?: number; log?: (line: string) => void } = {}) =>
  searchEvalRunHandler({ store, search, log: () => undefined, ...over });

describe('searchEvalRunJob', () => {
  it('is keyed by product and commit, in the kind\'s lane, its payload holding neither a token nor a question', () => {
    expect(searchEvalRunJob({ productId: 'p-1', slot: 'abc' })).toEqual({ kind: 'search-eval-run', key: 'p-1@abc', subject: 'p-1', payload: { productId: 'p-1', slot: 'abc' }, lane: 'search-eval-run', maxTries: 3 });
  });
});

describe('searchEvalRunHandler — the daily run', () => {
  const SET = [question('q-1', 'quotes', ['BR-1']), question('q-2', 'quotes', ['BR-2', 'BR-3']), question('q-3', 'account', ['BR-9']), question('q-4', 'account', [])];
  const RANKS = { [`${QUESTION_TEXT} q-1`]: ['BR-1', 'BR-7'], [`${QUESTION_TEXT} q-2`]: ['BR-7', 'BR-3', 'BR-8', 'BR-9', 'BR-6', 'BR-2'], [`${QUESTION_TEXT} q-3`]: ['BR-7', 'BR-8'] };

  it('searches each question with a right answer, scores with the kit\'s scoring and keeps one run with its trigger, measures and misses', async () => {
    const { store, runs } = fakeStore({ 'p-1': SET });
    const searched = fakeSearch(RANKS);
    expect(await handler(store, searched.search)(job())).toEqual({ outcome: 'done' });
    expect(searched.asked).toEqual([`${QUESTION_TEXT} q-1`, `${QUESTION_TEXT} q-2`, `${QUESTION_TEXT} q-3`]);

    const scores = scoreSearches([
      { id: 'q-1', category: 'quotes', ranked: ['BR-1', 'BR-7'], right: ['BR-1'] },
      { id: 'q-2', category: 'quotes', ranked: ['BR-7', 'BR-3', 'BR-8', 'BR-9', 'BR-6', 'BR-2'], right: ['BR-2', 'BR-3'] },
      { id: 'q-3', category: 'account', ranked: ['BR-7', 'BR-8'], right: ['BR-9'] },
      { id: 'q-4', category: 'account', ranked: [], right: [] },
    ]);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ productId: 'p-1', trigger: 'daily', slot: SLOT });
    expect(runs[0]?.measures).toEqual({
      overall: scores.overall,
      categories: { quotes: scores.byCategory[0]?.measures, account: scores.byCategory[1]?.measures },
      misses: scores.misses,
      skipped: 1,
    });
    // hand-worked: q-1 first (top1), q-2 best at rank 2 (top5), q-3 absent: top@1 1/3, top@5 2/3
    expect(scores.overall).toMatchObject({ questions: 3, top1: 1 / 3, top5: 2 / 3 });
    expect(runs[0]?.measures).toMatchObject({ misses: [{ id: 'q-3', category: 'account', rank: null, first: ['BR-7', 'BR-8'], right: ['BR-9'] }] });
  });

  it('keeps per question the ranks of its right answers found and the ids that came first', async () => {
    const { store, runs } = fakeStore({ 'p-1': SET });
    await handler(store, fakeSearch(RANKS).search)(job());
    expect(runs[0]?.questions).toEqual([
      { questionId: 'q-1', category: 'quotes', ranks: [1], first: ['BR-1', 'BR-7'] },
      { questionId: 'q-2', category: 'quotes', ranks: [2, 6], first: ['BR-7', 'BR-3', 'BR-8', 'BR-9', 'BR-6'] },
      { questionId: 'q-3', category: 'account', ranks: [], first: ['BR-7', 'BR-8'] },
    ]);
  });

  it('scores a question with no category as other', async () => {
    const { store, runs } = fakeStore({ 'p-1': [question('q-1', null, ['BR-1'])] });
    await handler(store, fakeSearch({ [`${QUESTION_TEXT} q-1`]: ['BR-1'] }).search)(job());
    expect(Object.keys((runs[0]?.measures as { categories: object }).categories)).toEqual(['other']);
  });

  it('runs every product of the workspace, each once', async () => {
    const { store, runs } = fakeStore({ 'p-1': [question('q-1', 'quotes', ['BR-1'])], 'p-2': [question('q-5', 'quotes', ['BR-1'], 'p-2')] });
    const searched = fakeSearch({});
    await handler(store, searched.search)(job());
    expect(runs.map((run) => run.productId)).toEqual(['p-1', 'p-2']);
  });

  it('keeps no second run for the same slot, and searches nothing again', async () => {
    const { store, runs } = fakeStore({ 'p-1': SET });
    const searched = fakeSearch(RANKS);
    await handler(store, searched.search)(job());
    await handler(store, searched.search)(job());
    expect(runs).toHaveLength(1);
    expect(searched.asked).toHaveLength(3);
    await handler(store, searched.search)(job({ slot: '2027-01-22T00:00:00.000Z' }));
    expect(runs).toHaveLength(2);
  });

  it('keeps no run for a set with no right answer, and searches nothing for it', async () => {
    const { store, runs } = fakeStore({ 'p-1': [question('q-1', 'quotes', [])] });
    const searched = fakeSearch({});
    expect(await handler(store, searched.search)(job())).toEqual({ outcome: 'done' });
    expect(runs).toEqual([]);
    expect(searched.asked).toEqual([]);
  });
});

describe('searchEvalRunHandler — after an embed', () => {
  it('runs the one product of the job, as trigger embed, in the slot of the commit', async () => {
    const { store, runs } = fakeStore({ 'p-1': [question('q-1', 'quotes', ['BR-1'])], 'p-2': [question('q-5', 'quotes', ['BR-1'], 'p-2')] });
    expect(await handler(store, fakeSearch({ [`${QUESTION_TEXT} q-5`]: ['BR-1'] }).search)(job({ productId: 'p-2', slot: 'c'.repeat(40) }))).toEqual({ outcome: 'done' });
    expect(runs.map(({ productId, trigger, slot }) => ({ productId, trigger, slot }))).toEqual([{ productId: 'p-2', trigger: 'embed', slot: 'c'.repeat(40) }]);
  });

  it('keeps its run beside the daily one of the same day', async () => {
    const { store, runs } = fakeStore({ 'p-1': [question('q-1', 'quotes', ['BR-1'])] });
    const { search } = fakeSearch({});
    await handler(store, search)(job());
    await handler(store, search)(job({ productId: 'p-1', slot: SLOT }));
    expect(runs.map((run) => run.trigger)).toEqual(['daily', 'embed']);
  });
});

describe('searchEvalRunHandler — when a search fails', () => {
  it('keeps no run of that product, runs the others, then throws so the worker retries', async () => {
    const { store, runs } = fakeStore({ 'p-1': [question('q-1', 'quotes', ['BR-1'])], 'p-2': [question('q-5', 'quotes', ['BR-1'], 'p-2')] });
    const search: EvalSearcher = ({ productId }) => (productId === 'p-1' ? Promise.reject(new Error('eval-search: galaxy answered 500')) : Promise.resolve(['BR-1']));
    await expect(handler(store, search)(job())).rejects.toThrow('a search failed in 1 of 2 products');
    expect(runs.map((run) => run.productId)).toEqual(['p-2']);
  });

  it('counts a galaxy that cannot be asked (no secret) as a failed search, never as a miss', async () => {
    const { store, runs } = fakeStore({ 'p-1': [question('q-1', 'quotes', ['BR-1'])] });
    await expect(handler(store, () => Promise.resolve(null))(job())).rejects.toThrow('a search failed in 1 of 1 products');
    expect(runs).toEqual([]);
  });

  it('throws a malformed payload naming its field', async () => {
    const { store } = fakeStore({});
    await expect(handler(store, fakeSearch({}).search)(job({ productId: 'p-1' }))).rejects.toThrow('malformed: slot');
  });
});

describe('searchEvalRunHandler — time', () => {
  it('asks to run again when it runs out of time, and the next run carries on with the products not yet kept', async () => {
    const { store, runs } = fakeStore({ 'p-1': [question('q-1', 'quotes', ['BR-1'])], 'p-2': [question('q-5', 'quotes', ['BR-1'], 'p-2')] });
    let now = Date.parse(SLOT);
    const lines: string[] = [];
    const slow: EvalSearcher = () => {
      now += 2000;
      return Promise.resolve(['BR-1']);
    };
    const first = await handler(store, slow, { clock: () => now, budgetMs: 1000, log: (line) => lines.push(line) })(job());
    expect(first).toEqual({ outcome: 'later', at: new Date(now + 60_000), progress: { recorded: 1 } });
    expect(runs.map((run) => run.productId)).toEqual(['p-1']);
    expect(lines).toEqual(['search eval run: 1 of 2 products run, out of time: again in a minute']);
    expect(await handler(store, fakeSearch({ [`${QUESTION_TEXT} q-5`]: ['BR-1'] }).search)(job())).toEqual({ outcome: 'done' });
    expect(runs.map((run) => run.productId)).toEqual(['p-1', 'p-2']);
  });

  it('logs no question', async () => {
    const { store } = fakeStore({ 'p-1': [question('q-1', 'quotes', ['BR-1'])] });
    const lines: string[] = [];
    await handler(store, fakeSearch({ [`${QUESTION_TEXT} q-1`]: ['BR-1'] }).search, { log: (line) => lines.push(line) })(job());
    expect(lines).toEqual(['search eval run: daily 2027-01-21: 1 runs kept in 1 products, 0 not run']);
  });
});
