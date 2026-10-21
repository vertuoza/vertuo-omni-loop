import { z } from 'zod';
import { PRODUCT_GRAPH_DEPTH } from 'omni-loop/kit/lib/knowledge/product-graph.ts';

// The product graph's read contract (PRD 1798 s3; ADR-0095): what
// `GET /api/products/<key>/knowledge/graph?id=…&depth=…` takes. Its answer is the kit's own schema
// (omni-loop/kit/lib/knowledge/product-graph.ts: P5's neighbourhood at version 2), so the CLI reads
// exactly what the server sends. Browser-safe: zod only.

/** A product's key, as products.key holds it (supabase/migrations/20261203100000_product_prd_ids.sql). */
export const ProductKeySchema = z.string().max(40).regex(/^[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*$/);

/** The depths a walk takes, as the query spells them. */
const DEPTHS = Array.from({ length: PRODUCT_GRAPH_DEPTH.most }, (_, at) => String(at + 1));

/** `id`, the node to walk out of (a repository node's prefixed id, a Legal id or `term:<word>`), and `depth`, 1 by default. */
export const GraphQuerySchema = z.object({
  id: z.string().trim().min(1, 'id').max(500, 'id'),
  depth: z.string().refine((depth) => DEPTHS.includes(depth), 'depth').optional().transform((depth) => (depth === undefined ? PRODUCT_GRAPH_DEPTH.fallback : Number(depth))),
});

/** The refusals, in plain words. */
export const GRAPH_READ_REFUSALS = Object.freeze({
  id: 'Name the node as `id=<id>`: a repository node’s id (`vertuo-omni-loop/BR-PRODUCT-3`), a Legal id (`L-INVOICING-1`) or `term:<word>`.',
  depth: `The depth is a whole number from 1 to ${String(PRODUCT_GRAPH_DEPTH.most)}.`,
  noDatabase: 'Knowledge graphs are not available here: this deployment has no database.',
  notRead: 'The knowledge graph could not be read. Try again.',
} as const);
