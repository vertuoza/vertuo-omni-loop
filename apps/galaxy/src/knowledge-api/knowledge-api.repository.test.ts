import { describe, expect, it } from 'vitest';
import { knowledgeApiRepository, type KnowledgeApiDb } from './knowledge-api.repository';

// A terminal's knowledge change, its storage (PRD 2268 s1): which database function each call makes, with
// which arguments, and how its answer or its refusal comes back. A fake client stands in for Supabase.

type Answer = { data: unknown; error: { code?: string; message: string } | null };

const ROW = {
  id: 'c-1', workspace_id: 'w-1', product_id: 'p-1', kind: 'never', seq: 4, body: 'We never store card numbers.',
  created_by: 'u-1', created_at: '2026-10-20T09:00:00Z', updated_at: '2026-10-20T09:00:00Z', removed_at: null, removed_by: null,
};

/** A client that records each call and answers `answer`. */
function fakeDb(answer: Answer) {
  const calls: string[] = [];
  const query = {
    eq(column: string, value: unknown) { calls.push(`eq ${column} ${String(value)}`); return query; },
    is(column: string, value: unknown) { calls.push(`is ${column} ${String(value)}`); return query; },
    then<R>(resolve: (a: Answer) => R) { return Promise.resolve(answer).then(resolve); },
  };
  const db = {
    rpc(fn: string, args: Record<string, unknown>) { calls.push(`rpc ${fn} ${JSON.stringify(args)}`); return Promise.resolve(answer); },
    from(table: string) { return { select(columns: string) { calls.push(`from ${table} select ${columns}`); return query; } }; },
  };
  return { db: db as unknown as KnowledgeApiDb, calls };
}

describe('the knowledge change\'s storage', () => {
  it('finds the product through knowledge_product_for_repo(), the product named or none', async () => {
    const { db, calls } = fakeDb({ data: { id: 'p-1', workspace: 'w-1', name: 'Mobile' }, error: null });
    const store = knowledgeApiRepository(db);
    expect(await store.productFor('kp-org/api', 'Mobile')).toEqual({ ok: true, value: { id: 'p-1', workspace: 'w-1', name: 'Mobile' } });
    await store.productFor('kp-org/solo', null);
    expect(calls).toEqual([
      'rpc knowledge_product_for_repo {"p_repo":"kp-org/api","p_product":"Mobile"}',
      'rpc knowledge_product_for_repo {"p_repo":"kp-org/solo","p_product":null}',
    ]);
  });

  it('keeps the database\'s code and words when it refuses, and says so when an answer is out of shape', async () => {
    const refused = fakeDb({ data: null, error: { code: '21000', message: 'kp-org/api is in 2 products: Mobile, Estimates; pass --product to name one.' } });
    expect(await knowledgeApiRepository(refused.db).productFor('kp-org/api', null)).toEqual({
      ok: false, code: '21000', message: 'kp-org/api is in 2 products: Mobile, Estimates; pass --product to name one.',
    });
    const odd = fakeDb({ data: { id: 'p-1' }, error: null });
    expect(await knowledgeApiRepository(odd.db).productFor('kp-org/api', null)).toEqual({ ok: false, code: 'shape', message: 'knowledge_product_for_repo answered out of shape' });
    const silent = fakeDb({ data: null, error: { message: 'down' } });
    expect(await knowledgeApiRepository(silent.db).productFor('kp-org/api', null)).toEqual({ ok: false, code: null, message: 'down' });
  });

  it('finds a live constituent by its kind, and a Never line by its number', async () => {
    const { db, calls } = fakeDb({ data: [{ id: 'c-1' }], error: null });
    const store = knowledgeApiRepository(db);
    expect(await store.constituent('p-1', { kind: 'never', seq: 4 })).toEqual({ ok: true, value: 'c-1' });
    expect(await store.constituent('p-1', { kind: 'statement', seq: null })).toEqual({ ok: true, value: 'c-1' });
    expect(calls).toEqual([
      'from constituents select id', 'eq product_id p-1', 'eq kind never', 'is removed_at null', 'eq seq 4',
      'from constituents select id', 'eq product_id p-1', 'eq kind statement', 'is removed_at null',
    ]);
    expect(await knowledgeApiRepository(fakeDb({ data: [], error: null }).db).constituent('p-1', { kind: 'never', seq: 9 })).toEqual({ ok: true, value: null });
  });

  it('adds and edits a constituent through constituent_add() and constituent_edit(), answering its kind and number', async () => {
    const { db, calls } = fakeDb({ data: ROW, error: null });
    const store = knowledgeApiRepository(db);
    expect(await store.addConstituent('w-1', 'p-1', 'never', 'We never store card numbers.')).toEqual({ ok: true, value: { kind: 'never', seq: 4 } });
    expect(await store.editConstituent('w-1', 'c-1', 'We never store card numbers.')).toEqual({ ok: true, value: { kind: 'never', seq: 4 } });
    expect(calls).toEqual([
      'rpc constituent_add {"p_workspace":"w-1","p_product":"p-1","p_kind":"never","p_text":"We never store card numbers."}',
      'rpc constituent_edit {"p_workspace":"w-1","p_constituent":"c-1","p_text":"We never store card numbers."}',
    ]);
    const member = fakeDb({ data: null, error: { code: '42501', message: 'Only an owner of the workspace can change its constituents.' } });
    expect(await knowledgeApiRepository(member.db).addConstituent('w-1', 'p-1', 'statement', 'x')).toEqual({
      ok: false, code: '42501', message: 'Only an owner of the workspace can change its constituents.',
    });
  });
});
