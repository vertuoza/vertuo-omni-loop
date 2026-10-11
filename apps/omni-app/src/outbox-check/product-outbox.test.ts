import { describe, expect, it } from 'vitest';
import { productOutboxReader, productOutboxVerdict, questionsUrl, type ProductOutbox } from './product-outbox.ts';

const MOBILE_12 = { key: 'mobile', seq: 12, id: 'mobile-12' };
const GALAXY = 'https://galaxy.example/';

type Recorded = { table: string; query: URLSearchParams; apikey: string | null };

/** A fetch answering each table's requests, in order, from `tables`; a table with no answer left answers `[]`, a `null` answer a refusal. */
function tablesFetch(tables: Record<string, (unknown[] | null)[]>) {
  const requests: Recorded[] = [];
  const fetch: typeof globalThis.fetch = (input, init = {}) =>
    new Promise((resolve) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const table = url.pathname.replace('/rest/v1/', '');
      requests.push({ table, query: url.searchParams, apikey: new Headers(init.headers).get('apikey') });
      const queue = tables[table] ?? [];
      const answer = queue.length > 0 ? queue.shift() : [];
      resolve(answer === null
        ? new Response(JSON.stringify({ message: 'permission denied', code: '42501' }), { status: 403, headers: { 'content-type': 'application/json' } })
        : new Response(JSON.stringify(answer), { status: 200, headers: { 'content-type': 'application/json' } }));
    });
  return { fetch, requests };
}

const read = (fetch: typeof globalThis.fetch) => productOutboxReader({ url: 'https://db.example', key: 'service-key', fetch });

const TABLES = {
  product_repositories: [[{ product_id: 'p-1', products: { key: 'mobile', name: 'Mobile' } }]],
  dossiers: [[{ id: 'd-1' }]],
  outbox_items: [[
    { item: 's1-01-a', rank: 'high', outbox_settlements: [] },
    { item: 's1-02-b', rank: 'medium', outbox_settlements: [{ verdict: 'adopted' }] },
    { item: 's2-01-c', rank: 'human-action', outbox_settlements: [] },
  ]],
};

describe('productOutboxReader — a product PRD\'s outbox rows, as the service role, never calling Supabase', () => {
  it('finds the PRD through the product holding the pull request\'s repository, and counts the items with no settlement as open', async () => {
    const db = tablesFetch(structuredClone(TABLES));
    expect(await read(db.fetch)('Acme/API', MOBILE_12)).toEqual({
      dossierId: 'd-1',
      productId: 'p-1',
      productName: 'Mobile',
      open: [{ item: 's1-01-a', rank: 'high' }, { item: 's2-01-c', rank: 'human-action' }],
    });
    expect(db.requests.map((r) => r.table)).toEqual(['product_repositories', 'dossiers', 'outbox_items']);
    const [holder, dossier, items] = db.requests;
    expect(holder?.query.get('repository')).toBe('eq.acme/api');
    expect(holder?.query.get('products.key')).toBe('eq.mobile');
    expect(dossier?.query.get('product_id')).toBe('eq.p-1');
    expect(dossier?.query.get('product_seq')).toBe('eq.12');
    expect(dossier?.query.get('kind')).toBe('eq.prd');
    expect(items?.query.get('dossier_id')).toBe('eq.d-1');
    expect(holder?.apikey).toBe('service-key');
  });

  it('reads null when no product keyed so holds the repository, or it has no such PRD, reading nothing more', async () => {
    const none = tablesFetch({ ...structuredClone(TABLES), product_repositories: [[]] });
    expect(await read(none.fetch)('acme/api', MOBILE_12)).toBeNull();
    expect(none.requests.map((r) => r.table)).toEqual(['product_repositories']);
    const noPrd = tablesFetch({ ...structuredClone(TABLES), dossiers: [[]] });
    expect(await read(noPrd.fetch)('acme/api', MOBILE_12)).toBeNull();
    expect(noPrd.requests.map((r) => r.table)).toEqual(['product_repositories', 'dossiers']);
  });

  it('reads an outbox with no item as none open', async () => {
    const db = tablesFetch({ ...structuredClone(TABLES), outbox_items: [[]] });
    expect(await read(db.fetch)('acme/api', MOBILE_12)).toMatchObject({ open: [] });
  });

  it('throws the database\'s refusal, or an answer out of shape', async () => {
    await expect(read(tablesFetch({ ...structuredClone(TABLES), outbox_items: [null] }).fetch)('acme/api', MOBILE_12)).rejects.toThrow('the database refused: permission denied (42501)');
    await expect(read(tablesFetch({ ...structuredClone(TABLES), outbox_items: [[{ item: 's1-01-a', rank: 7 }]] }).fetch)('acme/api', MOBILE_12)).rejects.toThrow();
  });
});

const OUTBOX: ProductOutbox = { dossierId: 'd-1', productId: 'p-1', productName: 'Mobile', open: [] };

describe('productOutboxVerdict — the outbox check of a product PRD\'s target PR (acceptance 7)', () => {
  it('passes with no open item: one gate, on the product', () => {
    const verdict = productOutboxVerdict(MOBILE_12, { reachable: true, outbox: OUTBOX }, GALAXY);
    expect(verdict).toMatchObject({ conclusion: 'success', title: '0 open · one gate on Mobile', detailsUrl: 'https://galaxy.example/app/products/p-1/questions' });
    expect(verdict.summary).toContain('mobile-12');
    expect(verdict.summary).not.toMatch(/plan PR/);
  });

  it('fails while an item is open, sending whoever reads it to the product\'s Questions tab, each open item listed', () => {
    const open = [{ item: 's1-01-a', rank: 'high' }, { item: 's2-01-c', rank: 'human-action' }];
    const verdict = productOutboxVerdict(MOBILE_12, { reachable: true, outbox: { ...OUTBOX, open } }, GALAXY);
    expect(verdict).toMatchObject({ conclusion: 'failure', title: '2 open · answer on Mobile › Questions', detailsUrl: 'https://galaxy.example/app/products/p-1/questions' });
    expect(verdict.summary).toContain('- `s1-01-a` · high');
    expect(verdict.summary).toContain('- `s2-01-c` · human-action');
    expect(verdict.summary).toContain('https://galaxy.example/app/products/p-1/questions');
  });

  it('fails a pull request naming a PRD no product holding this repository has', () => {
    expect(productOutboxVerdict(MOBILE_12, { reachable: true, outbox: null }, GALAXY)).toMatchObject({
      conclusion: 'failure',
      title: 'unknown · no product PRD mobile-12 holds this repository',
      detailsUrl: null,
    });
  });

  it('holds, never fails, when the server cannot be read', () => {
    expect(productOutboxVerdict(MOBILE_12, { reachable: false, since: '2026-10-11T10:05:42.000Z' }, GALAXY)).toMatchObject({
      conclusion: 'neutral',
      title: 'held · server unreachable since 2026-10-11 10:05 UTC · held, not failed',
      detailsUrl: null,
    });
  });

  it('links the product\'s Questions tab under the galaxy, whatever slashes end its address', () => {
    expect(questionsUrl('https://galaxy.example//', 'p 1')).toBe('https://galaxy.example/app/products/p%201/questions');
  });
});
