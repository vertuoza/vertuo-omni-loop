// The `search-categorize` job (PRD omni-loop-7 s3) with a fake store, a fake embedder and a fake galaxy port: no test
// calls Supabase, a model or galaxy. Every question is fictional.
import { describe, expect, it } from 'vitest';
import { EMBED_BATCH, EMBED_MODEL } from 'omni-loop/kit/lib/knowledge/embed-contract.ts';
import type { Embedder } from '../knowledge-embed/embedder.ts';
import type { CategorizeAsk, Categorizer } from '../search-categorize/galaxy.ts';
import { cosine } from '../search-categorize/group.ts';
import type { NewGroup, SearchStore, Ungrouped } from '../search-categorize/store.ts';
import { MAX_SEARCHES, searchCategorizeHandler, SEARCH_CATEGORIZE_KIND } from './search-categorize.ts';
import type { ClaimedJob } from './ledger.ts';

const VECTORS: Record<string, number[]> = {
  'can a quote be sent without a payment term': [0.9, 0.3, 0.1, 0.05],
  'can a quote go out with no payment term': [0.88, 0.33, 0.12, 0.04],
  'how do I reset my password': [0.1, 0.05, 0.9, 0.4],
};

const search = (n: number, question: string, productId = 'p-1'): Ungrouped => ({ id: `s-${String(n)}`, productId, workspaceId: 'w-1', question });

/** A store in memory: the searches with no group, the groups kept and what was set. */
function fakeStore(pending: Ungrouped[]) {
  const groups: (NewGroup & { id: string })[] = [];
  const grouped = new Map<string, string>();
  const categories = new Map<string, string>();
  const asked: number[] = [];
  const store: SearchStore = {
    ungrouped: (limit) => {
      asked.push(limit);
      return Promise.resolve(pending.filter((s) => !grouped.has(s.id)).slice(0, limit));
    },
    nearest: (productId, model, vector) => {
      const own = groups.filter((g) => g.productId === productId && g.model === model);
      const best = own.map((g) => ({ groupId: g.id, cosine: cosine(g.vector, vector) })).sort((a, b) => b.cosine - a.cosine)[0];
      return Promise.resolve(best ?? null);
    },
    addGroup: (group) => {
      const id = `g-${String(groups.length + 1)}`;
      groups.push({ ...group, id });
      return Promise.resolve(id);
    },
    join: (searchId, groupId) => {
      grouped.set(searchId, groupId);
      return Promise.resolve();
    },
    setCategory: (searchId, category) => {
      categories.set(searchId, category);
      return Promise.resolve();
    },
  };
  return { store, groups, grouped, categories, asked };
}

function fakeEmbed() {
  const calls: string[][] = [];
  const embed: Embedder = (texts) => {
    calls.push([...texts]);
    return Promise.resolve(texts.map((text) => VECTORS[text] ?? [0, 0, 0, 1]));
  };
  return { embed, calls };
}

const answers = (by: Record<string, string | null>): { categorize: Categorizer; asks: CategorizeAsk[] } => {
  const asks: CategorizeAsk[] = [];
  return {
    asks,
    categorize: (ask) => {
      asks.push(ask);
      return Promise.resolve(by[ask.question] ?? null);
    },
  };
};

const JOB = { id: 'j-1', kind: SEARCH_CATEGORIZE_KIND, payload: { slot: '2027-01-15T09:00:00.000Z' } } as unknown as ClaimedJob;
const quiet = () => undefined;

