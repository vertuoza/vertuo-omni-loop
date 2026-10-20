import type { ProductGraphEdge, ProductGraphNode, RepositoryStanding, Unresolved } from 'vertuo-omni-plan/kit/lib/knowledge/product-graph.ts';
import { PRODUCT_GRAPH_DEPTH } from 'vertuo-omni-plan/kit/lib/knowledge/product-graph.ts';
import type { JoinedGraph, JoinedNode } from '../join';
import { walkProductGraph } from '../walk';

// The product's knowledge graph page, as data (PRD 1798 s6): the joined graph (s3's reader) turned into
// what the page draws, with no markup and no read. The repositories strip, the node list (searched), a
// picked node's neighbourhood walked out to a depth of 1 to 3, the unresolved list. Each node is labelled
// by where it comes from: its repository's short name, `Legal`, `Glossary` or `Never`.

/** Nodes listed at once; a longer list is searched down. */
export const LIST_LIMIT = 100;

/** The command that pushes a repository's graph. */
export const PUSH_COMMAND = 'omni kb graph push';

export type GraphQuery = { q: string; node: string | null; depth: number };

/** What the address asks for: a search, a node and a depth of 1 to 3 (1 when absent or out of range). */
export function graphQueryOf(raw: { q?: string | null; node?: string | null; depth?: string | null }): GraphQuery {
  const depth = Number(raw.depth);
  const ok = Number.isInteger(depth) && depth >= 1 && depth <= PRODUCT_GRAPH_DEPTH.most;
  return { q: (raw.q ?? '').trim().slice(0, 200), node: raw.node && raw.node !== '' ? raw.node : null, depth: ok ? depth : PRODUCT_GRAPH_DEPTH.fallback };
}

export type NodeLine = { id: string; kind: string; label: string | null; from: string; hop: number | null; href: string };

export type RepositoryLine =
  | { repo: string; state: 'pushed'; commit: string; pushedAt: string; pushedBy: string | null }
  | { repo: string; state: 'never'; command: string }
  | { repo: string; state: 'not-served' };

export type EdgeLine = { from: string; kind: ProductGraphEdge['kind']; to: string };

export type Picked = { id: string; depth: number; nodes: NodeLine[]; edges: EdgeLine[] } | { id: string; missing: true };

export type GraphPageData = {
  product: { id: string; name: string };
  query: GraphQuery;
  repositories: RepositoryLine[];
  /** The nodes the search leaves, the first LIST_LIMIT of them. */
  list: NodeLine[];
  /** How many nodes the search leaves, and how many the graph holds. */
  matching: number;
  total: number;
  picked: Picked | null;
  unresolved: Unresolved[];
};

/** Where a node comes from, in the words of the page. */
export function originOf(node: Pick<JoinedNode, 'kind' | 'repo'>): string {
  if (node.repo !== null) return node.repo;
  if (node.kind === 'legal') return 'Legal';
  if (node.kind === 'term') return 'Glossary';
  return 'Never';
}

/** The page's address for a search, a node and a depth. */
export function graphHref(product: string, { q, node, depth }: GraphQuery): string {
  const params = new URLSearchParams();
  if (q !== '') params.set('q', q);
  if (node !== null) params.set('node', node);
  if (node !== null && depth !== PRODUCT_GRAPH_DEPTH.fallback) params.set('depth', String(depth));
  const rest = params.toString();
  return `/app/products/${encodeURIComponent(product)}/knowledge/graph${rest === '' ? '' : `?${rest}`}`;
}

const nodeLine = (product: string, query: GraphQuery, node: JoinedNode, hop: number | null): NodeLine => ({
  id: node.id,
  kind: node.kind,
  label: node.label,
  from: originOf(node),
  hop,
  href: graphHref(product, { q: query.q, node: node.id, depth: query.depth }),
});

const repositoryLine = (standing: RepositoryStanding): RepositoryLine => {
  if (standing.graph === 'none') return { repo: standing.repo, state: 'not-served' };
  if (standing.commit === null || standing.pushedAt === null) return { repo: standing.repo, state: 'never', command: PUSH_COMMAND };
  return { repo: standing.repo, state: 'pushed', commit: standing.commit.slice(0, 7), pushedAt: standing.pushedAt, pushedBy: standing.pushedBy };
};

const matches = (node: JoinedNode, q: string): boolean => {
  const needle = q.toLowerCase();
  return needle === '' || node.id.toLowerCase().includes(needle) || (node.label ?? '').toLowerCase().includes(needle) || originOf(node).toLowerCase().includes(needle);
};

function pickedOf(product: string, graph: JoinedGraph, query: GraphQuery): Picked | null {
  if (query.node === null) return null;
  const walked = walkProductGraph(graph, { id: query.node, depth: query.depth });
  if (walked === null) return { id: query.node, missing: true };
  const nodes = walked.nodes.map((node: ProductGraphNode) => nodeLine(product, query, node, node.hop));
  nodes.sort((a, b) => (a.hop ?? 0) - (b.hop ?? 0) || a.id.localeCompare(b.id));
  return { id: walked.start, depth: query.depth, nodes, edges: walked.edges.map(({ from, kind, to }) => ({ from, kind, to })) };
}

/** The page's data from the product and its whole joined graph. */
export function graphPageOf(product: { id: string; name: string }, graph: JoinedGraph, query: GraphQuery): GraphPageData {
  const found = graph.nodes.filter((node) => matches(node, query.q));
  return {
    product,
    query,
    repositories: graph.repositories.map(repositoryLine),
    list: found.slice(0, LIST_LIMIT).map((node) => nodeLine(product.id, query, node, null)),
    matching: found.length,
    total: graph.nodes.length,
    picked: pickedOf(product.id, graph, query),
    unresolved: graph.unresolved,
  };
}
