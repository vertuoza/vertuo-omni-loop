import {
  PRODUCT_GRAPH_VERSION,
  type ProductGraphEdge,
  type ProductGraphNode,
  type ProductNeighbourhood,
  type ProductNodeKind,
} from 'omni-loop/kit/lib/knowledge/product-graph.ts';
import type { JoinedGraph, JoinedNode } from './join';

// The walk over a product's joined graph (PRD 1798 s3), as P5 walks one repository
// (kit/lib/knowledge/neighbourhood.ts): out of the start, `depth` hops, each edge read from either end.
// The start is always walked out of; past it only the entries are (a principle, a rule, an invariant, a
// contract, a Legal entry), and every other node (a test, a path, a schema, a screen, a decision record,
// a term, a Never line) is a leaf. A node reached twice is kept once, at the first hop reaching it, and
// a sibling edge stored both ways is one edge. Pure, and free of anything server-side, so a page can
// walk the graph it already holds.

/** The kinds walked past the start: P5's entries, and a Legal entry, walked to what serves it. */
const WALKED: ReadonlySet<ProductNodeKind> = new Set(['principle', 'rule', 'invariant', 'contract', 'legal']);

const TERM_PREFIX = 'term:';

/** A walk's result: the start's id in the graph, the nodes reached with their hop, the edges walked. */
export type Walked = { start: string; nodes: ProductGraphNode[]; edges: ProductGraphEdge[] };

/** An edge's identity: a sibling is the same edge read from either end. */
function edgeKey({ from, to, kind }: ProductGraphEdge): string {
  const ends = kind === 'sibling' ? [from, to].sort() : [from, to];
  return `${kind} ${ends.join(' ')}`;
}

/** The node `id` names: exactly, or a term in any case. */
function startOf(graph: JoinedGraph, id: string) {
  const exact = graph.nodes.find((node) => node.id === id);
  if (exact !== undefined || !id.startsWith(TERM_PREFIX)) return exact;
  const wanted = id.toLowerCase();
  return graph.nodes.find((node) => node.kind === 'term' && node.id.toLowerCase() === wanted);
}

/** The repository nodes a bare `id` stands for, `<repository>/<id>`, in the graph's order (#2221). */
export function prefixedMatches(graph: JoinedGraph, id: string): string[] {
  return graph.nodes.filter((node) => node.repo !== null && node.id === `${node.repo}/${id}`).map((node) => node.id);
}

/** Every edge touching each node, in the graph's order. */
function edgesByNode(edges: readonly ProductGraphEdge[]): Map<string, ProductGraphEdge[]> {
  const touching = new Map<string, ProductGraphEdge[]>();
  for (const edge of edges) {
    for (const end of new Set([edge.from, edge.to])) {
      const list = touching.get(end);
      if (list === undefined) touching.set(end, [edge]);
      else list.push(edge);
    }
  }
  return touching;
}

/** A walk in progress: what it reads, the nodes it reached, the edges it walked and their keys. */
type Walk = {
  byId: ReadonlyMap<string, JoinedNode>;
  touching: ReadonlyMap<string, readonly ProductGraphEdge[]>;
  reached: Map<string, ProductGraphNode>;
  edges: ProductGraphEdge[];
  seen: Set<string>;
};

/** One hop out of `from`: records each new edge and each new node at `hop`; returns the entries reached, to walk next. */
function step(walk: Walk, from: string, hop: number): string[] {
  const next: string[] = [];
  for (const edge of walk.touching.get(from) ?? []) {
    const other = walk.byId.get(edge.from === from ? edge.to : edge.from);
    if (other === undefined) continue;
    const key = edgeKey(edge);
    if (!walk.seen.has(key)) {
      walk.seen.add(key);
      walk.edges.push(edge);
    }
    if (walk.reached.has(other.id)) continue;
    walk.reached.set(other.id, { ...other, hop });
    if (WALKED.has(other.kind)) next.push(other.id);
  }
  return next;
}

/** The neighbourhood of `id`, `depth` hops out; `null` when the graph holds no such node. */
export function walkProductGraph(graph: JoinedGraph, { id, depth }: { id: string; depth: number }): Walked | null {
  const start = startOf(graph, id);
  if (start === undefined) return null;
  const walk: Walk = {
    byId: new Map(graph.nodes.map((node) => [node.id, node])),
    touching: edgesByNode(graph.edges),
    reached: new Map([[start.id, { ...start, hop: 0 }]]),
    edges: [],
    seen: new Set(),
  };
  let frontier = [start.id];
  for (let hop = 1; hop <= depth; hop += 1) frontier = frontier.flatMap((from) => step(walk, from, hop));
  return { start: start.id, nodes: [...walk.reached.values()], edges: walk.edges };
}

/** P5's neighbourhood JSON at version 2 for the product keyed `key` (`null` before it has one); `null` when the graph holds no `id`. */
export function productNeighbourhood(graph: JoinedGraph, { key, id, depth }: { key: string | null; id: string; depth: number }): ProductNeighbourhood | null {
  const walked = walkProductGraph(graph, { id, depth });
  if (walked === null) return null;
  return {
    version: PRODUCT_GRAPH_VERSION,
    shape: 'neighbourhood',
    repo: null,
    start: [walked.start],
    depth,
    product: { state: 'server', key, cachedOn: null },
    nodes: walked.nodes,
    edges: walked.edges,
    unresolved: graph.unresolved,
    repositories: graph.repositories,
  };
}
