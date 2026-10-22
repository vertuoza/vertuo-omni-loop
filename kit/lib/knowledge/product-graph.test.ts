// PRD 1798, slice s3: a product's knowledge graph as the server answers it, at version 2. Version 1's
// fields, plus `repo` on each node, `unresolved`, `repositories`, the kind `never` and the state
// `server`; strict, so an unknown field is refused.
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { NeighbourhoodEdge, NeighbourhoodNode } from './neighbourhood.ts';
import {
  PRODUCT_GRAPH_DEPTH,
  PRODUCT_GRAPH_VERSION,
  ProductNeighbourhoodSchema,
  type ProductGraphEdge,
  type ProductGraphNode,
  type ProductNeighbourhood,
} from './product-graph.ts';

const SHA = '9086e70'.padEnd(40, 'a');

const ANSWER: ProductNeighbourhood = {
  version: 2,
  shape: 'neighbourhood',
  repo: null,
  start: ['L-INVOICING-1'],
  depth: 2,
  product: { state: 'server', key: 'omni-loop', cachedOn: null },
  nodes: [
    { id: 'L-INVOICING-1', kind: 'legal', label: 'An invoice keeps its number.', status: null, file: null, origin: 'product', hop: 0, repo: null },
    { id: 'vertuo-omni-loop/BR-PRODUCT-3', kind: 'rule', label: 'A quote shows its total.', status: 'law', file: '.omni-loop/knowledge/product/rules.md', origin: 'repository', hop: 1, repo: 'vertuo-omni-loop' },
    { id: 'never#3', kind: 'never', label: 'Never sell the data.', status: null, file: null, origin: 'product', hop: 0, repo: null },
  ],
  edges: [{ from: 'vertuo-omni-loop/BR-PRODUCT-3', to: 'L-INVOICING-1', kind: 'serves' }],
  unresolved: [{ repo: 'back-end', node: 'back-end/BR-INVOICE-2', id: 'L-INVOICING-9' }],
  repositories: [
    { repo: 'vertuo-omni-loop', commit: SHA, pushedAt: '2026-10-13T14:02:00.000Z', pushedBy: 'pierrederval', graph: 'own' },
    { repo: 'back-end', commit: null, pushedAt: null, pushedBy: null, graph: 'own' },
    { repo: 'design', commit: null, pushedAt: null, pushedBy: null, graph: 'none' },
  ],
};

describe('ProductNeighbourhoodSchema', () => {
  it('reads the server’s answer at version 2, unchanged', () => {
    expect(PRODUCT_GRAPH_VERSION).toBe(2);
    expect(ProductNeighbourhoodSchema.parse(ANSWER)).toEqual(ANSWER);
  });

  it('refuses version 1, an unknown field, a node without its repository and an unknown state', () => {
    const refused = (answer: unknown) => !ProductNeighbourhoodSchema.safeParse(answer).success;
    expect(refused({ ...ANSWER, version: 1 })).toBe(true);
    expect(refused({ ...ANSWER, extra: true })).toBe(true);
    const withoutRepo = { id: 'L-INVOICING-1', kind: 'legal', label: null, status: null, file: null, origin: 'product', hop: 0 };
    expect(refused({ ...ANSWER, nodes: [withoutRepo] })).toBe(true);
    expect(refused({ ...ANSWER, nodes: [{ ...withoutRepo, repo: null }] })).toBe(false);
    expect(refused({ ...ANSWER, product: { ...ANSWER.product, state: 'stale' } })).toBe(true);
    expect(refused({ ...ANSWER, repositories: [{ ...ANSWER.repositories[0], commit: '9086e70' }] })).toBe(true);
    expect(refused({ ...ANSWER, unresolved: [{ repo: 'back-end', node: 'back-end/BR-INVOICE-2' }] })).toBe(true);
  });

  it('takes a depth of 1 to 3', () => {
    expect(PRODUCT_GRAPH_DEPTH).toEqual({ fallback: 1, most: 3 });
    for (const depth of [1, 3]) expect(ProductNeighbourhoodSchema.safeParse({ ...ANSWER, depth }).success).toBe(true);
    for (const depth of [0, 4, 1.5]) expect(ProductNeighbourhoodSchema.safeParse({ ...ANSWER, depth }).success).toBe(false);
  });

  it('keeps version 1’s node and edge: a version 2 node is one with its repository', () => {
    expectTypeOf<NeighbourhoodNode>().toExtend<Omit<ProductGraphNode, 'repo'>>();
    expectTypeOf<NeighbourhoodEdge>().toEqualTypeOf<ProductGraphEdge>();
  });
});
