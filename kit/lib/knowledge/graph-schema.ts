/**
 * **A repository's whole knowledge graph, as it is pushed** (PRD 1798, P6): the schema
 * `omni kb graph push` sends under `graph` and `POST /api/knowledge/graphs` reads it with.
 *
 * ```text
 * { version: 1, shape: 'repository', nodes: [{id, kind, label, status, file, origin}], edges: [{from, to, kind}] }
 * ```
 *
 * It is P5's neighbourhood (`neighbourhood.ts`) at its version, with every node and edge of the
 * repository rather than one walk: no `start`, `depth` or `hop`. The repository's slug and commit
 * travel beside it, never in it, and so does nothing of the product: its Legal entries and Glossary
 * terms are the server's own (P3), so a node read from the product (`origin: 'product'`) is refused,
 * while an edge may still end at a Legal id (`L-INVOICING-1`) or a term (`term:<word>`), which the
 * server joins to the product's own nodes. Every other end of an edge is a node of the graph, and no
 * node id is used twice. Strict throughout: an unknown field is refused, so a graph from a later
 * version is never half read.
 */
import { z } from 'zod';
import { LEGAL_ID_SHAPE } from './registers.ts';
import { NEIGHBOURHOOD_VERSION, type EdgeKind, type NodeKind, type NodeStatus } from './neighbourhood.ts';

/** The shape of a whole repository's graph, beside P5's `neighbourhood`. */
export const GRAPH_SHAPE = 'repository';

const NODE_KINDS = ['principle', 'rule', 'invariant', 'legal', 'contract', 'test', 'path', 'schema', 'screen', 'adr', 'term'] as const satisfies readonly NodeKind[];
const EDGE_KINDS = ['serves', 'enforced-by', 'governs', 'points-to', 'cites', 'sibling', 'screen', 'same-prd', 'uses-term'] as const satisfies readonly EdgeKind[];
const STATUSES = ['law', 'rule', 'proposed'] as const satisfies readonly NodeStatus[];

/** A node's id: a register id, or a leaf's `<kind>:<what>`. */
const NodeId = z.string().min(1).max(500);

const GraphNodeSchema = z.strictObject({
  id: NodeId,
  kind: z.enum(NODE_KINDS),
  label: z.string().max(5000).nullable(),
  status: z.enum(STATUSES).nullable(),
  file: z.string().min(1).max(1000).nullable(),
  origin: z.literal('repository'),
});
export type GraphNode = z.infer<typeof GraphNodeSchema>;

const GraphEdgeSchema = z.strictObject({ from: NodeId, to: NodeId, kind: z.enum(EDGE_KINDS) });
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;

/** An end the product holds rather than the repository: a Legal entry's id or a Glossary term. */
const isProductEnd = (id: string): boolean => LEGAL_ID_SHAPE.test(id) || /^term:\S/.test(id);

/** Refuses a node id used twice, and an edge end that is neither a node nor the product's. */
function wellJoined(graph: { nodes: readonly GraphNode[]; edges: readonly GraphEdge[] }, ctx: z.RefinementCtx): void {
  const ids = new Set<string>();
  graph.nodes.forEach((node, at) => {
    if (ids.has(node.id)) ctx.addIssue({ code: 'custom', message: `${node.id} is a node twice`, path: ['nodes', at, 'id'] });
    ids.add(node.id);
  });
  graph.edges.forEach((edge, at) => {
    for (const end of ['from', 'to'] as const) {
      const id = edge[end];
      if (!ids.has(id) && !isProductEnd(id)) ctx.addIssue({ code: 'custom', message: `${id} is no node of the graph`, path: ['edges', at, end] });
    }
  });
}

export const RepositoryGraphSchema = z.strictObject({
  version: z.literal(NEIGHBOURHOOD_VERSION),
  shape: z.literal(GRAPH_SHAPE),
  nodes: z.array(GraphNodeSchema).max(50_000),
  edges: z.array(GraphEdgeSchema).max(200_000),
}).superRefine(wellJoined);
export type RepositoryGraph = z.infer<typeof RepositoryGraphSchema>;

const ITEM: Readonly<Record<string, string>> = { nodes: 'node', edges: 'edge' };

/** The first problem zod found in a graph, in one plain line naming the field. */
export function graphProblem(error: z.ZodError): string {
  const issue = error.issues[0];
  const path = issue?.path ?? [];
  if (issue?.code === 'unrecognized_keys') {
    const [list, at] = path;
    const where = typeof list === 'string' && typeof at === 'number' && ITEM[list] ? `The graph's ${ITEM[list]} ${String(at + 1)}` : 'The graph';
    return `${where} does not carry ${issue.keys.join(', ')}.`;
  }
  const message = issue?.message ?? 'see the schema';
  return path.length === 0 ? `The graph is malformed: ${message}.` : `The graph's \`${path.join('.')}\` is malformed: ${message}.`;
}
