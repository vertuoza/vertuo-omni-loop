// PRD 1798, slice s1: the schema of a repository's whole graph as `omni kb graph push` sends it and
// `POST /api/knowledge/graphs` reads it. P5's version 1 types, `shape: 'repository'`, no start, depth
// or hop, no product node; strict, so an unknown field is refused wherever it hides.
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { NeighbourhoodEdge, NeighbourhoodNode } from './neighbourhood.ts';
import {
  GRAPH_SHAPE,
  graphProblem,
  RepositoryGraphSchema,
  type GraphEdge,
  type GraphNode,
  type RepositoryGraph,
} from './graph-schema.ts';

const rule = (id: string, fields: Partial<GraphNode> = {}): GraphNode => ({
  id, kind: 'rule', label: `${id} holds.`, status: 'rule', file: '.omni-loop/knowledge/product/rules.md', origin: 'repository', ...fields,
});

/** A small repository: a principle, a law serving it and a Legal entry, its test, and a term it uses. */
const GRAPH: RepositoryGraph = {
  version: 1,
  shape: 'repository',
  nodes: [
    rule('P-PRODUCT-1', { kind: 'principle', status: null, file: '.omni-loop/knowledge/product/principles.md' }),
    rule('BR-PRODUCT-3', { status: 'law' }),
    rule('test:kit/test/plugin.test.ts', { kind: 'test', label: null, status: null, file: 'kit/test/plugin.test.ts' }),
    rule('path:kit/lib/**', { kind: 'path', label: null, status: null, file: null }),
  ],
  edges: [
    { from: 'BR-PRODUCT-3', to: 'P-PRODUCT-1', kind: 'serves' },
    { from: 'BR-PRODUCT-3', to: 'L-INVOICING-1', kind: 'serves' },
    { from: 'BR-PRODUCT-3', to: 'test:kit/test/plugin.test.ts', kind: 'enforced-by' },
    { from: 'BR-PRODUCT-3', to: 'path:kit/lib/**', kind: 'governs' },
    { from: 'BR-PRODUCT-3', to: 'term:credit note', kind: 'uses-term' },
  ],
};

const parsed = (graph: unknown) => RepositoryGraphSchema.safeParse(graph);
const problemOf = (graph: unknown) => {
  const result = parsed(graph);
  return result.success ? null : graphProblem(result.error);
};

