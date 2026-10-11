import { describe, expect, it } from 'vitest';
import { targetsReader } from './targets.ts';

type Recorded = { table: string; query: URLSearchParams };

/** A fetch answering each table's requests, in order, from `tables`; a table with no answer left answers `[]`, a `null` answer a refusal. */
function tablesFetch(tables: Record<string, (unknown[] | null)[]>) {
  const requests: Recorded[] = [];
  const fetch: typeof globalThis.fetch = (input) =>
    new Promise((resolve) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const table = url.pathname.replace('/rest/v1/', '');
      requests.push({ table, query: url.searchParams });
      const queue = tables[table] ?? [];
      const answer = queue.length > 0 ? queue.shift() : [];
      resolve(answer === null
        ? new Response(JSON.stringify({ message: 'permission denied', code: '42501' }), { status: 403, headers: { 'content-type': 'application/json' } })
        : new Response(JSON.stringify(answer), { status: 200, headers: { 'content-type': 'application/json' } }));
    });
  return { fetch, requests };
}

const read = (fetch: typeof globalThis.fetch) => targetsReader({ url: 'https://db.example', key: 'service-key', fetch });

const DOSSIER = [{ workspace_id: 'w-1', product_id: 'p-1', product_seq: 12 }];
const TABLES = {
  dossiers: [DOSSIER],
  products: [[{ key: 'mobile' }]],
  workspaces: [[{ github_installation_id: 77 }]],
  product_repositories: [[{ repository: 'acme/api' }, { repository: 'acme/mobile' }]],
  pull_requests: [[{ repo: 'acme/api', number: 446 }, { repo: 'acme/mobile', number: 31 }]],
};

describe('targetsReader — a product PRD\'s open target pull requests, from the database, never from GitHub', () => {
  it('reads the PRD\'s id, its workspace\'s installation and the open pull requests of every repository its product holds', async () => {
    const db = tablesFetch(structuredClone(TABLES));
    expect(await read(db.fetch)('d-1')).toEqual({
      prdId: 'mobile-12',
      installationId: 77,
      pulls: [{ repository: 'acme/api', number: 446 }, { repository: 'acme/mobile', number: 31 }],
    });
    const pulls = db.requests.find((r) => r.table === 'pull_requests')?.query;
    expect(pulls?.get('workspace_id')).toBe('eq.w-1');
    expect(pulls?.get('repo')).toBe('in.(acme/api,acme/mobile)');
    expect(pulls?.get('merged_at')).toBe('is.null');
    expect(pulls?.get('closed_at')).toBe('is.null');
    expect(db.requests.find((r) => r.table === 'dossiers')?.query.get('kind')).toBe('eq.prd');
  });

  it('reads null for a dossier that is no product PRD, or none at all, reading nothing more', async () => {
    for (const dossiers of [[], [{ workspace_id: 'w-1', product_id: null, product_seq: null }], [{ workspace_id: 'w-1', product_id: 'p-1', product_seq: null }]]) {
      const db = tablesFetch({ ...structuredClone(TABLES), dossiers: [dossiers] });
      expect(await read(db.fetch)('d-1')).toBeNull();
      expect(db.requests.map((r) => r.table)).toEqual(['dossiers']);
    }
  });

  it('reads null for a product with no key yet, or a workspace with no installation', async () => {
    expect(await read(tablesFetch({ ...structuredClone(TABLES), products: [[{ key: null }]] }).fetch)('d-1')).toBeNull();
    expect(await read(tablesFetch({ ...structuredClone(TABLES), workspaces: [[{ github_installation_id: null }]] }).fetch)('d-1')).toBeNull();
  });

  it('lists no pull request, and reads none, when the product holds no repository', async () => {
    const db = tablesFetch({ ...structuredClone(TABLES), product_repositories: [[]] });
    expect(await read(db.fetch)('d-1')).toEqual({ prdId: 'mobile-12', installationId: 77, pulls: [] });
    expect(db.requests.map((r) => r.table)).not.toContain('pull_requests');
  });

  it('throws the database\'s refusal, or an answer out of shape', async () => {
    await expect(read(tablesFetch({ ...structuredClone(TABLES), pull_requests: [null] }).fetch)('d-1')).rejects.toThrow('the database refused: permission denied (42501)');
    await expect(read(tablesFetch({ ...structuredClone(TABLES), pull_requests: [[{ repo: 'acme/api', number: 'one' }]] }).fetch)('d-1')).rejects.toThrow();
  });
});
