import { ProductNeighbourhoodSchema } from 'omni-loop/kit/lib/knowledge/product-graph.ts';
import { authenticate, type TokenCheck } from '../ask/auth';
import { refuse, reply } from '../business-api/reply';
import { archivedMessage } from '../business-api/read';
import { GRAPH_READ_REFUSALS, GraphQuerySchema, ProductKeySchema } from './product-graph.contract';
import type { ProductGraphService } from './product-graph.service';

// A product's knowledge graph, read at its HTTP edge (PRD 1798 s3; ADR-0095), as a plain function of a
// Request, so it is tested with a fake repository and the route under app/api/products/[key]/ stays one
// line:
//
//   GET /api/products/<key>/knowledge/graph?id=…&depth=…
//     → 200 {version: 2, shape: 'neighbourhood', repo: null, start, depth, product, nodes, edges, unresolved, repositories}
//
// `omni kb graph --product <key>` calls it with the terminal's sign-in (a bearer token). The sign-in is
// checked first, then the query, and only then is anything read, as the caller, never with a service
// key: row-level security decides which product, links, graphs and knowledge they read (law
// BR-PRODUCT-63), so a product of another workspace is one that does not exist. The answer is checked
// against the kit's own schema before it leaves, and nothing is written.
//
// Refusals follow ADR-0029, each `{error}` in plain words: 400 no `id`, or a `depth` outside 1 to 3; 401
// no valid sign-in; 404 a product key the caller cannot read, the same answer as for one that does not
// exist; 404 an `id` absent from the joined graph, naming the prefixed ids a bare one stands for; 503 no database here, or the sign-in service down;
// 500 a failed read, logged. An archived product (PRD 2232) answers 404 too, with `Product <name> is archived: an
// owner restores it on its page.`, its owner included.

/** A client acting as one access token: the Auth server's check and the reads as that person. */
type CallerClient = TokenCheck & { service: ProductGraphService };

export type ProductGraphDeps = {
  /** A client acting as the given access token, or null when no database is configured. */
  connect: ((token: string) => CallerClient) | null;
  log: (line: string) => void;
};

/** The answer for a product the caller cannot read, or that does not exist: one and the same. */
const noProduct = (key: string) => refuse(404, `No product ${key} that you can read.`);

/** The answer for an id the graph does not hold, naming the prefixed ids a bare one stands for (#2221). */
function noNode(id: string, key: string, matches: readonly string[]) {
  const hint = matches.length === 0 ? '' : ` Did you mean ${matches.join(' or ')}?`;
  return refuse(404, `No node ${id} in the knowledge graph of ${key}.${hint}`);
}

/** The query's node and depth, or the refusal its first problem is. */
function queryOf(params: URLSearchParams) {
  const parsed = GraphQuerySchema.safeParse({ id: params.get('id') ?? '', depth: params.get('depth') ?? undefined });
  if (parsed.success) return parsed.data;
  return refuse(400, parsed.error.issues[0]?.path[0] === 'depth' ? GRAPH_READ_REFUSALS.depth : GRAPH_READ_REFUSALS.id);
}

/** GET: the neighbourhood of one node of the product keyed `key`, across every repository of the product. */
export async function readProductGraph(request: Request, key: string, deps: ProductGraphDeps): Promise<Response> {
  if (!deps.connect) return refuse(503, GRAPH_READ_REFUSALS.noDatabase);
  const auth = await authenticate(request.headers.get('authorization'), deps.connect);
  if (!auth.ok) return refuse(auth.status, auth.error);
  const query = queryOf(new URL(request.url).searchParams);
  if (query instanceof Response) return query;
  if (!ProductKeySchema.safeParse(key).success) return noProduct(key);
  try {
    const read = await deps.connect(auth.caller.token).service.neighbourhood({ key }, query);
    if (read.kind === 'no-product') return noProduct(key);
    if (read.kind === 'archived') return refuse(404, archivedMessage(read.name));
    if (read.kind === 'no-node') return noNode(query.id, key, read.matches);
    return reply(200, ProductNeighbourhoodSchema.parse(read.body));
  } catch (error) {
    deps.log(`knowledge-graphs: ${key}: ${error instanceof Error ? error.message : String(error)}`);
    return refuse(500, GRAPH_READ_REFUSALS.notRead);
  }
}
