// The stored fix facts (PRD 691, s1): the store's Supabase calls on a recording client, and its fake's
// rules. No test reaches Supabase.
import { describe, expect, it } from 'vitest';
import type { ConceptFacts, FixSummary } from '../../dossier/github/fix';
import { UNREAD } from '../../dossier/github/summary';
import { conceptFactsOf, conceptFactsStore, factsOf, fixFactsStore } from './store';
import { fakeConceptFactsStore, fakeFixFactsStore } from './store.fake';
import { parseIssue, parsePr } from 'vertuo-omni-plan/kit/lib/ids.ts';

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

describe('a concept\'s facts, in the same table (PRD 1272, s4)', () => {
  const CONCEPT: ConceptFacts = {
    issue: FACTS.issue,
    pull: { number: parsePr(1270), url: 'https://github.com/acme/widgets/pull/1270', state: 'merged', mergedAt: '2026-10-07T09:00:00Z', mergedBy: null },
  };

  it('stores {issue, pull} in fix_facts, and reads back only a row that holds a concept\'s two parts', async () => {
    const { calls, db } = recording([{ dossier_id: 'c1', facts: CONCEPT }, { dossier_id: 'c2', facts: { issue: UNREAD } }]);
    await conceptFactsStore(db).writeFacts([{ dossier_id: 'c1', workspace_id: W, facts: CONCEPT }], '2026-10-08T10:00:00Z');
    expect([...(await conceptFactsStore(db).readFacts(W, ['c1', 'c2']))]).toEqual([['c1', CONCEPT]]);
    expect(calls).toEqual([
      ['upsert', 'fix_facts', [{ dossier_id: 'c1', workspace_id: W, facts: CONCEPT, synced_at: '2026-10-08T10:00:00Z' }], { onConflict: 'dossier_id' }],
      ['select', 'fix_facts', 'dossier_id, facts', ['eq', 'workspace_id', W], ['in', 'dossier_id', ['c1', 'c2']]],
    ]);
  });

  it('reads a part GitHub could not read as unread, and anything else as no facts', () => {
    expect(conceptFactsOf({ issue: UNREAD, pull: UNREAD })).toEqual({ issue: UNREAD, pull: UNREAD });
    expect(conceptFactsOf({ issue: null, pull: { number: 3 } })).toBeNull();
    expect(conceptFactsOf(null)).toBeNull();
  });

  it('keeps one row per concept on its fake, reading only the workspace asked', async () => {
    const store = fakeConceptFactsStore(() => '2026-10-08T10:00:00Z');
    await store.writeFacts([{ dossier_id: 'c1', workspace_id: W, facts: CONCEPT }]);
    await store.writeFacts([{ dossier_id: 'c1', workspace_id: W, facts: { ...CONCEPT, pull: UNREAD } }]);
    expect(store.rows).toEqual([{ dossier_id: 'c1', workspace_id: W, facts: { ...CONCEPT, pull: UNREAD }, synced_at: '2026-10-08T10:00:00Z' }]);
    expect(store.writes).toEqual([`${W} c1`, `${W} c1`]);
    expect((await store.readFacts('w-other', ['c1'])).size).toBe(0);
  });
});
