/**
 * **A product's knowledge graph, as the server answers it** (PRD 1798, P6): P5's neighbourhood
 * (`neighbourhood.ts`) across every repository of a product, joined with the product's own Legal
 * entries, Glossary terms and Never lines, at `version: 2`:
 *
 * ```text
 * { version: 2, shape: 'neighbourhood', repo: null, start, depth, product: {state: 'server', key, cachedOn: null},
 *   nodes: [{id, kind, label, status, file, origin, hop, repo}], edges: [{from, to, kind}],
 *   unresolved: [{repo, node, id}], repositories: [{repo, commit, pushedAt, pushedBy, graph}] }
 * ```
 *
 * P5 adds a field only with a new version, so the server's answer is version 2: version 1's fields,
 * plus `repo` on each node (the repository's short name, `null` on a product node), `unresolved` (an
 * edge of a repository to a Legal id or a term the product does not hold), `repositories` (what each
 * linked repository's data is: its commit, when and by whom it was pushed, all `null` when it never
 * pushed, and `graph` `own`, or `none` for a link whose graph is not served), the node kind `never`
 * (a live Never line of the product, `never#<n>`) and the product state `server`.
 *
 * `GET /api/products/<key>/knowledge/graph` checks its answer with this schema before it leaves, so
 * the CLI reads exactly what the server sends. Strict: an unknown field is refused. zod and types
 * only, so a browser can import it.
 */
import { z } from 'zod';
import type { EdgeKind, NodeKind, NodeOrigin, NodeStatus, ProductState } from './neighbourhood.ts';

export const PRODUCT_GRAPH_VERSION = 2;

/** How many hops between entries a product's neighbourhood may walk: 1 by default, 3 at most. */
export const PRODUCT_GRAPH_DEPTH = Object.freeze({ fallback: 1, most: 3 } as const);

/** Version 1's kinds, and a live Never line of the product. */
export type ProductNodeKind = NodeKind | 'never';

/** Version 1's states, and `server`: the product's Legal, Glossary and Never lines read at request time. */
type ProductGraphState = ProductState | 'server';

const NODE_KINDS = ['principle', 'rule', 'invariant', 'legal', 'contract', 'test', 'path', 'schema', 'screen', 'adr', 'term', 'never'] as const satisfies readonly ProductNodeKind[];
const EDGE_KINDS = ['serves', 'enforced-by', 'governs', 'points-to', 'cites', 'sibling', 'screen', 'same-prd', 'uses-term', 'domain', 'layer'] as const satisfies readonly EdgeKind[];
const STATUSES = ['law', 'rule', 'proposed'] as const satisfies readonly NodeStatus[];
const ORIGINS = ['repository', 'product'] as const satisfies readonly NodeOrigin[];
const STATES = ['cached', 'offline', 'none', 'server'] as const satisfies readonly ProductGraphState[];

const ProductGraphNodeSchema = z.strictObject({
  id: z.string().min(1),
  kind: z.enum(NODE_KINDS),
  label: z.string().nullable(),
  status: z.enum(STATUSES).nullable(),
  file: z.string().min(1).nullable(),
  origin: z.enum(ORIGINS),
  hop: z.number().int().min(0),
  /** The repository's short name (`back-end`); `null` on a node of the product. */
  repo: z.string().min(1).nullable(),
});
export type ProductGraphNode = z.infer<typeof ProductGraphNodeSchema>;

const ProductGraphEdgeSchema = z.strictObject({ from: z.string().min(1), to: z.string().min(1), kind: z.enum(EDGE_KINDS) });
export type ProductGraphEdge = z.infer<typeof ProductGraphEdgeSchema>;

/** An edge of a repository's node to a Legal id or a term the product does not hold (absent, retired or removed). */
const UnresolvedSchema = z.strictObject({ repo: z.string().min(1), node: z.string().min(1), id: z.string().min(1) });
export type Unresolved = z.infer<typeof UnresolvedSchema>;

/** A linked repository: its latest pushed commit, when and by whom (`null` each when it never pushed), and whether its graph is served. */
const RepositoryStandingSchema = z.strictObject({
  repo: z.string().min(1),
  commit: z.string().regex(/^[0-9a-f]{40}$/).nullable(),
  pushedAt: z.iso.datetime({ offset: true }).nullable(),
  pushedBy: z.string().min(1).nullable(),
  graph: z.enum(['own', 'none']),
});
export type RepositoryStanding = z.infer<typeof RepositoryStandingSchema>;

export const ProductNeighbourhoodSchema = z.strictObject({
  version: z.literal(PRODUCT_GRAPH_VERSION),
  shape: z.literal('neighbourhood'),
  repo: z.string().min(1).nullable(),
  start: z.array(z.string().min(1)),
  depth: z.number().int().min(1).max(PRODUCT_GRAPH_DEPTH.most),
  product: z.strictObject({ state: z.enum(STATES), key: z.string().min(1).nullable(), cachedOn: z.string().nullable() }),
  nodes: z.array(ProductGraphNodeSchema),
  edges: z.array(ProductGraphEdgeSchema),
  unresolved: z.array(UnresolvedSchema),
  repositories: z.array(RepositoryStandingSchema),
});
export type ProductNeighbourhood = z.infer<typeof ProductNeighbourhoodSchema>;

/** Version 1's node: P5's `--json`, with no repository. */
const V1NodeSchema = z.strictObject({
  id: z.string().min(1),
  kind: z.enum(['principle', 'rule', 'invariant', 'legal', 'contract', 'test', 'path', 'schema', 'screen', 'adr', 'term']),
  label: z.string().nullable(),
  status: z.enum(STATUSES).nullable(),
  file: z.string().min(1).nullable(),
  origin: z.enum(ORIGINS),
  hop: z.number().int().min(0),
});

const V1NeighbourhoodSchema = z.strictObject({
  version: z.literal(1),
  shape: z.literal('neighbourhood'),
  repo: z.string().min(1).nullable(),
  start: z.array(z.string().min(1)),
  depth: z.number().int().min(1).max(PRODUCT_GRAPH_DEPTH.most),
  product: z.strictObject({ state: z.enum(['cached', 'offline', 'none']), key: z.string().min(1).nullable(), cachedOn: z.string().nullable() }),
  nodes: z.array(V1NodeSchema),
  edges: z.array(ProductGraphEdgeSchema),
});

/** A neighbourhood document of either version, as the CLI reads it. */
export type ReadNeighbourhood = {
  version: 1 | 2;
  start: string[];
  depth: number;
  product: ProductNeighbourhood['product'];
  nodes: (Omit<ProductGraphNode, 'repo' | 'kind'> & { kind: string; repo?: string | null })[];
  edges: ProductGraphEdge[];
  unresolved: Unresolved[];
  repositories: RepositoryStanding[];
};

/**
 * P5's reader (PRD 1798, s5): a neighbourhood document of version 1 (`omni kb graph <id> --json`) or of
 * version 2 (the server's). A version 1 answer has no `unresolved` and no `repositories`, read as empty,
 * and no `repo` on a node. Any other version, or an unknown field, is refused with `null`.
 */
export function readNeighbourhood(value: unknown): ReadNeighbourhood | null {
  const two = ProductNeighbourhoodSchema.safeParse(value);
  if (two.success) return { ...two.data, version: 2 };
  const one = V1NeighbourhoodSchema.safeParse(value);
  return one.success ? { ...one.data, version: 1, unresolved: [], repositories: [] } : null;
}
