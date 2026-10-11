import { describe, expect, it } from 'vitest';
import { DraftStoreError } from './run';
import { draftStore } from './store';
import { sure } from '../../arcade/test/sure';

// The draft's store against a fake Supabase client: which function of the migration each write calls,
// with which arguments, and a refusal carried with its code. Never Supabase itself.

function fakeDb(answers: Record<string, { data: unknown; error?: { code: string; message: string } }>) {
  const rpcs: Array<[string, Record<string, unknown>]> = [];
  const reads: Array<{ table: string; filters: Array<[string, unknown]> }> = [];
  const db = {
    rpc(fn: string, args: Record<string, unknown>) {
      rpcs.push([fn, args]);
      const a = answers[fn] ?? { data: null };
      return Promise.resolve({ data: a.data, error: a.error ?? null });
    },
    from(table: string) {
      const read = { table, filters: [] as Array<[string, unknown]> };
      reads.push(read);
      const a = answers[table] ?? { data: [] };
      const answer = { data: a.data, error: a.error ?? null };
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: (col: string, v: unknown) => { read.filters.push([col, v]); return chain; },
        order: () => chain,
        limit: () => chain,
        maybeSingle: () => Promise.resolve(answer),
        then: (ok: (v: unknown) => unknown, no: (e: unknown) => unknown) => Promise.resolve(answer).then(ok, no),
      };
      return chain;
    },
  };
  return { db: db as never, rpcs, reads };
}

describe('draftStore', () => {
  it('proposes a claim through claim_propose_evidence and reads its outcome', async () => {
    const { db, rpcs } = fakeDb({ claim_propose_evidence: { data: { outcome: 'replacing', id: 'offering#4' } } });
    const receipts = [{ kind: 'file' as const, where: 'acme/app/README.md', quote: 'the ERP' }];
    expect(await draftStore(db).propose('ws-1', 'p-1', 'offering', 'CRM', receipts)).toBe('replacing');
    expect(rpcs).toEqual([['claim_propose_evidence', { p_workspace: 'ws-1', p_product: 'p-1', p_kind: 'offering', p_value: 'CRM', p_receipts: receipts }]]);
  });

  it('starts, progresses and finishes a draft through the migration\'s functions', async () => {
    const { db, rpcs } = fakeDb({ business_draft_start: { data: { id: 'd-1', kind: 'draft', state: 'running', started_at: '2026-09-30T10:00:00Z', finished_at: null, counts: {}, scanned: [], reason: null } } });
    const store = draftStore(db);
    expect((await store.start('ws-1', 'draft')).id).toBe('d-1');
    await store.progress('ws-1', 'd-1', { readmes: 1 } as never, [{ source: 'app · README.md', state: 'read' }]);
    await store.finish('ws-1', 'd-1', 'failed', {} as never, [], 'why');
    expect(rpcs.map(([fn]) => fn)).toEqual(['business_draft_start', 'business_draft_progress', 'business_draft_finish']);
    expect(sure(rpcs[2], 'rpcs[2]')[1]).toEqual({ p_workspace: 'ws-1', p_draft: 'd-1', p_state: 'failed', p_counts: {}, p_scanned: [], p_reason: 'why' });
  });

  it('carries a refusal with its code', async () => {
    const { db } = fakeDb({ business_source_add: { data: null, error: { code: '22023', message: 'Web page: three at most. Remove one first.' } } });
    const error = await draftStore(db).add('ws-1', 'https://acme.com').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DraftStoreError);
    expect((error as DraftStoreError).code).toBe('22023');
  });

  it('reads only the tracked repositories, each with its only product, and the first product', async () => {
    const { db, reads } = fakeDb({
      repositories: { data: [{ full_name: 'acme/api' }, { full_name: 'acme/app' }, { full_name: 'acme/web' }] },
      // Its products are its links (PRD 1364): acme/app is in one, acme/web in two, acme/api in none.
      product_repositories: { data: [
        { product_id: 'p-1', repository: 'acme/app' }, { product_id: 'p-1', repository: 'acme/web' }, { product_id: 'p-2', repository: 'acme/web' },
      ] },
      products: { data: [{ id: 'p-1' }] },
    });
    const store = draftStore(db);
    expect(await store.repositories('ws-1')).toEqual([
      { full_name: 'acme/api', product_id: null }, { full_name: 'acme/app', product_id: 'p-1' }, { full_name: 'acme/web', product_id: null },
    ]);
    expect(await store.firstProduct('ws-1')).toBe('p-1');
    expect(reads.map((r) => r.table).slice(0, 2)).toEqual(['repositories', 'product_repositories']);
    expect(sure(reads[0], 'reads[0]').filters).toEqual([['workspace_id', 'ws-1'], ['tracked', true]]);
    expect(sure(reads[1], 'reads[1]').filters).toEqual([['workspace_id', 'ws-1']]);
  });
});
