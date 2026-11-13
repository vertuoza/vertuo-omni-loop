// The `search-eval-promote` job (PRD omni-loop-8 s4) with a fake store and fakes of galaxy's two routes: no test calls
// Supabase or galaxy. Every question and entry is fictional.
import { describe, expect, it } from 'vitest';
import type { EvalSearcher, Judge } from '../search-eval/galaxy.ts';
import type { LoggedSearch } from '../search-eval/promote.ts';
import type { SearchEvalStore } from '../search-eval/store.ts';
import type { ClaimedJob } from './ledger.ts';
import { searchEvalPromoteHandler, SEARCH_EVAL_PROMOTE_KIND } from './search-eval-promote.ts';

const NOW = Date.parse('2027-01-21T00:00:00.000Z');
const QUESTIONS: Record<string, string> = { 'g-1': 'can a quote be sent without a payment term', 'g-2': 'how do I reset my password', 'g-3': 'can a quote be copied' };

const job = (): ClaimedJob => ({ id: 'j-1', kind: SEARCH_EVAL_PROMOTE_KIND, key: 'search-eval-promote@2027-01-21T00:00:00.000Z', subject: SEARCH_EVAL_PROMOTE_KIND, payload: { slot: '2027-01-21T00:00:00.000Z' }, tries: 1, claim: 'c-1', claimedUntil: '2027-01-21T00:05:00.000Z' });

const log = (groupId: string, category: string | null, n: number, productId = 'p-1'): LoggedSearch[] => Array.from({ length: n }, () => ({ groupId, productId, workspaceId: 'w-1', category }));

/** A store in memory: the log, the groups already in the set, the answers Jev wrote and a person's answers it keeps. */
function fakeStore(searches: LoggedSearch[], joined: string[] = [], opened: Record<string, string[]> = {}, persons: string[] = []) {
  const set = new Map(joined.map((groupId) => [groupId, `q-${groupId}`]));
  const since: string[] = [];
  const answers: { questionId: string; entryId: string; relevant: boolean; confidence: number }[] = [];
  const store: SearchEvalStore = {
    searches: (sinceIso) => {
      since.push(sinceIso);
      return Promise.resolve(searches);
    },
    joined: () => Promise.resolve(new Set(set.keys())),
    promote: ({ groupId }) => {
      if (set.has(groupId)) return Promise.resolve(null);
      set.set(groupId, `q-${groupId}`);
      return Promise.resolve(`q-${groupId}`);
    },
    questionOf: (questionId) => Promise.resolve(QUESTIONS[questionId.slice(2)] ?? null),
    opened: (groupId) => Promise.resolve(opened[groupId] ?? []),
    answerJev: (answer) => {
      if (persons.includes(answer.entryId)) return Promise.resolve(false);
      answers.push(answer);
      return Promise.resolve(true);
    },
    evalProducts: () => Promise.resolve([]),
    questions: () => Promise.resolve([]),
    recorded: () => Promise.resolve(false),
    record: () => Promise.resolve(null),
  };
  return { store, set, since, answers };
}

/** Galaxy's search: the ids ranked for each question. */
function fakeSearch(ids: string[] | null = ['BR-1', 'BR-2', 'BR-3']) {
  const asked: { productId: string; question: string }[] = [];
  const search: EvalSearcher = ({ productId, question }) => {
    asked.push({ productId, question });
    return Promise.resolve(ids);
  };
  return { search, asked };
}

/** Galaxy's verdicts: `BR-1` and `BR-9` answer, `BR-3` does not, the rest it keeps no verdict for. */
function fakeJudge() {
  const asked: string[][] = [];
  const ask: Judge = ({ entryIds }) => {
    asked.push([...entryIds]);
    return Promise.resolve(entryIds.map((entryId) => ({ entryId, relevant: ['BR-1', 'BR-9'].includes(entryId) ? true : entryId === 'BR-3' ? false : null, confidence: 0.8 })));
  };
  return { ask, asked };
}

const handler = (parts: { store: SearchEvalStore; search?: EvalSearcher; ask?: Judge }, over: { clock?: () => number; budgetMs?: number; log?: (line: string) => void } = {}) =>
  searchEvalPromoteHandler({ search: fakeSearch().search, ask: fakeJudge().ask, clock: () => NOW, log: () => undefined, ...parts, ...over });

