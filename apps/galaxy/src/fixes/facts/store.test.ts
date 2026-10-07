// The stored fix facts (PRD 691, s1): the store's Supabase calls on a recording client, and its fake's
// rules. No test reaches Supabase.
import { describe, expect, it } from 'vitest';
import type { FixSummary } from '../../dossier/github/fix';
import { UNREAD } from '../../dossier/github/summary';
import { factsOf, fixFactsStore } from './store';
import { fakeFixFactsStore } from './store.fake';
import { parseIssue } from 'vertuo-omni-plan/kit/lib/ids.ts';

const W = 'w-acme';
const FACTS: FixSummary = {
  issue: { number: parseIssue(7), url: 'https://github.com/acme/widgets/issues/7', state: 'open', author: 'ada', createdAt: '2026-09-28T09:00:00Z', risk: null, regression: true },
  pull: UNREAD,
  approvals: [{ login: 'bob', at: '2026-09-28T11:00:00Z' }],
  release: null,
};

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
  it('upserts each fix\'s facts with when they were read, and writes nothing for none', async () => {
    const { calls, db } = recording();
    await fixFactsStore(db).writeFacts([]);
    await fixFactsStore(db).writeFacts([{ dossier_id: 'd1', workspace_id: W, facts: FACTS }], '2026-09-29T10:00:00Z');
    expect(calls).toEqual([[
      'upsert', 'fix_facts',
      [{ dossier_id: 'd1', workspace_id: W, facts: FACTS, synced_at: '2026-09-29T10:00:00Z' }],
      { onConflict: 'dossier_id' },
    ]]);
  });

  it('reads the workspace\'s rows of the fixes asked, in one call, dropping a row whose facts are not a fix\'s', async () => {
    const { calls, db } = recording([
      { dossier_id: 'd1', facts: FACTS },
      { dossier_id: 'd2', facts: { issue: 'nonsense' } },
      { dossier_id: 'd3', facts: null },
    ]);
    const facts = await fixFactsStore(db).readFacts(W, ['d1', 'd2', 'd1', 'd3']);
    expect([...facts]).toEqual([['d1', FACTS]]);
    expect(calls).toEqual([['select', 'fix_facts', 'dossier_id, facts', ['eq', 'workspace_id', W], ['in', 'dossier_id', ['d1', 'd2', 'd3']]]]);
  });

  it('asks nothing for no fix, and throws Supabase\'s reason on a refusal', async () => {
    const { calls, db } = recording();
    expect((await fixFactsStore(db).readFacts(W, [])).size).toBe(0);
    expect(calls).toEqual([]);
    const refused = recording([], { message: 'permission denied', code: '42501' });
    await expect(fixFactsStore(refused.db).readFacts(W, ['d1'])).rejects.toThrow('permission denied (42501)');
    await expect(fixFactsStore(refused.db).writeFacts([{ dossier_id: 'd1', workspace_id: W, facts: FACTS }])).rejects.toThrow('permission denied (42501)');
  });

  it('reads a stored FixSummary back as the reader returned it, and nothing else', () => {
    expect(factsOf(JSON.parse(JSON.stringify(FACTS)))).toEqual(FACTS);
    expect(factsOf({ issue: UNREAD, pull: UNREAD, approvals: UNREAD, release: UNREAD })).toEqual({ issue: UNREAD, pull: UNREAD, approvals: UNREAD, release: UNREAD });
    expect(factsOf({ ...FACTS, release: { tag: 'v1' } })).toBeNull();
    expect(factsOf('x')).toBeNull();
  });
});

describe('the store, on its fake', () => {
  it('keeps one row per fix, a write replacing its facts, and reads only the workspace asked', async () => {
    const store = fakeFixFactsStore(() => '2026-09-29T10:00:00Z');
    await store.writeFacts([{ dossier_id: 'd1', workspace_id: W, facts: FACTS }]);
    await store.writeFacts([{ dossier_id: 'd1', workspace_id: W, facts: { ...FACTS, pull: null } }]);
    expect(store.rows).toEqual([{ dossier_id: 'd1', workspace_id: W, facts: { ...FACTS, pull: null }, synced_at: '2026-09-29T10:00:00Z' }]);
    expect([...(await store.readFacts(W, ['d1']))]).toEqual([['d1', { ...FACTS, pull: null }]]);
    expect((await store.readFacts('w-other', ['d1'])).size).toBe(0);
    store.fail = 'down';
    await expect(store.readFacts(W, ['d1'])).rejects.toThrow('down');
  });
});
