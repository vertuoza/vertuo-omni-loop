import { describe, expect, it } from 'vitest';
import type { RepositoryGraph } from 'vertuo-omni-plan/kit/lib/knowledge/graph-schema.ts';
import { productGraphRepository, type ProductGraphDb } from './product-graph.repository';

// The product graph's reads (PRD 1798 s3), on a stubbed Supabase client acting as the caller: which table
// each reads with which filter, the rows it parses (a stored graph by the kit's own schema), a failed or
// out-of-shape read thrown. No test calls Supabase.

type Raw = { data: unknown; error: { message: string } | null };

const SHA = 'a'.repeat(40);
const GRAPH: RepositoryGraph = { version: 1, shape: 'repository', nodes: [], edges: [] };

function stub(answers: Record<string, Raw>) {
  const reads: string[] = [];
  const client = {
    from: (table: string) => {
      const steps: string[] = [table];
      const answer = () => answers[table] ?? { data: null, error: { message: `no stub for ${table}` } };
      const chain = {
        select: (columns: string) => { steps.push(`select ${columns}`); return chain; },
        eq: (column: string, value: string) => { steps.push(`${column}=${value}`); return chain; },
        order: (column: string, options?: { ascending?: boolean }) => { steps.push(`order ${column}${options?.ascending === false ? ' desc' : ''}`); return chain; },
        limit: (count: number) => { steps.push(`limit ${String(count)}`); return chain; },
        then: (resolve: (raw: Raw) => unknown) => { reads.push(steps.join(' · ')); return Promise.resolve(answer()).then(resolve); },
      };
      return chain;
    },
  };
  return { db: client as unknown as ProductGraphDb, reads };
}

const PRODUCT = { id: 'p1', key: 'omni-loop', name: 'Omni Loop' };

describe('productGraphRepository', () => {
  it('reads a product by its key, the oldest first when two workspaces hold it, and by its id', async () => {
    const s = stub({ products: { data: [PRODUCT], error: null } });
    const store = productGraphRepository(s.db);
    expect(await store.productByKey('omni-loop')).toEqual(PRODUCT);
    expect(await store.productById('p1')).toEqual(PRODUCT);
    expect(s.reads).toEqual([
      'products · select id, key, name · key=omni-loop · order created_at · order id · limit 1',
      'products · select id, key, name · id=p1 · limit 1',
    ]);
    expect(await productGraphRepository(stub({ products: { data: [], error: null } }).db).productByKey('omni-loop')).toBeNull();
  });

  it('reads the product’s links, its Legal entries, its terms and its Never lines', async () => {
    const s = stub({
      product_repositories: { data: [{ repository: 'acme/api', knowledge: 'own' }], error: null },
      product_legal: { data: [{ code: 'INVOICING', number: 1, statement: 'An invoice keeps its number.', retired_at: null }], error: null },
      product_glossary: { data: [{ term: 'credit note', meaning: 'A document.', removed_at: '2026-10-01T00:00:00Z' }], error: null },
      constituents: { data: [{ seq: 3, body: 'Never sell the data.', removed_at: null }], error: null },
    });
    const store = productGraphRepository(s.db);
    expect(await store.links('p1')).toEqual([{ repository: 'acme/api', knowledge: 'own' }]);
    expect(await store.legal('p1')).toEqual([{ code: 'INVOICING', number: 1, statement: 'An invoice keeps its number.', retired_at: null }]);
    expect(await store.glossary('p1')).toEqual([{ term: 'credit note', meaning: 'A document.', removed_at: '2026-10-01T00:00:00Z' }]);
    expect(await store.never('p1')).toEqual([{ seq: 3, body: 'Never sell the data.', removed_at: null }]);
    expect(s.reads).toEqual([
      'product_repositories · select repository, knowledge · product_id=p1 · order repository',
      'product_legal · select code, number, statement, retired_at · product_id=p1 · order code · order number',
      'product_glossary · select term, meaning, removed_at · product_id=p1 · order term',
      'constituents · select seq, body, removed_at · product_id=p1 · kind=never · order seq',
    ]);
  });

  it('reads the latest pushed graph of a repository, by its kit’s schema, or none', async () => {
    const row = { sha: SHA, graph: GRAPH, pushed_at: '2026-10-13T14:02:00+00:00', pushed_by_login: 'pierrederval' };
    const s = stub({ knowledge_graphs: { data: [row], error: null } });
    expect(await productGraphRepository(s.db).latestGraph('acme/api')).toEqual(row);
    expect(s.reads).toEqual(['knowledge_graphs · select sha, graph, pushed_at, pushed_by_login · repository=acme/api · order pushed_at desc · limit 1']);
    expect(await productGraphRepository(stub({ knowledge_graphs: { data: [], error: null } }).db).latestGraph('acme/api')).toBeNull();
    const odd = stub({ knowledge_graphs: { data: [{ ...row, graph: { ...GRAPH, extra: true } }], error: null } });
    await expect(productGraphRepository(odd.db).latestGraph('acme/api')).rejects.toThrow('knowledge-graph: knowledge_graphs');
  });

  it('throws on a failed read, naming it', async () => {
    const failed = productGraphRepository(stub({}).db);
    await expect(failed.productByKey('omni-loop')).rejects.toThrow('read the product omni-loop: no stub for products');
    await expect(failed.productById('p1')).rejects.toThrow('read the product p1: no stub for products');
    await expect(failed.links('p1')).rejects.toThrow('read the links of the product: no stub for product_repositories');
    await expect(failed.legal('p1')).rejects.toThrow('read the Legal entries of the product: no stub for product_legal');
    await expect(failed.glossary('p1')).rejects.toThrow('read the glossary of the product: no stub for product_glossary');
    await expect(failed.never('p1')).rejects.toThrow('read the Never lines of the product: no stub for constituents');
    await expect(failed.latestGraph('acme/api')).rejects.toThrow('read the graph of acme/api: no stub for knowledge_graphs');
  });
});
