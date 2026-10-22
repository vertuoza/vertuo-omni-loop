import { describe, expect, it } from 'vitest';
import type { RepositoryGraph } from 'omni-loop/kit/lib/knowledge/graph-schema.ts';
import type { ProductGraphRepository, StoredProductRow } from './product-graph.repository';
import { productGraphService } from './product-graph.service';

// The product graph's reader (PRD 1798 s3), over a repository answering as the caller's rows would: the
// latest graph of each `own` link joined with the product's Legal entries, terms and Never lines, read by
// key or by id; the whole graph for the page, a neighbourhood for the route. No test calls Supabase.

const SHA = '9086e70'.padEnd(40, 'a');

const GRAPH: RepositoryGraph = {
  version: 1,
  shape: 'repository',
  nodes: [{ id: 'BR-PRODUCT-3', kind: 'rule', label: 'A quote shows its total.', status: 'law', file: '.omni-loop/knowledge/product/rules.md', origin: 'repository' }],
  edges: [{ from: 'BR-PRODUCT-3', to: 'L-INVOICING-1', kind: 'serves' }],
};

const PRODUCT = { id: 'p1', key: 'omni-loop', name: 'Omni Loop' };

/** A repository holding one product, read as its member; `asked` records the graphs read. */
function repositoryOf({ product = PRODUCT }: { product?: StoredProductRow | null } = {}) {
  const asked: string[] = [];
  const repository: ProductGraphRepository = {
    productByKey: (key) => Promise.resolve(product?.key === key ? product : null),
    productById: (id) => Promise.resolve(product?.id === id ? product : null),
    links: () => Promise.resolve([
      { repository: 'vertuoza/vertuo-omni-loop', knowledge: 'own' as const },
      { repository: 'demo-org/back-end', knowledge: 'own' as const },
      { repository: 'demo-org/design', knowledge: 'imported' as const },
    ]),
    legal: () => Promise.resolve([
      { code: 'INVOICING', number: 1, statement: 'An invoice keeps its number.', retired_at: null },
      { code: 'INVOICING', number: 2, statement: 'A quote expires.', retired_at: '2026-10-01T00:00:00+00:00' },
    ]),
    glossary: () => Promise.resolve([{ term: 'credit note', meaning: 'A document that cancels part of an invoice.', removed_at: null }]),
    never: () => Promise.resolve([{ seq: 3, body: 'Never sell the data.', removed_at: null }, { seq: 1, body: 'Never ship untested.', removed_at: '2026-10-01T00:00:00+00:00' }]),
    latestGraph: (name) => {
      asked.push(name);
      return Promise.resolve(name === 'vertuoza/vertuo-omni-loop'
        ? { sha: SHA, graph: GRAPH, pushed_at: '2026-10-13T14:02:00.123456+00:00', pushed_by_login: 'pierrederval' }
        : null);
    },
  };
  return { repository, asked };
}

describe('productGraphService', () => {
  it('joins the latest graph of each own link with the product’s Legal entries, terms and live Never lines', async () => {
    const { repository, asked } = repositoryOf();
    const read = await productGraphService(repository).graph({ id: 'p1' });
    expect(read?.product).toEqual(PRODUCT);
    expect(read?.graph.nodes.map(({ id }) => id)).toEqual(['L-INVOICING-1', 'term:credit note', 'never#3', 'vertuo-omni-loop/BR-PRODUCT-3']);
    expect(read?.graph.edges).toEqual([{ from: 'vertuo-omni-loop/BR-PRODUCT-3', to: 'L-INVOICING-1', kind: 'serves' }]);
    expect(read?.graph.repositories).toEqual([
      { repo: 'vertuo-omni-loop', commit: SHA, pushedAt: '2026-10-13T14:02:00.123Z', pushedBy: 'pierrederval', graph: 'own' },
      { repo: 'back-end', commit: null, pushedAt: null, pushedBy: null, graph: 'own' },
      { repo: 'design', commit: null, pushedAt: null, pushedBy: null, graph: 'none' },
    ]);
    expect(asked).toEqual(['vertuoza/vertuo-omni-loop', 'demo-org/back-end']);
  });

  it('answers the neighbourhood of a node by the product’s key', async () => {
    const read = await productGraphService(repositoryOf().repository).neighbourhood({ key: 'omni-loop' }, { id: 'L-INVOICING-1', depth: 1 });
    expect(read.kind).toBe('ok');
    if (read.kind !== 'ok') return;
    expect(read.body.product).toEqual({ state: 'server', key: 'omni-loop', cachedOn: null });
    expect(read.body.start).toEqual(['L-INVOICING-1']);
    expect(read.body.nodes.map(({ id, hop }) => [id, hop])).toEqual([['L-INVOICING-1', 0], ['vertuo-omni-loop/BR-PRODUCT-3', 1]]);
  });

  it('answers for no archived product, its owner included (PRD 2232)', async () => {
    const archived = { ...PRODUCT, archived_at: '2026-10-20T08:00:00+00:00' };
    const { repository, asked } = repositoryOf({ product: archived });
    const service = productGraphService(repository);
    expect(await service.neighbourhood({ key: 'omni-loop' }, { id: 'L-INVOICING-1', depth: 1 })).toEqual({ kind: 'archived', name: 'Omni Loop' });
    expect(await service.neighbourhood({ id: 'p1' }, { id: 'L-INVOICING-1', depth: 1 })).toEqual({ kind: 'archived', name: 'Omni Loop' });
    expect(await service.graph({ id: 'p1' })).toBeNull();
    expect(asked).toEqual([]);
  });

  it('reads no product the caller cannot read, and no node the graph does not hold', async () => {
    const service = productGraphService(repositoryOf({ product: null }).repository);
    expect(await service.graph({ id: 'p1' })).toBeNull();
    expect(await service.neighbourhood({ key: 'omni-loop' }, { id: 'L-INVOICING-1', depth: 1 })).toEqual({ kind: 'no-product' });
    const known = productGraphService(repositoryOf().repository);
    expect(await known.neighbourhood({ key: 'omni-loop' }, { id: 'L-INVOICING-2', depth: 1 })).toEqual({ kind: 'no-node', matches: [] });
    expect(await known.neighbourhood({ key: 'omni-loop' }, { id: 'never#1', depth: 1 })).toEqual({ kind: 'no-node', matches: [] });
    expect(await known.neighbourhood({ key: 'omni-loop' }, { id: 'BR-PRODUCT-3', depth: 1 })).toEqual({ kind: 'no-node', matches: ['vertuo-omni-loop/BR-PRODUCT-3'] });
  });
});
