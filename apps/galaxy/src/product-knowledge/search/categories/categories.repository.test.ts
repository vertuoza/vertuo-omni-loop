import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { categorizedSearchesOf, groupHeadsOf } from './categories.repository';

// The Categories view's storage (PRD omni-loop-7 s4): the reads it sends as the signed-in person, each answer
// parsed where it comes in. A fake client records each query's chain and answers in order.

type Answer = { data: unknown; error: { message: string } | null };

function fakeDb(answers: Answer[]) {
  const lines: string[] = [];
  const chain = (line: string[]): unknown => new Proxy({}, {
    get(_, key: string) {
      if (key === 'then') {
        const answer = answers.shift() ?? { data: null, error: { message: 'no answer left' } };
        lines.push(line.join('.'));
        return (resolve: (value: Answer) => unknown) => resolve(answer);
      }
      return (...args: unknown[]) => chain([...line, `${key}(${args.map((a) => JSON.stringify(a)).join(',')})`]);
    },
  });
  const db = { from: (table: string) => chain([`from(${JSON.stringify(table)})`]) } as unknown as Pick<SupabaseClient, 'from'>;
  return { db, lines };
}

const stored = (id: string) => ({
  id, query: 'q', mode: 'words', total: 0, opened_rank: null, asked_at: '2026-11-12T10:00:00Z', category: null, group_id: null,
});

describe('the categorized searches of a product', () => {
  it('are the search_knowledge rows asked since a day, newest first, with their category and group', async () => {
    const { db, lines } = fakeDb([{ data: [{ ...stored('a'), category: 'quotes', group_id: 'g1', opened_rank: 2 }], error: null }]);
    expect(await categorizedSearchesOf(db, 'p-1', '2026-08-15T00:00:00Z')).toEqual([{
      id: 'a', query: 'q', mode: 'words', total: 0, hitIds: [], openedRank: 2, askedAt: '2026-11-12T10:00:00Z', category: 'quotes', groupId: 'g1',
    }]);
    expect(lines).toEqual([
      'from("mcp_search_log").select("id, query, mode, total, opened_rank, asked_at, category, group_id").eq("product_id","p-1")'
      + '.eq("tool","search_knowledge").gte("asked_at","2026-08-15T00:00:00Z").order("asked_at",{"ascending":false}).range(0,999)',
    ]);
  });

  it('read the next page while a page is full', async () => {
    const full = Array.from({ length: 1000 }, (_, i) => stored(`r${String(i)}`));
    const { db, lines } = fakeDb([{ data: full, error: null }, { data: [stored('last')], error: null }]);
    expect(await categorizedSearchesOf(db, 'p-1', 'x')).toHaveLength(1001);
    expect(lines[1]).toContain('.range(1000,1999)');
  });

  it('are none to read on a refusal or an answer out of shape', async () => {
    expect(await categorizedSearchesOf(fakeDb([{ data: null, error: { message: 'down' } }]).db, 'p-1', 'x')).toBeNull();
    expect(await categorizedSearchesOf(fakeDb([{ data: [{ ...stored('a'), category: 4 }], error: null }]).db, 'p-1', 'x')).toBeNull();
  });
});

describe('the groups of a product', () => {
  it('are each group id with its first question, oldest first', async () => {
    const { db, lines } = fakeDb([{ data: [{ id: 'g1', question: 'can a quote be sent without a payment term' }], error: null }]);
    expect(await groupHeadsOf(db, 'p-1')).toEqual([{ id: 'g1', question: 'can a quote be sent without a payment term' }]);
    expect(lines).toEqual(['from("mcp_search_groups").select("id, question").eq("product_id","p-1").order("created_at",{"ascending":true}).range(0,999)']);
  });

  it('are none to read on a refusal or an answer out of shape', async () => {
    expect(await groupHeadsOf(fakeDb([{ data: null, error: { message: 'down' } }]).db, 'p-1')).toBeNull();
    expect(await groupHeadsOf(fakeDb([{ data: [{ id: 'g1' }], error: null }]).db, 'p-1')).toBeNull();
  });
});
