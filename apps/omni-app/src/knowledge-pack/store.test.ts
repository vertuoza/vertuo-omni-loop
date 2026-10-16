import { describe, expect, it } from 'vitest';
import { knowledgePackStore } from './store.ts';

type Call = { method: string; path: string; search: string; body: unknown; key: string | null };

/** A fetch answering every call with `answer` (status 200), or Postgres's refusal when `answer` is null. */
function dbFetch(answer: unknown) {
  const calls: Call[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(String(input), init);
    const url = new URL(request.url);
    const text = request.method === 'GET' ? '' : await request.text();
    calls.push({ method: request.method, path: url.pathname, search: decodeURIComponent(url.search), body: text ? JSON.parse(text) : null, key: request.headers.get('apikey') });
    return answer === null
      ? new Response(JSON.stringify({ message: 'Path: ../x may not leave the pack\'s folder.', code: '22023' }), { status: 400, headers: { 'content-type': 'application/json' } })
      : new Response(JSON.stringify(answer), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return { fetch, calls };
}

const store = (fetch: typeof globalThis.fetch) => knowledgePackStore({ url: 'https://db.example', key: 'service-key', fetch });

const SHA = 'a'.repeat(40);
const FILE = { path: '.omni-loop/knowledge/a.md', content: 'a\n', sha256: 'b'.repeat(64) };

describe('knowledgePackStore — as the service role (PRD 2011 s11)', () => {
  it('held: reads whether a product holds the repository, by its lower-case name', async () => {
    const db = dbFetch([{ product_id: 'p-1' }]);
    expect(await store(db.fetch).held('Acme/API')).toBe(true);
    expect(db.calls).toEqual([expect.objectContaining({ method: 'GET', path: '/rest/v1/product_repositories', key: 'service-key' })]);
    expect(db.calls[0]?.search).toContain('repository=eq.acme/api');
  });

  it('held: false when no product holds it', async () => {
    expect(await store(dbFetch([]).fetch).held('acme/api')).toBe(false);
  });

  it('put: calls knowledge_pack_put with the repository, the commit, its date and each file with its sha256', async () => {
    const answer = { repository: 'acme/api', sha: SHA, packs: [{ workspace: 'w-1', packId: 'k-1', created: true, newest: true, files: 1 }] };
    const db = dbFetch(answer);
    expect(await store(db.fetch).put({ repository: 'acme/api', sha: SHA, committedAt: '2026-10-16T09:00:00Z', files: [FILE] })).toEqual(answer);
    expect(db.calls).toEqual([{
      method: 'POST',
      path: '/rest/v1/rpc/knowledge_pack_put',
      search: '',
      body: { p_repo: 'acme/api', p_sha: SHA, p_committed_at: '2026-10-16T09:00:00Z', p_files: [FILE] },
      key: 'service-key',
    }]);
  });

  it('put: throws the database\'s refusal with its code', async () => {
    await expect(store(dbFetch(null).fetch).put({ repository: 'acme/api', sha: SHA, committedAt: '2026-10-16T09:00:00Z', files: [FILE] }))
      .rejects.toThrow("the database refused: Path: ../x may not leave the pack's folder. (22023)");
  });

  it('held and put: throw on a refusal or an answer out of shape', async () => {
    await expect(store(dbFetch(null).fetch).held('acme/api')).rejects.toThrow('the database refused');
    for (const answer of ['nothing', {}, { repository: 'acme/api', sha: 'short', packs: [] }, { repository: 'acme/api', sha: SHA, packs: [{ workspace: 'w-1' }] }]) {
      await expect(store(dbFetch(answer).fetch).put({ repository: 'acme/api', sha: SHA, committedAt: '2026-10-16T09:00:00Z', files: [] })).rejects.toThrow();
    }
  });
});
