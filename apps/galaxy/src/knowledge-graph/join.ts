import type { RepositoryGraph } from 'omni-loop/kit/lib/knowledge/graph-schema.ts';
import { LEGAL_ID_SHAPE } from 'omni-loop/kit/lib/knowledge/registers.ts';
import type { ProductGraphEdge, ProductGraphNode, RepositoryStanding, Unresolved } from 'omni-loop/kit/lib/knowledge/product-graph.ts';

// The join (PRD 1798 s3): the latest pushed graph of each repository of a product, joined with the
// product's own Legal entries, Glossary terms and Never lines (P3's tables, PRD 871's constituents),
// into one graph. A pure function: what it is given is everything it reads.
//
// - Each repository node's id is prefixed with its repository's short name and a slash,
//   `vertuo-omni-loop/BR-PRODUCT-3`, and carries `repo`, so two repositories holding one id never
//   collide. Two linked repositories sharing a short name (`acme/web`, `other/web`) are named by their
//   whole name instead, for the same reason.
// - The product's active Legal entries are `legal` nodes by their id (`L-INVOICING-1`), its live
//   terms `term:<word>` nodes, its live Never lines `never` nodes (`never#3`), each `origin: 'product'`
//   and `repo: null`. A retired, removed or absent one is no node.
// - A repository's edge to a Legal id reaches the product's Legal node; to a term, the product's one
//   term node, found without case, so two repositories using one term meet on it. An id the product
//   does not hold is listed under `unresolved`, with the repository, the node and the id, never dropped
//   silently.
// - `repositories` says what each link's data is: its latest commit, when and by whom it was pushed
//   (null each when it never pushed), and `graph`: `own`, or `none` for a link whose knowledge is
//   `imported` or `none`, whose graph is not served.

/** A repository's latest pushed graph: its commit, when and by whom (their GitHub login, when known). */
export type PushedGraph = { commit: string; pushedAt: string; pushedBy: string | null; graph: RepositoryGraph };

/** One link of the product: the repository (owner/name), where its knowledge lives, its latest push. */
export type LinkedRepository = { repository: string; knowledge: 'own' | 'imported' | 'none'; pushed: PushedGraph | null };

/** What the join reads: the links, and the product's Legal entries, terms and Never lines, retired or removed ones included. */
export type ProductSources = {
  links: readonly LinkedRepository[];
  legal: readonly { id: string; statement: string; retired: boolean }[];
  glossary: readonly { term: string; meaning: string; removed: boolean }[];
  never: readonly { id: string; body: string; removed: boolean }[];
};

/** A node of the joined graph: a version 2 node before any walk reaches it. */
export type JoinedNode = Omit<ProductGraphNode, 'hop'>;

/** The product's whole graph: every node and edge, what did not resolve, and each repository's standing. */
export type JoinedGraph = { nodes: JoinedNode[]; edges: ProductGraphEdge[]; unresolved: Unresolved[]; repositories: RepositoryStanding[] };

const TERM_PREFIX = 'term:';

/** A statement's first sentence, as P5 labels a Legal node. */
const headline = (statement: string): string => (statement.split(/(?<=[.!?])\s+/)[0] ?? '').trim();

const productNode = (id: string, kind: JoinedNode['kind'], label: string): JoinedNode => ({ id, kind, label, status: null, file: null, origin: 'product', repo: null });

/** Each link's name in the graph: its short name, or its whole name when another link shares the short one. */
function namesOf(links: readonly LinkedRepository[]): string[] {
  const short = links.map(({ repository }) => repository.slice(repository.indexOf('/') + 1));
  return links.map(({ repository }, at) => (short.filter((name) => name === short[at]).length > 1 ? repository : (short[at] ?? repository)));
}

/** How an edge end names a product node: the node's id, `null` when the product does not hold it, `undefined` for none. */
type Resolve = (end: string) => string | null | undefined;

/** The product's own nodes, and how a repository's edge end finds one. */
function productSide({ legal, glossary, never }: ProductSources) {
  const legalNodes = legal.filter((entry) => !entry.retired).map((entry) => productNode(entry.id, 'legal', headline(entry.statement)));
  const termNodes = glossary.filter((term) => !term.removed).map((term) => productNode(`${TERM_PREFIX}${term.term}`, 'term', term.meaning));
  const neverNodes = never.filter((line) => !line.removed).map((line) => productNode(line.id, 'never', line.body));
  const legalIds = new Set(legalNodes.map(({ id }) => id));
  const terms = new Map(termNodes.map(({ id }) => [id.toLowerCase(), id]));
  const resolve: Resolve = (end) => {
    if (LEGAL_ID_SHAPE.test(end)) return legalIds.has(end) ? end : null;
    if (end.startsWith(TERM_PREFIX)) return terms.get(end.toLowerCase()) ?? null;
    return undefined;
  };
  return { nodes: [...legalNodes, ...termNodes, ...neverNodes], resolve };
}

/** The standing of a link, from its latest push when its graph is served. */
function standingOf(link: LinkedRepository, repo: string): RepositoryStanding {
  const pushed = link.knowledge === 'own' ? link.pushed : null;
  return { repo, commit: pushed?.commit ?? null, pushedAt: pushed?.pushedAt ?? null, pushedBy: pushed?.pushedBy ?? null, graph: link.knowledge === 'own' ? 'own' : 'none' };
}

/** One repository's part of the product's graph: its nodes and edges prefixed, the product ends it names joined. */
function joinRepository(graph: RepositoryGraph, repo: string, resolve: Resolve): Pick<JoinedGraph, 'nodes' | 'edges' | 'unresolved'> {
  const own = new Set(graph.nodes.map(({ id }) => id));
  const prefixed = (id: string) => `${repo}/${id}`;
  const endOf = (end: string) => (own.has(end) ? prefixed(end) : resolve(end));
  const edges: ProductGraphEdge[] = [];
  const unresolved = new Map<string, Unresolved>();
  for (const edge of graph.edges) {
    const [from, to] = [endOf(edge.from), endOf(edge.to)];
    if (typeof from === 'string' && typeof to === 'string') {
      edges.push({ from, to, kind: edge.kind });
      continue;
    }
    const missing = typeof from === 'string' ? edge.to : edge.from;
    const node = prefixed(own.has(edge.from) ? edge.from : edge.to);
    unresolved.set(`${node} ${missing}`, { repo, node, id: missing });
  }
  return { nodes: graph.nodes.map((node) => ({ ...node, id: prefixed(node.id), repo })), edges, unresolved: [...unresolved.values()] };
}

/** The product's one graph, joined from its repositories' latest graphs and its own knowledge. */
export function joinProductGraph(sources: ProductSources): JoinedGraph {
  const product = productSide(sources);
  const names = namesOf(sources.links);
  const parts = sources.links.flatMap((link, at) => {
    const graph = link.knowledge === 'own' ? link.pushed?.graph : undefined;
    return graph === undefined ? [] : [joinRepository(graph, names[at] ?? link.repository, product.resolve)];
  });
  return {
    nodes: [...product.nodes, ...parts.flatMap(({ nodes }) => nodes)],
    edges: parts.flatMap(({ edges }) => edges),
    unresolved: parts.flatMap(({ unresolved }) => unresolved),
    repositories: sources.links.map((link, at) => standingOf(link, names[at] ?? link.repository)),
  };
}
