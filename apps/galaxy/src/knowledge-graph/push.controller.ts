import { graphProblem, RepositoryGraphSchema } from 'vertuo-omni-plan/kit/lib/knowledge/graph-schema.ts';
import { callerOrigin, type TokenCheck } from '../ask/auth';
import { reply } from '../business-api/reply';
import { bodyOf, receivePush, refuse } from '../data/kit-push';
import { GRAPH_PUSH_REFUSALS, GraphPushReplySchema, GraphPushSchema, MAX_GRAPH_PUSH_BYTES } from './push.contract';
import type { GraphPushService } from './push.service';

// A repository's knowledge graph, pushed at its HTTP edge (PRD 1798; ADR-0095), as a plain function of a
// Request, so it is tested with a fake service and the route under app/api/knowledge/graphs/ stays one
// line:
//
//   POST /api/knowledge/graphs {repo, commit, graph}
//     → 200 {repo, commit, nodes, edges, products: [{key, href}]}
//
// The kit's `omni kb graph push` sends it with the terminal's sign-in (a bearer token): the repository's
// slug, its HEAD commit and its whole graph, read here by the kit's own schema (P5's version 1 nodes and
// edges, shape `repository`), so an unknown field anywhere is refused. The sign-in is checked first, then
// the size, then the body, and only then is anything stored, as the caller, never with a service key: the
// database refuses a repository no workspace of the caller lists (law BR-PRODUCT-63). `products` are the
// caller's own workspaces' products serving the repository's knowledge, each with its Knowledge tab; a
// repository in no product is stored, and `products` is empty.
//
// Refusals follow ADR-0029, each `{error}` in plain words: 400 a malformed body or graph, 401 no valid
// sign-in, 403 a repository no workspace of the caller lists, 413 a body over 2 MiB, 503 no database here
// or the sign-in service down, 500 the database failed, logged.

/** A client acting as one access token: the Auth server's check and the push as that person. */
type CallerClient = TokenCheck & { service: GraphPushService };

export type GraphPushDeps = {
  /** A client acting as the given access token, or null when no database is configured. */
  connect: ((token: string) => CallerClient) | null;
  log: (line: string) => void;
};

const NO_DATABASE = 'Knowledge graphs are not available here: this deployment has no database.';
const NOT_STORED = 'The knowledge graph could not be stored. Try again.';

/** POST /api/knowledge/graphs: keeps the repository's graph at its commit. */
export async function pushKnowledgeGraph(request: Request, deps: GraphPushDeps): Promise<Response> {
  const received = await receivePush(request, deps.connect, { unavailable: NO_DATABASE, maxBytes: MAX_GRAPH_PUSH_BYTES });
  if (received instanceof Response) return received;
  const body = bodyOf(GraphPushSchema, received.sent, 'A knowledge graph push');
  if ('problem' in body) return refuse(400, body.problem);
  const graph = RepositoryGraphSchema.safeParse(body.graph);
  if (!graph.success) return refuse(400, graphProblem(graph.error));
  try {
    const kept = await received.client().service.push({ repo: body.repo, commit: body.commit, graph: graph.data });
    if (!kept.ok) {
      if (kept.cause !== null) deps.log(`knowledge-graphs: ${body.repo}: ${kept.cause}`);
      return refuse(GRAPH_PUSH_REFUSALS[kept.kind], kept.error);
    }
    const origin = callerOrigin(request);
    const products = kept.value.products.map(({ id, key }) => ({ key, href: `${origin}/app/products/${encodeURIComponent(id)}/knowledge` }));
    return reply(200, GraphPushReplySchema.parse({ ...kept.value, products }));
  } catch (error) {
    deps.log(`knowledge-graphs: ${body.repo}: ${error instanceof Error ? error.message : String(error)}`);
    return refuse(GRAPH_PUSH_REFUSALS.database, NOT_STORED);
  }
}
