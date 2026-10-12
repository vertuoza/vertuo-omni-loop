import { describe, expect, it } from 'vitest';
import { productsRepository, type ProductsDb } from './products.repository';

// The products' storage (PRD 1364 s8), on a stubbed client (no test calls Supabase): each read's table,
// columns and filters, what it answers parsed, and a refusal or an answer out of shape thrown.

type Answer = { data?: unknown; error?: { message: string } | null };

function stub(answers: Record<string, Answer>) {
  const calls: unknown[][] = [];
  const query = (table: string) => {
    const answer = answers[table] ?? { data: [] };
    const q = {
      select: (...a: unknown[]) => { calls.push([table, 'select', ...a]); return q; },
      eq: (...a: unknown[]) => { calls.push([table, 'eq', ...a]); return q; },
      not: (...a: unknown[]) => { calls.push([table, 'not', ...a]); return q; },
      order: (...a: unknown[]) => { calls.push([table, 'order', ...a]); return q; },
      then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) =>
        Promise.resolve({ data: answer.data ?? null, error: answer.error ?? null }).then(ok, ko),
    };
    return q;
  };
  const db = {
    from: (table: string) => query(table),
    rpc: (fn: string) => { calls.push([fn, 'rpc']); return query(fn); },
  };
  return { calls, repo: productsRepository(db as unknown as ProductsDb) };
}

describe('the products\' storage', () => {
  it('reads the workspace\'s products first first, with the columns Settings › Products reads', async () => {
    const { calls, repo } = stub({ products: { data: [{ id: 'p-1', name: 'Mobile', pitch_look: null, pitch: null }] } });
    expect(await repo.products('ws-1')).toEqual([{ id: 'p-1', name: 'Mobile', pitch_look: null, pitch: null }]);
    expect(calls).toEqual([['products', 'select', 'id, name, pitch_look, pitch'], ['products', 'eq', 'workspace_id', 'ws-1'], ['products', 'order', 'ordinal']]);
  });

  it('reads the workspace\'s links, its repositories and its dossiers that carry a product', async () => {
    const { calls, repo } = stub({
      product_repositories: { data: [{ product_id: 'p-1', repository: 'vertuo/api', role: 'api' }] },
      repositories: { data: [{ full_name: 'vertuo/api' }] },
      dossiers: { data: [{ id: 'd-1', kind: 'prd', product_id: 'p-1' }] },
    });
    expect(await repo.links('ws-1')).toEqual([{ product_id: 'p-1', repository: 'vertuo/api' }]);
    expect(await repo.repositories('ws-1')).toEqual(['vertuo/api']);
    expect(await repo.productDossiers('ws-1')).toEqual([{ id: 'd-1', kind: 'prd', product_id: 'p-1' }]);
    expect(calls).toEqual([
      ['product_repositories', 'select', 'product_id, repository'], ['product_repositories', 'eq', 'workspace_id', 'ws-1'],
      ['repositories', 'select', 'full_name'], ['repositories', 'eq', 'workspace_id', 'ws-1'],
      ['dossiers', 'select', 'id, kind, product_id'], ['dossiers', 'not', 'product_id', 'is', null], ['dossiers', 'eq', 'workspace_id', 'ws-1'],
    ]);
  });

  it('reads the dossiers whose approval waits on the caller', async () => {
    const { calls, repo } = stub({ approval_requests_waiting: { data: [{ id: 'r-1', dossier: 'd-1', repo: 'vertuo/api', prd: 7, title: 'T', askedAt: '2026-10-01T00:00:00Z' }] } });
    expect(await repo.waitingDossiers()).toEqual(['d-1']);
    expect(calls).toEqual([['approval_requests_waiting', 'rpc']]);
  });

  it('throws on a refusal, naming the read', async () => {
    const { repo } = stub({ product_repositories: { error: { message: 'permission denied' } } });
    await expect(repo.links('ws-1')).rejects.toThrow('could not read the products\' repositories (permission denied)');
  });

  it('throws on an answer out of shape', async () => {
    const { repo } = stub({ dossiers: { data: [{ id: 'd-1', kind: 'prd', product_id: null }] } });
    await expect(repo.productDossiers('ws-1')).rejects.toThrow();
  });
});
