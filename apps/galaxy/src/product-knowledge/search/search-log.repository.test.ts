import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { searchesOf } from './search-log.repository';

// The Search section's storage (PRD omni-loop-6 s3): the read it sends as the signed-in person, each answer
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

const stored = (id: string) => ({ id, query: 'q', mode: 'words', total: 0, hit_ids: [], opened_rank: null, asked_at: '2026-11-12T10:00:00Z' });

describe('the searches of a product', () => {
  it('are the search_knowledge rows asked since a day, newest first, as the section reads them', async () => {
    const { db, lines } = fakeDb([{ data: [{ ...stored('a'), hit_ids: ['x'], opened_rank: 1, mode: 'meaning', total: 1 }], error: null }]);
    expect(await searchesOf(db, 'p-1', '2026-08-15T00:00:00Z')).toEqual([
      { id: 'a', query: 'q', mode: 'meaning', total: 1, hitIds: ['x'], openedRank: 1, askedAt: '2026-11-12T10:00:00Z' },
    ]);
    expect(lines).toEqual([
      'from("mcp_search_log").select("id, query, mode, total, hit_ids, opened_rank, asked_at").eq("product_id","p-1").eq("tool","search_knowledge")'
      + '.gte("asked_at","2026-08-15T00:00:00Z").order("asked_at",{"ascending":false}).range(0,999)',
    ]);
  });

  it('read the next page while a page is full', async () => {
    const full = Array.from({ length: 1000 }, (_, i) => stored(`r${i}`));
    const { db, lines } = fakeDb([{ data: full, error: null }, { data: [stored('last')], error: null }]);
    expect(await searchesOf(db, 'p-1', 'x')).toHaveLength(1001);
    expect(lines[1]).toContain('.range(1000,1999)');
  });

  it('are none to read on a refusal or an answer out of shape', async () => {
    expect(await searchesOf(fakeDb([{ data: null, error: { message: 'down' } }]).db, 'p-1', 'x')).toBeNull();
    expect(await searchesOf(fakeDb([{ data: [{ ...stored('a'), total: 'many' }], error: null }]).db, 'p-1', 'x')).toBeNull();
  });
});