describe('the pushed graph (PRD 1798 s1)', () => {
  it('takes P5\'s version 1 nodes and edges, shaped as a whole repository', () => {
    expect(GRAPH_SHAPE).toBe('repository');
    expect(parsed(GRAPH)).toEqual({ success: true, data: GRAPH });
  });

  it('is P5\'s node without its hop, and only a repository\'s own, and P5\'s edge unchanged', () => {
    expectTypeOf<GraphNode>().toEqualTypeOf<{ [K in Exclude<keyof NeighbourhoodNode, 'hop'>]: K extends 'origin' ? 'repository' : NeighbourhoodNode[K] }>();
    expectTypeOf<GraphEdge>().toEqualTypeOf<NeighbourhoodEdge>();
  });

  it('takes an empty repository', () => {
    expect(parsed({ version: 1, shape: 'repository', nodes: [], edges: [] }).success).toBe(true);
  });

  it('refuses an unknown field, on the graph, a node or an edge, naming it', () => {
    expect(problemOf({ ...GRAPH, start: ['BR-PRODUCT-3'] })).toBe('The graph does not carry start.');
    expect(problemOf({ ...GRAPH, depth: 1 })).toBe('The graph does not carry depth.');
    expect(problemOf({ ...GRAPH, nodes: [{ ...rule('BR-PRODUCT-9'), hop: 0 }] })).toBe('The graph\'s node 1 does not carry hop.');
    expect(problemOf({ ...GRAPH, edges: [{ ...GRAPH.edges[0], weight: 2 }] })).toBe('The graph\'s edge 1 does not carry weight.');
  });

  it('refuses another version, another shape, and a neighbourhood', () => {
    expect(problemOf({ ...GRAPH, version: 2 })).toMatch(/^The graph's `version` is malformed/);
    expect(problemOf({ ...GRAPH, shape: 'neighbourhood' })).toMatch(/^The graph's `shape` is malformed/);
  });

  it('refuses a product node: the server holds the product\'s own', () => {
    const legal = rule('L-INVOICING-1', { kind: 'legal', status: null, file: null, origin: 'product' as 'repository' });
    expect(problemOf({ ...GRAPH, nodes: [...GRAPH.nodes, legal] })).toMatch(/^The graph's `nodes\.4\.origin` is malformed/);
  });

  it('refuses a kind, an edge kind or a status P5 does not know', () => {
    expect(problemOf({ ...GRAPH, nodes: [rule('BR-PRODUCT-9', { kind: 'persona' as 'rule' })] })).toMatch(/`nodes\.0\.kind` is malformed/);
    expect(problemOf({ ...GRAPH, edges: [{ from: 'BR-PRODUCT-3', to: 'P-PRODUCT-1', kind: 'likes' }] })).toMatch(/`edges\.0\.kind` is malformed/);
    expect(problemOf({ ...GRAPH, nodes: [rule('BR-PRODUCT-9', { status: 'draft' as 'rule' })] })).toMatch(/`nodes\.0\.status` is malformed/);
  });

  it('refuses a node id twice', () => {
    expect(problemOf({ ...GRAPH, nodes: [...GRAPH.nodes, rule('BR-PRODUCT-3')] })).toBe('The graph\'s `nodes.4.id` is malformed: BR-PRODUCT-3 is a node twice.');
  });

  it('refuses an edge whose end is no node of the graph, unless it is a Legal id or a term the product holds', () => {
    expect(problemOf({ ...GRAPH, edges: [{ from: 'BR-PRODUCT-3', to: 'BR-PRODUCT-404', kind: 'cites' }] }))
      .toBe('The graph\'s `edges.0.to` is malformed: BR-PRODUCT-404 is no node of the graph.');
    expect(problemOf({ ...GRAPH, edges: [{ from: 'L-INVOICING-1', to: 'BR-PRODUCT-3', kind: 'serves' }] })).toBeNull();
    expect(problemOf({ ...GRAPH, edges: [{ from: 'ghost', to: 'BR-PRODUCT-3', kind: 'cites' }] }))
      .toBe('The graph\'s `edges.0.from` is malformed: ghost is no node of the graph.');
    expect(problemOf({ ...GRAPH, edges: [{ from: 'BR-PRODUCT-3', to: 'term:', kind: 'uses-term' }] }))
      .toBe('The graph\'s `edges.0.to` is malformed: term: is no node of the graph.');
  });

  it('refuses an empty id, and a node that is not an object', () => {
    expect(problemOf({ ...GRAPH, nodes: [rule('')] })).toMatch(/`nodes\.0\.id` is malformed/);
    expect(problemOf({ ...GRAPH, nodes: ['BR-PRODUCT-3'] })).toMatch(/`nodes\.0` is malformed/);
    expect(problemOf(null)).toMatch(/^The graph is malformed: /);
  });
});

describe('the domain and layer edges (PRD 2346 s4)', () => {
  const adr = (id: string): GraphNode => ({ id, kind: 'adr', label: 'Migrations only add.', status: null, file: '.omni-loop/knowledge/adr/0001-migrations-only-add.md', origin: 'repository' });

  it('accepts a rule linked to a decision record by its domain and by its layer', () => {
    const graph: RepositoryGraph = {
      ...GRAPH,
      nodes: [...GRAPH.nodes, adr('ADR-0001')],
      edges: [...GRAPH.edges, { from: 'BR-PRODUCT-3', to: 'ADR-0001', kind: 'domain' }, { from: 'BR-PRODUCT-3', to: 'ADR-0001', kind: 'layer' }],
    };
    expect(parsed(graph)).toEqual({ success: true, data: graph });
  });

  it('still refuses an edge kind it does not know', () => {
    expect(parsed({ ...GRAPH, edges: [{ from: 'BR-PRODUCT-3', to: 'P-PRODUCT-1', kind: 'area' }] }).success).toBe(false);
  });
});
