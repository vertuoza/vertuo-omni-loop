import { describe, expect, it } from 'vitest';
import { productFilterRepository, type ProductFilterDb } from './product-filter.repository';

// The product filter's storage (PRD 1364 s12), on a stubbed client (no test calls Supabase): each read's
// table, columns and filters, what it answers parsed, and a refusal or an answer out of shape thrown.

type Answer = { data?: unknown; error?: { message: string } | null };

function stub(answers: Record<string, Answer>) {
  const calls: unknown[][] = [];
  const query = (table: string) => {
    const answer = answers[table] ?? { data: [] };
    const q = {
      select: (...a: unknown[]) => { calls.push([table, 'select', ...a]); return q; },
      eq: (...a: unknown[]) => { calls.push([table, 'eq', ...a]); return q; },
      in: (...a: unknown[]) => { calls.push([table, 'in', ...a]); return q; },
      not: (...a: unknown[]) => { calls.push([table, 'not', ...a]); return q; },
      order: (...a: unknown[]) => { calls.push([table, 'order', ...a]); return q; },
      then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) =>
        Promise.resolve({ data: answer.data ?? null, error: answer.error ?? null }).then(ok, ko),
    };
    return q;
  };
  return { calls, repo: productFilterRepository({ from: (table: string) => query(table) } as unknown as ProductFilterDb) };
}

describe('the product filter\'s storage', () => {
  it('reads the listed workspaces\' products, first first', async () => {
    const { calls, repo } = stub({ products: { data: [{ id: 'p-1', name: 'Mobile', workspace_id: 'ws-1' }] } });
    expect(await repo.products(['ws-1', 'ws-2'])).toEqual([{ id: 'p-1', name: 'Mobile', workspace_id: 'ws-1' }]);
    expect(calls).toEqual([
      ['products', 'select', 'id, name, workspace_id'], ['products', 'order', 'ordinal'], ['products', 'in', 'workspace_id', ['ws-1', 'ws-2']],
    ]);
  });

  it('reads only the dossiers that carry a product, by id', async () => {
    const { calls, repo } = stub({ dossiers: { data: [{ id: 'd-1', product_id: 'p-1' }] } });
    expect(await repo.dossierProducts(['ws-1'])).toEqual(new Map([['d-1', 'p-1']]));
    expect(calls).toEqual([['dossiers', 'select', 'id, product_id'], ['dossiers', 'not', 'product_id', 'is', null], ['dossiers', 'in', 'workspace_id', ['ws-1']]]);
  });

  it('reads a board\'s workspaces and its ideas that carry a product', async () => {
    const { calls, repo } = stub({
      repositories: { data: [{ workspace_id: 'ws-1' }] },
      ideas: { data: [{ id: 'i-1', product_id: 'p-1' }] },
    });
    expect(await repo.boardWorkspaces('vertuo/app')).toEqual(['ws-1']);
    expect(await repo.ideaProducts('vertuo/app')).toEqual(new Map([['i-1', 'p-1']]));
    expect(calls).toEqual([
      ['repositories', 'select', 'workspace_id'], ['repositories', 'eq', 'full_name', 'vertuo/app'],
      ['ideas', 'select', 'id, product_id'], ['ideas', 'not', 'product_id', 'is', null], ['ideas', 'eq', 'repo', 'vertuo/app'],
    ]);
  });

  it('throws on a refusal, naming the read', async () => {
    const { repo } = stub({ products: { error: { message: 'denied' } }, dossiers: { error: { message: 'denied' } } });
    await expect(repo.products(['ws-1'])).rejects.toThrow('could not read the products (denied)');
    await expect(repo.dossierProducts(['ws-1'])).rejects.toThrow('could not read the dossiers\' products (denied)');
  });

  it('throws on an answer out of shape', async () => {
    const { repo } = stub({ ideas: { data: [{ id: 'i-1' }] } });
    await expect(repo.ideaProducts('vertuo/app')).rejects.toThrow();
  });
});
