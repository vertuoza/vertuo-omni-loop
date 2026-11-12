// The `knowledge-embed` job's database (PRD 2728 s4) against a stubbed PostgREST: no test calls Supabase. Every row
// is a fictional product, Acme.
import { describe, expect, it } from 'vitest';
import { knowledgeEmbedStore, lawHomeOf } from './store.ts';

type Call = { method: string; path: string; search: string; body: unknown; key: string | null };

const SHA = 'e'.repeat(40);
const HASH = 'a'.repeat(64);

/** A PostgREST answering each table or function by `answers[path]`, or a refusal when it is null. */
function dbFetch(answers: Record<string, unknown>) {
  const calls: Call[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(String(input), init);
    const url = new URL(request.url);
    const text = request.method === 'GET' ? '' : await request.text();
    calls.push({ method: request.method, path: url.pathname, search: decodeURIComponent(url.search), body: text ? JSON.parse(text) : null, key: request.headers.get('apikey') });
    const answer = answers[url.pathname.replace('/rest/v1/', '')];
    return answer === null
      ? new Response(JSON.stringify({ message: 'Each vector: 384 numbers.', code: '22023' }), { status: 400, headers: { 'content-type': 'application/json' } })
      : new Response(JSON.stringify(answer ?? []), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return { fetch, calls };
}

const store = (fetch: typeof globalThis.fetch) => knowledgeEmbedStore({ url: 'https://db.example', key: 'service-key', fetch });

const ANSWERS = {
  knowledge_packs: [{ id: 'k-1', workspace_id: 'w-1' }, { id: 'k-2', workspace_id: 'w-2' }],
  knowledge_pack_files: [{ path: '.omni-loop/config.yml', content: 'kit: 1\n' }],
  product_repositories: [
    { product_id: 'p-1', workspace_id: 'w-1', repository: 'acme/widgets' },
    { product_id: 'p-2', workspace_id: 'w-1', repository: 'acme/widgets' },
    { product_id: 'p-2', workspace_id: 'w-1', repository: 'acme/api' },
  ],
  products: [{ id: 'p-1', workspace_id: 'w-1', plan_repository: null }, { id: 'p-2', workspace_id: 'w-1', plan_repository: null }],
  product_legal: [{ product_id: 'p-1', code: 'GDPR', number: 2, statement: 'Credentials are never stored in clear.', source: 'https://law.example/32' }],
  product_glossary: [{ product_id: 'p-2', term: 'Quote', meaning: 'What a contractor sends.', avoid: ['estimate'] }],
  constituents: [{ product_id: 'p-1', seq: 6, body: 'Never locks a workspace in.' }],
};

describe('lawHomeOf', () => {
  it('is the plan repository, else the only repository, else none', () => {
    expect(lawHomeOf('Acme/Plan', ['acme/widgets'])).toBe('acme/plan');
    expect(lawHomeOf(null, ['acme/widgets'])).toBe('acme/widgets');
    expect(lawHomeOf(null, ['acme/api', 'acme/widgets'])).toBeNull();
    expect(lawHomeOf(null, [])).toBeNull();
  });
});

describe('knowledgeEmbedStore — as the service role (PRD 2728 s4)', () => {
  it('sources: each workspace keeping the pack, its files, and each live product holding the repository with its rows', async () => {
    const db = dbFetch(ANSWERS);
    const packs = await store(db.fetch).sources('Acme/Widgets', SHA);
    expect(packs).toEqual([
      {
        workspace: 'w-1',
        files: ANSWERS.knowledge_pack_files,
        products: [
          {
            lawHome: true,
            legal: [{ id: 'L-GDPR-2', statement: 'Credentials are never stored in clear.', source: 'https://law.example/32', owner: null }],
            glossary: [],
            never: [{ seq: 6, body: 'Never locks a workspace in.' }],
          },
          { lawHome: false, legal: [], glossary: [{ term: 'Quote', meaning: 'What a contractor sends.', avoid: ['estimate'] }], never: [] },
        ],
      },
      { workspace: 'w-2', files: ANSWERS.knowledge_pack_files, products: [] },
    ]);
    expect(db.calls.every((call) => call.method === 'GET' && call.key === 'service-key')).toBe(true);
  });

  it('sources: reads the pack by its lower-case repository and commit, live products only, and no owner', async () => {
    const db = dbFetch(ANSWERS);
    await store(db.fetch).sources('Acme/Widgets', SHA);
    const search = (path: string) => db.calls.filter((call) => call.path === `/rest/v1/${path}`).map((call) => call.search);
    expect(search('knowledge_packs')).toEqual([expect.stringContaining(`repository=eq.acme/widgets&sha=eq.${SHA}`)]);
    expect(search('knowledge_pack_files').map((s) => /pack_id=eq\.(k-\d)/.exec(s)?.[1])).toEqual(['k-1', 'k-2']);
    expect(search('products')[0]).toContain('archived_at=is.null');
    expect(search('product_legal')[0]).toContain('retired_at=is.null');
    expect(search('product_legal')[0]).not.toContain('owner');
    expect(search('product_glossary')[0]).toContain('removed_at=is.null');
    expect(search('constituents')[0]).toContain('kind=eq.never');
  });

  it('sources: none, and nothing else read, when no workspace keeps the pack', async () => {
    const db = dbFetch({ knowledge_packs: [] });
    expect(await store(db.fetch).sources('acme/widgets', SHA)).toEqual([]);
    expect(db.calls).toHaveLength(1);
  });

  it('missing: calls knowledge_vectors_missing with the workspace, the model and the hashes', async () => {
    const db = dbFetch({ 'rpc/knowledge_vectors_missing': [HASH] });
    expect(await store(db.fetch).missing('w-1', 'gte-small', [HASH, 'b'.repeat(64)])).toEqual([HASH]);
    expect(db.calls).toEqual([expect.objectContaining({ method: 'POST', path: '/rest/v1/rpc/knowledge_vectors_missing', body: { p_workspace: 'w-1', p_model: 'gte-small', p_hashes: [HASH, 'b'.repeat(64)] } })]);
  });

  it('put: calls knowledge_vectors_put with each row\'s hash and vector, and answers how many were new', async () => {
    const db = dbFetch({ 'rpc/knowledge_vectors_put': 1 });
    expect(await store(db.fetch).put('w-1', 'gte-small', [{ sha256: HASH, vector: [0.5, 0.5] }])).toBe(1);
    expect(db.calls).toEqual([expect.objectContaining({ method: 'POST', path: '/rest/v1/rpc/knowledge_vectors_put', body: { p_workspace: 'w-1', p_model: 'gte-small', p_rows: [{ sha256: HASH, vector: [0.5, 0.5] }] } })]);
  });

  it('missing and put: call nothing for an empty list', async () => {
    const db = dbFetch({});
    expect(await store(db.fetch).missing('w-1', 'gte-small', [])).toEqual([]);
    expect(await store(db.fetch).put('w-1', 'gte-small', [])).toBe(0);
    expect(db.calls).toEqual([]);
  });

  it('throws the database\'s refusal with its code, or an answer out of shape', async () => {
    await expect(store(dbFetch({ 'rpc/knowledge_vectors_put': null }).fetch).put('w-1', 'gte-small', [{ sha256: HASH, vector: [1] }])).rejects.toThrow('the database refused: Each vector: 384 numbers. (22023)');
    await expect(store(dbFetch({ 'rpc/knowledge_vectors_missing': null }).fetch).missing('w-1', 'gte-small', [HASH])).rejects.toThrow('(22023)');
    await expect(store(dbFetch({ 'rpc/knowledge_vectors_missing': [1] }).fetch).missing('w-1', 'gte-small', [HASH])).rejects.toThrow();
    await expect(store(dbFetch({ knowledge_packs: null }).fetch).sources('acme/widgets', SHA)).rejects.toThrow('the database refused');
    await expect(store(dbFetch({ knowledge_packs: [{ id: 'k-1' }] }).fetch).sources('acme/widgets', SHA)).rejects.toThrow();
  });
});
