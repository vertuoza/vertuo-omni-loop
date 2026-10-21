// The raises the budgets check reads (PRD 1679 s3): a product PRD's outbox rows as the service role,
// never calling Supabase, and what reading them gives when it cannot.
import { describe, expect, it } from 'vitest';
import { parseConfig } from 'omni-loop/kit/lib/config.ts';
import { createContext } from 'omni-loop/kit/lib/context.ts';
import { parsePrd, parseProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import { raiseLine } from 'omni-loop/kit/lib/budgets/ratchet.ts';
import { makeRepo } from 'omni-loop/kit/test/fixture.ts';
import { outboxRowsReader, raisesFor, type OutboxRowsReader } from './raises.ts';

const MOBILE_12 = parseProductPrdId('mobile-12');

/** A fetch answering each table's requests, in order, from `tables`; a `null` answer a refusal. */
function tablesFetch(tables: Record<string, (unknown[] | null)[]>) {
  const requests: { table: string; query: URLSearchParams }[] = [];
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

const read = (fetch: typeof globalThis.fetch) => outboxRowsReader({ url: 'https://db.example', key: 'service-key', fetch });

const item = (ceiling: number) => `---\nid: s1-01-raise\nrank: high\n---\n\n${raiseLine('form:testing', ceiling)}\n`;

describe('outboxRowsReader — a product PRD\'s outbox rows, each with its latest settlement', () => {
  it('reads the PRD through the product holding the repository, and keeps the latest settlement of each item', async () => {
    const db = tablesFetch({
      product_repositories: [[{ product_id: 'p-1' }]],
      dossiers: [[{ id: 'd-1' }]],
      outbox_items: [[
        { item: 's1-01-raise', rank: 'high', body: item(4096), outbox_settlements: [
          { verdict: 'drifted', basis: 'first', settled_at: '2026-10-11T10:00:00Z' },
          { verdict: 'agreed', basis: 'second', settled_at: '2026-10-12T10:00:00Z' },
        ] },
        { item: 's1-02-open', rank: 'medium', body: 'open', outbox_settlements: [] },
      ]],
    });
    expect(await read(db.fetch)('Acme/Widgets', MOBILE_12)).toEqual({
      prdId: 'mobile-12',
      items: [
        { item: 's1-01-raise', rank: 'high', body: item(4096), settlement: { verdict: 'agreed', basis: 'second', settledAt: '2026-10-12T10:00:00Z' } },
        { item: 's1-02-open', rank: 'medium', body: 'open', settlement: null },
      ],
    });
    const [holder, dossier, items] = db.requests;
    expect(holder?.query.get('repository')).toBe('eq.acme/widgets');
    expect(holder?.query.get('products.key')).toBe('eq.mobile');
    expect(dossier?.query.get('product_seq')).toBe('eq.12');
    expect(items?.query.get('dossier_id')).toBe('eq.d-1');
  });

  it('reads no item when no product keyed so holds the repository, or it has no such PRD', async () => {
    expect(await read(tablesFetch({ product_repositories: [[]] }).fetch)('acme/widgets', MOBILE_12)).toEqual({ prdId: 'mobile-12', items: [] });
    const noPrd = tablesFetch({ product_repositories: [[{ product_id: 'p-1' }]], dossiers: [[]] });
    expect(await read(noPrd.fetch)('acme/widgets', MOBILE_12)).toEqual({ prdId: 'mobile-12', items: [] });
    expect(noPrd.requests.map(({ table }) => table)).toEqual(['product_repositories', 'dossiers']);
  });

  it('throws when the database refuses', async () => {
    await expect(read(tablesFetch({ product_repositories: [null] }).fetch)('acme/widgets', MOBILE_12)).rejects.toThrow('the database refused');
  });
});

describe('raisesFor — the raises a person said yes to', () => {
  const ctx = createContext(makeRepo().root, parseConfig('kit: 1\nrepo:\n  slug: acme/widgets\n', '.omni-loop/config.yml'));
  const rows = (verdict: string): OutboxRowsReader => () =>
    Promise.resolve({ prdId: 'mobile-12', items: [{ item: 's1-01-raise', rank: 'high', body: item(4096), settlement: { verdict, basis: 'b', settledAt: '2026-10-12T10:00:00Z' } }] });

  it('reads a product PRD\'s agreed raise from its rows, and none from a drifted one', async () => {
    const log: string[] = [];
    const given = { ctx, prd: MOBILE_12, repository: 'acme/widgets', log: (line: string) => log.push(line) };
    expect(await raisesFor({ ...given, readOutboxRows: rows('agreed') })).toEqual([{ id: 's1-01-raise', target: 'form:testing', ceiling: 4096 }]);
    expect(await raisesFor({ ...given, readOutboxRows: rows('drifted') })).toEqual([]);
    expect(log).toEqual([]);
  });

  it('reads none without a PRD, and none, said in the log, when the rows cannot be read', async () => {
    const log: string[] = [];
    expect(await raisesFor({ ctx, prd: null, repository: 'acme/widgets', readOutboxRows: rows('agreed'), log: (line) => log.push(line) })).toEqual([]);
    const refused: OutboxRowsReader = () => Promise.reject(new Error('the database refused: no'));
    expect(await raisesFor({ ctx, prd: MOBILE_12, repository: 'acme/widgets', readOutboxRows: refused, log: (line) => log.push(line) })).toEqual([]);
    expect(log.join('\n')).toContain('the raises of PRD mobile-12 could not be read');
  });

  it('reads none of a repository\'s PRD that has no ledger', async () => {
    expect(await raisesFor({ ctx, prd: parsePrd(7), repository: 'acme/widgets', readOutboxRows: null, log: () => undefined })).toEqual([]);
  });
});
