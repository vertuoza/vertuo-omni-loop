import { z } from 'zod';

// The knowledge graph push's contract (PRD 1798; ADR-0095): what the kit's `omni kb graph push` sends to
// `POST /api/knowledge/graphs`, and what it answers. The graph itself is read by the kit's own schema
// (omni-loop/kit/lib/knowledge/graph-schema.ts: P5's version 1 nodes and edges, shape
// `repository`), so the server reads exactly what the kit builds; here it is only a JSON object, checked
// after the rest so its problem names the graph's own field. Browser-safe: zod only.

/** The largest push: a large knowledge base's whole graph, with room to spare. */
export const MAX_GRAPH_PUSH_BYTES = 2 * 1024 * 1024;

/** `{repo, commit, graph}`: the repository (owner/name), the full commit the graph was built from, the graph. */
export const GraphPushSchema = z.strictObject({
  repo: z.string().max(200).regex(/^[\w.-]+\/[\w.-]+$/, 'owner/name'),
  commit: z.string().regex(/^[0-9a-fA-F]{40}$/, 'the full 40-character commit'),
  graph: z.record(z.string(), z.unknown()),
});

/** A product the pushed graph is served in, and its Knowledge tab. */
const ServedInSchema = z.strictObject({ key: z.string().min(1).nullable(), href: z.string().min(1) });

/** The answer: the repository and commit as stored (lower case), the graph's counts, its products. */
export const GraphPushReplySchema = z.strictObject({
  repo: z.string().min(1),
  commit: z.string().regex(/^[0-9a-f]{40}$/),
  nodes: z.number().int().min(0),
  edges: z.number().int().min(0),
  products: z.array(ServedInSchema),
});

/** The refusals a push answers with, by status. */
export const GRAPH_PUSH_REFUSALS = Object.freeze({ malformed: 400, forbidden: 403, database: 500 } as const);
export type GraphPushRefusal = keyof typeof GRAPH_PUSH_REFUSALS;
