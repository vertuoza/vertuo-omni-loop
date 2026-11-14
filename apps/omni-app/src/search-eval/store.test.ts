// The search eval store (PRD omni-loop-8 s4) against a stubbed PostgREST: no test calls Supabase.
import { describe, expect, it } from 'vitest';
import { searchEvalStore } from './store.ts';

type Call = { method: string; path: string; search: string; body: unknown };

/** A PostgREST answering each table or function by `answers[path]` (a function sees the call), or a refusal when it is null. */
function dbFetch(answers: Record<string, unknown>) {
  const calls: Call[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(String(input), init);
    const url = new URL(request.url);
    const text = request.method === 'GET' ? '' : await request.text();
    const call = { method: request.method, path: url.pathname.replace('/rest/v1/', ''), search: decodeURIComponent(url.search), body: text ? (JSON.parse(text) as unknown) : null };
    calls.push(call);
    const answer = answers[call.path];
    const body = typeof answer === 'function' ? (answer as (c: Call) => unknown)(call) : answer;
    return body === null
      ? new Response(JSON.stringify({ message: 'permission denied', code: '42501' }), { status: 403, headers: { 'content-type': 'application/json' } })
      : new Response(JSON.stringify(body ?? []), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return { fetch, calls };
}

const store = (fetch: typeof globalThis.fetch) => searchEvalStore({ url: 'https://db.example', key: 'service-key', fetch });

describe('searchEvalStore — as the service role', () => {
  it('searches: the grouped search_knowledge calls since a date, with their category', async () => {
    const db = dbFetch({ mcp_search_log: [{ group_id: 'g-1', product_id: 'p-1', workspace_id: 'w-1', category: null }] });
    expect(await store(db.fetch).searches('2027-01-01T00:00:00.000Z')).toEqual([{ groupId: 'g-1', productId: 'p-1', workspaceId: 'w-1', category: null }]);
    const [call] = db.calls;
    expect(call?.search).toContain('tool=eq.search_knowledge');
    expect(call?.search).toContain('group_id=not.is.null');
    expect(call?.search).toContain('asked_at=gte.2027-01-01T00:00:00.000Z');
  });

  it('searches: reads every page', async () => {
    const page = (n: number) => Array.from({ length: n }, (_, i) => ({ group_id: `g-${String(i)}`, product_id: 'p-1', workspace_id: 'w-1', category: 'quotes' }));
    const db = dbFetch({ mcp_search_log: (call: Call) => (call.search.includes('offset=0') ? page(1000) : page(3)) });
    expect(await store(db.fetch).searches('2027-01-01T00:00:00.000Z')).toHaveLength(1003);
    expect(db.calls).toHaveLength(2);
  });

  it('joined: every group of the set, a removed question\'s included', async () => {
    const db = dbFetch({ search_eval_questions: [{ group_id: 'g-1' }, { group_id: 'g-2' }] });
    expect(await store(db.fetch).joined()).toEqual(new Set(['g-1', 'g-2']));
    expect(db.calls[0]?.search).toContain('group_id=not.is.null');
    expect(db.calls[0]?.search).not.toContain('removed_at');
  });

  it('promote: calls the service role\'s function and answers the question\'s id, or null when the group joined once', async () => {
    const db = dbFetch({ 'rpc/search_eval_question_promote': 'q-1' });
    expect(await store(db.fetch).promote({ productId: 'p-1', groupId: 'g-1', category: 'quotes' })).toBe('q-1');
    expect(db.calls[0]?.body).toEqual({ p_product: 'p-1', p_group: 'g-1', p_category: 'quotes' });
  });

  it('promote: answers null for a null', async () => {
    const fetch: typeof globalThis.fetch = () => Promise.resolve(new Response('null', { status: 200, headers: { 'content-type': 'application/json' } }));
    expect(await store(fetch).promote({ productId: 'p-1', groupId: 'g-1', category: 'quotes' })).toBeNull();
  });

  it('questionOf: the question\'s text, or null', async () => {
    expect(await store(dbFetch({ search_eval_questions: [{ question: 'can a quote be sent' }] }).fetch).questionOf('q-1')).toBe('can a quote be sent');
    expect(await store(dbFetch({ search_eval_questions: [] }).fetch).questionOf('q-1')).toBeNull();
  });

  it('opened: the distinct entries agents opened for the group', async () => {
    const db = dbFetch({ mcp_search_log: [{ opened_id: 'BR-1' }, { opened_id: 'BR-2' }, { opened_id: 'BR-1' }] });
    expect(await store(db.fetch).opened('g-1')).toEqual(['BR-1', 'BR-2']);
    expect(db.calls[0]?.search).toContain('group_id=eq.g-1');
    expect(db.calls[0]?.search).toContain('opened_id=not.is.null');
  });

  it('answerJev: calls the service role\'s function and answers whether it wrote', async () => {
    const db = dbFetch({ 'rpc/search_eval_answer_jev': false });
    expect(await store(db.fetch).answerJev({ questionId: 'q-1', entryId: 'BR-1', relevant: true, confidence: 0.8 })).toBe(false);
    expect(db.calls[0]?.body).toEqual({ p_question: 'q-1', p_entry: 'BR-1', p_relevant: true, p_confidence: 0.8 });
  });

  it('evalProducts: the products with a live question', async () => {
    const db = dbFetch({ search_eval_questions: [{ product_id: 'p-1' }, { product_id: 'p-2' }, { product_id: 'p-1' }] });
    expect(await store(db.fetch).evalProducts()).toEqual(['p-1', 'p-2']);
    expect(db.calls[0]?.search).toContain('removed_at=is.null');
  });

  it('evalProducts: for a pack, the live products of its workspaces that hold the repository and have a question', async () => {
    const db = dbFetch({
      search_eval_questions: [{ product_id: 'p-1' }, { product_id: 'p-2' }, { product_id: 'p-3' }],
      product_repositories: [{ product_id: 'p-1' }, { product_id: 'p-3' }, { product_id: 'p-9' }],
      products: [{ id: 'p-1' }],
    });
    expect(await store(db.fetch).evalProducts({ repository: 'acme/widgets', workspaces: ['w-1'] })).toEqual(['p-1']);
    const holders = db.calls.find((call) => call.path === 'product_repositories');
    expect(holders?.search).toContain('repository=eq.acme/widgets');
    expect(holders?.search).toContain('workspace_id=in.(w-1)');
    const live = db.calls.find((call) => call.path === 'products');
    expect(live?.search).toContain('id=in.(p-1,p-3)');
    expect(live?.search).toContain('archived_at=is.null');
  });

  it('evalProducts: nothing for a pack with no workspace or no set, and no read of repositories', async () => {
    const none = dbFetch({ search_eval_questions: [] });
    expect(await store(none.fetch).evalProducts({ repository: 'acme/widgets', workspaces: ['w-1'] })).toEqual([]);
    const noWorkspace = dbFetch({ search_eval_questions: [{ product_id: 'p-1' }] });
    expect(await store(noWorkspace.fetch).evalProducts({ repository: 'acme/widgets', workspaces: [] })).toEqual([]);
    expect([...none.calls, ...noWorkspace.calls].some((call) => call.path === 'product_repositories')).toBe(false);
  });

  it('questions: the product\'s live questions, each with the entries answered relevant', async () => {
    const db = dbFetch({
      search_eval_questions: [
        { id: 'q-1', product_id: 'p-1', workspace_id: 'w-1', question: 'can a quote be sent', category: 'quotes' },
        { id: 'q-2', product_id: 'p-1', workspace_id: 'w-1', question: 'how do I reset', category: null },
      ],
      search_eval_answers: [{ question_id: 'q-1', entry_id: 'BR-1' }, { question_id: 'q-1', entry_id: 'BR-2' }],
    });
    expect(await store(db.fetch).questions('p-1')).toEqual([
      { id: 'q-1', productId: 'p-1', workspaceId: 'w-1', question: 'can a quote be sent', category: 'quotes', right: ['BR-1', 'BR-2'] },
      { id: 'q-2', productId: 'p-1', workspaceId: 'w-1', question: 'how do I reset', category: null, right: [] },
    ]);
    expect(db.calls[0]?.search).toContain('removed_at=is.null');
    expect(db.calls[1]?.search).toContain('relevant=eq.true');
  });

  it('recorded and record: whether the product holds the run, and the run kept (null on a repeat)', async () => {
    expect(await store(dbFetch({ search_eval_runs: [{ id: 'r-1' }] }).fetch).recorded('p-1', 'daily', 's')).toBe(true);
    expect(await store(dbFetch({ search_eval_runs: [] }).fetch).recorded('p-1', 'daily', 's')).toBe(false);
    const db = dbFetch({ 'rpc/search_eval_run_record': 'r-2' });
    expect(await store(db.fetch).record({ productId: 'p-1', trigger: 'embed', slot: 'abc', measures: { overall: {} }, questions: [{ questionId: 'q-1' }] })).toBe('r-2');
    expect(db.calls[0]?.body).toEqual({ p_product: 'p-1', p_trigger: 'embed', p_slot: 'abc', p_measures: { overall: {} }, p_questions: [{ questionId: 'q-1' }] });
  });

  it('throws what the database refused, never a question', async () => {
    const db = dbFetch({ mcp_search_log: null, search_eval_questions: null, search_eval_runs: null, 'rpc/search_eval_question_promote': null, 'rpc/search_eval_answer_jev': null, 'rpc/search_eval_run_record': null });
    const s = store(db.fetch);
    await expect(s.searches('2027-01-01')).rejects.toThrow('the database refused: permission denied');
    await expect(s.joined()).rejects.toThrow('permission denied');
    await expect(s.questionOf('q')).rejects.toThrow('permission denied');
    await expect(s.opened('g')).rejects.toThrow('permission denied');
    await expect(s.evalProducts()).rejects.toThrow('permission denied');
    await expect(s.questions('p')).rejects.toThrow('permission denied');
    await expect(s.recorded('p', 'daily', 's')).rejects.toThrow('permission denied');
    await expect(s.promote({ productId: 'p', groupId: 'g', category: 'c' })).rejects.toThrow('permission denied (42501)');
    await expect(s.answerJev({ questionId: 'q', entryId: 'e', relevant: true, confidence: 1 })).rejects.toThrow('permission denied');
    await expect(s.record({ productId: 'p', trigger: 'daily', slot: 's', measures: {}, questions: [] })).rejects.toThrow('permission denied');
  });
});
