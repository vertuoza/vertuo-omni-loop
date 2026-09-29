// The stored PRD outboxes (PRD 657, s5): the store's Supabase calls on a recording client, and its fake's
// rules. No test reaches Supabase.
import { describe, expect, it } from 'vitest';
import { prdOutboxStore, waitingOf } from './store';
import { fakePrdOutboxStore } from './store.fake';

const W = 'w-acme';
const REPO = 'acme/widgets';

type Call = unknown[];

function recording(rows: unknown[] = [], refuse: { message: string; code?: string } | null = null) {
  const calls: Call[] = [];
  const answer = (data: unknown) => Promise.resolve(refuse ? { data: null, error: refuse } : { data, error: null });
  const from = (table: string) => ({
    select: (columns: string) => {
      const filters: Call = [];
      const chain = {
        eq: (column: string, value: unknown) => { filters.push(['eq', column, value]); return chain; },
        in: (column: string, values: unknown) => { filters.push(['in', column, values]); return chain; },
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
          calls.push(['select', table, columns, ...filters]);
          return answer(rows).then(resolve, reject);
        },
      };
      return chain;
    },
    upsert: (values: unknown, options: unknown) => { calls.push(['upsert', table, values, options]); return answer(null); },
  });
  return { calls, db: { from } as never };
}

describe('the store, on Supabase', () => {
  it('upserts each PRD\'s counts with when they were taken, the repository in lower case, and writes nothing for none', async () => {
    const { calls, db } = recording();
    await prdOutboxStore(db).record([], '2026-09-29T10:00:00Z');
    await prdOutboxStore(db).record([{ workspace_id: W, repository: 'Acme/Widgets', prd: 7, open_questions: 2, waiting: [] }], '2026-09-29T10:00:00Z');
    expect(calls).toEqual([[
      'upsert', 'prd_outbox',
      [{ workspace_id: W, repository: 'acme/widgets', prd: 7, open_questions: 2, waiting: [], synced_at: '2026-09-29T10:00:00Z' }],
      { onConflict: 'workspace_id,repository,prd' },
    ]]);
  });

  it('reads the workspace\'s rows of the PRD numbers asked, in one call, keeping only the PRDs asked', async () => {
    const { calls, db } = recording([
      { repository: REPO, prd: 7, open_questions: 2, waiting: [{ id: 'a', rank: 'high', question: 'Q?' }, { id: 'b', rank: 'medium', question: 'M?' }] },
      { repository: 'acme/core', prd: 7, open_questions: 5, waiting: [] },
      { repository: REPO, prd: 8, open_questions: 0, waiting: null },
    ]);
    const counts = await prdOutboxStore(db).countsOf(W, [{ repository: 'Acme/Widgets', prd: 7 }, { repository: REPO, prd: 8 }, { repository: REPO, prd: 7 }]);
    expect([...counts]).toEqual([
      [`${REPO}#7`, { open_questions: 2, waiting: [{ id: 'a', rank: 'high', question: 'Q?' }] }],
      [`${REPO}#8`, { open_questions: 0, waiting: [] }],
    ]);
    expect(calls).toEqual([['select', 'prd_outbox', 'repository, prd, open_questions, waiting', ['eq', 'workspace_id', W], ['in', 'prd', [7, 8]]]]);
  });

  it('asks nothing for no PRD, and throws Supabase\'s reason on a refusal', async () => {
    const { calls, db } = recording();
    expect((await prdOutboxStore(db).countsOf(W, [])).size).toBe(0);
    expect(calls).toEqual([]);
    const refused = recording([], { message: 'permission denied', code: '42501' });
    await expect(prdOutboxStore(refused.db).countsOf(W, [{ repository: REPO, prd: 7 }])).rejects.toThrow('permission denied (42501)');
  });

  it('keeps only well-formed waiting items', () => {
    expect(waitingOf('x')).toEqual([]);
    expect(waitingOf([{ id: 'a', rank: 'human-action', question: 'Q' }, { id: 1 }, null, { id: 'b', rank: 'low', question: 'Q' }]))
      .toEqual([{ id: 'a', rank: 'human-action', question: 'Q' }]);
  });
});

describe('the store, on its fake', () => {
  it('keeps one row per PRD, a write replacing its counts', async () => {
    const store = fakePrdOutboxStore(() => '2026-09-29T10:00:00Z');
    await store.record([{ workspace_id: W, repository: 'Acme/Widgets', prd: 7, open_questions: 2, waiting: [] }]);
    await store.record([{ workspace_id: W, repository: REPO, prd: 7, open_questions: 0, waiting: [] }]);
    expect(store.rows).toHaveLength(1);
    expect([...(await store.countsOf(W, [{ repository: REPO, prd: 7 }]))]).toEqual([[`${REPO}#7`, { open_questions: 0, waiting: [] }]]);
    expect((await store.countsOf('w-other', [{ repository: REPO, prd: 7 }])).size).toBe(0);
  });
});
