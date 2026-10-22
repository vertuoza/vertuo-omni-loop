import { describe, expect, it } from 'vitest';
import { ProductNeighbourhoodSchema } from 'omni-loop/kit/lib/knowledge/product-graph.ts';
import type { JoinedGraph, JoinedNode } from './join';
import { prefixedMatches, productNeighbourhood, walkProductGraph } from './walk';

// The walk over a product's joined graph (PRD 1798 s3), as P5 walks one repository: only the nodes
// within `depth` edges of the start, the entries walked further and the others leaves.

const node = (id: string, kind: JoinedNode['kind'], repo: string | null): JoinedNode => ({
  id, kind, label: `${id}.`, status: null, file: null, origin: repo === null ? 'product' : 'repository', repo,
});

/**
 * L-1 ← a/R1 → a/P1 ← a/R2, a/R1 → a/test:x, a/R2 → a/test:y, L-1 ← b/R3 → term:t ← c/R4,
 * a/R1 and a/R2 siblings (stored both ways), and a Never line no edge reaches.
 */
const GRAPH: JoinedGraph = {
  nodes: [
    node('L-1', 'legal', null), node('term:t', 'term', null), node('never#3', 'never', null),
    node('a/R1', 'rule', 'a'), node('a/R2', 'rule', 'a'), node('a/P1', 'principle', 'a'), node('a/test:x', 'test', 'a'), node('a/test:y', 'test', 'a'),
    node('b/R3', 'rule', 'b'), node('c/R4', 'rule', 'c'),
  ],
  edges: [
    { from: 'a/R1', to: 'L-1', kind: 'serves' },
    { from: 'a/R1', to: 'a/test:x', kind: 'enforced-by' },
    { from: 'a/R1', to: 'a/P1', kind: 'serves' },
    { from: 'a/R2', to: 'a/P1', kind: 'serves' },
    { from: 'a/R2', to: 'a/test:y', kind: 'enforced-by' },
    { from: 'a/R1', to: 'a/R2', kind: 'sibling' },
    { from: 'a/R2', to: 'a/R1', kind: 'sibling' },
    { from: 'b/R3', to: 'L-1', kind: 'serves' },
    { from: 'b/R3', to: 'term:t', kind: 'uses-term' },
    { from: 'c/R4', to: 'term:t', kind: 'uses-term' },
  ],
  unresolved: [{ repo: 'b', node: 'b/R3', id: 'L-9' }],
  repositories: [{ repo: 'a', commit: null, pushedAt: null, pushedBy: null, graph: 'own' }],
};

const hops = (id: string, depth: number) => {
  const walked = walkProductGraph(GRAPH, { id, depth });
  return walked && Object.fromEntries(walked.nodes.map((n) => [n.id, n.hop]));
};

describe('walkProductGraph', () => {
  it('returns only the nodes within depth edges of the start', () => {
    expect(hops('L-1', 1)).toEqual({ 'L-1': 0, 'a/R1': 1, 'b/R3': 1 });
    expect(hops('L-1', 2)).toEqual({ 'L-1': 0, 'a/R1': 1, 'b/R3': 1, 'a/test:x': 2, 'a/P1': 2, 'a/R2': 2, 'term:t': 2 });
  });

  it('walks entries further and stops at a leaf: a term reached on the way is not walked past', () => {
    expect(hops('L-1', 3)).toEqual({ 'L-1': 0, 'a/R1': 1, 'b/R3': 1, 'a/test:x': 2, 'a/P1': 2, 'a/R2': 2, 'term:t': 2, 'a/test:y': 3 });
  });

  it('walks out of the start whatever its kind: a term meets the rules of every repository using it', () => {
    expect(hops('term:t', 1)).toEqual({ 'term:t': 0, 'b/R3': 1, 'c/R4': 1 });
    expect(walkProductGraph(GRAPH, { id: 'term:T', depth: 1 })?.start).toBe('term:t');
    expect(hops('never#3', 3)).toEqual({ 'never#3': 0 });
  });

  it('keeps the edges it walked, a sibling once', () => {
    expect(walkProductGraph(GRAPH, { id: 'a/R1', depth: 1 })?.edges).toEqual([
      { from: 'a/R1', to: 'L-1', kind: 'serves' },
      { from: 'a/R1', to: 'a/test:x', kind: 'enforced-by' },
      { from: 'a/R1', to: 'a/P1', kind: 'serves' },
      { from: 'a/R1', to: 'a/R2', kind: 'sibling' },
    ]);
    expect(walkProductGraph(GRAPH, { id: 'L-1', depth: 1 })?.edges).toEqual([
      { from: 'a/R1', to: 'L-1', kind: 'serves' },
      { from: 'b/R3', to: 'L-1', kind: 'serves' },
    ]);
  });

  it('is null for an id the graph does not hold', () => {
    expect(walkProductGraph(GRAPH, { id: 'R1', depth: 1 })).toBeNull();
    expect(walkProductGraph(GRAPH, { id: 'L-INVOICING-1', depth: 1 })).toBeNull();
  });
});

describe('prefixedMatches', () => {
  it('names the repository nodes a bare id stands for, prefixed by their repository (#2221)', () => {
    expect(prefixedMatches(GRAPH, 'R1')).toEqual(['a/R1']);
    const twice: JoinedGraph = { ...GRAPH, nodes: [...GRAPH.nodes, node('acme/web/R1', 'rule', 'acme/web')] };
    expect(prefixedMatches(twice, 'R1')).toEqual(['a/R1', 'acme/web/R1']);
  });

  it('names nothing for an id no repository holds, a prefixed id, or a product node', () => {
    expect(prefixedMatches(GRAPH, 'R9')).toEqual([]);
    expect(prefixedMatches(GRAPH, 'a/R1')).toEqual([]);
    expect(prefixedMatches(GRAPH, 'R1/x')).toEqual([]);
    expect(prefixedMatches(GRAPH, 'L-1')).toEqual([]);
    expect(prefixedMatches(GRAPH, '')).toEqual([]);
  });
});

describe('productNeighbourhood', () => {
  it('answers P5’s neighbourhood at version 2, with the whole graph’s unresolved and repositories', () => {
    const answer = productNeighbourhood(GRAPH, { key: 'omni-loop', id: 'L-1', depth: 1 });
    expect(answer).toEqual({
      version: 2,
      shape: 'neighbourhood',
      repo: null,
      start: ['L-1'],
      depth: 1,
      product: { state: 'server', key: 'omni-loop', cachedOn: null },
      nodes: [{ ...node('L-1', 'legal', null), hop: 0 }, { ...node('a/R1', 'rule', 'a'), hop: 1 }, { ...node('b/R3', 'rule', 'b'), hop: 1 }],
      edges: [{ from: 'a/R1', to: 'L-1', kind: 'serves' }, { from: 'b/R3', to: 'L-1', kind: 'serves' }],
      unresolved: GRAPH.unresolved,
      repositories: GRAPH.repositories,
    });
    expect(ProductNeighbourhoodSchema.parse(answer)).toEqual(answer);
    expect(productNeighbourhood(GRAPH, { key: 'omni-loop', id: 'nothing', depth: 1 })).toBeNull();
  });
});
