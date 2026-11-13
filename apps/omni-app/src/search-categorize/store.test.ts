// The `search-categorize` job's database (PRD omni-loop-7 s3) against a stubbed PostgREST: no test calls Supabase.
import { describe, expect, it } from 'vitest';
import { searchStore, vectorText } from './store.ts';

type Call = { method: string; path: string; search: string; body: unknown };

/** A PostgREST answering each table or function by `answers[path]`, or a refusal when it is null. */
function dbFetch(answers: Record<string, unknown>) {
  const calls: Call[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(String(input), init);
    const url = new URL(request.url);
    const text = request.method === 'GET' ? '' : await request.text();
    calls.push({ method: request.method, path: url.pathname.replace('/rest/v1/', ''), search: decodeURIComponent(url.search), body: text ? JSON.parse(text) : null });
    const answer = answers[url.pathname.replace('/rest/v1/', '')];
    return answer === null
      ? new Response(JSON.stringify({ message: 'permission denied', code: '42501' }), { status: 403, headers: { 'content-type': 'application/json' } })
      : new Response(JSON.stringify(answer ?? []), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return { fetch, calls };
}

const store = (fetch: typeof globalThis.fetch) => searchStore({ url: 'https://db.example', key: 'service-key', fetch });

describe('vectorText', () => {
  it('is pgvector\'s text form', () => {
    expect(vectorText([0.5, 1, -2])).toBe('[0.5,1,-2]');
  });
});

describe('searchStore — as the service role', () => {
  it('ungrouped: the oldest search_knowledge searches with a question and no group, at most `limit`', async () => {
    const db = dbFetch({ mcp_search_log: [{ id: 's-1', product_id: 'p-1', workspace_id: 'w-1', query: 'can a quote be sent' }] });
    expect(await store(db.fetch).ungrouped(200)).toEqual([{ id: 's-1', productId: 'p-1', workspaceId: 'w-1', question: 'can a quote be sent' }]);
    const [call] = db.calls;
    expect(call?.method).toBe('GET');
    expect(call?.search).toContain('group_id=is.null');
    expect(call?.search).toContain('tool=eq.search_knowledge');
    expect(call?.search).toContain('query=not.is.null');
    expect(call?.search).toContain('order=asked_at');
    expect(call?.search).toContain('limit=200');
  });

  it('nearest: the product\'s nearest group of the model with its cosine, or null', async () => {
    const found = dbFetch({ 'rpc/mcp_search_group_nearest': [{ group_id: 'g-1', cosine: 0.95 }] });
    expect(await store(found.fetch).nearest('p-1', 'gte-small', [1, 0])).toEqual({ groupId: 'g-1', cosine: 0.95 });
    expect(found.calls[0]?.body).toEqual({ p_product: 'p-1', p_model: 'gte-small', p_query: '[1,0]' });
    expect(await store(dbFetch({ 'rpc/mcp_search_group_nearest': [] }).fetch).nearest('p-1', 'gte-small', [1, 0])).toBeNull();
  });

  it('addGroup: inserts the group with its vector and answers its id', async () => {
    const db = dbFetch({ mcp_search_groups: { id: 'g-9' } });
    const id = await store(db.fetch).addGroup({ productId: 'p-1', workspaceId: 'w-1', firstSearchId: 's-1', question: 'can a quote be sent', model: 'gte-small', vector: [1, 0] });
    expect(id).toBe('g-9');
    expect(db.calls[0]).toMatchObject({
      method: 'POST',
      path: 'mcp_search_groups',
      body: { product_id: 'p-1', workspace_id: 'w-1', first_search_id: 's-1', question: 'can a quote be sent', model: 'gte-small', embedding: '[1,0]' },
    });
  });

  it('join and setCategory: update the one search', async () => {
    const db = dbFetch({});
    await store(db.fetch).join('s-1', 'g-1');
    await store(db.fetch).setCategory('s-1', 'quotes');
    expect(db.calls.map(({ method, path, search, body }) => ({ method, path, search, body }))).toEqual([
      { method: 'PATCH', path: 'mcp_search_log', search: '?id=eq.s-1', body: { group_id: 'g-1' } },
      { method: 'PATCH', path: 'mcp_search_log', search: '?id=eq.s-1', body: { category: 'quotes' } },
    ]);
  });

  it('throws what the database refused, never a question', async () => {
    const db = dbFetch({ mcp_search_log: null, 'rpc/mcp_search_group_nearest': null, mcp_search_groups: null });
    await expect(store(db.fetch).ungrouped(5)).rejects.toThrow('the database refused: permission denied (42501)');
    await expect(store(db.fetch).nearest('p-1', 'm', [1])).rejects.toThrow('permission denied');
    await expect(store(db.fetch).addGroup({ productId: 'p', workspaceId: 'w', firstSearchId: 's', question: 'q', model: 'm', vector: [1] })).rejects.toThrow('permission denied');
    await expect(store(db.fetch).join('s', 'g')).rejects.toThrow('permission denied');
    await expect(store(db.fetch).setCategory('s', 'c')).rejects.toThrow('permission denied');
  });
});