describe('searchEvalPromoteHandler', () => {
  it('promotes the most-asked groups of the last 30 days and keeps Jev\'s verdict of each of their hits and opened entries', async () => {
    const { store, set, since, answers } = fakeStore([...log('g-1', 'quotes', 3), ...log('g-2', 'account', 2)], [], { 'g-1': ['BR-9', 'BR-1'] });
    const judge = fakeJudge();
    expect(await handler({ store, ask: judge.ask })(job())).toEqual({ outcome: 'done' });
    expect(since).toEqual(['2026-12-22T00:00:00.000Z']);
    expect([...set.keys()].sort()).toEqual(['g-1', 'g-2']);
    // the groups in category order; the 3 hits, then the opened entry the hits do not hold, each once; null verdicts add no answer
    expect(judge.asked).toEqual([['BR-1', 'BR-2', 'BR-3'], ['BR-1', 'BR-2', 'BR-3', 'BR-9']]);
    expect(answers.filter((a) => a.questionId === 'q-g-1')).toEqual([
      { questionId: 'q-g-1', entryId: 'BR-1', relevant: true, confidence: 0.8 },
      { questionId: 'q-g-1', entryId: 'BR-3', relevant: false, confidence: 0.8 },
      { questionId: 'q-g-1', entryId: 'BR-9', relevant: true, confidence: 0.8 },
    ]);
  });

  it('searches the question as the product, and asks galaxy about it with the product\'s workspace', async () => {
    const { store } = fakeStore(log('g-1', 'quotes', 1));
    const searched = fakeSearch();
    const seen: { workspaceId: string; productId: string; question: string }[] = [];
    const ask: Judge = ({ workspaceId, productId, question }) => {
      seen.push({ workspaceId, productId, question });
      return Promise.resolve([]);
    };
    await handler({ store, search: searched.search, ask })(job());
    expect(searched.asked).toEqual([{ productId: 'p-1', question: QUESTIONS['g-1'] }]);
    expect(seen).toEqual([{ workspaceId: 'w-1', productId: 'p-1', question: QUESTIONS['g-1'] }]);
  });

  it('judges at most 20 entries a call', async () => {
    const { store } = fakeStore(log('g-1', 'quotes', 1), [], { 'g-1': Array.from({ length: 25 }, (_, i) => `OP-${String(i)}`) });
    const judge = fakeJudge();
    await handler({ store, ask: judge.ask })(job());
    expect(judge.asked.map((ids) => ids.length)).toEqual([20, 8]);
  });

  it('adds nothing for a group in the set, a removed question\'s included, and keeps no second question for a group on a second run', async () => {
    const { store, set } = fakeStore([...log('g-1', 'quotes', 3), ...log('g-3', 'quotes', 2)], ['g-1']);
    const judge = fakeJudge();
    await handler({ store, ask: judge.ask })(job());
    expect([...set.keys()].sort()).toEqual(['g-1', 'g-3']);
    expect(judge.asked).toHaveLength(1);
    await handler({ store, ask: judge.ask })(job());
    expect(judge.asked).toHaveLength(1);
  });

  it('never overwrites a person\'s answer: a refused write is not counted and the run goes on', async () => {
    const { store, answers } = fakeStore(log('g-1', 'quotes', 1), [], {}, ['BR-1']);
    const lines: string[] = [];
    await handler({ store }, { log: (line) => lines.push(line) })(job());
    expect(answers.map((a) => a.entryId)).toEqual(['BR-3']);
    expect(lines).toEqual(['search eval promote: 1 groups picked, 1 questions promoted, 1 answers kept, 0 questions left unjudged']);
  });

  it('adds no answer for a null verdict, and none when galaxy cannot be asked: the question waits in the set', async () => {
    const { store, set, answers } = fakeStore(log('g-1', 'quotes', 1));
    await handler({ store, ask: () => Promise.resolve(null) })(job());
    expect(set.has('g-1')).toBe(true);
    await handler({ store: fakeStore(log('g-2', 'x', 1)).store, search: () => Promise.resolve(null), ask: () => Promise.resolve(null) })(job());
    expect(answers).toEqual([]);
  });

  it('leaves a question unjudged when galaxy fails for it, and goes on with the next', async () => {
    const { store, set, answers } = fakeStore([...log('g-1', 'quotes', 2), ...log('g-2', 'account', 1)]);
    const lines: string[] = [];
    let calls = 0;
    const ask: Judge = ({ entryIds }) => {
      calls += 1;
      return calls === 1 ? Promise.reject(new Error('relevant: galaxy answered 500')) : Promise.resolve(entryIds.map((entryId) => ({ entryId, relevant: true, confidence: 0.9 })));
    };
    expect(await searchEvalPromoteHandler({ store, search: fakeSearch().search, ask, clock: () => NOW, log: (line) => lines.push(line) })(job())).toEqual({ outcome: 'done' });
    expect([...set.keys()].sort()).toEqual(['g-1', 'g-2']);
    expect(answers.map((a) => a.questionId)).toEqual(['q-g-1', 'q-g-1', 'q-g-1']);
    expect(lines).toEqual(['search eval promote: 2 groups picked, 2 questions promoted, 3 answers kept, 1 questions left unjudged']);
  });

  it('asks to run again when it runs out of time, keeping what joined, and logs no question', async () => {
    const { store, set } = fakeStore([...log('g-1', 'quotes', 2), ...log('g-2', 'account', 1)]);
    let now = NOW;
    const lines: string[] = [];
    const result = await searchEvalPromoteHandler({
      store,
      search: () => {
        now += 2000;
        return Promise.resolve(['BR-1']);
      },
      ask: fakeJudge().ask,
      clock: () => now,
      budgetMs: 1000,
      log: (line) => lines.push(line),
    })(job());
    expect(result).toEqual({ outcome: 'later', at: new Date(now + 60_000), progress: { promoted: 1 } });
    expect(set.size).toBe(1);
    expect(lines).toEqual(['search eval promote: 1 questions promoted, out of time: again in a minute']);
  });
});
