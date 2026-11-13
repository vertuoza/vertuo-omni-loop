import { z } from 'zod';
import { refuse, reply } from '../business-api/reply';
import { searchCategoryFor, type SearchDomain } from '../jev/decisions/search-category';
import { decide, type JevDecideDeps } from '../jev/resolve';
import { STAGE_SIGNATURE_HEADER, verifySignature } from '../stages/event/event';

// The App's search categorizer (PRD omni-loop-7 s2), as a plain function of a Request, so it is tested with
// injected dependencies and app/api/search/categorize/route.ts stays one line:
//
//   POST /api/search/categorize {workspaceId, productId, question}
//     → 200 {category: <a domain key of the product> | "other" | null, decidedBy, confidence}
//
// omni-app's `search-categorize` job calls it for each logged search it has grouped, signed as
// /api/laws/judge is (an HMAC-SHA256 over the exact body, `sha256=<hex>` in x-omni-signature-256), under
// its own shared secret SEARCH_CATEGORIZE_SECRET, since only Galaxy holds a workspace's sealed Jev key.
// It runs the workspace's `search-category` decision (../jev/decisions/search-category.ts) over the
// product's domains. The category is `null` when the decision is Off (or only in Shadow, which logs Jev's
// answer beside none), when the workspace has no Jev key or no service role is here, when Jev did not
// answer, answered outside the options or under the floor: the row then keeps no category.
//
// The question is never logged here, in a refusal or an answer (L-GDPR-2). Refusals, each `{error}` in
// plain words: 401 no secret here, or a missing or wrong signature; 400 a malformed body; 413 a body
// past its cap; 500 the product's domains could not be read.

export const SEARCH_CATEGORIZE_SIGNATURE_HEADER = STAGE_SIGNATURE_HEADER;
export const SEARCH_CATEGORIZE_SECRET_VAR = 'SEARCH_CATEGORIZE_SECRET';

/** The body's cap: a question of at most 2000 characters, two ids, and room for the keys. */
const MAX_BODY_BYTES = 16 * 1024;

const BODY = z.object({
  workspaceId: z.uuid(),
  productId: z.uuid(),
  question: z.string().trim().min(1).max(2000),
}).strict();

export type SearchCategorizeDeps = {
  /** SEARCH_CATEGORIZE_SECRET; unset, every call is refused. */
  secret: string | undefined;
  /** The resolver's dependencies, or null without the service role: no category. */
  jev: JevDecideDeps | null;
  /** The active domains of a product of a workspace, in their order. */
  domainsOf: (workspaceId: string, productId: string) => Promise<SearchDomain[]>;
  log?: (line: string) => void;
};

const NONE = { category: null, confidence: null, decidedBy: 'old' } as const;

const why = (error: unknown) => (error instanceof Error ? (error.message.split('\n')[0] ?? '') : 'unknown error');

export async function searchCategorizeRoute(request: Request, deps: SearchCategorizeDeps): Promise<Response> {
  const log = deps.log ?? console.error;
  if (!deps.secret) {
    log(`search categorize: ${SEARCH_CATEGORIZE_SECRET_VAR} is not set on this deployment, every call is refused`);
    return refuse(401, 'The search categorizer is not open here.');
  }
  const text = await request.text();
  if (!verifySignature(deps.secret, text, request.headers.get(SEARCH_CATEGORIZE_SIGNATURE_HEADER))) return refuse(401, 'Bad signature.');
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return refuse(413, `A categorize call carries ${MAX_BODY_BYTES / 1024} KiB at most.`);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return refuse(400, 'The body must be JSON.');
  }
  const body = BODY.safeParse(json);
  if (!body.success) return refuse(400, 'The body must be {workspaceId, productId, question}: two ids and the question.');
  const { workspaceId, productId, question } = body.data;
  if (!deps.jev) return reply(200, NONE);

  let domains: SearchDomain[];
  try {
    domains = await deps.domainsOf(workspaceId, productId);
  } catch (error) {
    log(`search categorize: the domains of a product could not be read — ${why(error)}`);
    return refuse(500, 'The product\'s domains could not be read. Try again.');
  }
  const counted = await decide(deps.jev, {
    workspace: workspaceId,
    entry: searchCategoryFor(domains),
    input: { question },
    old: () => Promise.resolve(null),
    ref: null,
  });
  if (counted.decidedBy !== 'jev' || counted.value === null) return reply(200, NONE);
  return reply(200, { category: counted.value, confidence: counted.confidence, decidedBy: 'jev' });
}