describe('the search-categorize job', () => {
  it('groups two wordings of one question together and an unrelated one apart, and sets each category from galaxy', async () => {
    const db = fakeStore([
      search(1, 'can a quote be sent without a payment term'),
      search(2, 'can a quote go out with no payment term'),
      search(3, 'how do I reset my password'),
    ]);
    const { embed } = fakeEmbed();
    const { categorize } = answers({ 'can a quote be sent without a payment term': 'quotes', 'can a quote go out with no payment term': 'quotes', 'how do I reset my password': 'other' });
    const result = await searchCategorizeHandler({ store: db.store, embed, categorize, log: quiet })(JOB);
    expect(result).toEqual({ outcome: 'done' });
    expect(db.groups.map((g) => [g.firstSearchId, g.question, g.model])).toEqual([
      ['s-1', 'can a quote be sent without a payment term', EMBED_MODEL],
      ['s-3', 'how do I reset my password', EMBED_MODEL],
    ]);
    expect(Object.fromEntries(db.grouped)).toEqual({ 's-1': 'g-1', 's-2': 'g-1', 's-3': 'g-2' });
    expect(Object.fromEntries(db.categories)).toEqual({ 's-1': 'quotes', 's-2': 'quotes', 's-3': 'other' });
  });

  it('never joins a question to another product\'s group', async () => {
    const db = fakeStore([search(1, 'can a quote be sent without a payment term', 'p-1'), search(2, 'can a quote be sent without a payment term', 'p-2')]);
    await searchCategorizeHandler({ store: db.store, embed: fakeEmbed().embed, categorize: answers({}).categorize, log: quiet })(JOB);
    expect(db.groups.map((g) => g.productId)).toEqual(['p-1', 'p-2']);
  });

  it('takes at most 200 searches a run, and embeds them 8 a call', async () => {
    const many = Array.from({ length: 20 }, (_, i) => search(i, `question ${String(i)}`));
    const db = fakeStore(many);
    const { embed, calls } = fakeEmbed();
    await searchCategorizeHandler({ store: db.store, embed, categorize: answers({}).categorize, log: quiet })(JOB);
    expect(MAX_SEARCHES).toBe(200);
    expect(db.asked).toEqual([200]);
    expect(calls.map((c) => c.length)).toEqual([EMBED_BATCH, EMBED_BATCH, 4]);
  });

  it('leaves the category empty on null, and still groups', async () => {
    const db = fakeStore([search(1, 'how do I reset my password')]);
    await searchCategorizeHandler({ store: db.store, embed: fakeEmbed().embed, categorize: answers({}).categorize, log: quiet })(JOB);
    expect(db.categories.size).toBe(0);
    expect(db.grouped.get('s-1')).toBe('g-1');
  });

  it('leaves the category empty when galaxy fails, keeps the group, and goes on with the next search', async () => {
    const db = fakeStore([search(1, 'can a quote be sent without a payment term'), search(2, 'how do I reset my password')]);
    const categorize: Categorizer = ({ question }) => (question.startsWith('can') ? Promise.reject(new Error('categorize: galaxy answered 500')) : Promise.resolve('other'));
    const result = await searchCategorizeHandler({ store: db.store, embed: fakeEmbed().embed, categorize, log: quiet })(JOB);
    expect(result).toEqual({ outcome: 'done' });
    expect(Object.fromEntries(db.grouped)).toEqual({ 's-1': 'g-1', 's-2': 'g-2' });
    expect(Object.fromEntries(db.categories)).toEqual({ 's-2': 'other' });
  });

  it('keeps no category a column would refuse', async () => {
    const db = fakeStore([search(1, 'a'), search(2, 'b')]);
    const { categorize } = answers({ a: '', b: 'x'.repeat(81) });
    await searchCategorizeHandler({ store: db.store, embed: fakeEmbed().embed, categorize, log: quiet })(JOB);
    expect(db.categories.size).toBe(0);
  });

  it('asks galaxy with the workspace, the product and the question', async () => {
    const db = fakeStore([search(1, 'how do I reset my password', 'p-9')]);
    const { categorize, asks } = answers({});
    await searchCategorizeHandler({ store: db.store, embed: fakeEmbed().embed, categorize, log: quiet })(JOB);
    expect(asks).toEqual([{ workspaceId: 'w-1', productId: 'p-9', question: 'how do I reset my password' }]);
  });

  it('a second run of the same slot groups nothing twice', async () => {
    const db = fakeStore([search(1, 'how do I reset my password')]);
    const { embed, calls } = fakeEmbed();
    const handler = searchCategorizeHandler({ store: db.store, embed, categorize: answers({}).categorize, log: quiet });
    await handler(JOB);
    await handler(JOB);
    expect(db.groups).toHaveLength(1);
    expect(calls).toHaveLength(1);
  });

  it('does nothing when no search waits', async () => {
    const db = fakeStore([]);
    const { embed, calls } = fakeEmbed();
    expect(await searchCategorizeHandler({ store: db.store, embed, categorize: answers({}).categorize, log: quiet })(JOB)).toEqual({ outcome: 'done' });
    expect(calls).toEqual([]);
  });

  it('throws when the embed fails, keeping what was grouped, for the worker to retry', async () => {
    const many = Array.from({ length: 10 }, (_, i) => search(i, `question ${String(i)}`));
    const db = fakeStore(many);
    let calls = 0;
    const embed: Embedder = (texts) => {
      calls += 1;
      return calls === 1 ? Promise.resolve(texts.map(() => [0, 0, 0, 1])) : Promise.reject(new Error('embed answered 500'));
    };
    await expect(searchCategorizeHandler({ store: db.store, embed, categorize: answers({}).categorize, log: quiet })(JOB)).rejects.toThrow('embed answered 500');
    expect(db.grouped.size).toBe(EMBED_BATCH);
  });

  it('asks to run again a minute later when it ran out of time', async () => {
    const db = fakeStore(Array.from({ length: 10 }, (_, i) => search(i, `question ${String(i)}`)));
    let now = 1_000;
    const embed: Embedder = (texts) => {
      now += 100_000;
      return Promise.resolve(texts.map(() => [0, 0, 0, 1]));
    };
    const result = await searchCategorizeHandler({ store: db.store, embed, categorize: answers({}).categorize, clock: () => now, budgetMs: 50_000, log: quiet })(JOB);
    expect(result).toEqual({ outcome: 'later', at: new Date(now + 60_000), progress: { grouped: EMBED_BATCH } });
  });

  it('logs counts, never a question', async () => {
    const db = fakeStore([search(1, 'how do I reset my password')]);
    const lines: string[] = [];
    await searchCategorizeHandler({ store: db.store, embed: fakeEmbed().embed, categorize: answers({}).categorize, log: (line) => lines.push(line) })(JOB);
    expect(lines).toHaveLength(1);
    expect(lines.join('\n')).not.toContain('password');
  });
});
