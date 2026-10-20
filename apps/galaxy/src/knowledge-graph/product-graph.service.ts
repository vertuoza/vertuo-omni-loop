import type { ProductNeighbourhood } from 'vertuo-omni-plan/kit/lib/knowledge/product-graph.ts';
import { joinProductGraph, type JoinedGraph, type LinkedRepository } from './join';
import type { ProductGraphRepository, StoredGraphRow, StoredProductRow } from './product-graph.repository';
import { prefixedMatches, productNeighbourhood } from './walk';

// The product graph's reader (PRD 1798 s3; ADR-0095), on its repository: the latest graph of each
// repository the product links with its own knowledge (`knowledge = 'own'`), joined with the product's
// Legal entries, Glossary terms and Never lines as the caller reads them. Who reads what is the
// database's to decide (row-level security, as the caller): a product they cannot read is no product.
//
// Two reads, one join: `graph` answers the whole joined graph (every node, for the page's search), and
// `neighbourhood` the walk out of one node, P5's neighbourhood JSON at version 2 (for the read route and
// the MCP link's get_knowledge_graph). A product is named by its key (the route) or its id (the page).

/** A product, by its key or its id. */
type ProductRef = { key: string } | { id: string };

/** The product read, and its whole graph. */
type ProductGraph = { product: StoredProductRow; graph: JoinedGraph };

/** A neighbourhood: its body, or why there is none (with no node, the prefixed ids a bare id stands for). */
type NeighbourhoodRead = { kind: 'ok'; body: ProductNeighbourhood } | { kind: 'no-product' } | { kind: 'archived'; name: string } | { kind: 'no-node'; matches: string[] };

/** A stored graph as the join reads it: the commit, when (ISO, in UTC) and by whom it was pushed. */
const pushedOf = (row: StoredGraphRow) => ({ commit: row.sha, pushedAt: new Date(row.pushed_at).toISOString(), pushedBy: row.pushed_by_login, graph: row.graph });

export function productGraphService(repository: ProductGraphRepository) {
  /** The links, each with its latest graph when its knowledge is its own. */
  async function linksOf(product: string): Promise<LinkedRepository[]> {
    const links = await repository.links(product);
    return Promise.all(links.map(async ({ repository: name, knowledge }) => {
      const latest = knowledge === 'own' ? await repository.latestGraph(name) : null;
      return { repository: name, knowledge, pushed: latest === null ? null : pushedOf(latest) };
    }));
  }

  /** The product's whole graph, as the caller reads it. */
  async function joined(product: string): Promise<JoinedGraph> {
    const [links, legal, glossary, never] = await Promise.all([linksOf(product), repository.legal(product), repository.glossary(product), repository.never(product)]);
    return joinProductGraph({
      links,
      legal: legal.map((entry) => ({ id: `L-${entry.code}-${String(entry.number)}`, statement: entry.statement, retired: entry.retired_at !== null })),
      glossary: glossary.map((term) => ({ term: term.term, meaning: term.meaning, removed: term.removed_at !== null })),
      never: never.map((line) => ({ id: `never#${String(line.seq)}`, body: line.body, removed: line.removed_at !== null })),
    });
  }

  /** The product a reference names, when the caller reads it. */
  const productOf = (ref: ProductRef) => ('key' in ref ? repository.productByKey(ref.key) : repository.productById(ref.id));

  return {
    /** The product's whole joined graph, or null when the caller reads no such product, or it is archived. */
    async graph(ref: ProductRef): Promise<ProductGraph | null> {
      const product = await productOf(ref);
      return product === null || product.archived_at ? null : { product, graph: await joined(product.id) };
    },

    /** The neighbourhood of `id`, `depth` hops out, across every repository of the product. */
    async neighbourhood(ref: ProductRef, { id, depth }: { id: string; depth: number }): Promise<NeighbourhoodRead> {
      const product = await productOf(ref);
      if (product === null) return { kind: 'no-product' };
      // An archived product answers for nobody, its owner included (PRD 2232): the owner reads it only on its page.
      if (product.archived_at) return { kind: 'archived', name: product.name };
      const graph = await joined(product.id);
      const body = productNeighbourhood(graph, { key: product.key, id, depth });
      return body === null ? { kind: 'no-node', matches: prefixedMatches(graph, id) } : { kind: 'ok', body };
    },
  };
}

export type ProductGraphService = ReturnType<typeof productGraphService>;
