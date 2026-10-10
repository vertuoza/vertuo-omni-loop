import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { productRepositoriesRepository } from './product-repositories.repository';

// The product links' reads (PRD 1364, s4), on a stubbed Supabase client: which table each reads with
// which filter, the rows it parses, and a failed or out-of-shape read thrown.

type Raw = { data: unknown; error: { message: string } | null };

function stub(answers: Record<string, Raw>) {
  const reads: string[] = [];
  const client = {
    from: (table: string) => {
      const steps: string[] = [table];
      const answer = () => answers[table] ?? { data: null, error: { message: `no stub for ${table}` } };
      const chain = {
        select: (columns: string) => { steps.push(`select ${columns}`); return chain; },
        eq: (column: string, value: string) => { steps.push(`${column}=${value}`); return chain; },
        in: (column: string, values: string[]) => { steps.push(`${column} in ${values.join(',')}`); return chain; },
        order: (column: string) => { steps.push(`order ${column}`); return chain; },
        then: (resolve: (raw: Raw) => unknown) => { reads.push(steps.join(' · ')); return Promise.resolve(answer()).then(resolve); },
      };
      return chain;
    },
  };
  return { db: client as unknown as Pick<SupabaseClient, 'from'>, reads };
}

const LINK = { repository: 'acme/api', role: 'api', knowledge: 'own', read_at: null, read_only: false, consumes: [] };

describe('productRepositoriesRepository', () => {
  it('reads the workspaces listing a repository, their products and one product’s links', async () => {
    const s = stub({
      repositories: { data: [{ workspace_id: 'w1' }], error: null },
      products: { data: [{ id: 'p1', workspace_id: 'w1', name: 'Mobile' }], error: null },
      product_repositories: { data: [LINK], error: null },
    });
    const store = productRepositoriesRepository(s.db);
    expect(await store.workspacesListing('acme/plan')).toEqual(['w1']);
    expect(await store.products(['w1'])).toEqual([{ id: 'p1', workspace_id: 'w1', name: 'Mobile' }]);
    expect(await store.links('p1')).toEqual([LINK]);
    expect(s.reads).toEqual([
      'repositories · select workspace_id · full_name=acme/plan',
      'products · select id, workspace_id, name · workspace_id in w1',
      'product_repositories · select repository, role, knowledge, read_at, read_only, consumes · product_id=p1 · order repository',
    ]);
  });

  it('throws on a failed read, naming it, and on rows out of shape', async () => {
    const failed = productRepositoriesRepository(stub({}).db);
    await expect(failed.workspacesListing('acme/plan')).rejects.toThrow('read the workspaces of acme/plan: no stub for repositories');
    await expect(failed.products(['w1'])).rejects.toThrow('read the products: no stub for products');
    await expect(failed.links('p1')).rejects.toThrow('read the links of the product: no stub for product_repositories');
    const odd = productRepositoriesRepository(stub({ product_repositories: { data: [{ ...LINK, knowledge: 'copied' }], error: null } }).db);
    await expect(odd.links('p1')).rejects.toThrow();
  });
});
